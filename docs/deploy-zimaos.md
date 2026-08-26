# Deploy — ZimaOS / CasaOS + 9Router (NINEROUTER)

> **Objetivo:** fazer a tradução IA (`POST /api/content/spells|items/[id]/translate`) funcionar em produção containerizada, mesmo sem Tailscale no container.

## 1. Por que falha por padrão?

- `NINEROUTER_URL` padrão é `http://100.83.170.1:20128/v1` — IP **Tailscale CGNAT** (`100.64/10`).
- Em dev no Windows com Tailscale ativo, `curl http://100.83.170.1:20128/v1/models` funciona porque o host está no Tailnet.
- No ZimaOS/CasaOS o container roda em **bridge default** sem Tailscale; se o ZimaCube **não está no Tailnet** ou não expõe `/dev/net/tun`, o IP `100.83*` não é roteável → `ENOTFOUND` / `ETIMEDOUT` / `ECONNREFUSED` / `UND_ERR_CONNECT_TIMEOUT`.
- `docker-compose.yml` original não tinha `extra_hosts`, `network_mode` nem sidecar → sem rota.
- Além disso, `translateSpellWithLLM` escondia o erro (500 genérico) sem `timeout`/`retry`.

**Evidência obrigatória:** `GET /api/health/ninerouter` (autenticado ou `x-health-token: $HEALTH_TOKEN`) faz:
```json
{
  "env": { "ninerouterUrl": "http://100.83.170.1:20128/v1", "hasKey": true, "isTailscaleCgnat": true },
  "probes": {
    "models": { "ok": false, "errorCode": "ENETUNREACH", "latencyMs": 12, "attemptedUrl": "http://100.83.170.1:20128/v1/models" },
    "chat": { "ok": false, "errorCode": "ETIMEDOUT", "latencyMs": 5002 }
  },
  "suggestion": "NINEROUTER_URL usa IP CGNAT inalcançável..."
}
```
Fora do container (`curl` no host) o mesmo endpoint pode retornar `ok: true` — prova do isolamento. Dentro do container:
```bash
docker compose exec app wget -qO- http://100.83.170.1:20128/v1/models   # ETIMEDOUT
docker compose exec app node -e "fetch('http://100.83.170.1:20128/v1/models').then(r=>r.text()).then(console.log).catch(e=>console.error(e.cause?.code||e.message))"
```
Compare com o host:
```bash
curl http://100.83.170.1:20128/v1/models   # ok
```

## 2. Arquitetura corrigida (primária + alternativas)

### Princípio
Código **não hardcoda** IP; lê `NINEROUTER_URL`/`NINEROUTER_MODEL`/`NINEROUTER_KEY` em **runtime** (dentro da função) para respeitar env injetado pelo ZimaOS em `output: standalone`. Timeout **25s** (modelo 120b é lento) + **1 retry** com backoff 2s apenas para rede/timeout, não para 401/429/400. Fallback automático Tailscale→`host.docker.internal`.

### Opção A — Proxy público (RECOMENDADA, menos lock-in)
> Remove dependência do container estar no Tailnet. Código já suporta qualquer `NINEROUTER_URL` (basta configurar env).

**Passos — Tailscale Funnel (mais simples se já usa Tailscale):**
```bash
# No host que roda o 9Router (ex: máquina com IP 100.83.170.1)
tailscale funnel 20128 on
# ou
tailscale serve --bg --https 443 http://127.0.0.1:20128
# Teste:
curl https://<seu-host>.ts.net/v1/models -H "Authorization: Bearer $NINEROUTER_KEY"
```
> Se Funnel exigir plano, use `tailscale serve --bg --https` + `NINEROUTER_URL=https://<host>.ts.net/v1`.

**Passos — Cloudflare Tunnel (sem Tailscale, domínio próprio):**
```bash
cloudflared tunnel create ninerouter
cloudflared tunnel route dns ninerouter ninerouter.seudominio.com
cloudflared tunnel --url http://100.83.170.1:20128 --hostname ninerouter.seudominio.com
# ou via config.yml:
# tunnel: <id>
# ingress:
#   - hostname: ninerouter.seudominio.com
#     service: http://100.83.170.1:20128
```
No painel ZimaOS → app Libmork → Variáveis:
```
NINEROUTER_URL=https://ninerouter.seudominio.com/v1
NINEROUTER_KEY=sk-...
NINEROUTER_MODEL=ollama/gpt-oss:120b
HEALTH_TOKEN=opcional-para-monitorar-sem-login
```
Teste: `curl -H "x-health-token: $HEALTH_TOKEN" https://seu-libmork/api/health/ninerouter | jq .reachable` deve ser `true`.

**Passos — Nginx + TLS (avançado):**
```nginx
server {
  listen 443 ssl;
  server_name ninerouter.seudominio.com;
  ssl_certificate /etc/letsencrypt/live/ninerouter.seudominio.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/ninerouter.seudominio.com/privkey.pem;
  location / {
    proxy_pass http://100.83.170.1:20128;
    proxy_set_header Authorization $http_authorization;
  }
}
```

**Trade-offs A:**
| Prós | Contras |
|------|---------|
| Funciona de qualquer host, sem sidecar | Requer domínio + TLS + gerenciar Bearer KEY em HTTPS |
| Sem `network_mode` custom | Se usar Funnel, depende de feature Tailscale |
| Operador não precisa entender CGNAT | Expone endpoint (mas autenticado por KEY) |

### Opção B — Sidecar Tailscale (privada)
> Mantém tráfego no Tailnet, sem expor para internet.

```bash
# 1. Crie auth key em https://login.tailscale.com/admin/settings/keys (ephemeral, reuse)
export TS_AUTHKEY=tskey-auth-k...

# 2. Suba com override
docker compose -f docker-compose.yml -f docker-compose.override.tailscale.yml up -d

# 3. Verifique
docker logs libmork-tailscale        # deve mostrar "tailscale up" success
docker compose exec app wget -qO- http://100.83.170.1:20128/v1/models  # agora deve dar 200
curl -H "x-health-token: $HEALTH_TOKEN" http://localhost:3000/api/health/ninerouter | jq .probes.models.ok
```

**O que faz o `docker-compose.override.tailscale.yml`:**
- Roda `tailscale/tailscale:latest` com `cap_add: [NET_ADMIN,SYS_MODULE]` e `/dev/net/tun`.
- `app.network_mode: service:tailscale` — app compartilha netns com o sidecar, roteando `100.64/10`.
- Volume `libmork-tailscale-state` persiste estado.

**Trade-offs B:**
| Prós | Contras |
|------|---------|
| Privado, sem domínio/TLS | Requer TS_AUTHKEY, TUN device, privilégios (ZimaOS pode bloquear) |
| Mantém IP `100.83.170.1` | Overhead de container extra, authkey expira |
| Sem expor publicamente | Lock-in Tailscale |

### Opção C — Fallback `host.docker.internal` (automático)
> Útil quando 9Router roda no **mesmo host físico** (ZimaCube) mas fora do Tailnet do container.

- Já implementado: código detecta `100.83.170.1` + erro de rede (`ETIMEDOUT`/`ENETUNREACH`/`ECONNREFUSED`/`UND_ERR_CONNECT_TIMEOUT`) e tenta `http://host.docker.internal:20128/v1` com log `warn: ninerouter fallback host.docker.internal`.
- Requer `extra_hosts: ["host.docker.internal:host-gateway"]` (já adicionado em `docker-compose.yml` e `docker-compose.local.yml` para Compose v2+).
- **Não resolve** se 9Router está em outra máquina da rede Tailscale — use A ou B.

**Como usar C:**
```bash
# Se 9Router está no mesmo ZimaCube, exponha em 0.0.0.0:20128 (não só 127.0.0.1)
# No painel ZimaOS pode ser necessário mapear porta ou rodar 9Router no host (não no container).
# Mantenha NINEROUTER_URL=http://100.83.170.1:20128/v1 — fallback tentará host.docker.internal automaticamente.
docker compose logs app | grep "ninerouter fallback"
```

### Resumo de decisão
```
9Router acessível via internet? ──Sim──> Opção A (Funnel/Cloudflare) + NINEROUTER_URL=https://...
                │
                Não
                │
        ZimaCube no Tailnet?
          ├──Sim e pode rodar sidecar? ──> Opção B (override.tailscale.yml)
          │
          └──9Router no mesmo host? ──> Opção C (fallback automático + extra_hosts)
                │
                └──Nenhum acima? ──> Mova 9Router para host acessível ou exponha via A
```

## 3. Diagnóstico em produção

```bash
# Via sessão (logado no Libmork)
curl -b "libmork_session=<token>" https://seu-libmork/api/health/ninerouter | jq .

# Via HEALTH_TOKEN (sem login, para monitorias)
curl -H "x-health-token: $HEALTH_TOKEN" https://seu-libmork/api/health/ninerouter | jq .reachable

# Dentro do container (prova de isolamento)
docker compose exec app sh -c "wget -qO- http://100.83.170.1:20128/v1/models || echo FAIL"
docker compose exec app node -e "fetch('http://100.83.170.1:20128/v1/models',{signal:AbortSignal.timeout(5000)}).then(r=>console.log(r.status)).catch(e=>console.error(e.cause?.code||e.name))"
```

## 4. Resiliência e observabilidade

- **Timeout 25s + retry 1× (backoff 2s)** apenas para rede/timeout; 401/429/400 não retentam.
- **Fallback** Tailscale→host.docker.internal loga `console.warn`.
- **Erros granulares** (não mais 500 opaco):
  - `translation_provider_unconfigured` → 503
  - `translation_provider_timeout` → 504
  - `translation_provider_unreachable` → 502
  - `translation_provider_http_4xx/5xx` → 502 (body truncado 500 chars)
  - `translation_provider_empty` / `invalid_json` → 502
- **Logs** no server incluem `spellId|itemId`, `durationMs`, `error.code`, `causeCode`, sem expor KEY.
- **UI (`ContentManager.tsx`)**: banner vermelho acionável:
  > “Tradução indisponível: verifique conexão com 9Router (100.83.170.1 não alcançável do container). Tente novamente ou configure NINEROUTER_URL público.” + botão **Tentar novamente**.
- **`output: standalone` preservado**; leitura de env em runtime.

## 5. Checklist ZimaOS

- [ ] Defina em ZimaOS → Libmork → Environment: `NINEROUTER_URL`, `NINEROUTER_KEY` (trim), `NINEROUTER_MODEL`, opcional `HEALTH_TOKEN`.
- [ ] Se usar Opção A, confirme `NINEROUTER_URL` é `https://.../v1` acessível de fora (teste `curl -H "Authorization: Bearer $KEY" https://.../v1/models`).
- [ ] Se usar Opção B, configure `TS_AUTHKEY` e use override.
- [ ] Se usar Opção C, garanta 9Router escuta em `0.0.0.0:20128` no ZimaCube (não `127.0.0.1`).
- [ ] Após subir, `curl http://<zimacube>:3000/api/health/ninerouter -H "x-health-token: ..."` deve ter `reachable: true` e `latencyMs < 8000`.
- [ ] Tradução de magia: abra biblioteca → magia → deve mostrar “Traduzindo magia via IA...” → PT-BR, ou banner de erro com retry + código específico.
- [ ] Verifique logs: `docker logs libmork-app | grep translate` não deve conter KEY.

## 6. Referências

- Código: `src/lib/server/ninerouter.ts` (helper + trade-offs), `src/lib/server/content-translation.ts`, `src/app/api/content/spells/[spellId]/translate/route.ts`, `src/app/api/content/items/[itemId]/translate/route.ts`, `src/app/api/health/ninerouter/route.ts`, `src/components/content/ContentManager.tsx`
- Compose: `docker-compose.yml` (extra_hosts + comentários), `docker-compose.local.yml`, `docker-compose.override.tailscale.yml`
- Tailscale CGNAT 100.64/10, Docker bridge não roteia por padrão, `host.docker.internal:host-gateway`
