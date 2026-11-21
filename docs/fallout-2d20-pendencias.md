# Fallout 2d20 — Pendências e Estado de Entrega

**Data do levantamento:** 2026-11-20
**Branch:** `feat/fallout-2d20-system` (base `38b4807`, merge de `origin/main`)
**Escopo:** o que falta para fechar a frente Fallout 2d20, separado entre bloqueios operacionais, lacunas funcionais e ruído pré-existente do repositório.

> Todos os itens abaixo foram verificados contra o código nesta data. Itens marcados como **não verificável aqui** dependem de acesso ao banco real ou de outro checkout.

---

## 1. O que já está entregue

Para contextualizar o que falta:

- Motor de regras puro (`src/lib/systems/fallout/rules.ts`): SPECIAL, perícias, TN, críticos por Tag Skill, custo de AP de dados extras, crédito de AP em dado natural 1, Pontos de Sorte, radiação com clamp e estágios.
- Servidor autoritativo: `/api/systems/fallout/roll`, `/roll/reroll`, `/radiation`, `/campaigns/[id]/ap` (delta), com `db.transaction` + row locks.
- Re-rolagem dado a dado em teste falho, 1 Ponto de Sorte por dado re-rolado, debitada no servidor.
- Radiação: teto efetivo de PV = `hpMax − rads`, estágios em 0 / >0 / ≥25% / ≥50% / ≥75% / 100% com penalidade de dificuldade 0/0/1/1/2/2, imunidade para `ghoul`, `super_mutant` e `mister_handy`.
- Ficha Pip-Boy 3000 (STAT / SPECIAL / INV / DATA) e wizard de criação em 4 fases.
- **Card de recursos no Escudo do Mestre** (`src/components/campaigns/shield/MasterFalloutPanel.tsx`): AP da Equipe, AP do Supervisor e Radiação numa aba do painel de mídia, ao lado de Mundos / Assets / Jukebox, exclusiva de `rulesEngine === "fallout_2d20"`. Os widgets saíram do cabeçalho de `CampaignDetail`.
- Hooks compartilhados `src/hooks/useFalloutAP.ts` e `src/hooks/useFalloutRadiation.ts` — uma fonte de verdade para o card do mestre e o widget do Pip-Boy.

**Verificação desta entrega:** suíte completa `195 arquivos / 1490 testes` verde, `tsc --noEmit` limpo, ESLint 0 erros, Prettier ok nos arquivos alterados. Card conferido no navegador nas larguras reais da coluna esquerda (200 / 240 / 380px): sem overflow horizontal, sem texto cortado, controles alcançáveis, interações de AP e radiação funcionando.

---

## 2. Bloqueios operacionais

Impedem o uso da frente em produção. Nenhum é bug de código.

### 2.1 Migrações aditivas 0024–0027 não aplicadas no banco real

O projeto **não usa migration files para o banco real**: `drizzle/meta/` é gitignored (`.gitignore:52`) e o journal local tem só 2 entradas. O caminho validado é aplicar o delta aditivo por script idempotente (`CREATE TABLE/INDEX IF NOT EXISTS`, FKs em `DO $$ ... EXCEPTION WHEN duplicate_object`, tudo numa transação) e conferir por consulta read-only ao `information_schema`.

Scripts pendentes de aplicação/confirmacao:

| Script                                     | Conteúdo                                                                                | Frente                 |
| ------------------------------------------ | --------------------------------------------------------------------------------------- | ---------------------- |
| `drizzle/0024_npc_pin_damage.sql`          | `attack_expression`, `damage_expression`, `damage_type`, `critical_range` em `npc_pins` | Issue #90              |
| `drizzle/0025_create_attacks.sql`          | tabela `attacks` como conteúdo da Biblioteca Global                                     | Issue #90              |
| `drizzle/0026_add_fallout_2d20_system.sql` | `fallout_campaign_states` + `fallout_characters` + 3 índices                            | Fallout                |
| `drizzle/0027_library_rule_system.sql`     | `rule_system` em `spells`, `items`, `skills`, `conditions`                              | Biblioteca por sistema |

**Atenção:** `npm run db:push` falha com `Interactive prompts require a TTY terminal` num tablesResolver ambíguo (drift entre `schema.ts` e o banco real). **Não responder prompts de rename no escuro.** `db:generate` já produziu migration com drift (recriava tabelas existentes) e foi descartada.

**Não verificável aqui:** este checkout não tem `DATABASE_URL` no `.env`, então não foi possível confirmar quais desses scripts já estão aplicados no banco externo. O WIP atual **não altera `schema.ts`** — radiação e `luck_points_current` já existem em `0026` (`src/lib/db/schema.ts:935-936`), logo nenhuma migração nova é exigida por esta entrega.

### 2.2 Relay de radiação exige reiniciar o dev server

`server.js:448-450` adicionou o relay `fallout:radiation-update` → `fallout:radiation-updated`. O `server.js` **não é hot-reloaded**: um processo de dev já em execução continua com os handlers antigos.

Sintoma observado: AP sincroniza entre mestre e jogador, radiação não. Os handlers foram validados subindo `server.js` isolado na porta 3999 (com `next` stubado) — ambos os relays ecoaram corretamente. **Ação pendente: reiniciar o processo de dev.** O relay de AP (`server.js:438-440`) já existia.

### 2.3 Colisão de prefixo de migração entre branches

- Nesta branch existem **dois** scripts `0023`: `0023_add_campaign_dice3d_toggles.sql` e `0023_add_scene_columns.sql`.
- A branch `fix/dice3d-sync-ai-translation-canvas-grid` (commit local `d5c0888`, **não pushado**) traz `drizzle/0024_add_master_ai_settings.sql`, que colide com `0024_npc_pin_damage.sql` desta branch.

**Ação pendente:** renomear o script da outra branch para `0028_add_master_ai_settings.sql` antes de PR/rebase, e resolver a duplicidade de `0023`. Como os scripts são aplicados manualmente, a colisão não quebra o banco hoje, mas torna a ordem de aplicação ambígua.

### 2.4 Sem PR aberto

`gh pr list --head feat/fallout-2d20-system --state all` retorna vazio. A branch está **3 commits à frente** de `origin/feat/fallout-2d20-system` (`38b4807` merge de main, `eb52095` cenas #86, `88674c5` overlay/chat/studio #95), mais o WIP desta entrega.

---

## 3. Lacunas funcionais do sistema Fallout

Funcionalidade que existe parcialmente ou não existe. Ordenadas por impacto.

### 3.1 Endpoint de Dados de Combate (DC) sem caller na UI

`src/app/api/systems/fallout/combat-dice/route.ts` está implementado e testado (`src/app/api/systems/fallout/__tests__/routes.test.ts:504`), mas **nenhum componente o chama** — a única referência fora a própria rota é o teste. Rolar dano de arma hoje não tem caminho pela interface.

### 3.2 Tracker de combate não é Fallout-aware

`src/components/combat/*.tsx` (`CombatTrackerModal`, `PlayerTurnOverlay`, `TargetSelectionModal`, `DeathSaveModal`, `DefenseReactionModal`, duelos) não tem **nenhuma** referência a `fallout` ou `rulesEngine`. `EncounterModal.tsx` também não. Consequência: iniciativa, turnos e reações usam o fluxo d20 genérico; o AP da Equipe não é consumido por turno e a radiação não entra no combate.

### 3.3 `scarcityLevel` persistido, mas sem UI e sem efeito

A coluna existe (`src/lib/db/schema.ts:910`), o tipo existe (`src/lib/systems/fallout/types.ts:328`, valores `abundant | standard | scarce | desolate`) e o serviço lê/escreve (`src/lib/server/fallout-service.ts:65,88`, sempre `"standard"` na criação). **Nenhuma regra nem tela usa o valor** — não há como o mestre mudar a escassez, e ela não altera recompensa nem disponibilidade de itens.

### 3.4 Testes pendentes de re-rolagem vivem em memória

`src/lib/server/fallout-roll-store.ts:34-35` — TTL de 5 minutos, teto de 500 entradas, `Map` no `globalThis`. É intencional (mesma natureza da presença do Socket.IO), mas implica:

- reiniciar o servidor invalida toda re-rolagem pendente;
- passar de 5 minutos sem re-rolar perde a oferta de Sorte;
- múltiplas instâncias não compartilham o store.

Se a frente for para produção com mais de uma instância, isso precisa de armazenamento compartilhado.

### 3.5 Socket.IO sem adapter compartilhado

`server.js` não usa Redis adapter (nenhuma referência a `redis`/`adapter`), embora `REDIS_URL` exista no `.env`. Todo o tempo real — AP, radiação, dados 3D, log, combate — é relay em memória por sala `campaign:<id>`. **Não escala horizontalmente.** É o mesmo estado do resto do app, não uma regressão do Fallout.

---

## 4. Limites da verificação feita

Registrar para não confundir "testado" com "verificado em produção":

- **Sem banco real neste checkout** (`.env` sem `DATABASE_URL`): não houve verificação com login, campanha real ou dados persistidos. As rotas foram exercitadas por testes com mock de banco e, no navegador, por um harness temporário com stub de `fetch` usando as regras reais.
- **Sem screenshot**: `take_screenshot` do browser-use retornou `NATIVE_BROWSER_VIEWPORT_UNAVAILABLE`. A checagem visual foi por geometria do DOM (bounding boxes, `scrollWidth` vs `clientWidth`, cores computadas), não por imagem.
- **Harness temporário removido**: `src/app/preview-shield-fallout/` foi deletado após a verificação. Não sobrou rota de preview no repo.
- **Flake conhecido**: `src/components/chat/__tests__/CampaignChat.test.tsx:104` falhou uma vez sob carga paralela da suíte completa e passou na re-execução e isolado. O arquivo não foi tocado por esta entrega e tem `SocketContext` totalmente mockado. É fragilidade de `waitFor` com timeout padrão de 1s, não regressão.

---

## 5. Ruído pré-existente do repositório

Não bloqueia esta frente, mas gera falsos positivos ao verificar. Não gastar turnos "corrigindo" sem pedido explícito.

- **Prettier vs CRLF**: `core.autocrlf=true` contra `"endOfLine": "lf"` no `.prettierrc` faz `prettier --check` falhar em arquivos intocados (ex.: `PlayerDashboard.tsx`, confirmado falhando também em `HEAD`). Para ver o diff real: `git diff --ignore-cr-at-eol`.
- **ESLint**: avisos de `react-hooks/set-state-in-effect` em carregamento de dados dentro de effect (padrão do repo, agora também em `src/hooks/useFalloutRadiation.ts:71`) e `any`/`<img>` em componentes mais antigos. Comparar com `git show HEAD:<arquivo> | npx eslint --stdin --stdin-filename <arquivo>` antes de mexer.
- **Docs desatualizados**: README e `docs/01`/`docs/02` descrevem fases e fórmulas que o código já superou (Next 15 vs 16, 5 vs 6 atributos, pontos de criação, perícias treinadas). Usar como histórico de decisões, não como referência de comportamento.
- **`WorldSelectorModal.tsx` órfão**: continua sem nenhum import (`src/components/campaigns/WorldSelectorModal.tsx` referencia só a si mesmo). Apagar ou não segue pendente de decisão do dono.
- **Camada offline órfã**: Dexie (rascunhos + fila de mutações) não está ligada a formulários/fichas.
- **Mundos — semântica destrutiva**: `POST /api/campaigns/:id/worlds` reassina o `campaign_id` do mundo (pode tirá-lo de outra campanha) e `DELETE /api/campaigns/:id/worlds/:worldId` apaga a linha do mundo em vez de só desvincular. Proteção oferecida, decisão pendente.
- **`.env.example` versionado com valores que parecem credenciais reais** (`DATABASE_URL`, `NINEROUTER_KEY`). Tratar como expostos; não replicar segredos em novos commits.

---

## 6. Checklist de fechamento

Operacional, na ordem:

- [ ] Aplicar/confirmar `0024`–`0027` no banco real por script aditivo idempotente e conferir via `information_schema`.
- [ ] Reiniciar o dev server para carregar o relay de radiação de `server.js:448`.
- [ ] Renomear `0024_add_master_ai_settings.sql` → `0028_*` na branch `fix/dice3d-sync-ai-translation-canvas-grid` e resolver o `0023` duplicado.
- [ ] Verificar a frente com banco real e login (mestre + jogador na mesma campanha): crédito/débito de AP, radiação com imunes, re-rolagem com Sorte.
- [ ] Abrir PR de `feat/fallout-2d20-system`.

Funcional, exige decisão de escopo:

- [ ] Ligar o endpoint `combat-dice` a alguma interface (ficha Pip-Boy ou tracker).
- [ ] Decidir se o tracker de combate ganha ramo Fallout (iniciativa, gasto de AP por turno, radiação em combate).
- [ ] Definir se `scarcityLevel` ganha UI e efeito, ou se sai do schema.
- [ ] Decidir se o store de re-rolagem e o relay Socket.IO precisam de estado compartilhado antes de escalar.
