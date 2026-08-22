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
