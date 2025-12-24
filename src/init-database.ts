import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function initializeDatabaseSchema(): Promise<void> {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'apm_terminal',
    multipleStatements: true
  });

  try {
    // Check if tables exist
    const [rows] = await connection.query(
      "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = ? AND table_name = 'argo_carrier_visit'",
      [process.env.DB_NAME || 'apm_terminal']
    );

    const tableExists = (rows as any)[0].count > 0;

    if (!tableExists) {
      console.log('📦 Database tables not found. Importing schema...');

      // Read the SQL file
      const sqlFilePath = path.join(__dirname, '../demo_database.sql');
      const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');

      // Execute the SQL file
      await connection.query(sqlContent);

      console.log('✓ Database schema imported successfully!');
    } else {
      console.log('✓ Database tables already exist');
    }
  } catch (error) {
    console.error('Error initializing database schema:', error);
    throw error;
  } finally {
    await connection.end();
  }
}
