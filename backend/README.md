# WhatsApp Multi-User Backend - Phase 1 Setup Guide

## Overview
This backend enables multiple users to connect their own WhatsApp accounts through isolated Evolution API instances.

## Prerequisites
- Node.js 18+ installed
- Docker and Docker Compose installed
- PostgreSQL database (can run in Docker)
- Port range 9000-9999 available for user instances

## Phase 1 Setup Steps

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Set Up Main Application Database

First, create a PostgreSQL database for storing users and instance metadata. You can either:

**Option A: Use existing personal PostgreSQL**
If you want to use your existing Evolution Postgres (port 5432), use a different database:

**Option B: Create a separate PostgreSQL instance (Recommended)**
Create `D:\projects\whatchat-new\backend\docker-compose-system-db.yml`:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    container_name: whatchat_system_db
    environment:
      POSTGRES_USER: whatchat_admin
      POSTGRES_PASSWORD: secure_password_here
      POSTGRES_DB: whatchat_system
    ports:
      - "5433:5432"
    volumes:
      - whatchat_system_data:/var/lib/postgresql/data
    restart: unless-stopped

volumes:
  whatchat_system_data:
```

Start it:
```bash
docker-compose -f docker-compose-system-db.yml up -d
```

### 3. Configure Environment

Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Edit `.env` with your settings:
```env
PORT=4000
JWT_SECRET=your-very-secure-random-string-here

# If using Option B above:
DB_HOST=localhost
DB_PORT=5433
DB_USER=whatchat_admin
DB_PASSWORD=secure_password_here
DB_NAME=whatchat_system
```

### 4. Initialize Database

Run the schema initialization:
```bash
npm run db:init
```

This creates:
- `users` table
- `evolution_instances` table
- Necessary indexes and triggers

### 5. Start the Backend Server

```bash
npm run dev
```

The backend will start on http://localhost:4000

### 6. Test the API

**Health Check:**
```bash
curl http://localhost:4000/health
```

**Sign Up:**
```bash
curl -X POST http://localhost:4000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "username": "testuser",
    "password": "password123"
  }'
```

**Login:**
```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }'
```

## Phase 1 Testing Plan

### Manual Instance Creation Test

After signing up a test user, you can manually create their Evolution API instance:

1. **Get auth token from signup/login response**

2. **Create instance for the user:**
```bash
curl -X POST http://localhost:4000/api/evolution/instance/create \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json"
```

This will:
- Generate unique ports (e.g., 9000, 9001, 9002)
- Create `docker-compose` file in `backend/docker-instances/`
- Start Docker containers
- Save instance details to database

3. **Check running containers:**
```bash
docker ps
```

You should see 3 new containers:
- `whatchat_testuser_1_api`
- `whatchat_testuser_1_postgres`
- `whatchat_testuser_1_redis`

4. **Verify instance details:**
```bash
curl http://localhost:4000/api/evolution/instance \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### Testing 2-User Isolation

1. **Create User 1:**
   - Sign up as user1@example.com
   - Create instance (gets ports 9000-9002)

2. **Create User 2:**
   - Sign up as user2@example.com
   - Create instance (gets ports 9003-9005)

3. **Verify isolation:**
   - Each user has separate Docker containers
   - Each user has separate database
   - Containers are on separate networks
   - Users cannot access each other's Evolution API

## Project Structure

```
backend/
├── database/
│   ├── schema.sql        # Database schema
│   ├── init.js          # Database initialization script
│   └── db.js            # PostgreSQL connection pool
├── middleware/
│   └── auth.js          # JWT authentication middleware
├── routes/
│   ├── auth.js          # User signup/login endpoints
│   └── evolution.js     # Evolution API management
├── services/
│   └── dockerManager.js # Docker Compose generation & management
├── docker-instances/    # Generated docker-compose files (auto-created)
├── package.json
├── server.js            # Express server
└── .env                 # Configuration (create from .env.example)
```

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Create new user account
- `POST /api/auth/login` - Login and get JWT token
- `GET /api/auth/me` - Get current user info (protected)

### Evolution API Management
- `GET /api/evolution/instance` - Get user's instance details (protected)
- `POST /api/evolution/instance/create` - Create Evolution API instance (protected)
- `ALL /api/evolution/proxy/*` - Proxy requests to user's Evolution API (protected)

## Next Steps (Phase 2)

After Phase 1 is working:
1. Automatic instance creation on signup
2. Instance status monitoring
3. Connect frontend to use proxy endpoints
4. Handle QR code through proxy
5. Instance lifecycle management (start/stop/delete)
6. Resource cleanup on user deletion

## Troubleshooting

**Database connection failed:**
- Verify PostgreSQL is running
- Check DB_HOST, DB_PORT in .env
- Ensure firewall allows connections

**Docker containers won't start:**
- Check ports are available: `netstat -an | findstr "9000"`
- Verify Docker is running: `docker ps`
- Check Docker Compose logs: `docker-compose -f backend/docker-instances/[file].yml logs`

**Port conflicts:**
- Edit PORT_RANGE_START in .env
- Ensure chosen range doesn't conflict with existing services

## Security Notes

- Change JWT_SECRET in production
- Use strong database passwords
- Never commit .env file
- Keep API keys secure
- Consider rate limiting for production
