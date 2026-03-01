import bcrypt from 'bcrypt';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Client } = pg;

async function createAdmin() {
  // Get credentials from command line arguments or environment variables
  const email = process.argv[2] || process.env.ADMIN_EMAIL;
  const username = process.argv[3] || process.env.ADMIN_USERNAME;
  const password = process.argv[4] || process.env.ADMIN_PASSWORD;

  if (!email || !username || !password) {
    console.error('❌ Error: Email, username, and password are required');
    console.log('\nUsage: node create-admin.js <email> <username> <password>');
    console.log('Example: node create-admin.js admin@example.com admin mypassword');
    process.exit(1);
  }

  // Generate hash
  const passwordHash = await bcrypt.hash(password, 10);
  console.log('Creating admin user...');

  // Connect to database
  const client = new Client({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  await client.connect();

  // Check if user exists
  const checkResult = await client.query(
    'SELECT id FROM users WHERE email = $1',
    [email]
  );

  if (checkResult.rows.length > 0) {
    // Update existing user
    await client.query(
      'UPDATE users SET password_hash = $1, username = $2, is_active = true WHERE email = $3',
      [passwordHash, username, email]
    );
    console.log(`✅ Admin user updated: ${email}`);
  } else {
    // Create new user
    await client.query(
      'INSERT INTO users (email, username, password_hash) VALUES ($1, $2, $3)',
      [email, username, passwordHash]
    );
    console.log(`✅ Admin user created: ${email}`);
  }

  console.log(`   Email: ${email}`);
  console.log(`   Username: ${username}`);
  console.log(`   Password: ${password}`);

  await client.end();
}

createAdmin().catch(console.error);
