# Plano de Execução — Libmork

## 1. Cabeçalho

| Campo | Valor |
|---|---|
| **Projeto** | Libmork — Aplicativo web de RPG de mesa |
| **Documento** | Plano de Execução |
| **Versão** | 1.0 |
| **Data** | 2026-08-22 |
| **Referência** | Análise de Requisitos v0.7 |

---

## 2. Stack Tecnológica Definida

| Camada | Tecnologia |
|---|---|
| **Framework** | Next.js 15 (App Router) |
| **Linguagem** | TypeScript 5 |
| **ORM** | Drizzle ORM (D-47 respondida) |
| **Banco de Dados** | PostgreSQL (externo, via variáveis de ambiente) |
| **Autenticação** | Cookies HTTP-only (D-44) |
| **Estilização** | Tailwind CSS 4 |
| **Validação** | Zod |
| **Containerização** | Docker + Docker Compose |
| **Linting** | ESLint + Prettier |
| **Testes** | Vitest (unitários) + Playwright (E2E, futuro) |

---

## 3. Estrutura do Repositório

```
libmork/
├── docs/                          # Documentação do projeto
│   ├── 01-analise-de-requisitos.md
│   └── 02-plano-de-execucao.md
├── src/
│   ├── app/                       # Next.js App Router
│   │   ├── (auth)/                # Grupo de rotas: login, registro
│   │   │   ├── login/
│   │   │   │   └── page.tsx
│   │   │   ├── register/
│   │   │   │   └── page.tsx
│   │   │   └── layout.tsx
│   │   ├── player/                # Frente do Jogador (mobile-first) — D-42
│   │   │   ├── characters/
│   │   │   ├── campaigns/
│   │   │   └── layout.tsx
│   │   ├── master/                # Escudo do Mestre (desktop-first) — D-42
│   │   │   ├── campaigns/
│   │   │   ├── characters/
│   │   │   └── layout.tsx
│   │   ├── public-sheet/          # Ficha pública somente leitura (D-05)
│   │   │   └── [token]/
│   │   │       └── page.tsx
│   │   ├── api/                   # API Routes
│   │   │   ├── auth/
│   │   │   ├── characters/
│   │   │   ├── campaigns/
│   │   │   └── public/
│   │   ├── layout.tsx             # Root layout
│   │   ├── page.tsx               # Landing / redirect
│   │   └── globals.css
│   ├── components/                # Componentes compartilhados
│   │   ├── ui/                    # Componentes base (botões, inputs, cards)
│   │   ├── character/             # Componentes de ficha
│   │   ├── campaign/              # Componentes de campanha
│   │   └── layout/                # Header, sidebar, navigation
│   ├── lib/                       # Lógica de negócio e utilitários
│   │   ├── db/                    # Drizzle: conexão e queries
│   │   │   ├── index.ts           # Conexão com o banco
│   │   │   ├── schema.ts          # Schema Drizzle completo
│   │   │   └── migrations/        # Migrations geradas pelo Drizzle Kit
│   │   ├── auth/                  # Lógica de autenticação
│   │   │   ├── session.ts         # Gerenciamento de sessão (cookies HTTP-only)
│   │   │   ├── password.ts        # Hash com argon2/bcrypt
│   │   │   └── oauth.ts           # Google OAuth
│   │   ├── engine/                # Motor de regras client-side (D-43)
│   │   │   ├── attributes.ts      # Modificadores, derivações
│   │   │   ├── combat.ts          # Resolução de ataques, bloqueio, esquiva
│   │   │   ├── dice.ts            # Rolagens d20, 2d20, expressões
│   │   │   ├── spells.ts          # Custo de ações por círculo (D-39)
│   │   │   └── skills.ts          # Perícias treinadas, vantagem
│   │   ├── validators/            # Schemas Zod para validação
│   │   │   ├── character.ts
│   │   │   ├── campaign.ts
│   │   │   └── auth.ts
│   │   └── utils/                 # Utilitários gerais
│   │       ├── tokens.ts          # Geração de tokens alta entropia (RNF-003)
│   │       └── constants.ts       # Constantes do sistema
│   ├── hooks/                     # React hooks customizados
│   └── types/                     # Tipos TypeScript globais
│       └── index.ts
├── public/                        # Assets estáticos
├── uploads/                       # Volume Docker para imagens (D-33)
├── drizzle.config.ts              # Configuração do Drizzle Kit
├── docker-compose.yml             # Docker Compose (app + volume)
├── Dockerfile                     # Build da aplicação Next.js
├── .env.example                   # Template de variáveis de ambiente
├── .gitignore
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── README.md
```

---

## 4. Fases de Execução Detalhadas

### Fase 0 — Fundação

**Objetivo:** Repositório funcional, buildável, com banco conectado e pronto para desenvolvimento.

| # | Tarefa | Entrega | Critério de aceite |
|---|---|---|---|
| 0.1 | Inicializar Next.js 15 com App Router + TypeScript | `package.json`, `tsconfig.json`, `next.config.ts` | `npm run dev` sobe sem erros |
| 0.2 | Configurar Tailwind CSS 4 | `globals.css` com Tailwind, classes funcionais | Componente de teste renderiza com Tailwind |
| 0.3 | Configurar ESLint + Prettier | `.eslintrc`, `.prettierrc` | `npm run lint` executa sem erros |
| 0.4 | Configurar Drizzle ORM + schema completo | `schema.ts` com todas as 20 entidades do modelo v0.7 | `npx drizzle-kit generate` gera migrations válidas |
| 0.5 | Docker Compose (app Next.js) | `Dockerfile`, `docker-compose.yml` com volume de imagens | `docker compose up` sobe a aplicação |
| 0.6 | `.env.example` com todas as variáveis | Arquivo template documentado | Todas as variáveis necessárias listadas |
| 0.7 | `.gitignore` + `README.md` básico | Arquivos de suporte | Node_modules, .env, uploads ignorados |
| 0.8 | Estrutura de pastas conforme seção 3 | Diretórios criados com arquivos placeholder | Estrutura verificável no repositório |

---

### Fase 1 — MVP

**Objetivo:** Grupo consegue cadastrar-se, criar campanhas/mundos, manter fichas completas e compartilhá-las por link público. Sem sessão ao vivo.

**Pré-requisitos:** Fase 0 completa.

#### 1.1 Autenticação & Contas (RF-001 a RF-005)

| # | Tarefa | Requisitos cobertos |
|---|---|---|
| 1.1.1 | Registro de conta (e-mail/senha) com hash argon2 | RF-001, RNF-007 |
| 1.1.2 | Login e-mail/senha com sessão via cookie HTTP-only | RF-002, D-44 |
| 1.1.3 | Login OAuth Google | RF-003 |
| 1.1.4 | Logout em qualquer frente | RF-004 |
| 1.1.5 | Middleware de proteção de rotas (player/* e master/*) | RF-005 |
| 1.1.6 | Gerenciamento de papéis por campanha (mestre/jogador) | RF-005 |

#### 1.2 Fichas de Personagem (RF-006 a RF-011, RF-029, RF-030)

| # | Tarefa | Requisitos cobertos |
|---|---|---|
| 1.2.1 | CRUD de personagem (criar, listar, editar, excluir) | RF-006 |
| 1.2.2 | Upload e exibição de imagem do personagem | RF-007, RF-063 |
| 1.2.3 | Associação de itens, magias, habilidades e condições à ficha | RF-008 |
| 1.2.4 | Motor de regras: cálculo de modificadores e status derivados (HP, Mana, Bloqueio) | RF-036, D-12, D-17 |
| 1.2.5 | Motor de regras: cálculo de perícias treinadas por Inteligência | RF-032, RF-067, D-40 |
| 1.2.6 | Tela da ficha mobile-first (frente jogador) | RNF-001 |
| 1.2.7 | Tela da ficha desktop-first (frente mestre) | RNF-001 |

#### 1.3 Campanhas & Mundos (RF-012 a RF-015)

| # | Tarefa | Requisitos cobertos |
|---|---|---|
| 1.3.1 | CRUD de campanhas (criar, listar, editar, arquivar) | RF-012 |
| 1.3.2 | Configuração do motor de regras por campanha (d20 ou 2d20) | RF-019 |
| 1.3.3 | Configuração de PvP por campanha | RF-053 |
| 1.3.4 | CRUD de mundos dentro de campanhas | RF-013 |
| 1.3.5 | Convite de jogadores para campanha | RF-015 |
| 1.3.6 | Vinculação N:N personagem-campanha com status de aprovação | RF-011 |

#### 1.4 Links Públicos (RF-023, RF-024)

| # | Tarefa | Requisitos cobertos |
|---|---|---|
| 1.4.1 | Geração de link público permanente com token de alta entropia | RF-023, RNF-003 |
| 1.4.2 | Página pública somente leitura da ficha (sem login) | RF-023, D-05 |
| 1.4.3 | Revogação e regeneração do link público | RF-024 |

---

### Fase 2 — Conteúdo & Fluxo Mestre

**Objetivo:** Biblioteca de conteúdo funcional, fluxo de aprovação de fichas, NPCs e NFC.

| # | Tarefa | Requisitos cobertos |
|---|---|---|
| 2.1 | Biblioteca global de conteúdo (habilidades, magias, itens, condições) | RF-016 |
| 2.2 | CRUD privado de conteúdo por campanha | RF-017 |
| 2.3 | Fichas consumindo biblioteca global + privada simultaneamente | RF-018 |
| 2.4 | CRUD de Perícias com fórmulas interpretáveis | RF-031, D-35 |
| 2.5 | CRUD de Classes com benefícios por nível | RF-033, D-21 |
| 2.6 | CRUD de Magias com Círculo e Tempo de Conjuração | RF-034, RF-070, D-22 |
| 2.7 | Fluxo de aprovação de fichas (rascunho→pendente→aprovado/rejeitado) | RF-009 |
| 2.8 | Distribuição de fichas prontas pelo mestre | RF-010 |
| 2.9 | CRUD de NPCs (inimigos/comuns) com stats, imagem e ficha simplificada | RF-014, D-38 |
| 2.10 | Pinar magias/habilidades/ataques no NPC | RF-065 |
| 2.11 | NFC — associação de etiquetas NDEF | RF-021, RF-022, D-36 |
| 2.12 | Revogação de NFC | RF-024 |

---

### Fase 3 — Tempo Real

**Objetivo:** Sincronização em tempo real via WebSockets entre jogadores e Escudo do Mestre.

| # | Tarefa | Requisitos cobertos |
|---|---|---|
| 3.1 | Infraestrutura WebSocket (setup, autenticação via cookie no handshake) | RF-025, D-44 |
| 3.2 | Sincronização de HP/Mana/Condições em tempo real | RF-025 |
| 3.3 | Presença dos conectados (online/offline com sinalizador) | RF-026, D-37 |
| 3.4 | Controle interativo de status pelo mestre (alterar HP/Mana/condições) | RF-049 |
| 3.5 | Rolagem em tempo real (digital + manual) com atualização no Escudo | RF-041, RF-046 |
| 3.6 | Configuração de proxy reverso (nginx/Caddy) documentada | RNF-006 |

---

### Fase 4 — Motor de Jogo

**Objetivo:** Combate automatizado com motor dual, iniciativa, turnos, morte e renascimento.

| # | Tarefa | Requisitos cobertos |
|---|---|---|
| 4.1 | Motor dual: resolução de testes d20+mod e 2d20 somado | RF-019, RF-020 |
| 4.2 | Testes por atributo (Força/Destreza para ataque, Destreza para esquiva, Empatia para social) | RF-028 |
| 4.3 | Sistema de combate: iniciativa, pop-up na tela do jogador, botão "espadas cruzadas" | RF-038, RF-039, D-23 |
| 4.4 | Controle de 3 ações por turno com registro visual | RF-040, RF-062, D-31 |
| 4.5 | Seleção de alvo, rolagem, verificação de acerto e dedução de dano | RF-047 |
| 4.6 | Defesa ativa do jogador (prompt Esquivar/Bloqueio) | RF-066, D-41 |
| 4.7 | Defesa de NPC pelo mestre (Esquivar vs Bloqueio) | RF-048, RF-061 |
| 4.8 | Bloqueio tático com mitigação por Vigor | RF-037, D-19 |
| 4.9 | Custo de ações por círculo de magia | RF-051, D-39 |
| 4.10 | Benefícios automáticos de classe ao subir de nível | RF-052 |
| 4.11 | Progressão de XP (0–100) com level-up automático | RF-035, D-18 |
| 4.12 | Distribuição de ponto de atributo no level-up | RF-029, D-13 |
| 4.13 | Fluxo de morte: condição "Caído", overlay, testes de morte, estabilização | RF-042, D-25 |
| 4.14 | Renascimento Fênix: metade dos níveis, 50% HP/Mana, sequelas pelo mestre | RF-043, D-25 |
| 4.15 | Morte definitiva: inativar personagem, conceder Pontos de Sombra | RF-044, D-26 |
| 4.16 | Log lateral de rolagens no Escudo do Mestre | RF-050 |

---

### Fase 5 — Duelo & Pontos de Sombra

**Objetivo:** Mecânicas avançadas de meta-jogo e combate P2P.

| # | Tarefa | Requisitos cobertos |
|---|---|---|
| 5.1 | Fluxo de gasto de Pontos de Sombra no setup de campanha | RF-045, D-26 |
| 5.2 | Escala de dificuldade global por Sombra | RF-055 |
| 5.3 | Rastreamento de expiração (3 campanhas) e remoção automática | RF-068, D-26 |
| 5.4 | Item Mágico com Contraponto (qualidade livre + revisão do mestre) | RF-054, D-27 |
| 5.5 | Duelo P2P: convite/aceite entre jogadores | RF-069, D-45 |
| 5.6 | Duelo P2P: turnos, ações, rolagens, reações defensivas | RF-069 |
| 5.7 | Duelo P2P: configuração de resultados temporários/permanentes | RF-069 |

---

## 5. Decisões Técnicas para Fase 0

| Decisão | Escolha | Justificativa |
|---|---|---|
| ORM | Drizzle | Respondido P-47: mais leve, SQL-first, melhor performance |
| Hash de senha | bcrypt (via `bcryptjs`) | Mais simples para começar; migração para argon2 possível depois |
| Sessão | Cookie HTTP-only com token no banco | D-44; sem dependência de JWT |
| Validação | Zod | Integra com Drizzle e React Hook Form |
| UI Components | Tailwind CSS + componentes próprios | Sem dependência de lib de UI pesada |

---

## 6. Variáveis de Ambiente

```env
# Banco de dados
DATABASE_URL=postgresql://user:password@host:5432/libmork

# Autenticação
AUTH_SECRET=<random-256-bit-hex>
GOOGLE_CLIENT_ID=<google-oauth-client-id>
GOOGLE_CLIENT_SECRET=<google-oauth-client-secret>

# Aplicação
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development

# Imagens
UPLOAD_DIR=/app/uploads
MAX_IMAGE_SIZE_MB=5
```

---

*Fim do documento — Libmork · Plano de Execução v1.0 · 2026-08-22*
