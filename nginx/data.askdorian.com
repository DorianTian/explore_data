# NL2SQL — data.askdorian.com
# Deploy: scp to /etc/nginx/sites-available/data.askdorian.com
# Enable: sudo ln -sf /etc/nginx/sites-available/data.askdorian.com /etc/nginx/sites-enabled/
# Cloudflare: A record → data → EC2 Elastic IP (Proxied)

upstream nl2sql_api {
    server 127.0.0.1:3100;
    keepalive 32;
}

upstream nl2sql_web {
    server 127.0.0.1:3001;
    keepalive 16;
}

server {
    listen 80;
    server_name data.askdorian.com;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    client_max_body_size 4M;

    # ── API: SSE streaming (no buffering, long timeout) ──
    location /api/query/stream {
        proxy_pass http://nl2sql_api;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 300s;
        chunked_transfer_encoding on;
    }

    # ── API: all /api/* and /health ──
    location /api/ {
        proxy_pass http://nl2sql_api;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_connect_timeout 10s;
        proxy_send_timeout 60s;
        proxy_read_timeout 120s;

        proxy_buffering on;
        proxy_buffer_size 8k;
        proxy_buffers 8 8k;
    }

    location = /health {
        proxy_pass http://nl2sql_api;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        access_log off;
    }

    # ── Web: Next.js static assets (long cache) ──
    location /_next/static/ {
        alias /opt/aix-ops-hub/nl2sql/packages/web/.next/static/;
        expires 365d;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # ── Web: everything else → Next.js ──
    location / {
        proxy_pass http://nl2sql_web;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_connect_timeout 10s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
