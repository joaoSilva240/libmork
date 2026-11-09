# Design — Chat: DMs, Compartilhamentos e Permissões de Grupo

**Data:** 2026-11-07
**Branch:** `feature/issue-62-campaign-chat-groups`
**Estado:** Aprovado pelo usuário em conversa (brainstorming)

## 1. Contexto

O chat de campanhas (issue #62) já está implementado: grupos 1:1 por campanha,
mensagens em tempo real (Socket.IO, salas `chat:${groupId}`), enquetes exclusivas
do Mestre, serviço em `src/lib/server/chat-service.ts`, rotas em
`src/app/api/chat/` e UI em `src/components/chat/`.

Este spec cobre quatro evoluções solicitadas:

1. Garantir exclusão em cascata campanha → chat/assets (já validado: OK).
2. Chat privado (DM) 1:1 iniciado ao clicar no `@handle` do perfil do mestre.
3. Compartilhamento no chat (itens da biblioteca, perfis via `@`, publicações
   da comunidade, acesso a campanhas) com card minimalista padrão.
4. Menu hambúrguer com "Configurações" do grupo: permissões por membro
   (ler / escrever / compartilhar), remover do grupo e remover da campanha.

## 2. Decisões de abordagem

| Decisão          | Escolha                                                                                            | Alternativa descartada                                                        |
| ---------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| DMs              | Estender `campaign_chat_groups` (`campaignId` nullable + `type` + `userAId`/`userBId`)             | Tabelas separadas para DMs (duplicaria mensagens, membros, socket e UI)       |
| Compartilhamento | Mensagem `type: 'share'` com `payload` jsonb (snapshot congelado, padrão `communityPosts.payload`) | Guardar só ID+tipo (card quebra se a origem for apagada)                      |
| Permissões       | Flags booleanas em `campaign_chat_members` (`canRead`, `canWrite`, `canShare`, default `true`)     | Tabela de permissões genérica (complexidade sem demanda)                      |
| Migração DB      | Script transacional idempotente aditivo (mesma técnica das tabelas de chat)                        | `db:push` (falha por drift sem TTY) / migration files (não usados no projeto) |

Regras confirmadas pelo usuário:

- Somente o admin (Mestre) gerencia permissões; membros começam com tudo liberado.
- "Remover da campanha" = revogar convite + remover vínculos
  personagem-campanha + remover do grupo de chat (o personagem continua existindo).
- Clicar no card de compartilhamento abre detalhes (modal), não navegação de rota.

## 3. Cascata de exclusão (sem mudanças)

Validado em banco (read-only): todas as FKs que apontam para `campaigns` usam
`ON DELETE CASCADE`, incluindo `campaign_chat_groups` e `campaign_assets`. As
tabelas filhas do chat cascateiam a partir do grupo. A rota
`DELETE /api/campaigns/[id]` usa `db.delete(campaigns)` — a cascata do
PostgreSQL faz o resto. Nenhum código novo.

## 4. Schema (mudanças aditivas)

### `campaign_chat_groups`

- `campaignId`: passa a **nullable** (DMs não têm campanha).
- `type` varchar(20) NOT NULL default `'campaign'` — `'campaign' | 'dm'`.
- `userAId` uuid nullable → `users.id` ON DELETE CASCADE.
- `userBId` uuid nullable → `users.id` ON DELETE CASCADE.
- Índice único `idx_dm_pair` em (`userAId`, `userBId`) — o serviço normaliza a
  ordem (uuid menor em `userAId`) antes de inserir.
- O unique index existente em `campaignId` permanece válido (NULLs não colidem
  em índices únicos do Postgres).

### `campaign_chat_messages`

- `payload` jsonb nullable — usado quando `type = 'share'`:

```jsonc
{
  "kind": "library_item" | "profile" | "post" | "campaign",
  "snapshot": { /* dados congelados da entidade, por tipo (seção 6) */ }
}
```

### `campaign_chat_members`

- `canRead` boolean NOT NULL default `true`.
- `canWrite` boolean NOT NULL default `true`.
- `canShare` boolean NOT NULL default `true`.

## 5. Chat privado (DM) 1:1

### Serviço (`chat-service.ts`)

- `getOrCreateDmGroup(userId, otherUserId)`:
  - Normaliza o par (uuid menor = `userAId`); busca grupo `type='dm'` do par;
    se não existe, cria em transação (grupo + 2 membros `role='member'`,
    permissões padrão).
  - `name`/`avatarUrl` do grupo = `displayName`/avatar do **outro** usuário
    (sobrescritos na leitura, não no banco — ver abaixo).
  - Erros: `"Usuário não encontrado"` (404), não permitir DM consigo mesmo.
- `listUserChatGroups(userId)`: passa a incluir DMs. Para DMs, `name`,
  `avatarUrl` e `role` são derivados em tempo de leitura do outro membro
  (o grupo nunca exibe "Mestre" em DMs; `role` retornado = `'member'`).
- `getGroupMessages` / `postChatMessage`: sem mudança de contrato; enquetes
  continuam restritas a `role='admin'` (logo, indisponíveis em DMs).

### Rota

- `POST /api/chat/dm` body `{ userId }` (uuid) → 200 com o grupo
  (`getOrCreateDmGroup`). 401 sem sessão; 400 body inválido; 404 usuário
  inexistente.

### UI

- `MasterProfile.tsx`: o texto `@{userHandle}` vira botão quando o perfil não
  é do próprio usuário logado. Clique → `POST /api/chat/dm` →
  `router.push('/master/community?tab=chat&dm=<groupId>')`.
- `MasterCommunityView.tsx`: lê `searchParams`; com `tab=chat` abre a aba
  "Grupos de Campanha"; repassa `initialGroupId` (de `dm=`) para `CampaignChat`.
- `CampaignChat.tsx`: novo prop opcional `initialGroupId` — quando presente,
  seleciona esse grupo após carregar a lista (com fallback para o primeiro se
  o id não estiver na lista).

## 6. Compartilhamentos

### Tipos e snapshots (`payload.snapshot`)

| kind           | Origem                                                                       | Snapshot                                                                                   | Clique no card                                                                                   |
| -------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| `library_item` | `/api/content/[type]` (tipos do ContentManager: skills, spells, items, etc.) | `{ contentType, contentId, name, description?, imageUrl?, level?/raridade quando houver }` | Modal de detalhes do conteúdo (mesmo viewer usado pelo ContentManager, alimentado pelo snapshot) |
| `profile`      | tabela `users`                                                               | `{ userId, displayName, avatarUrl?, bio? }`                                                | Modal de perfil com botão "Iniciar chat" (DM)                                                    |
| `post`         | tabela `community_posts`                                                     | `{ postId, title, contentType, authorName, payload }` (reusa o snapshot congelado do post) | Reusa `PostDetailModal` alimentado pelo snapshot                                                 |
| `campaign`     | campanha do mestre + `campaign_invite` novo                                  | `{ campaignId, name, coverImageUrl?, inviteToken, masterName }`                            | Aceita o convite (mesmo serviço do fluxo de convite por link) e entra na campanha                |

### Serviço

- `postChatMessage` já aceita `type`; estender para `'share'`:
  - Exige `canShare` do membro (`"Você não tem permissão para compartilhar neste grupo"`).
  - O `payload` é construído **no servidor** a partir do `{ kind, id }` enviado
    pelo cliente (o cliente nunca manda snapshot cru):
    - `library_item`: busca o conteúdo global por tipo+id (apenas conteúdo
      global/da biblioteca geral — não conteúdo privado de campanha).
    - `profile`: busca o usuário por id (campos públicos).
    - `post`: busca o `communityPost` por id e copia o snapshot.
    - `campaign`: exige que o autor seja mestre da campanha; cria
      `campaignInvite` (token) e monta o snapshot.
  - Conteúdo não encontrado / sem acesso → erro `"Conteúdo não encontrado para compartilhar"`.

### Rotas

- `POST /api/chat/groups/[groupId]/messages` (existente) — body ganha
  `{ type: 'share', content?: string, share: { kind, id, contentType? } }`.
- `GET /api/chat/share-catalog?groupId=...` — catálogo para o SharePicker:
  retorna em uma chamada: abas _Biblioteca_ (tipos + itens globais do usuário),
  _Publicações_ (primeira página do feed) e _Campanhas_ (campanhas em que o
  usuário é mestre). 401 sem sessão.
- `GET /api/chat/users?q=<termo>&groupId=<opcional>` — busca de usuários para
  o autocomplete de `@` (mín. 2 chars; membros do grupo primeiro; retorna
  `userId`, `displayName`, `avatarUrl`; máx. 10 resultados). 401 sem sessão.

### UI

- **Botão "+"** no input do `ActiveChatRoom` (ao lado do botão de enquete):
  abre `SharePickerModal`.
- **`SharePickerModal`**: abas Biblioteca / Publicações / Campanhas; lista com
  busca local; selecionar item → envia mensagem `type='share'` (REST →
  broadcast socket existente `chat:send-message`).
- **Autocomplete de `@`** no textarea: ao digitar `@`, dropdown lista membros
  do grupo primeiro e depois busca usuários por `displayName`
  (`GET /api/chat/users?q=`, mínimo 2 chars). Selecionar um usuário → envia
  mensagem `share`/`profile` mantendo o texto digitado antes do `@` como
  `content` da mensagem.
- **`SharedContentCard`** (componente padrão único, minimalista):
  - Layout: linha com thumbnail/ícone por tipo (canto arredondado, tokens do
    tema), título (1 linha, truncate), subtítulo (tipo + autor/contexto),
    chevron à direita. Largura máx. ~320px dentro do balão.
  - Variantes visuais por `kind` apenas no ícone/cor de acento e subtítulo.
  - Clicável → abre o modal correspondente (tabela acima).
  - `ActiveChatRoom` renderiza `SharedContentCard` quando `message.type === 'share'`.

### Enforcement de permissões no serviço

- `getGroupMessages`: membro precisa existir e ter `canRead`
  (`"Você não tem permissão para ler este grupo"` → 403).
- `postChatMessage`: `canWrite` para qualquer mensagem
  (`"Você não tem permissão para escrever neste grupo"` → 403); `canShare`
  adicional para `type='share'`.

## 7. Menu hambúrguer + Configurações do grupo

### UI

- `ActiveChatRoom` header: botão hambúrguer (Menu) à direita:
  - Admin: itens "Configurações" e (em grupos de campanha) nada além — remoções
    vivem dentro das Configurações.
  - Membro: "Configurações" abre o painel em modo somente-leitura (lista de
    membros e suas permissões, sem toggles/ações).
- **`ChatSettingsPanel`** (modal):
  - Cabeçalho com nome/avatar do grupo e contagem de membros.
  - Lista de membros: avatar, nome, badge "Mestre" para admin; por membro
    (exceto o próprio admin): toggles Ler / Escrever / Compartilhar e menu de
    ações com **Remover do grupo** e **Remover da campanha** (este último só
    em grupos `type='campaign'`).
  - Confirmação inline antes de remover.

### Serviço

- `updateMemberPermissions(groupId, actorId, userId, { canRead, canWrite, canShare })`:
  - Só `role='admin'` (`"Apenas o Mestre pode alterar permissões"`).
  - Não altera permissões de outro admin.
- `removeGroupMember(groupId, actorId, userId)`:
  - Só admin; não pode remover a si mesmo nem outro admin.
  - Em DMs, remover equivale a sair — fora do escopo (botão não aparece em DM).
- `removeUserFromCampaign(campaignId, masterId, userId)` — transação:
  1. `campaignInvites` da campanha+usuário → `revoked = true`.
  2. Deleta vínculos `characterCampaigns` da campanha cujos personagens
     pertencem ao usuário (personagens não são apagados).
  3. Deleta o `campaign_chat_members` do usuário no grupo da campanha.
  - Só o mestre da campanha (`"Apenas o Mestre pode remover usuários da campanha"`).

### Rotas

- `PATCH /api/chat/groups/[groupId]/members/[userId]` body `{ canRead?, canWrite?, canShare? }` → membro atualizado.
- `DELETE /api/chat/groups/[groupId]/members/[userId]` → remove do grupo.
- `POST /api/campaigns/[id]/remove-member` body `{ userId }` → remove da campanha (e do grupo).
- Erros de permissão → 403; não membro/não encontrado → 404; body inválido → 400.

### Socket.IO (`server.js` + `SocketContext`)

- `chat:member-updated` — payload `{ groupId, userId, canRead, canWrite, canShare }`;
  clientes atualizam as permissões do membro em tempo real (UI desabilita input
  conforme).
- `chat:member-removed` — payload `{ groupId, userId, reason: 'group' | 'campaign' }`;
  - Para o usuário removido (se conectado e na sala): sai da sala
    (`chat:leave-group`) e vê o grupo sumir/estado "Você foi removido".
  - Para os demais: atualiza contagem/lista de membros.

## 8. Migração do banco

Script temporário `scripts/tmp-apply-chat-evolution.js` (idempotente,
transacional, só aditivo), executado uma vez e depois removido:

- `ALTER TABLE campaign_chat_groups ALTER COLUMN campaign_id DROP NOT NULL`;
- `ADD COLUMN IF NOT EXISTS` — `type`, `user_a_id`, `user_b_id` (groups);
  `payload` (messages); `can_read`, `can_write`, `can_share` (members);
- FKs novas em blocos `DO $$ ... EXCEPTION WHEN duplicate_object` ;
- `CREATE UNIQUE INDEX IF NOT EXISTS idx_dm_pair ON campaign_chat_groups (user_a_id, user_b_id)`.

`src/lib/db/schema.ts` é atualizado para refletir exatamente essas colunas
(fonte de verdade do ORM), sem `db:generate`/`db:push`.

## 9. Erros e casos-limite

- DM consigo mesmo → 400.
- Compartilhar conteúdo privado de campanha via biblioteca → bloqueado (só
  conteúdo global).
- Compartilhar campanha da qual não é mestre → 403.
- Card de conteúdo apagado → renderiza normalmente (snapshot congelado);
  ações dependentes de dado vivo (aceitar convite de campanha excluída, abrir
  post apagado) → toast de erro amigável.
- Usuário com `canRead=false` abrindo a conversa → 403 no GET e estado vazio
  com aviso na UI.
- Usuário removido com o app aberto → recebe `chat:member-removed`, sai da
  sala e a lista é recarregada.
- Convites antigos de usuário removido da campanha ficam `revoked=true`, o que
  já o exclui do sync de membros do `ensureCampaignChatGroup`.

## 10. Testes

- **Validadores** (`src/lib/validators/chat.ts`): schema de `share`
  (kind enum + id/contentType), schema de permissões, schema de remoção.
- **Serviço** (`chat-service`): getOrCreateDmGroup (cria/reusa/normaliza par),
  listUserChatGroups com DMs, enforcement canRead/canWrite/canShare,
  updateMemberPermissions (só admin, não toca admin), removeGroupMember,
  removeUserFromCampaign (transação: convite revogado + vínculos + membro).
- **Rotas**: `POST /api/chat/dm`, membros PATCH/DELETE, remove-member,
  mensagens share (payload montado no servidor), share-catalog.
- **Componentes**: `SharedContentCard` (variantes por kind, clique abre modal),
  `SharePickerModal` (abas, busca, seleção), autocomplete `@`,
  `ChatSettingsPanel` (toggles admin vs leitura para membro, confirmação de
  remoção), `MasterProfile` (@ clicável → DM), `MasterCommunityView`
  (parâmetros `tab`/`dm`), `CampaignChat` (`initialGroupId`).
- **Regressão**: testes existentes de chat/polls atualizados onde o contrato
  mudou (listUserChatGroups, postChatMessage).

## 11. Fora de escopo

- Sair de grupo voluntariamente em DMs / grupos de campanha.
- Moderação de conteúdo, denúncias, bloqueio entre usuários.
- Notificações push fora do realtime Socket.IO existente.
- Compartilhamento de arquivos/imagens direto do dispositivo.
