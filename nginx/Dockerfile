# Use the official Nginx image with SSL support
FROM nginx:1.25-alpine

# Install required packages
RUN apk add --no-cache \
    brotli \
    wget \
    openssl \
    certbot \
    && mkdir -p /var/cache/nginx/client_temp \
    && mkdir -p /var/cache/nginx/proxy_temp \
    && mkdir -p /var/cache/nginx/fastcgi_temp \
    && mkdir -p /var/cache/nginx/uwsgi_temp \
    && mkdir -p /var/cache/nginx/scgi_temp \
    && mkdir -p /etc/letsencrypt/live/exponentialpotential.space \
    && mkdir -p /var/www/certbot

# Create necessary directories and set permissions
RUN mkdir -p /etc/nginx/certs \
    && chown -R nginx:nginx /etc/letsencrypt \
    && chmod -R 755 /etc/letsencrypt

# Copy Nginx configuration
COPY nginx-ssl.conf /etc/nginx/nginx.conf

# Copy entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Expose ports
EXPOSE 80
EXPOSE 443

# Set proper permissions
RUN chown -R nginx:nginx /var/cache/nginx \
    && chmod -R 755 /var/cache/nginx \
    && chown -R nginx:nginx /etc/nginx/conf.d/ \
    && chmod -R 644 /etc/nginx/conf.d/ \
    && chown -R nginx:nginx /var/log/nginx \
    && chmod -R 755 /var/log/nginx

# Start Nginx
ENTRYPOINT ["/entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost/health/ || exit 1

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
