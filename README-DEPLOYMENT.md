# Deployment Guide

## Deploying to Coolify

### Step 1: Create MySQL Database in Coolify
1. In Coolify, go to your project
2. Add a new **MySQL** service
3. Note the database credentials

### Step 2: Deploy the Application
1. Add a new **Application** service
2. Connect your Git repository
3. Coolify will auto-detect the Dockerfile

### Step 3: Set Environment Variables
In Coolify, add these environment variables:

```
NODE_ENV=production
CHAT_SERVER_PORT=3000

# Database (from your Coolify MySQL service)
DB_HOST=mysql  # or the internal hostname Coolify provides
DB_PORT=3306
DB_USER=your_mysql_user
DB_PASSWORD=your_mysql_password
DB_NAME=apm_terminal
DB_CONNECTION_LIMIT=10

# AI Provider - use "OPENAI" or "DEEPSEEK"
AI_PROVIDER=DEEPSEEK

# API Keys (add the one you're using)
DEEPSEEK_API_KEY=your_deepseek_api_key_here
# OR for OpenAI:
# OPENAI_API_KEY=your_openai_api_key_here
```

### Step 4: Initialize Database
After the first deployment, you need to import the database schema:

1. Find your MySQL container in Coolify
2. Use the SQL import feature to upload `demo_database.sql`

OR connect via command line:
```bash
mysql -h [mysql-host] -u [user] -p [database] < demo_database.sql
```

### Exposed Port
Your app runs on port **3000** - make sure Coolify exposes this port.

## Local Development with Docker Compose

For local testing, use docker-compose:

```bash
# Create .env file with your settings
cp .env.example .env

# Start services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

The app will be available at:
- App: http://localhost:3000
- MySQL: localhost:3307
