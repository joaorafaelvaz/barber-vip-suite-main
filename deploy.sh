#!/bin/bash
set -e

echo "=== Barber VIP Suite - Deploy ==="

# Build and start container
echo ">> Building Docker image..."
docker compose build

echo ">> Starting container..."
docker compose up -d

echo ">> Container status:"
docker compose ps

echo ""
echo "=== Deploy complete ==="
echo "App running on http://localhost:3090"
echo ""
echo "Next steps on your VPS:"
echo "  1. Copy nginx/barber-vip.conf to /etc/nginx/sites-available/"
echo "  2. ln -s /etc/nginx/sites-available/barber-vip.conf /etc/nginx/sites-enabled/"
echo "  3. sudo nginx -t && sudo systemctl reload nginx"
echo "  4. sudo certbot --nginx -d teste.franquiabv.xyz"
