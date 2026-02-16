# CTIAS Lab Production Operations Guide

## Quick Start for Production

### System Requirements

**Minimum:**
- 4 CPU cores
- 8 GB RAM
- 50 GB storage
- Docker 20.10+
- Docker Compose 2.0+

**Recommended:**
- 8 CPU cores
- 16 GB RAM
- 100 GB SSD storage
- Kubernetes cluster (for high availability)

### Installation

1. **Clone and Configure**

```bash
git clone https://github.com/pangerlkr/ctias-lab.git
cd ctias-lab

# Copy and edit environment file
cp .env.example .env
nano .env  # Update with production values
```

2. **Update Critical Settings**

At minimum, change these in `.env`:
- `JWT_SECRET` - Generate with: `openssl rand -hex 32`
- `POSTGRES_PASSWORD` - Use a strong password
- `ADMIN_PASSWORD` - Use a strong password
- `CORS_ORIGINS` - Set to your actual domain

3. **Deploy**

```bash
# Start all services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f
```

4. **Verify Deployment**

```bash
# Check API health
curl http://localhost:8000/health

# Check frontend
curl http://localhost:3000
```

### Service Endpoints

| Service | URL | Description |
|---------|-----|-------------|
| Frontend | http://localhost:3000 | Web UI |
| Gateway API | http://localhost:8000 | REST API |
| API Docs | http://localhost:8000/docs | OpenAPI/Swagger |
| PostgreSQL | localhost:5432 | Database |
| Redis | localhost:6379 | Cache |

## Production Checklist

### Before Going Live

- [ ] Change all default passwords and secrets
- [ ] Configure CORS for your domain only
- [ ] Set up SSL/TLS certificates (use Let's Encrypt)
- [ ] Configure firewall rules
- [ ] Set up monitoring (Prometheus/Grafana)
- [ ] Configure log aggregation (ELK/Loki)
- [ ] Set up automated backups
- [ ] Create admin accounts
- [ ] Test disaster recovery procedures
- [ ] Review security settings
- [ ] Load test the system
- [ ] Set up uptime monitoring

### Security Hardening

1. **Network Security**
   - Use HTTPS/TLS everywhere
   - Restrict database access to internal network
   - Use VPN for administrative access
   - Configure firewall rules

2. **Application Security**
   - Enable rate limiting
   - Implement authentication/authorization
   - Validate all inputs
   - Keep dependencies updated
   - Regular security scans

3. **Data Security**
   - Encrypt data at rest
   - Encrypt data in transit
   - Regular backups with encryption
   - Secure key management

## Daily Operations

### Monitoring

**Health Checks:**
```bash
# Check all services
docker-compose ps

# API health
curl http://localhost:8000/health

# Check logs for errors
docker-compose logs --tail=100 gateway | grep ERROR
```

**Resource Usage:**
```bash
# Container stats
docker stats

# Disk usage
df -h

# Database size
docker exec ctias-postgres psql -U ctias -d ctias_lab -c \
  "SELECT pg_size_pretty(pg_database_size('ctias_lab'));"
```

### Backups

**Manual Backup:**
```bash
# Database
docker exec ctias-postgres pg_dump -U ctias ctias_lab > \
  backup-$(date +%Y%m%d-%H%M%S).sql

# Compress
gzip backup-*.sql
```

**Automated Backup Script:**
```bash
#!/bin/bash
# backup.sh - Add to cron for daily backups

BACKUP_DIR="/backups"
DATE=$(date +%Y%m%d-%H%M%S)

# Database backup
docker exec ctias-postgres pg_dump -U ctias ctias_lab | \
  gzip > $BACKUP_DIR/ctias-db-$DATE.sql.gz

# Keep only last 7 days
find $BACKUP_DIR -name "ctias-db-*.sql.gz" -mtime +7 -delete

echo "Backup completed: ctias-db-$DATE.sql.gz"
```

**Add to crontab:**
```bash
# Run daily at 2 AM
0 2 * * * /path/to/backup.sh
```

### Updates

**Updating the Application:**
```bash
# Pull latest code
git pull origin main

# Rebuild and restart
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# Verify
docker-compose ps
curl http://localhost:8000/health
```

**Database Migrations:**
```bash
# If using Alembic
docker exec ctias-gateway alembic upgrade head
```

### Log Management

**View Logs:**
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f gateway

# Last N lines
docker-compose logs --tail=100 gateway

# Search for errors
docker-compose logs gateway | grep -i error
```

**Log Rotation:**
Configure in `/etc/docker/daemon.json`:
```json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
```

## Troubleshooting

### Common Issues

**1. Service Won't Start**
```bash
# Check logs
docker-compose logs <service-name>

# Verify environment
docker-compose config

# Recreate service
docker-compose up -d --force-recreate <service-name>
```

**2. Database Connection Errors**
```bash
# Check database is running
docker-compose ps postgres

# Test connection
docker exec -it ctias-postgres psql -U ctias -d ctias_lab

# Check credentials in .env
grep DATABASE_URL .env
```

**3. Out of Memory**
```bash
# Check memory usage
docker stats

# Restart services
docker-compose restart

# Increase memory limits in docker-compose.yml
```

**4. High CPU Usage**
```bash
# Identify culprit
docker stats

# Check for runaway queries
docker exec ctias-postgres psql -U ctias -d ctias_lab -c \
  "SELECT pid, query FROM pg_stat_activity WHERE state = 'active';"
```

**5. Disk Space Full**
```bash
# Check disk usage
df -h

# Clean Docker resources
docker system prune -a --volumes

# Remove old logs
docker-compose logs > /dev/null 2>&1
```

### Performance Issues

**Slow API Responses:**
1. Check database query performance
2. Verify Redis is responding
3. Check CPU/memory usage
4. Review application logs
5. Enable query logging

**Database Performance:**
```bash
# Vacuum and analyze
docker exec ctias-postgres psql -U ctias -d ctias_lab -c \
  "VACUUM ANALYZE;"

# Check slow queries
docker exec ctias-postgres psql -U ctias -d ctias_lab -c \
  "SELECT query, calls, total_time, mean_time FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"
```

## Scaling

### Horizontal Scaling

**Scale API Gateway:**
```bash
docker-compose up -d --scale gateway=3
```

**Load Balancing:**
Use nginx or Traefik as reverse proxy:

```nginx
upstream gateway {
    server localhost:8000;
    server localhost:8001;
    server localhost:8002;
}

server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://gateway;
    }
}
```

### Vertical Scaling

Edit `docker-compose.yml`:
```yaml
gateway:
  deploy:
    resources:
      limits:
        cpus: '2'
        memory: 2G
      reservations:
        cpus: '1'
        memory: 1G
```

## Disaster Recovery

### Restore from Backup

**Database:**
```bash
# Stop services
docker-compose stop gateway

# Restore database
gunzip < backup-20240101.sql.gz | \
  docker exec -i ctias-postgres psql -U ctias -d ctias_lab

# Restart services
docker-compose start gateway
```

### Full System Recovery

1. Install Docker and Docker Compose
2. Clone repository
3. Copy backed up `.env` file
4. Restore database from backup
5. Start services
6. Verify functionality

## Monitoring Setup

### Prometheus + Grafana

Add to `docker-compose.yml`:

```yaml
  prometheus:
    image: prom/prometheus
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    ports:
      - "9090:9090"

  grafana:
    image: grafana/grafana
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
```

### Alerting

Configure alerts for:
- API response time > 2s
- Error rate > 5%
- Database connections > 80% max
- Disk usage > 80%
- Memory usage > 90%

## Maintenance Windows

### Planned Maintenance

1. Announce maintenance window
2. Set API to read-only mode
3. Backup database
4. Perform updates
5. Test functionality
6. Resume normal operations
7. Monitor for issues

### Emergency Maintenance

1. Take backup if possible
2. Perform necessary fixes
3. Restore from backup if needed
4. Verify functionality
5. Document incident

## Support

**Documentation:**
- [Deployment Guide](./DEPLOYMENT.md)
- [Architecture](./ARCHITECTURE.md)
- [Security](../SECURITY.md)

**Contact:**
- Email: contact@pangerlkr.link
- GitHub Issues: https://github.com/pangerlkr/ctias-lab/issues

## Version History

- v1.0.0 - Initial production release
  - Gateway API with health checks
  - IOC analysis endpoints
  - Reconnaissance capabilities
  - Database models
  - Docker deployment
  - Security hardening
