import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { query } from '../database/db.js';
import { authMiddleware } from '../middleware/auth.js';
import dockerManager from '../services/dockerManager.js';

const router = express.Router();

// Generate JWT token
const generateToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      username: user.username
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// Sign Up
router.post('/signup', async (req, res) => {
  try {
    const { email, username, password } = req.body;

    // Validation
    if (!email || !username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email, username, and password are required'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters'
      });
    }

    // Check if user already exists
    const existingUser = await query(
      'SELECT id FROM users WHERE email = $1 OR username = $2',
      [email, username]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Email or username already exists'
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const result = await query(
      `INSERT INTO users (email, username, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, email, username, created_at`,
      [email, username, passwordHash]
    );

    const user = result.rows[0];

    // Generate token
    const token = generateToken(user);

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: {
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          createdAt: user.created_at
        },
        token
      }
    });

  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during signup'
    });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    // Find user
    const result = await query(
      'SELECT id, email, username, password_hash, is_active FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    const user = result.rows[0];

    // Check if user is active
    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        message: 'Account is deactivated'
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Generate token
    const token = generateToken(user);

    // Check if user has an Evolution instance, create one if not
    try {
      const instanceCheck = await query(
        'SELECT id FROM evolution_instances WHERE user_id = $1',
        [user.id]
      );

      if (instanceCheck.rows.length === 0) {
        console.log(`🔄 No Evolution instance found for user ${user.username}, creating one...`);

        // Create instance asynchronously with retry logic (don't block login response)
        const createInstanceWithRetry = async (retries = 3) => {
          for (let attempt = 1; attempt <= retries; attempt++) {
            try {
              const result = await dockerManager.createUserInstance(user.id, user.username);
              console.log(`✅ Evolution instance created for user ${user.username}:`, result.instance.instanceName);
              return;
            } catch (err) {
              // Check if it's a serialization error (code 40001)
              if (err.code === '40001' && attempt < retries) {
                console.log(`⚠️ Serialization conflict for user ${user.username}, retrying (${attempt}/${retries})...`);
                // Wait before retry with exponential backoff
                await new Promise(resolve => setTimeout(resolve, 100 * attempt));
                continue;
              }
              console.error(`❌ Failed to create Evolution instance for user ${user.username}:`, err.message);
              break;
            }
          }
        };

        createInstanceWithRetry();
      }
    } catch (instanceError) {
      console.error('Error checking/creating Evolution instance:', instanceError);
      // Don't fail login if instance creation fails
    }

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user.id,
          email: user.email,
          username: user.username
        },
        token
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login'
    });
  }
});

// Get Current User (protected route)
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const result = await query(
      'SELECT id, email, username, created_at FROM users WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: {
        user: result.rows[0]
      }
    });

  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

export default router;
