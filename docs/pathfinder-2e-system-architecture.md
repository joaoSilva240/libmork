# Arquitetura de Suporte ao Sistema Pathfinder 2e (PF2e)

## 1. Visão Geral

Este documento técnico especifica o projeto arquitetural e o plano de implementação para adicionar o **Pathfinder 2e (PF2e)** como um sistema de regras selecionável e nativo no Libmork, coexistindo de forma modular e isolada com o sistema próprio (**Libmork**) e o sistema de horror analógico (**MISSING — Edição ZERO**).

---

## 2. Diagnóstico e Alinhamento com a Arquitetura Atual

O Libmork foi estruturado para suportar regras modulares por meio de abstrações que facilitam a introdução do PF2e:

1. **Contrato de Sistema de Jogo (`GameSystem`):**
   - Localização: `src/lib/engine/types.ts` e `src/lib/engine/registry.ts`.
   - Permite que qualquer subsistema registre funções puras de cálculo de modificador, derivação de atributos, resolução de ataques e testes.
2. **Isolamento por Campanha (`rulesEngine`):**
   - A tabela `campaigns` possui o campo `rules_engine varchar(50)`.
   - Atualmente suporta: `"d20_mod" | "dual_d20_sum" | "missing_zero"`.
   - A adição de `"pf2e"` não altera o comportamento de campanhas criadas nos outros motores.
3. **Catálogo de Conteúdo Pré-Existente:**
   - O repositório já conta com definições estruturadas para PF2e em `src/lib/content/`:
     - 12 Classes básicas em `pf2e-classes.ts` (Guerreiro, Ladino, Mago, Clérigo, Bárbaro, Bardo, Campeão, Druida, Monge, Patrulheiro, Feiticeiro, Alquimista).
     - Ancestralidades e heranças em `pf2e-races.ts`.
     - Stat blocks de monstros e tipos de dano em `pf2e-monsters.ts` e `pf2e-item-formatter.ts`.
4. **Economia de 3 Ações por Turno:**
   - O combate em tempo real do Libmork já implementa nativamente o ciclo de 3 ações por turno (`ACTIONS_PER_TURN = 3`), perfeitamente compatível com a mecânica oficial do PF2e.

---

## 3. Modelo de Dados e Alterações no Banco

### 3.1. Extensão de `RULES_ENGINES`

- Em `src/lib/utils/constants.ts`:
  ```typescript
  export const RULES_ENGINES = ["d20_mod", "dual_d20_sum", "missing_zero", "pf2e"] as const;
  export type RulesEngine = (typeof RULES_ENGINES)[number];
  ```

### 3.2. Ficha do Personagem (`characters`)

Para preservar compatibilidade retroativa sem quebrar fichas existentes do Libmork:

- O campo `attributes jsonb` no Drizzle armazena as chaves de PF2e quando a ficha pertencer ao sistema:
  ```json
  {
    "strength": 14,
    "dexterity": 16,
    "constitution": 12,
    "intelligence": 10,
    "wisdom": 12,
    "charisma": 8
  }
  ```
- **Compatibilidade de Nomes:** No Drizzle e na API, helpers de acesso leem de forma agnóstica (`forca/strength`, `destreza/dexterity`, `vigor/constitution`, `inteligencia/intelligence`, `empatia/wisdom`, `sorte/charisma`).
- **Proficiências TEML:** Campo dedicado ou extensão no JSONB com os rankings de proficiência do personagem:
  ```typescript
  export type ProficiencyRank = "untrained" | "trained" | "expert" | "master" | "legendary";
  // Untrained: +0 | Trained: Lv + 2 | Expert: Lv + 4 | Master: Lv + 6 | Legendary: Lv + 8
  ```

---

## 4. Motor de Regras: `Pf2eSystem`

Novo módulo em `src/lib/engine/systems/pf2eSystem.ts` implementando a interface `GameSystem`:

### 4.1. Quatro Graus de Sucesso (Four Degrees of Success)

O resultado de qualquer teste ou rolagem contra uma CD (Classe de Dificuldade) é determinado por:

1. **Sucesso Crítico:** Total $\ge \text{CD} + 10$ ou resultado natural 20 em teste que seria sucesso.
2. **Sucesso:** Total $\ge \text{CD}$ e $< \text{CD} + 10$.
3. **Falha:** Total $< \text{CD}$ e $> \text{CD} - 10$.
4. **Falha Crítica:** Total $\le \text{CD} - 10$ ou resultado natural 1 em teste que seria falha.

```typescript
export type DegreeOfSuccess = "critical_success" | "success" | "failure" | "critical_failure";

export function resolvePf2eDegree(
  roll: number,
  modifier: number,
  dc: number,
): {
  total: number;
  degree: DegreeOfSuccess;
  isNatural20: boolean;
  isNatural1: boolean;
};
```

### 4.2. Penalidade de Ataques Múltiplos (MAP)

- **1º Ataque:** Sem penalidade (+0).
- **2º Ataque:** -5 (-4 para armas com traço _Ágil/Agile_).
- **3º+ Ataque:** -10 (-8 para armas com traço _Ágil/Agile_).

### 4.3. Classe de Armadura (CA) e Salvaguardas

- $\text{CA} = 10 + \text{Modificador de Destreza (limitado pela armadura)} + \text{Bônus de Proficiência (TEML)} + \text{Bônus de Item}$.
- **Salvaguardas:**
  - **Fortitude:** Modificador de Constituição + Proficiência TEML.
  - **Reflexos:** Modificador de Destreza + Proficiência TEML.
  - **Vontade:** Modificador de Sabedoria + Proficiência TEML.

---

## 5. Experiência de Usuário e Telas

### 5.1. Seletor de Sistema na Criação de Personagem (`/player/characters/new`)

A tela de seleção de sistema passa a oferecer 3 opções:

1. **Libmork:** Sistema nativo com atributos base 8 e 10 pontos livres.
2. **Pathfinder 2e:** Criação tática orientada por Ancestralidade, Antecedente, Classe e 4 Boosts livres.
3. **MISSING — Edição ZERO:** Ficha investigativa minimalista de horror analógico.

### 5.2. Criação Guiada de Personagem PF2e (`Pf2eCharacterWizard`)

Fluxo clássico de 4 passos do PF2e:

1. **Ancestralidade & Herança:** Seleção de povo (Anão, Elfo, Humano, etc.) com PVs iniciais e bônus/penalidades de atributo.
2. **Antecedente (Background):** Escolha de histórico (Gladiador, Nômade, Erudito) com 2 boosts de atributo e perícia treinada.
3. **Classe:** Escolha entre as 12 classes pré-configuradas com atributo-chave e PV por nível.
4. **4 Aumentos Livres (Free Boosts):** Distribuição final dos 4 aumentos para personalizar os atributos de nível 1.

### 5.3. Ficha de Personagem PF2e (`CharacterDetail`)

- Visualização de CA, Percepção e Salvaguardas em destaque no topo da ficha.
- Seletor de visualização de perícias agrupadas com badges visuais de proficiência:
  - `[D]` Cinza (Destreinado: +0)
  - `[T]` Azul (Treinado: Nível + 2)
  - `[E]` Roxo (Especialista: Nível + 4)
  - `[M]` Dourado (Mestre: Nível + 6)
  - `[L]` Laranja/Fogo (Lendário: Nível + 8)
- Lista de armas com botões de rolagem automática calculando os 3 ataques com MAP (ex.: `Espada Longa: +7 / +2 / -3`).

### 5.4. Escudo do Mestre e Combate (`MasterRoster` & `ActorOverlay`)

- O log da sessão (`SessionLog`) exibe o grau de sucesso alcançado nas rolagens contra a CA ou DC do alvo.
- Em acertos críticos (`critical_success`), o motor dobra os dados de dano da arma automaticamente.
- NPCs do Bestiário PF2e exibem CA estática e reações ativas (ex.: _Ataque de Oportunidade / Escudo Reativo_).

---

## 6. Plano de Entrega e Fases

| Fase       | Escopo                          | Entregáveis                                                               |
| ---------- | ------------------------------- | ------------------------------------------------------------------------- |
| **Fase 1** | Motor e Regras Matemáticas      | `Pf2eSystem`, graus de sucesso, MAP, cálculo TEML e testes unitários      |
| **Fase 2** | Schemas, Validadores e Campanha | `rulesEngine: "pf2e"` nas campanhas, seeds de backgrounds e schemas       |
| **Fase 3** | Criação de Personagem           | Card no seletor de sistema e Wizard de criação PF2e                       |
| **Fase 4** | Ficha Especializada do Jogador  | Interface com CA, Salvaguardas, badges TEML e armas com MAP               |
| **Fase 5** | Combate & Escudo do Mestre      | Integração dos graus de sucesso no `SessionLog` e stat blocks de monstros |

---

## 7. Critérios de Aceite Globais

1. Campanhas criadas com `rulesEngine: "pf2e"` aplicam regras de graus de sucesso e MAP no combate.
2. Fichas de personagens criadas no sistema PF2e utilizam os 6 atributos clássicos e proficiências TEML.
3. Campanhas existentes nos sistemas `libmork` e `missing_zero` continuam funcionando sem qualquer alteração ou quebra.
4. Cobertura de testes unitários para a resolução matemática de PF2e (`resolvePf2eDegree`, `calculateAc`, `calculateMap`).
5. `npx tsc --noEmit` e suíte de testes de CI aprovados sem avisos ou falhas.
