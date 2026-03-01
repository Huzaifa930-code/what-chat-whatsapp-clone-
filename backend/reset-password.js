import bcrypt from 'bcrypt';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Client } = pg;

async function resetPassword() {
  // Get credentials from command line arguments or environment variables
  const email = process.argv[2] || process.env.RESET_EMAIL;
  const newPassword = process.argv[3] || process.env.RESET_PASSWORD;

  if (!email || !newPassword) {
    console.error('❌ Error: Email and new password are required');
    console.log('\nUsage: node reset-password.js <email> <new-password>');
    console.log('Example: node reset-password.js user@example.com newpassword123');
    process.exit(1);
  }

  // Generate hash
  const passwordHash = await bcrypt.hash(newPassword, 10);
  console.log('Generated hash:', passwordHash);

  // Connect to database
  const client = new Client({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  await client.connect();

  // Update password
  await client.query(
    'UPDATE users SET password_hash = $1 WHERE email = $2',
    [passwordHash, email]
  );

  console.log(`✅ Password reset for ${email}`);
  console.log(`New password: ${newPassword}`);

  // Test login
  const result = await client.query(
    'SELECT password_hash FROM users WHERE email = $1',
    [email]
  );

  const isValid = await bcrypt.compare(newPassword, result.rows[0].password_hash);
  console.log('Password validation test:', isValid ? '✅ SUCCESS' : '❌ FAILED');

  await client.end();
}

resetPassword().catch(console.error);
