import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Client } = pg;

async function initDatabase() {
  // First connect to postgres database to create our database
  const adminClient = new Client({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: 'postgres'
  });

  try {
    console.log('Connecting to PostgreSQL...');
    await adminClient.connect();

    // Check if database exists
    const dbCheckResult = await adminClient.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [process.env.DB_NAME]
    );

    if (dbCheckResult.rows.length === 0) {
      console.log(`Creating database ${process.env.DB_NAME}...`);
      await adminClient.query(`CREATE DATABASE ${process.env.DB_NAME}`);
      console.log('Database created successfully!');
    } else {
      console.log(`Database ${process.env.DB_NAME} already exists.`);
    }

    await adminClient.end();

    // Now connect to the actual database and run schema
    const client = new Client({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });

    await client.connect();

    console.log('Running schema migrations...');
    const schemaSQL = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await client.query(schemaSQL);
    console.log('Schema created successfully!');

    await client.end();
    console.log('\n✅ Database initialization completed!');

  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    process.exit(1);
  }
}

initDatabase();
