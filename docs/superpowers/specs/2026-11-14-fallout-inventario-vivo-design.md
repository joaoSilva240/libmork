# Fase 4a — Inventário Vivo (Fallout 2d20)

**Data:** 2026-11-14
**Status:** Aprovado
**Depende de:** Fase 3 (Catálogo de Perks e Biblioteca Global) — commits c4e3a42..582a89f
**Referência upstream:** Muttley/foundryvtt-fallout@develop — `system/src/documents/FalloutActor.mjs`, `FalloutItem.mjs`

---

## 1. Motivação

Os itens do catálogo (Fase 3) são exibidos na ficha mas não aplicam efeitos mecânicos: equipar armadura não altera resistências, consumir um item não cura HP/rads, o peso carregado não é calculado, e ferimentos não têm estado de tratamento. Esta fase torna o inventário funcional sem introduzir combate (4b) nem sobrevivência (4c).

## 2. Escopo

### Inclui (5 funcionalidades)

1. **Equipar/desequipar apparel** → resistências por localização recalculadas (prioridade powerArmor > armor > outfit > headgear; clothing stacka via Math.max; poison sempre = base).
2. **Consumir consumível** → HP restaurado (capped em hpMax), radiação curada/infligida (floor 0), quantity decrementada, item removido ao zerar.
3. **Encumbrance derivado** → carryWeightCurrent (Σ weight×quantity, excluindo stashed e powerArmor energizada), encumbranceLevel (ceil do excesso / 50).
4. **Ferimentos com estado** → 3 slots por parte (0=saudável, 1=tratada, 2=aberta), status derivado (healthy/wounded/crippled), UI clicável no paperdoll.
5. **Munição com shots** → mapper popula shotsCurrent/shotsMax; exibição informativa no accordion (consumo real fica para 4b).

### Exclui (deferido)

- Ataque com arma, rolagem de dano, consumo de ammo pós-ataque, vicious, hit location → **4b**.
- Fome/sede/sono/fadiga, relógio de mundo → **4c**.
- Chem doses, addictions, alcoholismo, magazines, irradiated food com roll → **4c**.
- Weapon/apparel mods (attachment model), wear-and-tear (`tear`) → fora.
- Power armor frame com `frameId` aninhado → não modelado (powerArmor = armor monolítico).
- NPCs/creatures/robots/vehicles → só FalloutCharacter (jogador).
- Stash folder UI, sort por tipo → fora.

## 3. Arquitetura

### 3.1 Modelo de estado derivado

```
Cliente (PipBoySheet)
  │  aplica regra pura (rules.ts) → novo estado
  │  PATCH /api/systems/fallout/characters/[id]
  ▼
Serviço (fallout-service.ts)
  │  merge patch sobre existing
  │  recalculateFalloutDerived(merged)  ← NOVO
  │  persiste no Postgres (jsonb)
  ▼
Resposta: character com snapshots consistentes
```

- Derivadas são **server-side**: o serviço recalcula antes de persistir. Snapshots nunca ficam stale.
- Regras de mutação (consumir, equipar, toggle injury) são **client-side** em `rules.ts`, seguindo o padrão de `adjustFalloutPerkRank`/`normalizeFalloutPerk`.
- Sem rotas novas — reusa o PATCH existente.
- `createInitialFalloutCharacter` delega para `recalculateFalloutDerived` (fonte única das fórmulas).
- Fichas legadas se auto-saram na primeira escrita (migração idempotente dentro do recalc).

### 3.2 Race condition (Finding 2, pré-existente)

PATCHes quase simultâneos usam last-write-wins sobre o character inteiro. Consumir + equipar em sequência rápida pode perder uma mutação. Mesmo hazard de caps/perks/body parts já aceito no review final da Fase 3. Mitigação (estado otimista ou fila funcional) fica para 4b+.

## 4. Modelo de dados

### 4.1 Alterações em `types.ts`

```typescript
// Novo tipo para slot de ferimento
export type FalloutInjurySlot = 0 | 1 | 2; // saudável | tratada | aberta

// Novo status derivado por parte
export type FalloutBodyPartStatus = "healthy" | "wounded" | "crippled";

export interface FalloutBodyPart {
  location: FalloutBodyLocation;
  label: string;
  minRoll: number;
  maxRoll: number;
  injuries: [FalloutInjurySlot, FalloutInjurySlot, FalloutInjurySlot]; // ERA: number
  status: FalloutBodyPartStatus; // ERA: isCrippled: boolean
  resistances: FalloutResistances;
}

// Apparel — campos novos
export interface FalloutApparelItem {
  // ...campos existentes...
  stashed: boolean;   // NOVO, default false
  powered: boolean;   // NOVO, só relevante p/ powerArmor, default false
}

// Ammo — promovido de ramo genérico para interface própria
export interface FalloutAmmoItem {
  id: string;
  name: string;
  type: "ammo";
  description?: string;
  quantity: number;
  weight: number;
  costCaps: number;
  shotsCurrent: number; // NOVO
  shotsMax: number;     // NOVO
  stashed: boolean;     // NOVO
}

// Character — campos derivados novos
export interface FalloutCharacter {
  // ...campos existentes...
  carryWeightCurrent: number;  // NOVO derivado
  encumbranceLevel: number;    // NOVO derivado (0 = ok)
}
```

### 4.2 Migração legada (idempotente, dentro de recalculateFalloutDerived)

| Campo legado | Transformação |
|---|---|
| `bodyParts[loc].injuries: number` (0-3) | → `[2,2,...,0,0]` com N slots abertas (i < N → 2, senão 0) |
| `bodyParts[loc].isCrippled: true` sem `status` | → `status: "crippled"` |
| `bodyParts[loc].isCrippled: false` sem `status` | → derivar de injuries array |
| Ausência de `stashed` | → `false` |
| Ausência de `powered` | → `false` |
| Ausência de `shotsCurrent`/`shotsMax` (ammo) | → `shotsMax: 1, shotsCurrent: 1` |
| Ausência de `carryWeightCurrent`/`encumbranceLevel` | → recalculados |

### 4.3 Validators (`validators.ts`)

- `updateFalloutCharacterSchema`: aceitar `bodyParts` com `injuries` como array de 3 (0|1|2) OU number (legado, normalizado no service). Aceitar `status` como enum opcional.
- `items` array: aceitar objetos com `stashed`, `powered`, `shotsCurrent`, `shotsMax` opcionais (zod `.optional()` com defaults no recalc).
- Não bloquear campos desconhecidos (passthrough já existente).

## 5. Novo módulo: `src/lib/systems/fallout/derived.ts`

### 5.1 Função principal

```typescript
export function recalculateFalloutDerived(character: FalloutCharacter): FalloutCharacter
```

Imutável (retorna novo objeto). Ordem de execução:
1. `migrateLegacyFields(character)` — normaliza injuries/isCrippled/stashed/powered/shots.
2. `recomputeBodyResistances(char)` — prioridade apparel por localização.
3. `recomputeBodyStatus(char)` — status = max(injuries) → healthy/wounded/crippled.
4. `recomputeMaxHp(char)` — END + LUC + (level-1) - radiation; cap hpCurrent.
5. `recomputeDefense(char)` — AGI ≤ 8 ? 1 : 2.
6. `recomputeInitiative(char)` — PER + AGI.
7. `recomputeMeleeDamageBonus(char)` — STR 7-8→1, 9-10→2, 11+→3, senão 0.
8. `recomputeCarryWeightMax(char)` — STR × 10.
9. `recomputeEncumbrance(char)` — current + level.

### 5.2 Regra de resistências (recomputeBodyResistances)

Para cada localização (head, torso, leftArm, rightArm, leftLeg, rightLeg):

1. Coletar apparel equipado (`equipped: true`, `stashed: false`) que cobre a localização.
2. Prioridade:
   - **powerArmor** com `powered: true` → usa resistências dela (substitui tudo).
   - **armor** (apparelType === "armor") → usa resistências dela.
   - **outfit** → só aplica se NENHUM armor/powerArmor cobriu torso/membros.
   - **headgear** → só aplica em head.
   - **clothing** → `Math.max` com o valor já computado (único tipo que stacka).
3. `resistances.poison` = sempre o valor base do personagem (0 por padrão; armadura nunca contribui poison).
4. Resistência final = base_char + apparel_resistance (por tipo de dano).

Power armor com `equipped: true` mas `powered: false` → NÃO aplica resistências.

### 5.3 Regra de encumbrance (recomputeEncumbrance)

```
carryWeightCurrent = Σ (item.weight × item.quantity)
  para itens onde stashed === false
  excluindo apparel com apparelType === "powerArmor" && powered === true (vestida = não pesa)

encumbranceLevel = max(0, ceil((carryWeightCurrent - carryWeightMax) / 50))
```

Nota: perk Pack Rat (halvea junk) e butchery (creature) ficam fora — nosso modelo não tem junk/materials separados nem creatures.

### 5.4 Integração com createInitialFalloutCharacter

`rules.ts:338` passa a:
1. Montar o character base (como hoje).
2. Chamar `recalculateFalloutDerived(base)` e retornar o resultado.

As funções `calculateMaxHp`, `calculateDefense`, etc. permanecem exportadas (testes existentes as usam) mas são chamadas pelo derived.ts.

## 6. Nova operação em `rules.ts`

```typescript
export function applyFalloutConsumable(
  character: FalloutCharacter,
  itemId: string,
): FalloutCharacter | null
```

- Localiza item por id; retorna `null` se ausente, type ≠ "consumable", ou quantity ≤ 0.
- Retorna novo character:
  - `hpCurrent = min(hpMax, hpCurrent + (item.hpRestored ?? 0))`
  - `radiation = max(0, radiation - (item.radsCured ?? 0)) + (item.radsInflicted ?? 0)`
  - `quantity -= 1`; se chegou a 0, remove o item do array.
- Não aplica fome/sede/chem/addiction (4c).
- Não rola dados (irradiated food com roll = 4c).

## 7. Serviço (`fallout-service.ts`)

### 7.1 updateFalloutCharacterRecord (linha 184)

Inserir após o merge do patch (linha 230) e antes do `db.update` (linha 232):

```typescript
const merged = { ...existing, ...patch } as FalloutCharacter;
const derived = recalculateFalloutDerived(merged);
// Substituir campos derivados no patch antes de persistir
patch.hpMax = derived.hpMax;
patch.defense = derived.defense;
patch.initiative = derived.initiative;
patch.meleeDamageBonus = derived.meleeDamageBonus;
patch.carryWeightMax = derived.carryWeightMax;
patch.carryWeightCurrent = derived.carryWeightCurrent;
patch.encumbranceLevel = derived.encumbranceLevel;
patch.bodyParts = derived.bodyParts;
patch.hpCurrent = derived.hpCurrent; // capped
```

### 7.2 createFalloutCharacter

Já delega para `createInitialFalloutCharacter` que agora chama `recalculateFalloutDerived`. Sem mudança adicional no service.

### 7.3 mapDbToFalloutCharacter

Garantir que campos novos (`carryWeightCurrent`, `encumbranceLevel`) são lidos do jsonb com fallback (0) para fichas antigas. A migração no recalc cuida do resto na próxima escrita.

## 8. Mapper (`itemCatalog.ts`)

- **Ammo**: popular `shotsMax` de `sourceData.shots?.max ?? 1`, `shotsCurrent` de `sourceData.shots?.current ?? shotsMax`, `stashed: false`.
- **PowerArmor**: popular `powered: false`, `stashed: false`.
- **Todos os itens**: `stashed: false` default.
- Tipo `FalloutAmmoItem` passa a ser retornado pelo mapper quando `getFalloutItemCategory(entry) === "ammo"` (hoje cai no ramo genérico).

## 9. UI

### 9.1 PipBoySheet — aba INV (accordion de itens)

**Apparel (expandido):**
- Botão "Equipar" / "Desequipar" (toggle `equipped`). Highlight emerald quando equipado.
- Botão "Guardar" / "Recuperar" (toggle `stashed`).
- Se `apparelType === "powerArmor"`: botão "Energizar" / "Desenergizar" (toggle `powered`), habilitado só quando `equipped === true`.
- Cada toggle: `onUpdateCharacter({ items: updatedItems })`.

**Consumível (expandido):**
- Botão "Consumir" (ícone `UtensilsCrossed` ou `Pill` do Lucide conforme category).
- Se `quantity === 1`: confirmação inline (texto "Última unidade — consumir?" + botão confirmar/cancelar), sem modal dedicado.
- Aplica `applyFalloutConsumable(character, item.id)` → `onUpdateCharacter(result)`.
- Desabilitado quando `quantity <= 0` ou `readOnly`.

**Ammo (expandido):**
- Texto informativo: `{shotsCurrent}/{shotsMax} cargas` (sem botão de ação).

**Weapon/Mod/Miscellany:** sem ações novas.

**readOnly:** todos os botões de ação ocultos (padrão existente).

### 9.2 Paperdoll (componente existente ou novo)

Cada uma das 6 partes exibe **3 dots clicáveis** (slots de ferimento):
- Click cicla: `0 → 2 → 1 → 0` (saudável → aberta → tratada → saudável).
- Cores: `text-emerald-400` (0), `text-red-400` (2), `text-amber-400` (1).
- ARIA: `aria-label="Injúria {label} slot {n}: {status}"`, `role="button"`, `tabIndex={0}`.
- Status da parte (healthy/wounded/crippled) exibido como badge ao lado do nome.
- `onUpdateCharacter({ bodyParts: { ...character.bodyParts, [loc]: { ...part, injuries: newArray } } })`.
- readOnly: dots não clicáveis, sem tabIndex.

### 9.3 Encumbrance display

Na aba INV, header ou footer: `{carryWeightCurrent}/{carryWeightMax} lbs` + badge de nível se `encumbranceLevel > 0` (âmbar/vermelho conforme severidade).

## 10. Casos de borda

| Caso | Comportamento |
|---|---|
| Ficha legada `injuries: 2, isCrippled: true` | Migra para `[2,2,0]`, status "crippled" |
| `hpCurrent > hpMax` após radiação aumentar | Cap no recalc |
| PowerArmor equipped + powered:false | Resistências NÃO aplicadas |
| Clothing + armor na mesma parte | Math.max por tipo de dano |
| Consumir item quantity=0 | applyFalloutConsumable retorna null, botão desabilitado |
| Item sem campo `stashed` (legado) | Default false no recalc |
| PATCH simultâneo (race) | Last-write-wins, aceito (Finding 2) |
| Ammo sem sourceData.shots | shotsMax=1, shotsCurrent=1 |

## 11. Testes

### 11.1 `src/lib/systems/fallout/__tests__/derived.test.ts` (novo, ~15 casos)

- recomputeBodyResistances: powerArmor energizada substitui, não energizada ignora, armor > outfit, outfit só se nada cobriu, headgear só head, clothing Math.max, poison sempre base.
- recomputeEncumbrance: stashed excluído, powerArmor ligada excluída, nível 0/1/2.
- recomputeMaxHp: com/sem radiação, cap hpCurrent.
- Migração: injuries number → array, isCrippled → status, defaults ausentes, idempotência.

### 11.2 `rules.test.ts` (estendido, ~4 casos)

- applyFalloutConsumable: cura HP, cura rads, inflige rads, delete quando zero, quantity=0 retorna null, item inexistente retorna null.

### 11.3 `PipBoySheet.test.tsx` (estendido, ~8 casos)

- Toggle equipar → onUpdateCharacter com equipped:true.
- Toggle stashed → onUpdateCharacter com stashed:true.
- Toggle powered (só powerArmor) → onUpdateCharacter.
- Consumir → onUpdateCharacter com hpCurrent atualizado e quantity-1.
- Consumir última unidade → confirmação antes de aplicar.
- readOnly → botões ocultos.
- Ammo → mostra shots no accordion.
- Encumbrance → display correto.

### 11.4 `PipBoyPaperdoll.test.tsx` (novo ou estendido, ~4 casos)

- Click cicla 0→2→1→0.
- onUpdateCharacter com array correto.
- Status derivado exibido.
- readOnly sem interação.

### 11.5 `itemCatalog.test.ts` (estendido, ~2 casos)

- Ammo popula shotsCurrent/shotsMax.
- PowerArmor popula powered:false, stashed:false.

### 11.6 Integração service/route (~3 casos)

- PATCH com items equipped → bodyParts.resistances atualizados na resposta.
- PATCH com injuries array → status derivado na resposta.
- PATCH em ficha legada → migração automática.

## 12. Arquivos tocados (estimativa)

| Arquivo | Ação |
|---|---|
| `src/lib/systems/fallout/types.ts` |Modificar (BodyPart, Apparel, Ammo, Character) |
| `src/lib/systems/fallout/derived.ts` | **Criar** |
| `src/lib/systems/fallout/rules.ts` | Modificar (createInitial delega, +applyFalloutConsumable) |
| `src/lib/systems/fallout/itemCatalog.ts` | Modificar (ammo shots, stashed, powered) |
| `src/lib/systems/fallout/validators.ts` | Modificar (schemas aceitam novos campos) |
| `src/lib/server/fallout-service.ts` | Modificar (recalc no update, mapDb fallback) |
| `src/components/systems/fallout/PipBoySheet.tsx` | Modificar (botões INV, encumbrance display) |
| `src/components/systems/fallout/PipBoyPaperdoll.tsx` | Modificar ou criar (injury slots) |
| `src/lib/systems/fallout/__tests__/derived.test.ts` | **Criar** |
| `src/lib/systems/fallout/__tests__/rules.test.ts` | Modificar |
| `src/lib/systems/fallout/__tests__/itemCatalog.test.ts` | Modificar |
| `src/components/systems/fallout/__tests__/PipBoySheet.test.tsx` | Modificar |
| `src/components/systems/fallout/__tests__/PipBoyPaperdoll.test.tsx` | Criar ou modificar |

## 13. Constraints globais

- Não tocar o banco remoto sem autorização (DATABASE_URL compartilhado).
- Trabalhar exclusivamente no worktree da sessão.
- Ícones: lucide-react (nunca emojis).
- UI: copiar classes do tema Pip-Boy existente (emerald/amber/red, font-mono, bordas).
- Testes: Vitest + @testing-library; sem dependências novas.
- Commit: PT-BR sem acentos, HUSKY=0, stage por nome.
- Não mergear/pushar sem pedido explícito.
