# Libmork

**Aplicativo web de RPG de mesa com sistema de regras próprio, inspirado em D&D, Ordem Paranormal e 2D20.**

---

## 📖 Documentação

- [Análise de Requisitos v0.7](./docs/01-analise-de-requisitos.md)
- [Plano de Execução v1.0](./docs/02-plano-de-execucao.md)

---

## 🚀 Stack Tecnológica

| Camada | Tecnologia |
|---|---|
| **Framework** | Next.js 15 (App Router) |
| **Linguagem** | TypeScript 5 |
| **ORM** | Drizzle ORM |
| **Banco de Dados** | PostgreSQL (externo) |
| **Autenticação** | Cookies HTTP-only |
| **Estilização** | Tailwind CSS 4 |
| **Validação** | Zod |
| **Containerização** | Docker + Docker Compose |

---

## 📁 Estrutura do Projeto

```
libmork/
├── docs/                          # Documentação
├── src/
│   ├── app/                       # Next.js App Router
│   │   ├── (auth)/                # Autenticação
│   │   ├── player/                # Frente do Jogador (mobile-first)
│   │   ├── master/                # Escudo do Mestre (desktop-first)
│   │   ├── public-sheet/          # Fichas públicas somente leitura
│   │   └── api/                   # API Routes
│   ├── components/                # Componentes React
│   ├── lib/
│   │   ├── db/                    # Drizzle ORM (schema + conexão)
│   │   ├── auth/                  # Autenticação
│   │   ├── engine/                # Motor de regras (client-side)
│   │   ├── validators/            # Schemas Zod
│   │   └── utils/                 # Utilitários
│   ├── hooks/                     # React hooks
│   └── types/                     # Tipos TypeScript
├── uploads/                       # Imagens (volume Docker)
├── drizzle.config.ts              # Configuração Drizzle Kit
├── docker-compose.yml             # Docker Compose
└── Dockerfile                     # Build da aplicação
```

---

## ⚙️ Setup de Desenvolvimento

### Pré-requisitos

- Node.js 22+
- PostgreSQL 14+ (externo, não incluído no Docker Compose)
- npm 10+

### 1. Clonar o repositório

```bash
git clone https://github.com/joaoSilva240/libmork.git
cd libmork
```

### 2. Instalar dependências

```bash
npm install
```

### 3. Configurar variáveis de ambiente

```bash
cp .env.example .env.local
```

Edite `.env.local` e preencha:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/libmork
AUTH_SECRET=<gere-uma-chave-secreta-256-bits>
GOOGLE_CLIENT_ID=<seu-google-oauth-client-id>
GOOGLE_CLIENT_SECRET=<seu-google-oauth-client-secret>
```

### 4. Criar o banco de dados

```bash
# No PostgreSQL:
createdb libmork
```

### 5. Executar migrations

```bash
npm run db:generate
npm run db:push
```

### 6. Iniciar o servidor de desenvolvimento

```bash
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000) no navegador.

---

## 🐳 Deploy com Docker

```bash
# Build da imagem
docker compose build

# Subir o container
docker compose up -d
```

### 🔧 ZimaOS / CasaOS + Tradução IA (NINEROUTER / 9Router)

> **Diagnóstico:** `GET /api/health/ninerouter` (requer login ou header `x-health-token` com `HEALTH_TOKEN`) retorna `reachable`, `latencyMs`, `errorCode` (`ENETUNREACH`/`UND_ERR_CONNECT_TIMEOUT` indica CGNAT inalcançável do bridge). Veja `docs/deploy-zimaos.md` para o guia completo.

A tradução de magias/itens via 9Router (OpenAI-compatible) falha em produção quando `NINEROUTER_URL=http://100.83.170.1:20128/v1` (IP Tailscale CGNAT `100.64/10`) não é roteável do container bridge padrão — o ZimaCube precisa estar no Tailnet ou expor o daemon. O `docker-compose.yml` já inclui `extra_hosts: ["host.docker.internal:host-gateway"]` e fallback automático para `host.docker.internal:20128` quando o IP Tailscale falha, mas isso só funciona se 9Router estiver no **mesmo host físico**. Para produção resiliente escolha uma das opções:

| Opção | Como | Quando usar |
|-------|------|-------------|
| **A — URL pública (recomendada, menos lock-in)** | Publique o 9Router: `tailscale funnel 20128` **ou** `cloudflared tunnel --url http://100.83.170.1:20128` **ou** Nginx+TLS. Defina `NINEROUTER_URL=https://ninerouter.seudominio.com/v1` no painel ZimaOS/CasaOS (variáveis do app). | Produção acessível de qualquer host, sem sidecar, funciona mesmo se ZimaCube sair do Tailnet |
| **B — Sidecar Tailscale (privada)** | `docker compose -f docker-compose.yml -f docker-compose.override.tailscale.yml up -d` com `TS_AUTHKEY` (ver `docker-compose.override.tailscale.yml`). Mantém tráfego privado no Tailnet (`network_mode: service:tailscale`). | Quer manter IP `100.83.170.1` privado sem domínio/TLS |
| **C — Mesmo host (fallback automático)** | Rode 9Router no próprio ZimaCube/ZimaOS e mantenha `NINEROUTER_URL=http://100.83.170.1:20128/v1`; o código tenta automaticamente `host.docker.internal:20128/v1` em falha de rede (`warn: ninerouter fallback...`). | 9Router e app no mesmo hardware e sem querer expor para internet |

> Código **não hardcoda** IP: respeita `NINEROUTER_URL` env. O fallback `100.83.170.1 → host.docker.internal` só ativa em `ETIMEDOUT`/`ENETUNREACH`/`ECONNREFUSED`/`UND_ERR_CONNECT_TIMEOUT`. Timeout 25s + 1 retry (backoff 2s) apenas para rede; erros `401/429/400` não retentam. Mensagens granulares (`translation_provider_unconfigured`, `timeout`, `unreachable`, `http_xxx`, `empty`, `invalid_json`) são exibidas na UI com botão **Retry** — não mais 500 opaco.

---

## 🚀 Configurar Tradução via IA (9Router)

### Opção A (Recomendado) — Expor 9Router publicamente:

```bash
# Tailscale Funnel
tailscale funnel 20128

# Cloudflare Tunnel
cloudflared tunnel --url http://100.83.170.1:20128
```

Configure `NINEROUTER_URL` apontando para seu domínio no painel ZimaOS/CasaOS.

### Opção B (Privado) — Rodar 9Router no mesmo host:

Aponte `NINEROUTER_URL=http://host.docker.internal:20128/v1` (requer `extra_hosts` no compose). O código tenta fallback automaticamente quando o IP Tailscale falha.

---

## 📜 Scripts Disponíveis

```bash
npm run dev              # Servidor de desenvolvimento
npm run build            # Build de produção
npm run start            # Servidor de produção
npm run lint             # Lint com ESLint
npm run format           # Formatar código com Prettier
npm run format:check     # Verificar formatação

npm run db:generate      # Gerar migrations do Drizzle
npm run db:push          # Aplicar schema no banco
npm run db:studio        # Abrir Drizzle Studio (GUI do banco)
```

---

## 🎯 Fases de Desenvolvimento

| Fase | Status | Descrição |
|---|---|---|
| **Fase 0 — Fundação** | 🚧 **Em andamento** | Repositório, Docker, schema do banco, estrutura base |
| **Fase 1 — MVP** | 📋 Planejada | Autenticação, fichas, campanhas, links públicos |
| **Fase 2 — Conteúdo & Fluxo Mestre** | 📋 Planejada | Biblioteca, aprovação de fichas, NPCs, NFC |
| **Fase 3 — Tempo Real** | 📋 Planejada | WebSockets, sincronização HP/Mana/Condições |
| **Fase 4 — Motor de Jogo** | 📋 Planejada | Combate, iniciativa, morte, renascimento |
| **Fase 5 — Duelo & Pontos de Sombra** | 📋 Planejada | Duelo P2P, meta-moeda, caos narrativo |

---

## 🤝 Contribuindo

Este é um projeto pessoal em desenvolvimento ativo. Contribuições serão bem-vindas após o lançamento do MVP.

---

## 📄 Licença

MIT

---

## 📧 Contato

João Silva — [joao.silvaoliver240@gmail.com](mailto:joao.silvaoliver240@gmail.com)

GitHub: [@joaoSilva240](https://github.com/joaoSilva240)
