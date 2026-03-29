import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function initializeDatabaseSchema(): Promise<void> {
  const dbName = process.env.DB_NAME || 'compass_db';
  const connConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: dbName,
    multipleStatements: true
  };

  try {
    // Check if database already has data — skip reimport if so
    const checkConn = await mysql.createConnection(connConfig);
    try {
      const [rows]: any = await checkConn.query('SELECT COUNT(*) AS c FROM argo_carrier_visit');
      if (rows[0]?.c > 0) {
        console.log(`✓ Database already has data (${rows[0].c} visits) — skipping reimport`);
        await checkConn.end();
        return;
      }
    } catch (e) {
      // Table doesn't exist — proceed with import
    }
    await checkConn.end();

    console.log('📦 Initializing database schema...');

    // Try to increase max_allowed_packet (may fail without SUPER privilege — that's ok)
    const setupConn = await mysql.createConnection(connConfig);
    try {
      await setupConn.query('SET GLOBAL max_allowed_packet = 67108864');
    } catch (e) {
      console.log('⚠ Could not SET GLOBAL max_allowed_packet (no SUPER privilege) — using session setting');
    }
    await setupConn.end();

    const connection = await mysql.createConnection({
      ...connConfig,
      maxAllowedPacket: 64 * 1024 * 1024,
    } as any);
    // Also try session-level setting
    try { await connection.query('SET SESSION max_allowed_packet = 67108864'); } catch (e) {}

    const sqlFilePath = path.join(__dirname, '../demo_database.sql');
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
    await connection.query(sqlContent);
    await connection.end();

    console.log('✓ Database schema imported successfully with fresh data!');
  } catch (error) {
    console.error('Error initializing database schema:', error);
    throw error;
  }
}
