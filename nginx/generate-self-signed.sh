#!/bin/sh

# Create directory for SSL certificates if it doesn't exist
mkdir -p /etc/ssl/private

# Generate self-signed certificate
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/ssl/private/nginx-selfsigned.key \
  -out /etc/ssl/certs/nginx-selfsigned.crt \
  -subj "/CN=exponentialpotential.space" \
  -addext "subjectAltName=DNS:exponentialpotential.space,DNS:www.exponentialpotential.space"

# Set proper permissions
chmod 600 /etc/ssl/private/nginx-selfsigned.key
chmod 644 /etc/ssl/certs/nginx-selfsigned.crt
