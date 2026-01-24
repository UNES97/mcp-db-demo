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
    console.log('📦 Initializing database schema...');

    // Drop all tables to ensure fresh import (tables will be dropped by demo_database.sql)
    // Read the SQL file
    const sqlFilePath = path.join(__dirname, '../demo_database.sql');
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');

    // Execute the SQL file (it already contains DROP TABLE IF EXISTS statements)
    await connection.query(sqlContent);

    console.log('✓ Database schema imported successfully with fresh data!');
  } catch (error) {
    console.error('Error initializing database schema:', error);
    throw error;
  } finally {
    await connection.end();
  }
}
