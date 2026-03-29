import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function initializeDatabaseSchema(): Promise<void> {
  const connConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true
  };

  try {
    // Check if database already has data — skip reimport if so
    const checkConn = await mysql.createConnection(connConfig);
    try {
      const [rows]: any = await checkConn.query('SELECT COUNT(*) AS c FROM compass_db.argo_carrier_visit');
      if (rows[0]?.c > 0) {
        console.log(`✓ Database already has data (${rows[0].c} visits) — skipping reimport`);
        await checkConn.end();
        return;
      }
    } catch (e) {
      // Database or table doesn't exist — proceed with import
    }
    await checkConn.end();

    console.log('📦 Initializing database schema...');

    const setupConn = await mysql.createConnection(connConfig);
    await setupConn.query('SET GLOBAL max_allowed_packet = 67108864');
    await setupConn.end();

    const connection = await mysql.createConnection(connConfig);
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
