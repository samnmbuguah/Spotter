#!/bin/bash
# SSL Certificate Renewal Script

set -e

echo "Starting SSL certificate renewal process..."

# Pull latest certbot image
docker pull certbot/certbot:latest

# Renew certificates
docker run --rm -v $(pwd)/letsencrypt:/etc/letsencrypt \
  -v $(pwd)/certbot-www:/var/www/certbot \
  certbot/certbot:latest renew --webroot --webroot-path=/var/www/certbot

# Reload nginx configuration
if docker-compose -f docker-compose.ssl.yml ps nginx | grep -q "Up"; then
  echo "Reloading nginx configuration..."
  docker-compose -f docker-compose.ssl.yml exec nginx nginx -s reload
fi

# Set proper permissions
echo "🔐 Setting certificate permissions..."
sudo chmod -R 644 $(pwd)/letsencrypt/live/exponentialpotential.space/*.pem
sudo chmod 600 $(pwd)/letsencrypt/live/exponentialpotential.space/privkey.pem
sudo chown -R $USER:$USER $(pwd)/letsencrypt/

echo "✅ SSL certificate renewal completed!"
