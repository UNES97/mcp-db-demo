import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function initializeDatabaseSchema(): Promise<void> {
  const dbName = process.env.DB_NAME || 'compass_db';
  const baseConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true
  };

  try {
    // First try connecting WITH the database name
    let connConfig: any = { ...baseConfig, database: dbName };
    let connection;

    try {
      connection = await mysql.createConnection(connConfig);
    } catch (e: any) {
      // If access denied on the DB, try without database to check if we can connect at all
      if (e.code === 'ER_DBACCESS_DENIED_ERROR') {
        console.log(`⚠ User "${baseConfig.user}" cannot access database "${dbName}"`);

        // Connect without database and find one we CAN access
        const probeConn = await mysql.createConnection(baseConfig);
        const [dbs]: any = await probeConn.query('SHOW DATABASES');
        const available = dbs.map((r: any) => r.Database).filter((d: string) =>
          !['information_schema', 'mysql', 'performance_schema', 'sys'].includes(d)
        );
        console.log(`  Available databases: ${available.join(', ') || 'none'}`);

        if (available.length > 0) {
          const useDb = available[0];
          console.log(`  Using "${useDb}" instead`);
          await probeConn.query(`USE \`${useDb}\``);
          connConfig = { ...baseConfig, database: useDb };
          await probeConn.end();
          connection = await mysql.createConnection(connConfig);
        } else {
          // Try to create it
          try {
            await probeConn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
            console.log(`  Created database "${dbName}"`);
            await probeConn.end();
            connection = await mysql.createConnection(connConfig);
          } catch (e2) {
            await probeConn.end();
            console.error(`  No accessible database found. Set MYSQL_DATABASE=${dbName} on your MySQL service.`);
            throw e;
          }
        }
      } else {
        throw e;
      }
    }

    // Check if data already exists
    try {
      const [rows]: any = await connection.query('SELECT COUNT(*) AS c FROM argo_carrier_visit');
      if (rows[0]?.c > 0) {
        console.log(`✓ Database "${dbName}" has data (${rows[0].c} visits) — skipping reimport`);
        await connection.end();
        return;
      }
    } catch (e) {
      // Table doesn't exist — proceed with import
    }

    console.log(`📦 Importing demo data into "${dbName}"...`);

    // Try to increase packet size
    try { await connection.query('SET GLOBAL max_allowed_packet = 67108864'); } catch (e) {}
    try { await connection.query('SET SESSION max_allowed_packet = 67108864'); } catch (e) {}

    const sqlFilePath = path.join(__dirname, '../demo_database.sql');
    let sqlContent = fs.readFileSync(sqlFilePath, 'utf8');

    // Strip any DROP/CREATE DATABASE and USE statements
    sqlContent = sqlContent.replace(/DROP\s+DATABASE\s+[^;]+;/gi, '');
    sqlContent = sqlContent.replace(/CREATE\s+DATABASE\s+[^;]+;/gi, '');
    sqlContent = sqlContent.replace(/USE\s+`?\w+`?\s*;/gi, '');

    await connection.query(sqlContent);

    // Shift dates so data is centered around today
    const anchorDate = new Date('2026-03-29');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffDays = Math.round((today.getTime() - anchorDate.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays !== 0) {
      console.log(`  Shifting dates by ${diffDays} days...`);
      const dateCols: [string, string[]][] = [
        ['argo_carrier_visit', ['ata', 'atd']],
        ['argo_visit_details', ['eta', 'etd', 'ata', 'atd']],
        ['inv_move_event', ['t_fetch', 't_put', 't_discharge']],
        ['inv_unit_fcy_visit', ['time_in', 'time_out']],
        ['road_truck_transactions', ['handled', 'time_in', 'time_out']],
        ['vsl_crane_statistics_delays', ['delay_date']],
      ];
      for (const [table, cols] of dateCols) {
        for (const col of cols) {
          try {
            await connection.query(`UPDATE \`${table}\` SET \`${col}\` = DATE_ADD(\`${col}\`, INTERVAL ${diffDays} DAY) WHERE \`${col}\` IS NOT NULL`);
          } catch (e) {}
        }
      }
    }

    await connection.end();
    console.log('✓ Database imported successfully!');
  } catch (error) {
    console.error('Database init error:', error);
    throw error;
  }
}
