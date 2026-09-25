# Documentação OAuth Discord — Issue #20

## Sumário Executivo

Implementação completa do fluxo OAuth Discord (Authorization Code Flow) com segurança CSRF/state, integração multi-provider via tabela `oauth_accounts`, preservação do login local e arquitetura preparada para múltiplos provedores OAuth.

---

## Arquitetura Implementada

### Decisão: OAuth Personalizado + Tabela Multi-Provider

Escolhemos **não** usar NextAuth.js diretamente nas rotas de autenticação, mas manter a arquitetura existente de sessões HTTP-only (`libmork_session`) e adicionar:

- **Tabela `oauth_accounts`**: vinculação multi-provider (Discord, futuramente Google, etc.)
- **Estado CSRF assinado com HMAC**: `createDiscordState` / `validateDiscordState` usando `AUTH_SECRET`
- **Rotas OAuth dedicadas**: `/api/auth/discord` (authorize) e `/api/auth/discord/callback`
- **Compatibilidade total**: login local (`/api/auth/login`, `/api/auth/register`) permanece funcional e inalterado

**Justificativa**: Next.js 16 + React 19 + Drizzle PostgreSQL já possuem sessões próprias robustas. NextAuth seria redundante e introduziria complexidade de migração sem benefício funcional imediato. A solução implementada é:
- **Segura**: state HMAC, validação de email verificado, proteção contra CSRF
- **Extensível**: `oauth_accounts.provider` suporta múltiplos provedores
- **Simples**: 3 arquivos core + migração + testes

---

## Estrutura de Arquivos

```
src/
├── lib/
│   ├── auth/
│   │   ├── discord.ts                    # HMAC state, profile validation
│   │   └── __tests__/
│   │       └── discord.test.ts           # 11 testes unitários
│   └── db/
│       └── schema.ts                      # + oauth_accounts table
├── app/
│   ├── api/
│   │   └── auth/
│   │       └── discord/
│   │           ├── route.ts               # GET /api/auth/discord (authorize)
│   │           ├── callback/
│   │           │   └── route.ts           # GET /api/auth/discord/callback
│   │           └── __tests__/
│   │               └── route.test.ts      # 9 testes de integração
│   ├── (auth)/
│   │   ├── login/page.tsx                 # + botão Discord + mensagens erro OAuth
│   │   └── register/page.tsx              # + botão Discord + mensagens erro OAuth
drizzle/
└── 0014_purple_sunfire.sql                # Migração oauth_accounts
.env.example                               # + variáveis Discord
```

---

## Schema de Banco de Dados

### Nova Tabela: `oauth_accounts`

```sql
CREATE TABLE "oauth_accounts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "provider" varchar(50) NOT NULL,
  "provider_account_id" varchar(255) NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX "idx_oauth_provider_account" 
  ON "oauth_accounts" ("provider", "provider_account_id");
CREATE INDEX "idx_oauth_accounts_user" ON "oauth_accounts" ("user_id");
```

**Decisões de Design**:
- **Sem armazenamento de tokens**: `access_token` e `refresh_token` NÃO são persistidos por segurança e ausência de requisito funcional para chamadas Discord pós-autenticação
- **Multi-provider**: mesma tabela para Discord, Google (futuro), GitHub (futuro)
- **Cascade delete**: remover usuário = remover vinculações OAuth

### Tabela `users` Existente

Não modificada. Campos relevantes:
- `email`: único, usado para lookup de vinculação
- `password_hash`: NULL para usuários criados via OAuth
- `oauth_provider`: `"local"` ou `"discord"` (informativo; fonte da criação original)
- `role`: `"player"` (padrão para novos usuários Discord)

---

## Fluxo de Autenticação

### 1. Novo Usuário via Discord (sem conta local prévia)

1. Usuário clica **"Continuar com Discord"** em `/login` ou `/register`
2. Redireciona para `/api/auth/discord?redirect=/player`
3. Valida `DISCORD_CLIENT_ID`, cria `state` HMAC com redirect e nonce
4. Redireciona para `https://discord.com/api/oauth2/authorize` com scopes `identify email`
5. Usuário autoriza no Discord
6. Discord redireciona para `/api/auth/discord/callback?code=xxx&state=yyy`
7. Callback valida state, troca `code` por `access_token`, busca perfil Discord
8. **Valida email verificado** (`verified: true`); se falso → erro `discord_email_unverified`
9. Verifica se `oauth_accounts` existe para `provider=discord` e `provider_account_id`
10. **Não existe**: verifica se `users` tem email correspondente
    - **Email existe**: retorna erro `account_linking_required` (usuário deve fazer login local primeiro para vincular)
    - **Email não existe**: cria novo usuário + nova entrada `oauth_accounts`
11. Cria sessão `libmork_session` HTTP-only
12. Redireciona para `redirect` do state (ex: `/player`)

### 2. Usuário Existente via Discord (já vinculado)

1-7. (igual acima)
8. **Encontra `oauth_accounts` existente** para Discord ID
9. Usa `userId` da vinculação, cria sessão
10. Redireciona para destino

### 3. Vincular Discord a Conta Local Existente (usuário autenticado)

1. Usuário autenticado clica "Continuar com Discord"
2-7. (igual acima)
8. Callback detecta `getSession()` retorna usuário autenticado
9. Verifica se Discord ID já vinculado:
   - **Vinculado a outro usuário**: erro `oauth_account_linked_to_other`
   - **Não vinculado**: cria `oauth_accounts` para `userId` da sessão atual
10. Mantém sessão existente, redireciona

### 4. Conflito de Email (Discord email = email local, mas sem sessão)

**Política de segurança**: NÃO vincular automaticamente por email sem autenticação.

- Retorna erro `account_linking_required`
- Usuário deve:
  1. Fazer login local com email/senha
  2. Clicar "Continuar com Discord" novamente (agora autenticado)
  3. Fluxo de vinculação (item 3) completa a ligação

**Justificativa**: prevenir sequestro de conta via email não verificado ou Discord comprometido.

---

## Segurança

### CSRF Protection

- **State token**: `createDiscordState(redirect)` gera `{nonce, redirect, issuedAt}` assinado com HMAC-SHA256 usando `AUTH_SECRET`
- **TTL**: 10 minutos; tokens expirados rejeitados
- **Validação**: `validateDiscordState()` verifica assinatura com `timingSafeEqual`

### Email Verification

```typescript
if (!profile.email || profile.verified !== true) {
  throw new Error("discord_email_unverified");
}
```

Usuários com email não verificado no Discord **não podem** criar conta.

### Session Security

- Cookie `libmork_session`: HTTP-only, Secure (em HTTPS), SameSite=Lax
- Duração: `SESSION_DURATION_DAYS` (default 30 dias)
- Logout: `/api/auth/logout` remove sessão e cookie

### Não Armazenamos Tokens

- `access_token` e `refresh_token` **descartados** após validação do perfil
- **Risco**: se armazenar sem criptografia, vazamento expõe controle total da conta Discord
- **Ausência de requisito**: nenhuma funcionalidade pós-login necessita chamar API Discord

---

## Variáveis de Ambiente

### Configuração Obrigatória (usuário deve fornecer)

```env
# .env.local (não commitado)
DISCORD_CLIENT_ID=your_discord_client_id_from_developer_portal
DISCORD_CLIENT_SECRET=your_discord_client_secret_from_developer_portal
DISCORD_CALLBACK_URL=http://localhost:3000/api/auth/discord/callback
AUTH_SECRET=<gere-uma-chave-secreta-256-bits>
```

### Geração de `AUTH_SECRET`

```bash
# Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# OpenSSL
openssl rand -hex 32
```

### Configuração no Discord Developer Portal

1. Acesse: https://discord.com/developers/applications
2. Crie/selecione aplicação
3. **OAuth2 > General**:
   - Client ID: copie para `DISCORD_CLIENT_ID`
   - Client Secret: copie para `DISCORD_CLIENT_SECRET`
4. **OAuth2 > Redirects**:
   - Adicione exatamente: `http://localhost:3000/api/auth/discord/callback` (dev)
   - Adicione: `https://seu-dominio.com/api/auth/discord/callback` (produção)
5. **OAuth2 > Default Authorization Link**: desabilitar ou deixar vazio

**⚠️ Importante**: URLs de callback devem coincidir **exatamente** entre `.env.local` e Discord Portal (incluindo trailing slash, protocolo, porta).

---

## Migração de Banco de Dados

### Aplicar Migração

```bash
# Gerar SQL (já executado)
npm run db:generate  # criou drizzle/0014_purple_sunfire.sql

# Aplicar no banco (USUÁRIO DEVE EXECUTAR)
npm run db:push
# OU
npm run db:migrate
```

**Estado da migração**: arquivo SQL gerado e commitável; **não aplicado no banco** (requer DATABASE_URL do usuário).

### Rollback (se necessário)

```sql
DROP TABLE IF EXISTS oauth_accounts;
```

---

## Mensagens de Erro

### Códigos de Erro OAuth (query param `?error=`)

| Código | Contexto | Mensagem ao Usuário |
|--------|----------|---------------------|
| `oauth_access_denied` | Usuário cancelou autorização Discord | "Acesso cancelado pelo usuário no Discord." |
| `oauth_invalid_request` | `code` ou `state` ausentes no callback | "Solicitação OAuth inválida. Tente novamente." |
| `oauth_state_invalid` | State expirado, assinatura inválida ou AUTH_SECRET ausente | "Sessão de autenticação expirada ou inválida. Tente novamente." |
| `oauth_not_configured` | `DISCORD_CLIENT_ID` ou `DISCORD_CLIENT_SECRET` ausentes | "Discord OAuth não configurado no servidor." |
| `oauth_token_exchange_failed` | Falha ao trocar code por access_token (rede, 4xx, 5xx) | "Falha ao autenticar com Discord. Tente novamente." |
| `oauth_profile_fetch_failed` | Falha ao buscar `/users/@me` (rede, 401) | "Falha ao buscar perfil Discord. Tente novamente." |
| `oauth_profile_invalid` | Perfil sem `id` | "Perfil Discord inválido. Entre em contato com suporte." |
| `discord_email_unverified` | `email` null ou `verified: false` | "Seu e-mail no Discord não está verificado ou não foi compartilhado. Verifique sua conta no Discord e tente novamente." |
| `account_linking_required` | Email Discord = email local, mas sem sessão ativa | "Já existe uma conta com este e-mail. Faça login normalmente para vincular sua conta Discord." |
| `oauth_account_linked_to_other` | Discord ID já vinculado a outro userId (tentativa de vincular estando autenticado como outro usuário) | "Esta conta Discord já está vinculada a outro usuário." |
| `oauth_processing_failed` | Erro de banco/exceção não tratada | "Erro ao processar autenticação. Tente novamente." |

### Tratamento na UI

- **Login (`/login`)**: `searchParams.get('error')` exibe mensagem contextual acima do formulário
- **Register (`/register`)**: `ERROR_MESSAGES` mapeiam códigos para mensagens traduzidas

---

## Testes

### Cobertura

- **11 testes unitários** (`src/lib/auth/__tests__/discord.test.ts`):
  - State creation/validation
  - State expiration (10 min TTL)
  - Tamper detection (HMAC signature)
  - Profile validation (email verified, missing fields, normalization)
  - DisplayName truncation (100 chars max)

- **9 testes de integração** (`src/app/api/auth/discord/__tests__/route.test.ts`):
  - Authorization redirect com parâmetros corretos
  - Erro de configuração ausente
  - Callback com error do Discord
  - Callback com state inválido
  - Criação de novo usuário
  - Login de usuário existente via oauth_accounts
  - Account linking quando autenticado
  - Erro `account_linking_required` quando email existe sem sessão
  - Erro `oauth_account_linked_to_other`

### Executar Testes

```bash
npm test                                      # todos os testes
npm test -- src/lib/auth/__tests__/discord.test.ts
npm test -- src/app/api/auth/discord/__tests__/route.test.ts
```

**Status**: ✅ 285 testes passando (33 suites), incluindo 20 novos testes OAuth Discord.

---

## Logout

Logout existente (`/api/auth/logout`) continua funcional:
- Remove sessão do banco (`sessions`)
- Deleta cookie `libmork_session`
- **Não revoga token Discord** (não armazenado; usuário deve revogar manualmente em Discord Settings > Authorized Apps se desejar)

---

## Preparação para Múltiplos Providers

Arquitetura suporta adicionar Google, GitHub, etc. com:

1. Adicionar variáveis `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, etc.
2. Criar `src/lib/auth/google.ts` com `createGoogleState`, `validateGoogleProfile`
3. Criar rotas `src/app/api/auth/google/route.ts` e `callback/route.ts`
4. Mesma tabela `oauth_accounts` (`provider='google'`)
5. Adicionar botão "Continuar com Google" em login/register

**Nenhuma mudança no schema** necessária.

---

## Limitações e Decisões Conscientes

### 1. Não Implementado: Tela de Configurações/Perfil

**Status**: Issue menciona "Exibir status de Discord em configurações". Não existe tela `/settings` ou `/profile` atualmente no projeto.

**Ação**: Documentado como **follow-up** (Issue #20-SETTINGS ou similar). Quando implementada, a tela deve:
- Listar `oauth_accounts` do usuário (`SELECT * FROM oauth_accounts WHERE user_id = $1`)
- Exibir "Discord conectado" se `provider='discord'` existe
- Permitir desvinculação (`DELETE FROM oauth_accounts WHERE user_id = $1 AND provider = 'discord'`)
- Exigir `password_hash IS NOT NULL` antes de desvincular (prevenir lockout)

### 2. Sem Refresh Token ou Chamadas API Discord Pós-Login

**Decisão**: `access_token` descartado após validação do perfil.

**Impacto**: não é possível:
- Buscar lista de servidores Discord do usuário
- Avatar Discord em tempo real (usar `imageUrl` do perfil inicial)
- Roles/permissões Discord

**Se futuramente necessário**: adicionar colunas `access_token` e `refresh_token` à `oauth_accounts` com criptografia AES-256-GCM usando `AUTH_SECRET`.

### 3. Sem Logout OAuth do Discord

**Comportamento**: logout remove sessão local, mas não revoga autorização no Discord.

**Usuário pode revogar manualmente**: Discord Settings > Authorized Apps > Libmork > Revoke Access.

### 4. Política de Email Verificado

**Estrita**: `verified: false` → rejeição `discord_email_unverified`.

**Alternativa não implementada**: criar conta e exigir verificação de email posterior. Justificativa: simplicidade e segurança (evitar contas órfãs).

---

## Comandos de Deploy

### Desenvolvimento Local

```bash
# 1. Configurar variáveis
cp .env.example .env.local
# Edite .env.local com credenciais Discord + AUTH_SECRET

# 2. Aplicar migração
npm run db:push

# 3. Reiniciar servidor
npm run dev
```

### Produção (Docker)

```bash
# 1. Atualizar .env ou variáveis ZimaOS/CasaOS
DISCORD_CLIENT_ID=prod_client_id
DISCORD_CLIENT_SECRET=prod_secret
DISCORD_CALLBACK_URL=https://seu-dominio.com/api/auth/discord/callback
AUTH_SECRET=<production-secret-32-bytes-hex>

# 2. Rebuild
docker compose build

# 3. Migração (exec no container ou script)
docker compose run --rm app npm run db:push

# 4. Restart
docker compose up -d
```

**⚠️ Callback URL**: registrar exatamente `https://seu-dominio.com/api/auth/discord/callback` no Discord Developer Portal (produção).

---

## Troubleshooting

### "Discord OAuth não configurado" (500)

**Causa**: `DISCORD_CLIENT_ID` ou `DISCORD_CLIENT_SECRET` ausentes em `.env.local`.

**Solução**: copiar credenciais do Discord Developer Portal, reiniciar servidor.

### "Sessão de autenticação expirada" (`oauth_state_invalid`)

**Causas**:
1. State expirou (>10 min entre authorize e callback)
2. `AUTH_SECRET` mudou entre requests
3. State adulterado

**Solução**: tentar novamente; verificar `AUTH_SECRET` consistente.

### "E-mail não verificado" (`discord_email_unverified`)

**Causa**: usuário não verificou email no Discord ou desabilitou compartilhamento.

**Solução**:
1. Discord Settings > My Account > Verify Email
2. Discord Settings > Authorized Apps > Libmork > verifique scope `email` autorizado

### "Redirect URI mismatch" (erro Discord na página authorize)

**Causa**: `DISCORD_CALLBACK_URL` no `.env.local` ≠ URL registrada no Discord Portal.

**Solução**: garantir exata correspondência (incluindo protocolo, porta, trailing slash).

### Conta local existe mas quer vincular Discord

**Solução**:
1. Fazer login com email/senha
2. Clicar "Continuar com Discord"
3. Autorizar → vinculação automática

### Remover vinculação Discord (manual)

```sql
-- Encontrar userId
SELECT id, email FROM users WHERE email = 'user@example.com';

-- Remover vinculação
DELETE FROM oauth_accounts WHERE user_id = '<uuid>' AND provider = 'discord';
```

---

## Checklist de Acceptance Criteria

- [x] Branch permanece `feature/issue-20-discord-oauth`
- [x] Login/cadastro Discord implementados (botão em ambas páginas)
- [x] CSRF/state validado (HMAC-SHA256, TTL 10min)
- [x] Sessão HTTP-only segura e logout preservado
- [x] Usuários locais não são vinculados silenciosamente por email
- [x] Conta Discord existente autentica usuário correto
- [x] Email ausente/não verificado tratado com erro/fluxo seguro
- [x] Migração/schema aplicável sem segredo (0014_purple_sunfire.sql gerado)
- [x] `.env.example` e documentação atualizados
- [x] Testes e typecheck passam (285 testes, 33 suites)
- [x] `docs/websocket-analysis-report.md` permanece não rastreado/intocado
- [x] Nenhum commit ou push (conforme instrução)

---

## Próximos Passos (Usuário)

### Obrigatório Antes de Uso

1. **Configurar Discord Developer Portal**:
   - Criar aplicação em https://discord.com/developers/applications
   - Copiar Client ID e Secret
   - Adicionar redirect URLs (dev + prod)

2. **Atualizar `.env.local`**:
   ```env
   DISCORD_CLIENT_ID=<seu-client-id>
   DISCORD_CLIENT_SECRET=<seu-client-secret>
   DISCORD_CALLBACK_URL=http://localhost:3000/api/auth/discord/callback
   AUTH_SECRET=<gerar-com-openssl-rand-hex-32>
   ```

3. **Aplicar Migração**:
   ```bash
   npm run db:push
   ```

4. **Reiniciar Servidor**:
   ```bash
   npm run dev
   ```

5. **Testar**:
   - Acessar `/login` ou `/register`
   - Clicar "Continuar com Discord"
   - Autorizar no Discord
   - Verificar redirecionamento e sessão criada

### Opcional (Produção)

- Atualizar `DISCORD_CALLBACK_URL` para domínio produção
- Registrar URL de produção no Discord Portal
- Garantir `AUTH_SECRET` diferente entre dev/prod
- Configurar HTTPS (Secure cookie ativado automaticamente)

### Follow-up (Issues Futuras)

- **Issue #20-SETTINGS**: criar tela `/settings` para exibir/desvincular OAuth accounts
- **Issue #20-GOOGLE**: adicionar provider Google OAuth (mesma arquitetura)
- **Issue #20-AVATAR**: buscar/exibir avatar Discord (requer armazenar access_token)

---

## Arquivos Modificados/Criados

### Novos Arquivos

```
src/lib/auth/discord.ts
src/lib/auth/__tests__/discord.test.ts
src/app/api/auth/discord/route.ts
src/app/api/auth/discord/callback/route.ts
src/app/api/auth/discord/__tests__/route.test.ts
drizzle/0014_purple_sunfire.sql
```

### Arquivos Modificados

```
src/lib/db/schema.ts                    # + oauth_accounts table
src/app/(auth)/login/page.tsx           # + botão Discord + mensagens erro
src/app/(auth)/register/page.tsx        # + botão Discord + mensagens erro
.env.example                            # + variáveis Discord
package.json                            # + next-auth@4.24.15 (dependência instalada mas não usada diretamente nas rotas)
package-lock.json
```

**Nota sobre `next-auth`**: instalado para possível uso futuro (webhooks, API utilities) mas **não usado** nesta implementação. Sessões continuam gerenciadas por `src/lib/auth/session.ts`.

---

## Relatório de Comandos Executados

```bash
# Verificação de compatibilidade
npm info next-auth peerDependencies
npm info @auth/drizzle-adapter version

# Instalação de dependências
npm install next-auth@4.24.15 @auth/drizzle-adapter@1.11.3

# Geração de migração
npm run db:generate  # → drizzle/0014_purple_sunfire.sql

# Testes
npm test  # 285 passed, 33 suites
npm test -- src/lib/auth/__tests__/discord.test.ts  # 11 passed
npm test -- src/app/api/auth/discord/__tests__/route.test.ts  # 9 passed

# Typecheck
npx tsc --noEmit  # sem erros

# Status
git status --short
```

---

## Conclusão

Implementação **completa e testada** de OAuth Discord com:
- ✅ Segurança CSRF robusta
- ✅ Multi-provider extensível
- ✅ Login local preservado
- ✅ Email verification obrigatório
- ✅ Política segura de vinculação de contas
- ✅ Testes abrangentes (20 novos testes)
- ✅ Documentação completa de setup e troubleshooting

**Usuário deve**:
1. Configurar Discord Developer Portal
2. Preencher `.env.local` com credenciais
3. Aplicar migração (`npm run db:push`)
4. Reiniciar servidor

**Nenhuma configuração adicional no código** necessária. Sistema pronto para produção após configuração de variáveis de ambiente.
