import express from 'express';
import axios from 'axios';
import { authMiddleware } from '../middleware/auth.js';
import { query } from '../database/db.js';
import dockerManager from '../services/dockerManager.js';

const router = express.Router();

/**
 * Get user's Evolution API instance details
 */
router.get('/instance', authMiddleware, async (req, res) => {
  try {
    const result = await query(
      `SELECT instance_name, api_port, api_key, connection_status, qr_code, phone_number, created_at
       FROM evolution_instances WHERE user_id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.json({
        success: true,
        data: { hasInstance: false }
      });
    }

    const instance = result.rows[0];

    res.json({
      success: true,
      data: {
        hasInstance: true,
        instance: {
          name: instance.instance_name,
          port: instance.api_port,
          apiKey: instance.api_key,
          status: instance.connection_status,
          qrCode: instance.qr_code,
          phoneNumber: instance.phone_number,
          url: `http://localhost:${instance.api_port}`,
          createdAt: instance.created_at
        }
      }
    });

  } catch (error) {
    console.error('Get instance error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get instance details'
    });
  }
});

/**
 * Create Evolution API instance for user
 */
router.post('/instance/create', authMiddleware, async (req, res) => {
  try {
    // Check if user already has an instance
    const existing = await query(
      'SELECT id FROM evolution_instances WHERE user_id = $1',
      [req.user.id]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'User already has an Evolution API instance'
      });
    }

    // Create new instance
    const result = await dockerManager.createUserInstance(req.user.id, req.user.username);

    res.status(201).json({
      success: true,
      message: 'Evolution API instance created successfully',
      data: result.instance
    });

  } catch (error) {
    console.error('Create instance error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create Evolution API instance',
      error: error.message
    });
  }
});

/**
 * Proxy requests to user's Evolution API instance
 */
router.all('/proxy/*', authMiddleware, async (req, res) => {
  try {
    // Get user's instance details
    const result = await query(
      'SELECT api_port, api_key FROM evolution_instances WHERE user_id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No Evolution API instance found for this user'
      });
    }

    const { api_port, api_key } = result.rows[0];

    // Extract the path after /proxy/
    const proxyPath = req.params[0];
    const targetUrl = `http://localhost:${api_port}/${proxyPath}`;

    // Prepare headers
    const headers = {
      'apikey': api_key,
      'Content-Type': req.headers['content-type'] || 'application/json'
    };

    // Make request to Evolution API
    const axiosConfig = {
      method: req.method,
      url: targetUrl,
      headers,
      params: req.query,
      data: req.body,
      validateStatus: () => true // Accept all status codes
    };

    const response = await axios(axiosConfig);

    // Forward the response
    res.status(response.status).json(response.data);

  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({
      success: false,
      message: 'Proxy request failed',
      error: error.message
    });
  }
});

export default router;
