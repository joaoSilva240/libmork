# Plano A — Painéis Consolidados com Abas (módulos agregados em `useMasterScreenConfig`)

**Issue:** #89 — feat(shield): consolidar módulos do escudo em painéis com abas
**Data:** 2026-11-09
**Estratégia:** Abordagem estrutural — introduz dois novos IDs de módulo agregadores (`mediaPanel`, `actorsPanel`) no config do escudo e dois novos componentes de contêiner com abas. Migração automática do `localStorage` legado.

## Arquitetura

### 1. Novos componentes de contêiner

**`src/components/campaigns/shield/ShieldTabContainer.tsx`** (genérico)

- Props: `tabs: { id, label, icon, visible }[]`, `activeTab`, `onTabChange`, `persistKey`, `className`, `children` (render por aba ativa).
- Cabeçalho compacto: botões com ícone `lucide-react` + `title`/tooltip, `role="tablist"` / `role="tab"` / `aria-selected`, navegação por teclado (setas + Enter), `focus-visible:ring-accent` no padrão do projeto.
- Renderização: **todas as abas ficam montadas no DOM**; apenas a aba ativa é visível (`hidden` via classe). Isso garante que:
  - o áudio da `MasterJukebox` não para nem reinicia ao trocar de aba (critério de aceitação);
  - scroll, seleções e estado interno dos painéis são preservados.
- Apenas a aba visível usa `aria-hidden={false}` / ocultas `inert` para acessibilidade.
- Persistência: lê/escreve `localStorage` chave `libmork:shield-tabs:<persistKey>` pós-hidratação (padrão `MasterSidebar.tsx`: ler em `useEffect` para evitar divergência SSR).

**`src/components/campaigns/shield/MasterMediaPanel.tsx`**

- Tabs: `worlds` (MapPin), `assets` (Image), `jukebox` (Music).
- Recebe `showMap`, `showAssets`, `showJukebox` do config; abas desativadas são **ocultadas do cabeçalho**; se a aba ativa salva ficou invisível, cai para a primeira visível.
- Renderiza os componentes existentes (`WorldsPanel` extraído de `CampaignDetail`, `MasterAssetsPanel`, `MasterJukebox`) como children da aba, mantendo as props atuais (`isCompact`, `initialActiveAssetId`, etc.).
- Redimensionamento vertical do contêiner: um único `ResizeHandle` no contêiner (reutilizar `useResizableLayout` com storage key `libmork:campaign-media-panel:<id>`), removendo os handles individuais dos painéis internos.

**`src/components/campaigns/shield/MasterActorsPanel.tsx`**

- Tabs: `charactersNpcs` (Users), `players` (UserCheck).
- Reutiliza `CampaignInvites` duas vezes com as flags `showCharactersNpcs`/`showPlayers` atuais.
- Mantém as assinaturas WebSocket (`subscribeCampaignInviteCreated`/`Revoked`) **apenas na aba de Jogadores**, conforme otimização da issue #75 — `CampaignInvites` com `showPlayers={true}` já as registra; como ambos ficam montados, extrair as assinaturas para hook condicionado à aba (ex.: passar prop `subscriptionsEnabled`).

### 2. Config do escudo (`src/hooks/useMasterScreenConfig.ts`)

- Estender `ShieldModuleId` com `"mediaPanel" | "actorsPanel"` (mantendo os IDs legados para o `sanitize`).
- `DEFAULT_SHIELD_LEFT_ORDER: ["mediaPanel", "actorsPanel"]`; right permanece `["sessionLog"]`.
- `sanitizeColumnOrder`: além de filtrar IDs inválidos, **migrar** listas legadas — mapear `worlds|assets|jukebox → mediaPanel` e `charactersNpcs|players → actorsPanel`, preservando a posição relativa do primeiro módulo do grupo e deduplicando. Remover `sessionLog` de grupos indevidos permanece igual.
- Novos campos `mediaActiveTab?: "worlds" | "assets" | "jukebox"` e `actorsActiveTab?: "charactersNpcs" | "players"` **não** entram no config global — persistência de aba fica por chave própria no `localStorage` (mantém config enxuto e compatível).
- Flags `showMap`, `showAssets`, `showJukebox`, `showCharactersNpcs`, `showPlayers` continuam existindo (controlam visibilidade das abas); `MasterScreenConfigPanel.tsx` ajustado para refletir os dois blocos consolidados na lista de módulos/reordenação.

### 3. Integração em `CampaignDetail.tsx`

- O switch `renderModule` ganha cases `mediaPanel`/`actorsPanel` que delegam aos novos contêineres.
- Cases legados (`worlds`, `assets`, `jukebox`, `charactersNpcs`, `players`) permanecem no switch para compatibilidade durante migração, mas nunca são alcançados após o sanitize/migração — remover em commit de limpeza.
- Estado de mundos (`worlds`, `selectedWorldId`, `worldsPanel`) sobe para `CampaignDetail` ou para o `MasterMediaPanel` conforme acoplamento; preferir mover para `MasterMediaPanel` para reduzir o `CampaignDetail` (hoje 819 linhas), mantendo callbacks usados por outros overlays via props.

## Passos de implementação

1. `ShieldTabContainer` (genérico + acessibilidade + persistência).
2. `MasterMediaPanel` — extrair painel de Mundos de `CampaignDetail` para componente próprio; montar abas.
3. `MasterActorsPanel` + hook `subscriptionsEnabled` em `CampaignInvites`.
4. `useMasterScreenConfig`: novos IDs, defaults, migração no `sanitizeColumnOrder` + testes.
5. Integrar em `CampaignDetail` / `MasterScreenConfigPanel`.
6. Testes + limpeza dos cases legados.

## Testes

- `ShieldTabContainer.test.tsx`: troca de aba, `role="tablist"`/`aria-selected`, navegação por teclado, persistência no `localStorage` (restauração pós-hidratação), ocultação de aba invisível e fallback para primeira visível.
- `MasterMediaPanel.test.tsx`: jukebox montado sob `hidden` não remonta/pausa ao trocar aba (assert de que o `<audio>`/elemento persiste no DOM); abas ocultas conforme `showMap/showAssets/showJukebox`.
- `MasterActorsPanel.test.tsx`: assinaturas WS registradas só com aba players habilitada; ocultação conforme flags.
- `useMasterScreenConfig.test.ts`: migração de config legado (`leftColumnOrder` antigo → novos IDs, posição preservada, dedupe).
- Critérios de aceitação da issue cobertos item a item.

## Riscos

- Migração de config: usuários com ordenação customizada perdem granularidade por módulo (aceitável — os módulos agora são blocos).
- Áudio: garantir que trocar de aba não cause remontagem — testado explicitamente.
