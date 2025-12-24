# Docker Deployment Guide

This guide explains how to deploy the APM Terminal MCP Server using Docker and Docker Compose.

## Prerequisites

- Docker Engine 20.10 or higher
- Docker Compose 2.0 or higher
- At least 2GB of available RAM
- 5GB of available disk space

## Quick Start

### 1. Configure Environment Variables

Copy the example environment file and configure your settings:

```bash
cp .env.example .env
```

Edit `.env` and set your API keys:

```bash
# Required: Set your AI API key
OPENAI_API_KEY=your-deepseek-or-openai-key-here

# For DeepSeek (recommended, cheaper)
OPENAI_BASE_URL=https://api.deepseek.com/v1
AI_MODEL=deepseek-chat

# Or for OpenAI
# OPENAI_BASE_URL=https://api.openai.com/v1
# AI_MODEL=gpt-4o-mini

# Optional: Customize ports if needed
MYSQL_PORT=3307
APP_PORT=3000

# Optional: Change database credentials
MYSQL_ROOT_PASSWORD=root
MYSQL_USER=apm_user
MYSQL_PASSWORD=apm_password
```

### 2. Build and Start Services

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Check service status
docker-compose ps
```

### 3. Access the Application

Once the services are running:

- **Web Interface**: http://localhost:3000
- **API Health Check**: http://localhost:3000/api/health
- **MySQL Database**: localhost:3307 (from host machine)

### 4. Stop Services

```bash
# Stop services (keeps data)
docker-compose stop

# Stop and remove containers (keeps data volumes)
docker-compose down

# Stop and remove everything including data
docker-compose down -v
```

## Service Details

### MySQL Database (mysql)

- **Image**: mysql:5.7
- **Container Name**: apm-terminal-mysql
- **Port**: 3307 (host) → 3306 (container)
- **Database**: apm_terminal
- **Auto-initialization**: Runs `demo_database.sql` on first start

**Default Credentials:**
- Root Password: `root`
- User: `apm_user`
- Password: `apm_password`

### Application Server (app)

- **Container Name**: apm-terminal-app
- **Port**: 3000 (host) → 3000 (container)
- **Health Check**: Automated health monitoring
- **Restart Policy**: Restarts automatically unless manually stopped

## Advanced Usage

### View Real-time Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f app
docker-compose logs -f mysql
```

### Execute Commands in Containers

```bash
# Access MySQL CLI
docker-compose exec mysql mysql -u apm_user -p apm_terminal

# Access application shell
docker-compose exec app sh

# Run npm commands
docker-compose exec app npm run build
```

### Rebuild After Code Changes

```bash
# Rebuild application container
docker-compose up -d --build app

# Rebuild everything
docker-compose up -d --build
```

### Database Management

#### Backup Database

```bash
docker-compose exec mysql mysqldump -u root -proot apm_terminal > backup.sql
```

#### Restore Database

```bash
docker-compose exec -T mysql mysql -u root -proot apm_terminal < backup.sql
```

#### Reset Database

```bash
# Stop services
docker-compose down

# Remove MySQL data volume
docker volume rm mcp_mysql_data

# Start services (will reinitialize database)
docker-compose up -d
```

### Custom Database Initialization

To use a different database schema:

1. Modify `demo_database.sql` with your schema
2. Remove the existing MySQL data volume:
   ```bash
   docker-compose down -v
   ```
3. Restart services:
   ```bash
   docker-compose up -d
   ```

## Environment Variables Reference

### Application Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Node environment | `production` |
| `PORT` | Application port | `3000` |
| `DB_HOST` | MySQL host | `mysql` |
| `DB_PORT` | MySQL port | `3306` |
| `DB_USER` | Database user | `apm_user` |
| `DB_PASSWORD` | Database password | `apm_password` |
| `DB_NAME` | Database name | `apm_terminal` |
| `OPENAI_API_KEY` | AI API key | *Required* |
| `OPENAI_BASE_URL` | AI API endpoint | DeepSeek/OpenAI |
| `AI_MODEL` | AI model name | `deepseek-chat` |

### Docker Compose Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MYSQL_ROOT_PASSWORD` | MySQL root password | `root` |
| `MYSQL_USER` | MySQL user | `apm_user` |
| `MYSQL_PASSWORD` | MySQL password | `apm_password` |
| `MYSQL_PORT` | MySQL host port | `3307` |
| `APP_PORT` | App host port | `3000` |

## Networking

Services communicate via the `apm-network` bridge network:

```
┌─────────────────────────────────────────┐
│          Docker Network (bridge)        │
│                                         │
│  ┌─────────────┐      ┌──────────────┐ │
│  │     App     │─────▶│    MySQL     │ │
│  │  (Node.js)  │      │   (5.7)      │ │
│  └─────────────┘      └──────────────┘ │
│         │                               │
└─────────┼───────────────────────────────┘
          │
          ▼
    Host Port 3000
```

## Troubleshooting

### Port Already in Use

If ports 3000 or 3307 are already in use:

```bash
# Change ports in .env file
APP_PORT=3001
MYSQL_PORT=3308

# Restart services
docker-compose down
docker-compose up -d
```

### Database Connection Failed

1. Check MySQL is healthy:
   ```bash
   docker-compose ps
   docker-compose logs mysql
   ```

2. Verify credentials in `.env` match docker-compose configuration

3. Wait for MySQL to fully initialize (30-60 seconds on first start)

### Application Won't Start

1. Check logs:
   ```bash
   docker-compose logs app
   ```

2. Verify API key is set:
   ```bash
   docker-compose exec app env | grep OPENAI_API_KEY
   ```

3. Rebuild container:
   ```bash
   docker-compose up -d --build app
   ```

### Permission Issues

If you encounter permission errors:

```bash
# Fix file ownership (Linux/macOS)
sudo chown -R $USER:$USER .

# Rebuild with no cache
docker-compose build --no-cache
```

## Production Deployment

### Security Recommendations

1. **Change default passwords**:
   ```bash
   MYSQL_ROOT_PASSWORD=<strong-random-password>
   MYSQL_PASSWORD=<strong-random-password>
   ```

2. **Use secrets management** (Docker Swarm or Kubernetes secrets)

3. **Enable SSL/TLS** with a reverse proxy (nginx, Traefik)

4. **Regular backups**:
   ```bash
   # Add to crontab
   0 2 * * * docker-compose exec mysql mysqldump -u root -p$MYSQL_ROOT_PASSWORD apm_terminal > /backups/apm_$(date +\%Y\%m\%d).sql
   ```

5. **Monitor logs** with a logging service (ELK stack, Loki, etc.)

### Resource Limits

Add resource limits to `docker-compose.yml`:

```yaml
services:
  app:
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M

  mysql:
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M
```

### Using a Reverse Proxy

Example nginx configuration:

```nginx
server {
    listen 80;
    server_name apm-terminal.example.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Scaling

To run multiple application instances behind a load balancer:

```bash
# Scale to 3 instances
docker-compose up -d --scale app=3

# Use nginx/HAProxy for load balancing
```

## Support

For issues or questions:
- Check logs: `docker-compose logs -f`
- Verify health: `docker-compose ps`
- Review configuration: `docker-compose config`
