# Fallout 2d20 — Fase 3: Catálogo de Perks e Biblioteca Global Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrar a Biblioteca Global oficial do Fallout 2d20 (perks e itens importados) ao assistente de criação (`FalloutCharacterWizard`) e à ficha do sobrevivente (`PipBoySheet`), permitindo busca, filtragem por SPECIAL/categoria, seleção com múltiplos ranks e expansão detalhada de regras e efeitos.

**Architecture:** 
- Atualizar tipos e normalizadores em `src/lib/systems/fallout/types.ts` e `rules.ts` para suportar `FalloutCharacterPerk` estruturado preservando retrocompatibilidade com `string[]`.
- No `FalloutCharacterWizard`, substituir o campo de texto livre de `StepPerks` por um catálogo com consulta à API `/api/content/spells?ruleSystem=fallout_2d20`, busca textual, chips de filtro por atributo SPECIAL e controles de rank.
- Na ficha `PipBoySheet`, implementar cards expansíveis (accordions) na aba DATA (perks) e INV (equipamentos), além dos modais `PipBoyPerkPickerModal` e `PipBoyItemPickerModal` para adição em jogo.

**Tech Stack:** React 19, TypeScript, Next.js 16, Tailwind CSS (tema Pip-Boy/Vault-Tec), Lucide React, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-13-fallout-perks-and-library-design.md`

## Global Constraints

- Preservar retrocompatibilidade total com fichas existentes cujo campo `perks` é um `string[]`.
- Usar ícones oficiais e Lucide React exclusivamente.
- Manter o tema visual terminal RobCo / Pip-Boy (`bg-black`, `border-emerald-500`, `text-emerald-300`, `text-amber-400`).
- Validação de requisitos de perks deve ser informativa (exibe aviso visual sem bloquear a confirmação do mestre/jogador).

---

### Task 1: Tipagem Estruturada e Normalização de Perks

**Files:**
- Modify: `src/lib/systems/fallout/types.ts`
- Modify: `src/lib/systems/fallout/rules.ts`
- Test: `src/lib/systems/fallout/__tests__/perks.test.ts`

- [ ] **Step 1: Escrever teste de falha para normalização de perks**

Criar `src/lib/systems/fallout/__tests__/perks.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { normalizeFalloutPerk } from "../rules";
import type { FalloutCharacterPerk } from "../types";

describe("Fallout Perks Normalization", () => {
  it("converte string legada em FalloutCharacterPerk com rank 1", () => {
    const perk = normalizeFalloutPerk("Action Boy");
    expect(perk).toEqual({
      name: "Action Boy",
      rank: 1,
    });
  });

  it("mantém objeto FalloutCharacterPerk intacto garantindo rank mínimo de 1", () => {
    const input: FalloutCharacterPerk = {
      name: "Gun Nut",
      rank: 2,
      maxRank: 4,
      description: "Permite criar mods de armas.",
      requirements: "INT 6",
    };
    const perk = normalizeFalloutPerk(input);
    expect(perk).toEqual(input);
  });
});
```

- [ ] **Step 2: Executar teste e verificar falha**
Run: `npx vitest run src/lib/systems/fallout/__tests__/perks.test.ts`

- [ ] **Step 3: Implementar tipo e função de normalização**
Adicionar `FalloutCharacterPerk` em `src/lib/systems/fallout/types.ts` e a função `normalizeFalloutPerk` em `src/lib/systems/fallout/rules.ts`.

- [ ] **Step 4: Executar teste e verificar sucesso**
Run: `npx vitest run src/lib/systems/fallout/__tests__/perks.test.ts`

- [ ] **Step 5: Commit**
```bash
git add src/lib/systems/fallout/types.ts src/lib/systems/fallout/rules.ts src/lib/systems/fallout/__tests__/perks.test.ts
git commit -m "feat(fallout): adiciona tipagem estruturada e normalizacao de perks"
```

---

### Task 2: Catálogo de Perks Integrado no Wizard de Criação (`StepPerks`)

**Files:**
- Modify: `src/components/systems/fallout/FalloutCharacterWizard.tsx`
- Test: `src/components/systems/fallout/__tests__/FalloutCharacterWizard.test.tsx`

- [ ] **Step 1: Adicionar casos de teste para o catálogo de perks no Wizard**
Testar busca de perks, filtro por SPECIAL, adição à lista e ajuste de rank.

- [ ] **Step 2: Executar teste e verificar falha**
Run: `npx vitest run src/components/systems/fallout/__tests__/FalloutCharacterWizard.test.tsx`

- [ ] **Step 3: Atualizar StepPerks no Wizard**
Buscar `/api/content/spells?ruleSystem=fallout_2d20`, adicionar input de busca, chips por atributo, cards com requisitos e botões de adicionar/remover/ajustar rank.

- [ ] **Step 4: Executar testes e verificar sucesso**
Run: `npx vitest run src/components/systems/fallout/__tests__/FalloutCharacterWizard.test.tsx`

- [ ] **Step 5: Commit**
```bash
git add src/components/systems/fallout/FalloutCharacterWizard.tsx src/components/systems/fallout/__tests__/FalloutCharacterWizard.test.tsx
git commit -m "feat(fallout): integra catalogo de perks oficial no wizard de criacao"
```

---

### Task 3: Visualização em Accordion e Modal de Perks no Pip-Boy (Aba DATA)

**Files:**
- Create: `src/components/systems/fallout/PipBoyPerkPickerModal.tsx`
- Modify: `src/components/systems/fallout/PipBoySheet.tsx`
- Test: `src/components/systems/fallout/__tests__/PipBoyPerkPickerModal.test.tsx`
- Test: `src/components/systems/fallout/__tests__/PipBoySheet.test.tsx`

- [ ] **Step 1: Escrever teste de falha para PipBoyPerkPickerModal**
- [ ] **Step 2: Implementar PipBoyPerkPickerModal.tsx**
- [ ] **Step 3: Integrar accordion de detalhes e botão de adicionar na aba DATA de PipBoySheet.tsx**
- [ ] **Step 4: Executar testes de PipBoySheet e PipBoyPerkPickerModal**
Run: `npx vitest run src/components/systems/fallout/__tests__/PipBoyPerkPickerModal.test.tsx src/components/systems/fallout/__tests__/PipBoySheet.test.tsx`

- [ ] **Step 5: Commit**
```bash
git add src/components/systems/fallout/PipBoyPerkPickerModal.tsx src/components/systems/fallout/PipBoySheet.tsx src/components/systems/fallout/__tests__/PipBoyPerkPickerModal.test.tsx src/components/systems/fallout/__tests__/PipBoySheet.test.tsx
git commit -m "feat(fallout): adiciona accordion de perks e modal de selecao na aba DATA"
```

---

### Task 4: Detalhes de Equipamentos e Modal Seletor de Itens no Pip-Boy (Aba INV)

**Files:**
- Create: `src/components/systems/fallout/PipBoyItemPickerModal.tsx`
- Modify: `src/components/systems/fallout/PipBoySheet.tsx`
- Test: `src/components/systems/fallout/__tests__/PipBoyItemPickerModal.test.tsx`

- [ ] **Step 1: Escrever teste de falha para PipBoyItemPickerModal**
- [ ] **Step 2: Implementar PipBoyItemPickerModal.tsx com filtros por categoria de item**
- [ ] **Step 3: Adicionar accordion de estatísticas de item e botão de adicionar na aba INV de PipBoySheet.tsx**
- [ ] **Step 4: Executar testes de PipBoyItemPickerModal e PipBoySheet**
Run: `npx vitest run src/components/systems/fallout/__tests__/PipBoyItemPickerModal.test.tsx src/components/systems/fallout/__tests__/PipBoySheet.test.tsx`

- [ ] **Step 5: Commit**
```bash
git add src/components/systems/fallout/PipBoyItemPickerModal.tsx src/components/systems/fallout/PipBoySheet.tsx src/components/systems/fallout/__tests__/PipBoyItemPickerModal.test.tsx
git commit -m "feat(fallout): adiciona detalhes de equipamentos e seletor de itens na aba INV"
```

---

### Task 5: Validação Final, Tipagem e Testes de Regressão

**Files:**
- Todos os arquivos modificados

- [ ] **Step 1: Executar verificação de tipos TypeScript**
Run: `npx tsc --noEmit`

- [ ] **Step 2: Executar toda a suíte de testes do Fallout 2d20**
Run: `npx vitest run src/components/systems/fallout/ src/lib/systems/fallout/ src/app/api/systems/fallout/`

- [ ] **Step 3: Verificar status limpo do git**
Run: `git status`
