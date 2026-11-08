# Design — Issue #63: Calendário de Sessões, Lançamento pelo Mestre e Hub Comunitário do Jogador

**Data:** 2026-11-08
**Branch:** `feature/issue-63-session-calendar-community-hub`
**Abordagem aprovada:** Plano A — calendário 100% custom (sem dependências novas), entrega em ondas.

## 1. Contexto

Não existe modelo de agendamento no banco (`sessions` = autenticação;
`campaignLogs` = registro retrospectivo). `campaigns` não tem tipo de mesa nem
vagas. O jogador já tem a aba "Comunidade" no bottom nav (issue #62)
renderizando apenas `CampaignChat`. O mestre tem `MasterCommunityView` com abas
"Mural de Conteúdo" e "Grupos de Campanha". Nenhuma lib de datas no projeto;
todo UI é custom com tokens de tema.

Este spec cobre: calendário do mestre (mês/semana/dia) com "Lançar Sessão",
hub do jogador com 3 submódulos (Grupos, Calendário Pessoal, Mural de
Convites), fluxo de candidatura com disponibilidade e confirmação pelo mestre.

## 2. Decisões

| Decisão | Escolha | Alternativa descartada |
|---|---|---|
| Calendário | Componentes próprios (`CalendarGrid`) com `Date` nativo + `Intl` | FullCalendar (risco React 19, +300KB, theming por overrides) |
| Tipo/vagas da mesa | Colunas nullable em `campaigns` (`oneShot`, `maxPlayers`), definidas na 1ª sessão | Tabela de configuração separada (overkill) |
| Detecção de 1ª sessão | Contagem de `campaign_sessions` da campanha (status != cancelled) == 0 | Flag manual no formulário |
| Disponibilidade do jogador | jsonb de dias ISO + horário preferido opcional; sem horário = `allDay: true` ("Livre o dia todo") | Tabela normalizada de slots (complexidade sem demanda) |
| Realtime | Eventos socket `session:*` na sala `campaign:${id}` existente + refresh ao abrir aba | Salas novas por sessão (desnecessário) |
| Migração DB | Script aditivo idempotente temporário (padrão do projeto) | `db:push` (drift sem TTY) |

## 3. Schema (aditivo)

### `campaigns` — novas colunas

- `oneShot` boolean nullable (null = mesa ainda não configurada).
- `maxPlayers` integer nullable.

### `campaign_sessions` (nova)

```
id              uuid PK default random
campaignId      uuid NOT NULL → campaigns.id ON DELETE CASCADE
masterId        uuid NOT NULL → users.id ON DELETE CASCADE
description     text NOT NULL
proposedStart   timestamptz NOT NULL  -- 00:00 local do primeiro dia do período
proposedEnd     timestamptz NOT NULL  -- 23:59:59 local do último dia (inclusivo)
scheduledAt     timestamptz nullable  -- data/hora final (batida pelo mestre)
durationMinutes integer NOT NULL default 240
xpReward        integer nullable
sessionType     varchar(20) NOT NULL  -- 'one_shot' | 'continuing'
maxSlots        integer NOT NULL
status          varchar(20) NOT NULL default 'proposed'  -- 'proposed' | 'confirmed' | 'cancelled'
createdAt/updatedAt timestamptz NOT NULL default now()
```

Todas as colunas de tempo das tabelas novas usam `withTimezone: true`
(precedente: `publicShareLinks`, schema.ts:509) — diferente do chat legado,
para garantir a semântica UTC. Inputs `date` no formulário viram
`proposedStart = 00:00` do dia inicial e `proposedEnd = 23:59:59` do dia final
(no fuso do navegador), tornando o último dia selecionável em `availableDays`.

Índices: `(campaignId, status)`, `(status, proposedStart)` (feed), `(masterId)`.
Check implícito no serviço: `proposedEnd > proposedStart`.

### `session_candidates` (nova)

```
id             uuid PK default random
sessionId      uuid NOT NULL → campaign_sessions.id ON DELETE CASCADE
userId         uuid NOT NULL → users.id ON DELETE CASCADE
characterId    uuid nullable → characters.id ON DELETE SET NULL
availableDays  jsonb NOT NULL default []   -- string[] de datas ISO 'yyyy-MM-dd' dentro do período
preferredStart varchar(5) nullable         -- 'HH:mm'
preferredEnd   varchar(5) nullable         -- 'HH:mm'
allDay         boolean NOT NULL default true  -- fallback "Livre o dia todo"
status         varchar(20) NOT NULL default 'interested'  -- 'interested' | 'accepted' | 'rejected'
appliedAt      timestamptz NOT NULL default now()
```

Índices: unique `(sessionId, userId)`, `(userId, status)`.

## 4. Backend

### Serviço `src/lib/server/session-service.ts`

Tipos exportados: `SessionSummary`, `SessionDetail`, `CandidateDetail`,
`PlayerCalendarEntry`, `SessionFeedItem`.

- `launchSession(masterId, input)`:
  - Valida que a campanha pertence ao mestre (`"Campanha não encontrada"`).
  - **1ª sessão** (contagem de sessões não-canceladas == 0): exige
    `sessionType` e `maxSlots` no input; persiste `campaigns.oneShot`
    (`sessionType === 'one_shot'`) e `campaigns.maxPlayers` em transação.
  - **Continuada**: ignora/deriva `sessionType` e `maxSlots` das colunas da
    campanha (se ainda null por legado, exige os campos como na 1ª).
    Jogadores já inscritos (`getEnrolledPlayers`) viram candidates
    `accepted` automaticamente na criação (até `maxSlots`) — a mesa fechada
    não aparece no feed público por vagas restantes 0.
  - Cria sessão `status: 'proposed'`; retorna `SessionDetail`.
- `listMasterSessions(masterId, rangeStart?, rangeEnd?)`: sessões das campanhas
  do mestre com contagem de vagas preenchidas (candidates accepted) e total de
  candidatos.
- `getSessionFeed(userId, page)`: sessões `status = 'proposed'` com
  `proposedEnd >= agora` e **vagas restantes > 0** (`maxSlots − accepted`;
  interested não conta), ordenadas por `proposedStart`; inclui campanha
  (nome, capa), mestre (nome, avatar), vagas restantes, `userApplied` (se o
  jogador já candidatou). Pagina 20. Sessões `confirmed`/`cancelled` não
  aparecem no feed (confirmed vive só nos calendários).
- `applyToSession(sessionId, userId, input)`:
  - Sessão precisa estar `proposed` (`"Esta sessão não está mais aberta a candidaturas"`).
  - Mestre não pode candidatar-se à própria sessão.
  - `availableDays` filtrado para datas dentro de `[proposedStart, proposedEnd]`;
    mínimo 1 dia (`"Selecione ao menos um dia disponível"`).
  - Sem `preferredStart/End` → `allDay: true`; com ambos → `allDay: false`
    (validação `preferredEnd > preferredStart`).
  - Upsert por `(sessionId, userId)`: recandidatar atualiza disponibilidade e
    reseta status para `interested` (mesmo após `rejected`).
  - Não aceita se vagas já preenchidas por accepted (`"Vagas esgotadas"`);
    checagem dentro de transação com `SELECT ... FOR UPDATE` na sessão
    (evita race de vagas).
- `listSessionCandidates(sessionId, masterId)`: panorama com jogador,
  personagem, dias, horários, status — só o mestre da sessão.
- `decideCandidate(sessionId, masterId, candidateUserId, decision)`:
  `accepted`/`rejected`; só mestre; em transação com `SELECT ... FOR UPDATE`
  na sessão — accepted não pode exceder `maxSlots` (`"Vagas esgotadas"`).
- `confirmSession(sessionId, masterId, scheduledAt, durationMinutes?)`:
  - Só mestre; status precisa ser `proposed`.
  - `scheduledAt` dentro do período proposto.
  - Transação: sessão → `confirmed` + `scheduledAt`; candidatos
    `interested` restantes → `rejected` automaticamente.
- `cancelSession(sessionId, masterId)`: só mestre; `proposed|confirmed` →
  `cancelled`.
- `listPlayerCalendar(userId, rangeStart?, rangeEnd?)`: sessões `confirmed`
  em que o usuário é candidate `accepted`, com `scheduledAt`, campanha e link
  da sala (`/player?tab=campaigns&campaign=<id>`).
- `getEnrolledPlayers(campaignId)`: donos de personagens `approved` em
  `characterCampaigns` (para listagem de inscritos na sessão continuada).

### Validadores `src/lib/validators/sessions.ts` (Zod)

- `launchSessionSchema`: `campaignId` uuid; `description` 10–2000;
  `proposedStart/proposedEnd` ISO datetime (refine end > start);
  `xpReward` int 0–100000 opcional; `sessionType` enum opcional;
  `maxSlots` int 1–20 opcional (obrigatórios na 1ª sessão — validação no
  serviço, que conhece o estado da campanha).
- `applySessionSchema`: `characterId` uuid opcional; `availableDays` array de
  strings regex `^\d{4}-\d{2}-\d{2}$` min 1 max 62; `preferredStart/End`
  regex `^([01]\d|2[0-3]):[0-5]\d$` opcionais aos pares.
- `confirmSessionSchema`: união discriminada por `action` —
  `{ action: 'confirm', scheduledAt: ISO datetime, durationMinutes?: int
  30–1440 default 240 }` ou `{ action: 'cancel' }` (usada no
  `PATCH /api/sessions/[id]`).
- `decideCandidateSchema`: `decision` enum `accepted|rejected`.

### Rotas REST (padrão existente: requireAuth, `{ success, data }`, logger)

- `GET/POST /api/sessions` — feed do jogador / lançar sessão (mestre).
- `GET /api/sessions/master?start=&end=` — calendário do mestre.
- `GET /api/sessions/[id]` — detalhe (mestre ou candidato).
- `PATCH /api/sessions/[id]` — confirmar ou cancelar via união discriminada
  `confirmSessionSchema` (`action: 'confirm' | 'cancel'`); só mestre.
- `GET/POST /api/sessions/[id]/candidates` — panorama (mestre) / candidatar-se.
- `PATCH /api/sessions/[id]/candidates/[userId]` — aceitar/rejeitar (mestre).
- `GET /api/player/calendar?start=&end=` — calendário pessoal.
- `GET /api/campaigns/[id]/enrolled-players` — inscritos (mestre).
- `GET /api/campaigns/[id]/session-context` — `{ isFirstSession, oneShot,
  maxPlayers, enrolledPlayers }` para o formulário de lançamento (mestre).

Mapeamento de erros: não autenticado 401; validação 400; permissão 403;
não encontrado 404; conflitos de regra ("Vagas esgotadas", "não está mais
aberta") 409.

### Socket.IO (`server.js` + `SocketContext`)

Eventos emitidos pelo cliente após REST (padrão do chat), reemitidos para a
sala `campaign:${campaignId}`:
- `session:publish` → `session:published` `{ campaignId, session }`.
- `session:apply` → `session:applied` `{ campaignId, sessionId, userId }`.
- `session:confirm` → `session:confirmed` `{ campaignId, session }`.
- `session:cancel` → `session:cancelled` `{ campaignId, sessionId }`.

`SocketContext`: `sendSessionPublish/Apply/Confirm/Cancel` +
`subscribeSessionPublished/Applied/Confirmed/Cancelled` (mesmo padrão dos
`chat:*`, payloads `Record<string, unknown>`).

**Alcance das salas (risco confirmado em revisão):** o jogador só entra em
`campaign:${id}` quando abre o overlay da campanha no dashboard
(`PlayerDashboard.tsx:245-258`). Para o realtime funcionar no hub, o
`PlayerCommunityHub` dá `joinCampaign` em **todas as campanhas do jogador**
ao montar (lista já carregada pelo dashboard) e `leaveCampaign` no unmount.
Fora do hub (outras abas), a degradação é graceful: refresh ao abrir a aba.

**Sem evento para aceite/rejeite de candidato** (decisão do mestre): o
jogador vê o status ao reabrir o feed/detalhe; o toast de `session:confirmed`
cobre o resultado final. Declarado como fora de escopo do realtime.

## 5. Frontend

### Utilitários `src/lib/utils/session-dates.ts`

Funções puras testáveis: `getMonthGrid(year, month)` (42 células, segunda a
domingo), `getWeekDays(date)`, `formatPtBr` via `Intl`, `eachDayISO(start, end)`,
`isSameDay`, `addMonths/addWeeks`. Sem dependências.

### `CalendarGrid` (`src/components/calendar/CalendarGrid.tsx`)

- Props: `view: 'month'|'week'|'day'`, `cursor: Date`, `events: CalendarEvent[]`
  (`{ id, date, title, color, badge? }`), `onNavigate(date)`, `onViewChange`,
  `onEventClick(event)`, `onDayClick?(date)`.
- Header: título mês/ano pt-BR, setas ‹ ›, botão "Hoje", seletor Mês/Semana/Dia.
- Mês: grade 7×6, células com até 3 blocos de evento + "+N"; dia atual destacado
  com anel accent; dias fora do mês esmaecidos.
- Semana: 7 colunas com lista de eventos por dia. Dia: coluna única com eventos
  em ordem cronológica.
- Mobile: células compactas (blocos viram pontos coloridos + contagem no mês);
  toque na célula abre o dia (view day). Tokens de tema em tudo.
- `data-testid`: `calendar-grid`, `calendar-prev`, `calendar-next`,
  `calendar-today`, `calendar-view-{month|week|day}`, `calendar-event-{id}`,
  `calendar-day-{yyyy-MM-dd}`.

### Mestre — aba "Calendário" no `MasterCommunityView`

- Terceira aba `tab-master-calendar` (ícone `CalendarDays`) →
  `MasterSessionCalendar`:
  - `CalendarGrid` alimentado por `GET /api/sessions/master` (eventos =
    sessões; cor por status: proposed=accent, confirmed=success,
    cancelled=muted/riscado).
  - Botão "Lançar Sessão" → `SessionLaunchModal`.
  - Clique em evento → `SessionDetailDrawer`: descrição, período, XP, badges,
    vagas (preenchidas/total), lista de candidatos com disponibilidade
    (panorama), ações por candidato (aceitar/rejeitar), botão "Confirmar
    Sessão" (abre `ConfirmSessionModal` com date/time picker dentro do
    período) e "Cancelar Sessão" (confirmação inline).
  - Realtime: subscrições `session:applied/confirmed/cancelled` atualizam
    drawer/lista; refresh ao abrir a aba.

### `SessionLaunchModal`

- Select de campanha (campanhas do mestre via `GET /api/campaigns` existente).
- Ao selecionar: `GET /api/campaigns/[id]/session-context` →
  `{ isFirstSession, oneShot, maxPlayers, enrolledPlayers }`.
- Campos: descrição, período (dois inputs date), XP opcional.
- **Condicional 1ª sessão**: radio One-shot / Campanha Continuada + número de
  vagas (obrigatórios). **Continuada**: mostra badges herdadas (tipo, vagas) +
  lista de jogadores já inscritos, sem reconfiguração.
- Submit → `POST /api/sessions` → socket `session:publish` → toast + refresh.

### Jogador — `PlayerCommunityHub` (substitui `CampaignChat` direto na aba community)

- Sub-abas (pills no topo, padrão das abas do mestre):
  1. **Grupos** (`hub-tab-groups`, ícone MessageSquare) → `CampaignChat` atual.
  2. **Calendário** (`hub-tab-calendar`, CalendarDays) → `PlayerSessionCalendar`:
     `CalendarGrid` com `GET /api/player/calendar` (só confirmadas+accepted);
     clique no evento → modal com detalhes + botão "Ir para a sala"
     (`/player?tab=campaigns&campaign=<id>`).
  3. **Convites** (`hub-tab-invites`, Globe2) → `SessionInviteFeed`.
- Estado da sub-aba persistido em `localStorage` (`libmork.communityHubTab`).
- Ao montar: `joinCampaign` nas campanhas do jogador (realtime, ver §4) +
  refresh de feed/calendário; no unmount: `leaveCampaign`.
- **Deep-link no PlayerDashboard**: ler `useSearchParams` (`tab`, `campaign`)
  com `<Suspense>` na page (precedente: `master/community/page.tsx:29`) —
  abre a aba indicada e pré-seleciona a campanha quando a lista carregar.
  O efeito de pré-seleção observa `campaigns` + params e aplica **uma única
  vez** (flag de controle), pois `selectedCampaign` é estado local
  assíncrono e o Escape limpa a seleção (`PlayerDashboard.tsx:493-505`) —
  evitar reabrir em loop.
- **Interpretação de "sala de jogo"** (issue §2.2): o deep-link abre o
  overlay de detalhes da campanha no dashboard do jogador (destino de jogo
  atual do front player), não uma rota dedicada.
- Badge de novidade na sub-aba Convites quando `session:published` chega.

### `SessionInviteFeed` + `SessionInviteCard` (estilo X)

- Feed paginado (botão "Carregar mais"), cards compactos: banner da campanha
  (ou gradiente com inicial), avatar+nome do mestre, sinopse truncate 2 linhas,
  metadados inline (vagas restantes, XP, período), badges One-shot/Campanha.
- Card clicável → `SessionInviteDetail` (modal): infos completas + botão
  "Tenho Interesse" → `ApplySessionModal`; se já candidatou → status
  ("Candidatura enviada", aceita/rejeitada).
- `ApplySessionModal`:
  - Select de personagem opcional ("Candidatar-se sem ficha" = null) via
    `GET /api/characters`.
  - Checkboxes de dias dentro do período proposto (grade de pills por dia).
  - Horário preferido: dois inputs time opcionais; hint "Sem horário = Livre o
    dia todo"; toggle explícito "Livre o dia todo" ligado por padrão.
  - Submit → `POST /api/sessions/[id]/candidates` → socket `session:apply`.

### Notificações

- Toast ao receber `session:confirmed`/`session:cancelled` de campanha do
  usuário. **Player**: padrão `ToastContainer`/`addToast` existente.
  **Mestre**: não há ToastContainer no front master — `MasterSessionCalendar`
  mantém estado local de toasts reutilizando o componente `ui/Toast`.
- Sem push notification fora do realtime (fora de escopo).

## 6. Migração do banco

Script temporário `scripts/tmp-apply-session-calendar.js` (idempotente,
transacional): `ADD COLUMN IF NOT EXISTS` em campaigns; `CREATE TABLE IF NOT
EXISTS` campaign_sessions/session_candidates; FKs em `DO $$ ... duplicate_object`;
índices `IF NOT EXISTS`. Executar, verificar via information_schema, deletar.
`schema.ts` atualizado para refletir exatamente (fonte de verdade do ORM).

## 7. Erros e casos-limite

- Campanha sem sessões mas com `oneShot/maxPlayers` null (legado): trata como
  1ª sessão (exige campos).
- Recandidatura: upsert atualiza disponibilidade e reseta para `interested`
  (inclusive após `rejected`); não duplica.
- Sessão continuada: inscritos da campanha viram `accepted` na criação; mesa
  cheia (restantes 0) não aparece no feed público.
- Confirmar sessão com 0 accepted: permitido (one-shot de mesa aberta) — sem
  bloqueio.
- `scheduledAt` fora do período → 400.
- Cancelar sessão confirmada: candidatos aceitos veem evento sumir do
  calendário pessoal + toast.
- Feed: só `proposed` com `proposedEnd >= agora` e vagas restantes > 0
  (`maxSlots − accepted`); confirmed/cancelled e campanhas excluídas
  (cascade) nunca aparecem.
- Dias disponíveis fora do período são filtrados silencencialmente no serviço.
- Timezone: colunas `withTimezone: true` (UTC no banco); UI exibe em pt-BR
  local (`Intl`); `proposedStart` = 00:00 do dia inicial e `proposedEnd` =
  23:59:59 do dia final no fuso do navegador (último dia inclusivo);
  `availableDays` compara apenas a parte de data local, sem conversão dupla.
- Race de vagas: apply e decideCandidate checam `accepted < maxSlots` em
  transação com `FOR UPDATE` na sessão.

## 8. Testes

- **Validadores** (`sessions.test.ts`): launch (refine período), apply (dias,
  horários aos pares, regex), confirm, decide.
- **Utilitários** (`session-dates.test.ts`): grade de 42 células, virada de
  mês/ano, eachDayISO, isSameDay.
- **Rotas** (mock do serviço, padrão do repo): sessions CRUD/feed, candidates,
  calendar, session-context, enrolled-players — 401/400/403/404/409.
- **Componentes**: CalendarGrid (views, navegação, eventos, mobile),
  SessionLaunchModal (condicional 1ª vs continuada), ApplySessionModal
  (fallback allDay, dias fora do período), SessionInviteFeed/Card,
  PlayerCommunityHub (3 sub-abas, persistência), MasterCommunityView (aba
  calendário), SessionDetailDrawer (panorama + confirmar/cancelar).
- **Regressão**: PlayerDashboard (aba community agora renderiza o hub),
  MasterCommunityView testes existentes.

## 9. Ondas de execução (subagents quando pedido; inline por padrão)

1. **Fundação**: schema + migração + validadores + utils de data (paralelo:
   schema/DB ∥ validadores+utils).
2. **Backend**: session-service + rotas + socket (agente único — arquivos
   acoplados).
3. **UI base** (paralelo, arquivos disjuntos): CalendarGrid ∥
   SessionLaunchModal+SessionDetailDrawer ∥ SessionInviteFeed+ApplySessionModal.
4. **Integração** (agente único): MasterCommunityView, PlayerCommunityHub,
   PlayerDashboard, subscrições socket.
5. **Verificação final**: suite completa, tsc, eslint, checklist manual.

## 10. Fora de escopo

- Notificações push/e-mail, lembretes automáticos.
- Drag-and-drop de eventos no calendário, reschedule por arrasto.
- Recorrência de sessões (weekly etc.).
- Chat por sessão (usa o chat da campanha existente).
- Fuso horário por usuário (tudo local do navegador).
