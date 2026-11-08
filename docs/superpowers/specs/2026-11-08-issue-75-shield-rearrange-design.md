# Design Doc: Rearranjo de Elementos entre Colunas do Escudo do Mestre e Visibilidade de Assets

- **Data:** 2026-11-08
- **Issue:** [#75 — feat(shield): rearranjo de elementos entre colunas do escudo do mestre e visibilidade dos assets](https://github.com/joaoSilva240/libmork/issues/75)
- **Status:** Aprovado

---

## 1. Visão Geral e Objetivos

O Escudo do Mestre (`CampaignDetail.tsx`) organiza a mesa em três colunas no desktop: Gestão (esquerda), Mesa Tática/Roster (centro) e Log da Sessão (direita). Atualmente, a posição dos elementos dentro dessas colunas é rígida e o painel de Assets & Handouts não possui controle de visibilidade.

Esta especificação define:
1. Controle de visibilidade para o módulo de Assets & Handouts (`showAssets`).
2. Interface com suporte a arrastar e soltar (HTML5 Drag & Drop nativo) e botões de acessibilidade na tela de configurações do mestre (`MasterScreenConfigPanel`) para ordenar e remanejar os 6 módulos laterais entre as colunas esquerda e direita.
3. Renderização dinâmica dos módulos no Escudo do Mestre (`CampaignDetail`), garantindo contenção elástica de altura no Log da Sessão para impedir estouro vertical de tela.
4. Persistência de ordem e visibilidade entre sessões no `localStorage`.

---

## 2. Modelo de Dados & Hook (`useMasterScreenConfig.ts`)

### Identificadores dos Módulos
```typescript
export type ShieldModuleId =
  | "worlds"
  | "assets"
  | "jukebox"
  | "charactersNpcs"
  | "players"
  | "sessionLog";
```

### Configuração Expandida
```typescript
export type MasterScreenConfig = {
  // Visibilidade de Módulos (com novo showAssets)
  showRoster: boolean;
  showSessionLog: boolean;
  showCanvas: boolean;
  showMap: boolean;
  showJukebox: boolean;
  showDiceRolls: boolean;
  showCharactersNpcs: boolean;
  showPlayers: boolean;
  showAssets: boolean; // default: true

  // Distribuição e ordenação das colunas
  leftColumnOrder: ShieldModuleId[];
  rightColumnOrder: ShieldModuleId[];

  // Configurações de IA existentes
  aiApiKey?: string;
  aiApiEndpoint?: string;
  aiModel?: string;
};
```

### Valores Padrão
```typescript
export const DEFAULT_SHIELD_LEFT_ORDER: ShieldModuleId[] = [
  "worlds",
  "assets",
  "jukebox",
  "charactersNpcs",
  "players",
];

export const DEFAULT_SHIELD_RIGHT_ORDER: ShieldModuleId[] = [
  "sessionLog",
];
```

### Sanitização & Resiliência
A função `sanitizeMasterScreenConfig` é atualizada para:
- Preservar `showAssets` (default `true` se indefinido).
- Validar se `leftColumnOrder` e `rightColumnOrder` são arrays de `ShieldModuleId`.
- Garantir que cada um dos 6 módulos exista exatamente uma vez entre `leftColumnOrder` e `rightColumnOrder`. Módulos ausentes são anexados à sua coluna padrão. Módulos duplicados são desduplicados.

---

## 3. Interface de Configuração (`MasterScreenConfigPanel.tsx`)

A aba *Tela do Mestre & Módulos* em `/master/settings` é atualizada com duas seções integradas:

### 3.1 Preferências de Visibilidade
Adiciona o checkbox para **Assets e Handouts** (`showAssets`) com a descrição:
- "Exibe o painel de handouts, mapas e cenas visuais compartilháveis."

### 3.2 Organizador de Módulos (Drag & Drop + A11y)
Duas colunas lado a lado representadas visualmente:
- **Coluna Esquerda (Gestão Padrão)**
- **Coluna Direita (Logs Padrão)**

Cada módulo é renderizado como um card com:
- Alça de arrasto (`GripVertical` do `lucide-react`) com cursor `grab`/`grabbing`.
- Ícone temático (`Music`, `Image`, `MapPin`, `Users`, `UserCheck`, `ScrollText`).
- Nome descritivo e badge de status (`Ativo` ou `Oculto`).
- Controles de acessibilidade por botão:
  - `ArrowUp` (`↑`) / `ArrowDown` (`↓`): sobe ou desce o módulo na coluna.
  - `ArrowLeftRight` (`⇄`): transfere o módulo para a outra coluna.

Eventos de Drag & Drop nativos:
- `onDragStart`: marca o módulo arrastado e aplica `opacity-50`.
- `onDragOver`: permite drop e exibe indicador visual de inserção.
- `onDrop`: calcula a nova posição e atualiza `leftColumnOrder` e `rightColumnOrder`.

### 3.3 Visualização em Tempo Real (`MasterScreenPreview.tsx`)
O preview lateral reflete a distribuição dinâmica dos módulos entre a coluna 1 e a coluna 3.

---

## 4. Renderização no Escudo do Mestre (`CampaignDetail.tsx`)

### 4.1 Renderizador Modular
Criação da função auxiliar `renderShieldModule(moduleId: ShieldModuleId)`:
- `"worlds"`: se `showMap` estiver ativo, renderiza o painel de mundos com resize handle vertical.
- `"assets"`: se `showAssets` estiver ativo, renderiza `MasterAssetsPanel`.
- `"jukebox"`: se `showJukebox` estiver ativo, renderiza `MasterJukebox`.
- `"charactersNpcs"`: se `showCharactersNpcs` estiver ativo, renderiza `CampaignInvites` com `showPlayers={false}`.
- `"players"`: se `showPlayers` estiver ativo, renderiza `CampaignInvites` com `showCharactersNpcs={false}`.
- `"sessionLog"`: se `showSessionLog` estiver ativo, renderiza `SessionLog` (ou `MissingSessionLog`).

### 4.2 Contenção de Altura e Ajuste do Log
- Ambas as colunas (esquerda e direita) usam:
  ```css
  flex flex-col gap-3 overflow-y-auto min-h-0 h-full
  ```
- O módulo `"sessionLog"` recebe `flex-1 min-h-[220px]`.
- Quando outros módulos são movidos para a coluna direita junto ao log:
  - O log reduz de tamanho elasticamente, preenchendo o espaço remanescente.
  - Caso a soma das alturas mínimas dos elementos exceda a altura da viewport, a coluna rola verticalmente sem quebrar o layout da mesa central.
- Resize handles horizontais de largura (`resize-left-column` e `resize-right-column`) permanecem nas extremidades de cada coluna.

---

## 5. Plano de Testes

1. `useMasterScreenConfig.test.ts`: valores padrão, sanitização de ordens corrompidas, persistência no `localStorage`.
2. `MasterScreenConfigPanel.reorder.test.tsx`: renderização com ícones Lucide, ações por teclado (`↑`, `↓`, `⇄`), drag-and-drop nativo e toggle de assets.
3. `MasterScreenPreview.test.tsx`: validação de reflexão de ordens customizadas no preview.
4. `CampaignDetail.moduleLayout.test.tsx`: montagem dos componentes nas colunas corretas, ocultação de assets e contenção flexível do log.
