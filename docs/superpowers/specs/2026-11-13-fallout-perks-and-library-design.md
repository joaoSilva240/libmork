# Design Doc: Fallout 2d20 — Fase 3: Catálogo de Perks e Integração com a Biblioteca Global

- **Data:** 2026-11-13
- **Branch:** `feat/fallout-2d20-improvements`
- **Status:** Aprovado

---

## 1. Visão Geral e Objetivos

O sistema Fallout 2d20 no Libmork possui os ~204 perks oficiais e ~1.094 itens de equipamento já importados na Biblioteca Global (`rule_system = 'fallout_2d20'`). No entanto, o assistente de criação (`FalloutCharacterWizard`) atualmente possui apenas um campo de texto livre rudimentar na Fase 4 (Perks), e a ficha em jogo (`PipBoySheet`) lista apenas nomes de perks sem descrições detalhadas nem possibilidade de adicionar novos perks ou itens do compêndio.

Esta funcionalidade entrega:
1. **Catálogo de Perks Integrado no Wizard de Criação (`StepPerks`):**
   - Consumo de `GET /api/content/spells?ruleSystem=fallout_2d20`.
   - Busca por texto e filtros rápidos por atributo S.P.E.C.I.A.L.
   - Cards temáticos com ícones, requisitos de S.P.E.C.I.A.L./nível e regras completas.
   - Suporte a múltiplos ranks e fallback para perk customizado.
2. **Visualização Enriquecida e Gestão de Perks no Pip-Boy (Aba DATA):**
   - Accordion expansível para ler descrições completas e requisitos de cada perk.
   - Ajuste de rank em jogo (para personagens em evolução).
   - Modal seletor para adicionar novos perks da Biblioteca Global.
3. **Gestão de Equipamentos no Pip-Boy (Aba INV):**
   - Accordion com estatísticas completas de itens (dados DC de armas, qualidades, RD de armaduras).
   - Modal seletor para adicionar itens do compêndio da biblioteca global.

---

## 2. Modelo de Dados & Tipos

### 2.1 Estrutura do Perk do Personagem
```typescript
export interface FalloutCharacterPerk {
  name: string;
  rank: number;
  maxRank?: number;
  description?: string | null;
  requirements?: string | null;
  imageUrl?: string | null;
  sourceKey?: string;
}

// Normalizador universal compatível com string[] legado
export function normalizeFalloutPerk(entry: string | FalloutCharacterPerk): FalloutCharacterPerk {
  if (typeof entry === "string") {
    return { name: entry, rank: 1 };
  }
  return {
    ...entry,
    rank: Math.max(1, entry.rank ?? 1),
  };
}
```

---

## 3. Componentes da Interface

### 3.1 Wizard: Catálogo de Perks (`StepPerks`)
- Busca de perks da API com estado de carregamento e tratamento de erro.
- Filtro por atributo (`FOR`, `PER`, `RES`, `CAR`, `INT`, `AGI`, `SOR`).
- Indicador visual nos requisitos:
  - Verde: Atende aos requisitos do personagem em criação.
  - Âmbar: Alerta de não conformidade (permitido com confirmação).
- Seletor de ranks `[-]` / `[+]` respeitando `maxRank`.

### 3.2 Ficha Pip-Boy: Aba DATA & Modal de Perks
- `PipBoyPerkPickerModal`: modal estilo terminal RobCo para selecionar perks em jogo.
- Detalhes de cada perk em accordion dentro de `PipBoySheet`.

### 3.3 Ficha Pip-Boy: Aba INV & Modal de Equipamento
- `PipBoyItemPickerModal`: modal estilo terminal RobCo com filtro por categoria (`weapon`, `apparel`, `consumable`, `ammo`, `mod`).
- Adição instantânea ao inventário do sobrevivente com peso e caps.

---

## 4. Estratégia de Testes
- Testes unitários para `FalloutCharacterWizard` cobrindo busca, filtros, seleção e ranks.
- Testes unitários para `PipBoySheet` cobrindo expansão de detalhes e acionamento dos modais.
- Testes de normalização e validação das estruturas.
