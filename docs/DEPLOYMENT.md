# CTIAS Lab Deployment Guide

## Production Deployment Checklist

### Pre-Deployment

- [ ] Review and update `.env` file with production values
- [ ] Change all default passwords and secrets
- [ ] Configure CORS origins appropriately
- [ ] Set up SSL/TLS certificates
- [ ] Review security settings
- [ ] Set up monitoring and logging
- [ ] Configure backup strategy

### Security Configuration

#### 1. Environment Variables

Copy `.env.example` to `.env` and update:

```bash
cp .env.example .env
```

**Critical variables to change:**

- `JWT_SECRET`: Use a strong, random 32+ character string
- `POSTGRES_PASSWORD`: Use a strong password
- `ADMIN_PASSWORD`: Use a strong password
- `CORS_ORIGINS`: Set to your actual frontend domain(s)

Generate secure secrets:
```bash
# Generate JWT secret
openssl rand -hex 32

# Generate password
openssl rand -base64 24
```

#### 2. Database Security

- Use strong passwords
- Restrict database access to internal network only
- Enable SSL/TLS for database connections
- Regular backups with encryption
- Use connection pooling

#### 3. API Security

- Configure rate limiting appropriately
- Use HTTPS/TLS in production
- Implement authentication and authorization
- Validate all inputs
- Sanitize outputs
- Log security events

### Docker Deployment

#### Development

```bash
# Clone repository
git clone https://github.com/pangerlkr/ctias-lab.git
cd ctias-lab

# Create environment file
cp .env.example .env
# Edit .env with your settings

# Start services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

#### Production

1. **Use Production Docker Compose**

Create `docker-compose.prod.yml`:

```yaml
version: '3.9'

services:
  postgres:
    image: postgres:15-alpine
    restart: always
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backups:/backups
    networks:
      - internal
    # Don't expose port publicly

  redis:
    image: redis:7-alpine
    restart: always
    command: redis-server --requirepass ${REDIS_PASSWORD}
    networks:
      - internal

  gateway:
    build:
      context: ./gateway
      dockerfile: Dockerfile
    restart: always
    environment:
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
      REDIS_URL: redis://:${REDIS_PASSWORD}@redis:6379/0
      JWT_SECRET: ${JWT_SECRET}
      ENVIRONMENT: production
      LOG_LEVEL: warning
    depends_on:
      - postgres
      - redis
    networks:
      - internal
      - external
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.api.rule=Host(`api.yourdomain.com`)"
      - "traefik.http.routers.api.tls=true"

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    restart: always
    environment:
      REACT_APP_API_URL: https://api.yourdomain.com
    networks:
      - external
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.web.rule=Host(`yourdomain.com`)"
      - "traefik.http.routers.web.tls=true"

networks:
  internal:
    driver: bridge
  external:
    driver: bridge

volumes:
  postgres_data:
```

2. **Deploy**

```bash
docker-compose -f docker-compose.prod.yml up -d
```

### Kubernetes Deployment

#### Prerequisites

- Kubernetes cluster (v1.24+)
- kubectl configured
- Helm 3.x installed

#### Deploy with Helm

1. **Create namespace**

```bash
kubectl create namespace ctias-lab
```

2. **Create secrets**

```bash
kubectl create secret generic ctias-secrets \
  --from-literal=jwt-secret=$(openssl rand -hex 32) \
  --from-literal=postgres-password=$(openssl rand -base64 24) \
  --from-literal=redis-password=$(openssl rand -base64 24) \
  -n ctias-lab
```

3. **Deploy PostgreSQL**

```bash
helm install postgres bitnami/postgresql \
  --set auth.existingSecret=ctias-secrets \
  --set auth.secretKeys.adminPasswordKey=postgres-password \
  --namespace ctias-lab
```

4. **Deploy Redis**

```bash
helm install redis bitnami/redis \
  --set auth.existingSecret=ctias-secrets \
  --set auth.existingSecretPasswordKey=redis-password \
  --namespace ctias-lab
```

5. **Deploy Application**

```bash
kubectl apply -f k8s/ -n ctias-lab
```

### Monitoring

#### Logging

- All services log to stdout in JSON format
- Use centralized logging (ELK, Loki, etc.)
- Configure log retention policies

#### Metrics

- Health check endpoints: `/health`
- Monitor response times
- Track error rates
- Monitor resource usage

#### Alerts

Set up alerts for:
- Service downtime
- High error rates
- Database connection issues
- High latency
- Resource exhaustion

### Backup Strategy

#### Database Backups

```bash
# Automated daily backup
docker exec ctias-postgres pg_dump -U ctias ctias_lab > backup-$(date +%Y%m%d).sql

# Restore from backup
docker exec -i ctias-postgres psql -U ctias ctias_lab < backup-20240101.sql
```

#### Backup Schedule

- Daily: Keep for 7 days
- Weekly: Keep for 4 weeks
- Monthly: Keep for 12 months

### Scaling

#### Horizontal Scaling

Scale gateway and module services:

```bash
# Docker Compose
docker-compose up -d --scale gateway=3

# Kubernetes
kubectl scale deployment gateway --replicas=3 -n ctias-lab
```

#### Vertical Scaling

Adjust resource limits in docker-compose.yml or k8s manifests:

```yaml
resources:
  limits:
    memory: "2Gi"
    cpu: "1000m"
  requests:
    memory: "1Gi"
    cpu: "500m"
```

### Performance Tuning

#### Database

- Enable connection pooling
- Add indexes on frequently queried columns
- Regular VACUUM and ANALYZE
- Monitor slow queries

#### Redis

- Configure memory limits
- Set eviction policies
- Use appropriate persistence settings

#### Application

- Enable caching
- Use connection pooling
- Optimize queries
- Compress responses

### Troubleshooting

#### Service Won't Start

```bash
# Check logs
docker-compose logs gateway

# Check service status
docker-compose ps

# Verify environment variables
docker-compose config
```

#### Database Connection Issues

```bash
# Check database is running
docker-compose ps postgres

# Test connection
docker exec -it ctias-postgres psql -U ctias -d ctias_lab

# Check environment variables
echo $DATABASE_URL
```

#### High Memory Usage

```bash
# Check container stats
docker stats

# Restart services
docker-compose restart

# Adjust memory limits
```

### Maintenance

#### Regular Updates

```bash
# Pull latest code
git pull origin main

# Rebuild containers
docker-compose build --no-cache

# Restart with new images
docker-compose up -d
```

#### Database Maintenance

```bash
# Vacuum database
docker exec ctias-postgres psql -U ctias -d ctias_lab -c "VACUUM ANALYZE;"

# Check database size
docker exec ctias-postgres psql -U ctias -d ctias_lab -c "SELECT pg_size_pretty(pg_database_size('ctias_lab'));"
```

### Security Hardening

1. **Network Security**
   - Use firewall rules
   - Restrict access to internal services
   - Use VPN for admin access

2. **Container Security**
   - Run as non-root user
   - Use minimal base images
   - Scan for vulnerabilities
   - Keep images updated

3. **Application Security**
   - Keep dependencies updated
   - Regular security audits
   - Implement rate limiting
   - Use WAF if possible

### Support

For issues or questions:
- GitHub Issues: https://github.com/pangerlkr/ctias-lab/issues
- Documentation: https://github.com/pangerlkr/ctias-lab/docs
- Contact: contact@pangerlkr.link
