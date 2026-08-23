# Documentação de Proxy Reverso para WebSockets — Libmork (RNF-006)

## Visão Geral

Este documento descreve as configurações recomendadas para operação estável do sistema de WebSockets do **Libmork** atrás de servidores de proxy reverso (Nginx, Caddy e Traefik).

A conexão WebSocket do Libmork utiliza o Socket.IO operando no endpoint `/api/socket/io`.

---

## 1. Nginx

Exemplo de configuração para o `nginx.conf` ou bloco `server`:

```nginx
server {
    listen 80;
    server_name rgp.seudominio.com;

    # Redirecionamento HTTP para HTTPS
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name rgp.seudominio.com;

    ssl_certificate /etc/letsencrypt/live/rgp.seudominio.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/rgp.seudominio.com/privkey.pem;

    # Configuração geral de Proxy para a aplicação Next.js
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Configuração dedicada para WebSockets (Socket.IO)
    location /api/socket/io {
        proxy_pass http://127.0.0.1:3000/api/socket/io;
        proxy_http_version 1.1;
        
        # Headers essenciais para WebSocket Upgrade
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts longos para manter a conexão WebSocket viva durante a sessão
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
        
        # Desabilitar buffering para respostas em tempo real instantâneas
        proxy_buffering off;
    }
}
```

---

## 2. Caddy Server

O Caddy suporta WebSockets nativamente por padrão. O arquivo `Caddyfile` necessita de configuração mínima:

```caddy
rgp.seudominio.com {
    reverse_proxy 127.0.0.1:3000 {
        # Manter conexões WebSocket ativas com flush instantâneo
        flush_interval -1
    }
}
```

---

## 3. Traefik (Docker / Kubernetes)

Com Traefik v2/v3, adicione as seguintes labels no seu arquivo `docker-compose.yml`:

```yaml
services:
  app:
    build: .
    restart: always
    environment:
      - PORT=3000
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.libmork.rule=Host(`rgp.seudominio.com`)"
      - "traefik.http.routers.libmork.entrypoints=websecure"
      - "traefik.http.routers.libmork.tls.certresolver=myresolver"
      - "traefik.http.services.libmork.loadbalancer.server.port=3000"
      # Garantir suporte a WebSockets sem encerramento de conexão por inatividade
      - "traefik.http.services.libmork.loadbalancer.responseForwarding.flushInterval=100ms"
```

---

## 4. Verificação de Saúde da Conexão

Para testar a estabilidade do WebSocket em produção:

```bash
# Testar handshake via curl
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" -H "Host: rgp.seudominio.com" https://rgp.seudominio.com/api/socket/io/?EIO=4&transport=websocket
```

Resposta esperada: `HTTP/1.1 101 Switching Protocols`.
