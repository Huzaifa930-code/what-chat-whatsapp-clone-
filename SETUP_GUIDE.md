# WhatsApp Multi-User System - Phase 1 Setup Guide

## Quick Start Overview

This guide will help you set up a multi-user WhatsApp system where each user gets their own isolated Evolution API instance.

**What we're building:**
- Backend API with user authentication (JWT)
- Database for users and Evolution API instances
- Automatic Docker instance creation per user
- Login/signup pages in React frontend
- Complete isolation between users

## Current State

✅ Your existing single-user setup in `D:\projects\what chat\`:
- Evolution API on port 8080
- PostgreSQL on port 5432
- Redis on port 6379
- **This stays untouched as your personal instance**

## Setup Steps

### Step 1: Install Backend Dependencies

```bash
cd D:\projects\whatchat-new\backend
npm install
```

### Step 2: Set Up System Database

Create a new PostgreSQL instance for storing user accounts and instance metadata.

Create file: `D:\projects\whatchat-new\backend\docker-compose-system-db.yml`

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    container_name: whatchat_system_db
    environment:
      POSTGRES_USER: whatchat_admin
      POSTGRES_PASSWORD: YourSecurePassword123
      POSTGRES_DB: whatchat_system
    ports:
      - "5433:5432"
    volumes:
      - whatchat_system_data:/var/lib/postgresql/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U whatchat_admin"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  whatchat_system_data:
```

Start the system database:
```bash
cd D:\projects\whatchat-new\backend
docker-compose -f docker-compose-system-db.yml up -d
```

### Step 3: Configure Environment

```bash
cd D:\projects\whatchat-new\backend
cp .env.example .env
```

Edit `.env`:
```env
PORT=4000
NODE_ENV=development

# Change this to a secure random string!
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=7d

# System Database (from Step 2)
DB_HOST=localhost
DB_PORT=5433
DB_USER=whatchat_admin
DB_PASSWORD=YourSecurePassword123
DB_NAME=whatchat_system

# Evolution API Settings
EVOLUTION_BASE_IMAGE=atendai/evolution-api:latest
EVOLUTION_POSTGRES_IMAGE=postgres:15-alpine
EVOLUTION_REDIS_IMAGE=redis:7-alpine

# Port allocation for new users
PORT_RANGE_START=9000

# Docker files location
COMPOSE_FILES_DIR=D:/projects/whatchat-new/backend/docker-instances
```

### Step 4: Initialize Database Schema

```bash
cd D:\projects\whatchat-new\backend
npm run db:init
```

Expected output:
```
Connecting to PostgreSQL...
Creating database whatchat_system...
Database created successfully!
Running schema migrations...
Schema created successfully!
✅ Database initialization completed!
```

### Step 5: Start Backend Server

```bash
cd D:\projects\whatchat-new\backend
npm run dev
```

Expected output:
```
🚀 WhatsApp Multi-User Backend running on port 4000
   Environment: development
   Health check: http://localhost:4000/health
```

Test health endpoint:
```bash
curl http://localhost:4000/health
```

### Step 6: Update Frontend Configuration

Create `D:\projects\whatchat-new\.env`:
```env
VITE_API_URL=http://localhost:4000/api
```

### Step 7: Start Frontend

```bash
cd D:\projects\whatchat-new
npm run dev
```

Open browser to: http://localhost:5173

## Testing Phase 1

### Test 1: User Signup & Login

1. **Go to http://localhost:5173**
2. **Sign up as first user:**
   - Email: user1@test.com
   - Username: user1
   - Password: password123
3. **You should be logged in automatically**

### Test 2: Create Evolution Instance for User 1

Open a new terminal and test the API:

```bash
# Login to get token
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user1@test.com","password":"password123"}'
```

Copy the token from response, then create instance:

```bash
curl -X POST http://localhost:4000/api/evolution/instance/create \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json"
```

Expected response:
```json
{
  "success": true,
  "message": "Evolution API instance created successfully",
  "data": {
    "instance": {
      "instanceName": "whatchat_user1_1",
      "apiPort": 9000,
      "apiKey": "...",
      "apiUrl": "http://localhost:9000"
    }
  }
}
```

### Test 3: Verify Docker Containers

```bash
docker ps
```

You should see:
```
whatchat_user1_1_api        (port 9000)
whatchat_user1_1_postgres   (port 9001)
whatchat_user1_1_redis      (port 9002)
whatchat_system_db          (port 5433)
```

Plus your original:
```
evolution_api               (port 8080)
evolution_postgres          (port 5432)
evolution_redis             (port 6379)
```

### Test 4: Create Second User (Isolation Test)

1. **Logout from frontend**
2. **Sign up as second user:**
   - Email: user2@test.com
   - Username: user2
   - Password: password123

3. **Create instance for user2:**
```bash
# Login as user2
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user2@test.com","password":"password123"}'

# Create instance (use new token)
curl -X POST http://localhost:4000/api/evolution/instance/create \
  -H "Authorization: Bearer USER2_TOKEN_HERE" \
  -H "Content-Type: application/json"
```

User 2 should get ports: 9003, 9004, 9005

### Test 5: Verify Complete Isolation

```bash
docker ps
```

Now you should see:
- **user1 containers:** whatchat_user1_1_* (ports 9000-9002)
- **user2 containers:** whatchat_user2_2_* (ports 9003-9005)
- **system db:** whatchat_system_db (port 5433)
- **your personal:** evolution_* (ports 8080, 5432, 6379)

Each user's containers are on separate Docker networks, ensuring complete isolation.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    React Frontend (Port 5173)                │
│  - Login/Signup pages                                        │
│  - WhatsApp chat interface                                   │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  │ HTTP + JWT
                  ↓
┌─────────────────────────────────────────────────────────────┐
│              Node.js Backend (Port 4000)                     │
│  - User authentication (JWT)                                 │
│  - Docker instance management                                │
│  - Proxy to user's Evolution API                             │
└─────────────────┬───────────────────────────────────────────┘
                  │
        ┌─────────┴─────────┐
        ↓                   ↓
┌──────────────────┐  ┌──────────────────────────────────────┐
│  System Database │  │    Docker Instances (per user)       │
│  (Port 5433)     │  │                                      │
│  - users         │  │  User 1:                             │
│  - instances     │  │   - Evolution API (Port 9000)        │
└──────────────────┘  │   - PostgreSQL (Port 9001)           │
                      │   - Redis (Port 9002)                │
                      │                                      │
                      │  User 2:                             │
                      │   - Evolution API (Port 9003)        │
                      │   - PostgreSQL (Port 9004)           │
                      │   - Redis (Port 9005)                │
                      │                                      │
                      │  ... (ports 9006+)                   │
                      └──────────────────────────────────────┘
```

## What's Working (Phase 1)

✅ User signup and login with JWT
✅ Database schema for users and instances
✅ Docker Compose generation per user
✅ Automatic port allocation
✅ Login/Signup UI in React
✅ User isolation (separate containers, networks, databases)

## What's Next (Phase 2)

- [ ] Auto-create instance on signup
- [ ] Update frontend to use proxy endpoints
- [ ] QR code through backend proxy
- [ ] Real-time connection status
- [ ] Instance management (start/stop/restart)
- [ ] User dashboard showing instance status

## Troubleshooting

### Backend won't start
```bash
# Check if port 4000 is available
netstat -an | findstr "4000"

# Check system database is running
docker ps | findstr "whatchat_system_db"

# Check database connection
docker logs whatchat_system_db
```

### Frontend can't connect to backend
- Check backend is running on port 4000
- Check `.env` has `VITE_API_URL=http://localhost:4000/api`
- Restart frontend after changing .env

### Instance creation fails
```bash
# Check Docker is running
docker ps

# Check available ports
netstat -an | findstr "9000"

# Check backend logs for errors
# (Look in terminal where backend is running)

# Check docker-compose files were created
dir D:\projects\whatchat-new\backend\docker-instances
```

### Port conflicts
If ports 9000+ are already in use, edit `.env`:
```env
PORT_RANGE_START=10000
```

Then restart backend.

## File Structure

```
D:\projects\whatchat-new\
├── backend/
│   ├── database/
│   │   ├── schema.sql
│   │   ├── init.js
│   │   └── db.js
│   ├── middleware/
│   │   └── auth.js
│   ├── routes/
│   │   ├── auth.js
│   │   └── evolution.js
│   ├── services/
│   │   └── dockerManager.js
│   ├── docker-instances/          # Generated compose files
│   │   └── whatchat_user1_1.yml
│   ├── docker-compose-system-db.yml
│   ├── package.json
│   ├── server.js
│   └── .env
├── src/
│   ├── components/
│   │   ├── Login.jsx              # New
│   │   ├── Signup.jsx             # New
│   │   ├── ChatList.jsx
│   │   ├── ChatWindow.jsx
│   │   └── QRCode.jsx
│   ├── services/
│   │   ├── api.js                 # New
│   │   └── evolutionApi.js
│   └── App.jsx                    # Updated with auth
├── .env                           # New
└── package.json
```

## Need Help?

Check backend logs for errors:
- The terminal where you ran `npm run dev` in backend folder

Check database:
```bash
# Connect to system database
docker exec -it whatchat_system_db psql -U whatchat_admin -d whatchat_system

# List users
SELECT id, email, username, created_at FROM users;

# List instances
SELECT user_id, instance_name, api_port, connection_status FROM evolution_instances;

# Exit
\q
```

Check Docker containers:
```bash
# All running containers
docker ps

# Logs for a specific container
docker logs whatchat_user1_1_api

# Stop all user instances
docker-compose -f backend/docker-instances/whatchat_user1_1.yml down
```
