import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';
import { query } from '../database/db.js';
import pool from '../database/db.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class DockerManager {
  constructor() {
    this.composeDir = process.env.COMPOSE_FILES_DIR || path.join(__dirname, '../docker-instances');
    this.portRangeStart = parseInt(process.env.PORT_RANGE_START) || 9000;

    // Ensure compose directory exists
    if (!fs.existsSync(this.composeDir)) {
      fs.mkdirSync(this.composeDir, { recursive: true });
    }
  }

  /**
   * Get the next available port set for a new user with database locking
   */
  async getNextAvailablePorts(client = null) {
    // If no client provided, use standalone query (legacy behavior)
    if (!client) {
      const result = await query(
        'SELECT api_port, postgres_port, redis_port FROM evolution_instances ORDER BY api_port DESC LIMIT 1'
      );

      if (result.rows.length === 0) {
        return {
          apiPort: this.portRangeStart,
          postgresPort: this.portRangeStart + 1,
          redisPort: this.portRangeStart + 2
        };
      }

      const lastPort = result.rows[0].api_port;
      return {
        apiPort: lastPort + 3,
        postgresPort: lastPort + 4,
        redisPort: lastPort + 5
      };
    }

    // Use SELECT FOR UPDATE to lock the row and prevent race conditions
    const result = await client.query(
      'SELECT api_port, postgres_port, redis_port FROM evolution_instances ORDER BY api_port DESC LIMIT 1 FOR UPDATE'
    );

    if (result.rows.length === 0) {
      // First user instance
      return {
        apiPort: this.portRangeStart,
        postgresPort: this.portRangeStart + 1,
        redisPort: this.portRangeStart + 2
      };
    }

    const lastPort = result.rows[0].api_port;
    return {
      apiPort: lastPort + 3,
      postgresPort: lastPort + 4,
      redisPort: lastPort + 5
    };
  }

  /**
   * Generate a unique instance name for a user
   */
  generateInstanceName(userId, username) {
    return `whatchat_${username.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${userId}`;
  }

  /**
   * Generate a secure API key
   */
  generateApiKey() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let apiKey = '';
    for (let i = 0; i < 32; i++) {
      apiKey += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return apiKey;
  }

  /**
   * Create docker-compose.yml file for a user's Evolution API instance
   */
  async createDockerComposeFile(userId, username, ports, apiKey) {
    const instanceName = this.generateInstanceName(userId, username);
    const postgresPassword = this.generateApiKey();

    const composeConfig = {
      version: '3.8',
      services: {
        postgres: {
          image: process.env.EVOLUTION_POSTGRES_IMAGE || 'postgres:15-alpine',
          container_name: `${instanceName}_postgres`,
          environment: {
            POSTGRES_USER: `user_${userId}`,
            POSTGRES_PASSWORD: postgresPassword,
            POSTGRES_DB: `evolution_${userId}`,
            PGDATA: '/var/lib/postgresql/data/pgdata'
          },
          volumes: [`${instanceName}_postgres_data:/var/lib/postgresql/data`],
          networks: [`${instanceName}_network`],
          restart: 'unless-stopped',
          ports: [`${ports.postgresPort}:5432`],
          healthcheck: {
            test: ['CMD-SHELL', `pg_isready -U user_${userId}`],
            interval: '10s',
            timeout: '5s',
            retries: 5
          }
        },
        redis: {
          image: process.env.EVOLUTION_REDIS_IMAGE || 'redis:7-alpine',
          container_name: `${instanceName}_redis`,
          command: 'redis-server --appendonly yes',
          volumes: [`${instanceName}_redis_data:/data`],
          networks: [`${instanceName}_network`],
          restart: 'unless-stopped',
          ports: [`${ports.redisPort}:6379`],
          healthcheck: {
            test: ['CMD', 'redis-cli', 'ping'],
            interval: '10s',
            timeout: '5s',
            retries: 5
          }
        },
        evolution_api: {
          image: process.env.EVOLUTION_BASE_IMAGE || 'atendai/evolution-api:latest',
          container_name: `${instanceName}_api`,
          ports: [`${ports.apiPort}:8080`],
          environment: {
            SERVER_URL: `http://localhost:${ports.apiPort}`,
            SERVER_PORT: '8080',
            AUTHENTICATION_API_KEY: apiKey,
            DATABASE_ENABLED: 'true',
            DATABASE_PROVIDER: 'postgresql',
            DATABASE_CONNECTION_URI: `postgresql://user_${userId}:${postgresPassword}@postgres:5432/evolution_${userId}`,
            DATABASE_SAVE_DATA_INSTANCE: 'true',
            DATABASE_SAVE_DATA_NEW_MESSAGE: 'true',
            DATABASE_SAVE_MESSAGE_UPDATE: 'true',
            DATABASE_SAVE_DATA_CONTACTS: 'true',
            DATABASE_SAVE_DATA_CHATS: 'true',
            CACHE_REDIS_ENABLED: 'true',
            CACHE_REDIS_URI: 'redis://redis:6379',
            CACHE_REDIS_PREFIX_KEY: `evolution_${userId}`,
            CACHE_REDIS_SAVE_INSTANCES: 'true',
            WEBHOOK_GLOBAL_ENABLED: 'false',
            WEBSOCKET_ENABLED: 'false',
            RABBITMQ_ENABLED: 'false',
            SQS_ENABLED: 'false',
            TYPEBOT_ENABLED: 'false',
            CHATWOOT_ENABLED: 'false',
            PROXY_ENABLED: 'false',
            CONFIG_SESSION_PHONE_VERSION: '2.3000.1026080446',
            LOG_LEVEL: 'INFO',
            LOG_COLOR: 'true',
            LOG_BAILEYS: 'error',
            DEL_INSTANCE: 'false',
            DEL_TEMP_INSTANCES: 'true',
            STORE_MESSAGES: 'true',
            STORE_MESSAGE_UP: 'true',
            STORE_CONTACTS: 'true',
            STORE_CHATS: 'true',
            CLEAN_STORE_CLEANING_INTERVAL: '7200',
            CLEAN_STORE_MESSAGES: 'true',
            CLEAN_STORE_MESSAGE_UP: 'true',
            CLEAN_STORE_CONTACTS: 'true',
            CLEAN_STORE_CHATS: 'true'
          },
          volumes: [
            `${instanceName}_instances:/evolution/instances`,
            `${instanceName}_store:/evolution/store`
          ],
          networks: [`${instanceName}_network`],
          depends_on: {
            postgres: { condition: 'service_healthy' },
            redis: { condition: 'service_healthy' }
          },
          restart: 'unless-stopped',
          healthcheck: {
            test: ['CMD-SHELL', 'curl -f http://localhost:8080 || exit 1'],
            interval: '30s',
            timeout: '10s',
            retries: 3,
            start_period: '40s'
          }
        }
      },
      networks: {
        [`${instanceName}_network`]: {
          driver: 'bridge',
          name: `${instanceName}_network`
        }
      },
      volumes: {
        [`${instanceName}_postgres_data`]: { name: `${instanceName}_postgres_data` },
        [`${instanceName}_redis_data`]: { name: `${instanceName}_redis_data` },
        [`${instanceName}_instances`]: { name: `${instanceName}_instances_data` },
        [`${instanceName}_store`]: { name: `${instanceName}_store_data` }
      }
    };

    // Write to file
    const composeFilePath = path.join(this.composeDir, `${instanceName}.yml`);
    const yamlContent = yaml.dump(composeConfig, { indent: 2 });
    fs.writeFileSync(composeFilePath, yamlContent, 'utf8');

    return composeFilePath;
  }

  /**
   * Start Docker containers for a user with proper project naming
   */
  async startInstance(composeFilePath) {
    try {
      // Extract instance name from compose file path to use as project name
      const fileName = path.basename(composeFilePath, '.yml');

      // Use --project-name to ensure each user's containers are isolated
      const command = `docker-compose -f "${composeFilePath}" --project-name "${fileName}" up -d`;
      const { stdout, stderr } = await execAsync(command);

      console.log('Docker compose up output:', stdout);
      if (stderr) console.error('Docker compose stderr:', stderr);

      // Wait a bit for containers to start
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Get container IDs
      const containerIds = await this.getContainerIds(composeFilePath, fileName);

      return {
        success: true,
        containerIds
      };
    } catch (error) {
      console.error('Failed to start Docker instance:', error);
      throw new Error(`Failed to start Docker instance: ${error.message}`);
    }
  }

  /**
   * Get container IDs from a running compose file
   */
  async getContainerIds(composeFilePath, projectName) {
    try {
      const { stdout } = await execAsync(`docker-compose -f "${composeFilePath}" --project-name "${projectName}" ps -q`);
      const ids = stdout.trim().split('\n').filter(id => id.length > 0);

      return {
        api: ids[0] || null,
        postgres: ids[1] || null,
        redis: ids[2] || null
      };
    } catch (error) {
      console.error('Failed to get container IDs:', error);
      return { api: null, postgres: null, redis: null };
    }
  }

  /**
   * Stop and remove Docker containers for a user
   */
  async stopInstance(composeFilePath) {
    try {
      // Extract instance name from compose file path to use as project name
      const fileName = path.basename(composeFilePath, '.yml');

      const command = `docker-compose -f "${composeFilePath}" --project-name "${fileName}" down`;
      const { stdout, stderr } = await execAsync(command);

      console.log('Docker compose down output:', stdout);
      if (stderr) console.error('Docker compose stderr:', stderr);

      return { success: true };
    } catch (error) {
      console.error('Failed to stop Docker instance:', error);
      throw new Error(`Failed to stop Docker instance: ${error.message}`);
    }
  }

  /**
   * Create a complete Evolution API instance for a user with proper locking
   */
  async createUserInstance(userId, username) {
    const client = await pool.connect();

    try {
      // Start transaction with serializable isolation to prevent race conditions
      await client.query('BEGIN');
      await client.query('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE');

      // Get available ports with row-level lock
      const ports = await this.getNextAvailablePorts(client);

      // Generate API key
      const apiKey = this.generateApiKey();

      // Generate instance name
      const instanceName = this.generateInstanceName(userId, username);

      // Reserve the ports in database BEFORE creating Docker containers
      await client.query(
        `INSERT INTO evolution_instances (
          user_id, instance_name, api_key, api_port, postgres_port, redis_port,
          compose_file_path, connection_status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          userId,
          instanceName,
          apiKey,
          ports.apiPort,
          ports.postgresPort,
          ports.redisPort,
          '', // Will update after compose file is created
          'creating'
        ]
      );

      // Commit transaction to release locks
      await client.query('COMMIT');

      // Now create docker-compose file (outside transaction)
      const composeFilePath = await this.createDockerComposeFile(
        userId,
        username,
        ports,
        apiKey
      );

      // Update compose file path
      await query(
        'UPDATE evolution_instances SET compose_file_path = $1 WHERE user_id = $2',
        [composeFilePath, userId]
      );

      // Start Docker containers
      const dockerResult = await this.startInstance(composeFilePath);

      // Update with container IDs and status
      await query(
        `UPDATE evolution_instances SET
          container_id_api = $1,
          container_id_postgres = $2,
          container_id_redis = $3,
          connection_status = $4
        WHERE user_id = $5`,
        [
          dockerResult.containerIds.api,
          dockerResult.containerIds.postgres,
          dockerResult.containerIds.redis,
          'disconnected',
          userId
        ]
      );

      return {
        success: true,
        instance: {
          instanceName,
          apiPort: ports.apiPort,
          apiKey,
          apiUrl: `http://localhost:${ports.apiPort}`
        }
      };

    } catch (error) {
      // Rollback transaction on error
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('Rollback error:', rollbackError);
      }

      console.error('Failed to create user instance:', error);
      throw error;
    } finally {
      // Release the client back to the pool
      client.release();
    }
  }
}

export default new DockerManager();
