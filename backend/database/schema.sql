-- Multi-User WhatsApp System Database Schema

-- Users Table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true
);

-- Evolution Instances Table
CREATE TABLE evolution_instances (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    instance_name VARCHAR(100) UNIQUE NOT NULL,
    api_key VARCHAR(255) NOT NULL,
    api_port INTEGER UNIQUE NOT NULL,
    postgres_port INTEGER UNIQUE NOT NULL,
    redis_port INTEGER UNIQUE NOT NULL,
    container_id_api VARCHAR(255),
    container_id_postgres VARCHAR(255),
    container_id_redis VARCHAR(255),
    connection_status VARCHAR(50) DEFAULT 'disconnected', -- disconnected, connecting, connected
    qr_code TEXT,
    phone_number VARCHAR(50),
    compose_file_path VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id) -- One instance per user for now
);

-- Indexes for better query performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_evolution_instances_user_id ON evolution_instances(user_id);
CREATE INDEX idx_evolution_instances_instance_name ON evolution_instances(instance_name);

-- Update timestamp trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_evolution_instances_updated_at BEFORE UPDATE ON evolution_instances
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
