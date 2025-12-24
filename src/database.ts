import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

export interface DatabaseConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  connectionLimit: number;
}

let pool: mysql.Pool | null = null;

export async function initializeDatabase(): Promise<void> {
  const config: DatabaseConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || '',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || '',
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '10'),
  };

  if (!config.user || !config.password || !config.database) {
    throw new Error('Database configuration is incomplete. Please check your .env file.');
  }

  try {
    pool = mysql.createPool(config);

    // Test the connection
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();

    console.error('Database pool created successfully');
  } catch (error) {
    console.error('Error creating database pool:', error);
    throw error;
  }
}

export async function executeQuery<T = any>(
  sql: string,
  params: any[] = []
): Promise<T[]> {
  try {
    if (!pool) {
      throw new Error('Database pool not initialized');
    }

    const [rows] = await pool.execute(sql, params);
    return rows as T[];
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
}

export async function closeDatabase(): Promise<void> {
  if (pool) {
    try {
      await pool.end();
      pool = null;
      console.error('Database pool closed');
    } catch (error) {
      console.error('Error closing database pool:', error);
      throw error;
    }
  }
}
