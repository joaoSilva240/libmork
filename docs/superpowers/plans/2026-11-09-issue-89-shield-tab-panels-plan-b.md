# Plano B — Agrupamento por Camada de Renderização (config legado preservado)

**Issue:** #89 — feat(shield): consolidar módulos do escudo em painéis com abas
**Data:** 2026-11-09
**Estratégia:** Abordagem incremental/mínima — os IDs de módulo e o `useMasterScreenConfig` **não mudam**. O agrupamento acontece na renderização: uma camada em `CampaignDetail` particiona a coluna em grupos fixos por afinidade e envolve os módulos em contêineres com abas.

## Arquitetura

### 1. Componente de abas

**`src/components/campaigns/shield/ShieldTabGroup.tsx`**

- Contêiner reutilizável: cabeçalho com abas por ícone `lucide-react` (tooltip, `role="tablist"`, `aria-selected`, teclado, `focus-visible:ring-accent`), corpo flexível que preenche a altura disponível (`lg:flex-1`), herdando o estilo visual dos painéis atuais (`rounded-lg border ... bg-* p-3`).
- Diferença-chave vs. Plano A: **renderiza condicionalmente apenas a aba ativa** — exceto a Jukebox, que recebe tratamento especial (prop `keepMounted`, ver §2) para não interromper o áudio.
- Persistência da aba ativa: hook dedicado **`src/hooks/useShieldActiveTab.ts`** com chaves `libmork:shield-tab:media` e `libmork:shield-tab:actors`; leitura pós-hidratação (padrão `MasterSidebar`) para não divergir do SSR.
- Fallback: se a aba salva corresponde a módulo com flag de visibilidade desligada, seleciona a primeira visível.

### 2. Agrupamento em `CampaignDetail.tsx`

- Nova função `renderShieldColumn(order: ShieldModuleId[])` que:
  1. Filtra módulos invisíveis (flags atuais).
  2. **Particiona** a lista em grupos: `worlds|assets|jukebox` → grupo "media"; `charactersNpcs|players` → grupo "actors"; `sessionLog` → grupo próprio (renderizado fora das abas, altura elástica restante, como hoje).
  3. Para cada grupo com ≥1 módulo visível, renderiza um `ShieldTabGroup` com abas apenas dos módulos visíveis do grupo; módulos órfãos (ex.: só `jukebox` visível no grupo media) renderizam o painel direto, **sem cabeçalho de abas** (sem custo de UI quando não há alternativa).
- Jukebox: `MasterJukebox` recebe `keepMounted` — dentro do `ShieldTabGroup`, quando `keepMounted`, o grupo renderiza a jukebox sempre montada sob `hidden` e o restante das abas condicionalmente. Assim o áudio persiste (critério de aceitação) sem precisar montar tudo.
- Redimensionamento: cada `ShieldTabGroup` usa `useResizableLayout` com storage key `libmork:campaign-tabgroup-<grupo>:<campaign.id>`; handles individuais dos painéis internos (`resize-worlds-panel` etc.) são removidos quando dentro de grupo.
- Assinaturas WebSocket: `CampaignInvites` (aba players) continua montando/remontando conforme aba ativa — para preservar a otimização da #75, extrair as assinaturas para hook `useCampaignInviteSubscriptions(enabled)` usado pelo `CampaignInvites` de players; desabilitado quando a aba players não está ativa **e** não é `keepMounted`.

### 3. O que NÃO muda

- `ShieldModuleId`, `leftColumnOrder`, `rightColumnOrder`, `sanitizeColumnOrder` — intactos; usuários mantêm ordenação customizada.
- `MasterScreenConfigPanel.tsx` — sem alterações estruturais (opcional: rótulo explicando o agrupamento).
- Módulos ficam fixos ao seu grupo temático (módulo não pode "escapar" do grupo — limitação consciente desta abordagem).

## Passos de implementação

1. `useShieldActiveTab` (persistência pós-hidratação + fallback por visibilidade) + teste.
2. `ShieldTabGroup` (abas acessíveis, `keepMounted` por aba) + testes.
3. Hook `useCampaignInviteSubscriptions` em `CampaignInvites` + teste.
4. `renderShieldColumn` com particionamento em `CampaignDetail.tsx`.
5. Remover handles de resize individuais dos painéis agrupados; adicionar handle no grupo.

## Testes

- `ShieldTabGroup.test.tsx`: abas por ícone/tooltip, troca, `keepMounted` (jukebox não remonta), fallback quando aba invisível, grupo com módulo único sem cabeçalho.
- `useShieldActiveTab.test.ts`: persistência e restauração.
- `useCampaignInviteSubscriptions.test.ts`: liga/desliga conforme aba ativa.
- `CampaignDetail.shieldTabs.test.tsx`: particionamento de coluna, sessionLog fora das abas, responsividade/altura contida.
- Testes existentes (`CampaignDetail.moduleLayout.test.tsx`, `MasterScreenConfigPanel.reorder.test.tsx`) atualizados conforme comportamento.

## Riscos / Trade-offs vs. Plano A

- ✅ Menor diff, zero migração de config, zero risco para usuários com ordenação customizada.
- ⚠️ Agrupamento fixo por afinidade — sem novos IDs de módulo, flexibilidade de "posicionar contêineres unificados entre colunas" (pedido na issue) fica limitada à posição do primeiro módulo do grupo.
- ⚠️ Remontagem de painéis não-keepMounted ao trocar aba (scroll/seleção internos podem resetar) — mitigável promovendo painéis a `keepMounted` caso a caso.
