# Fase 4a.1 — Armas, Mods, Kits de Origem e Limites de Perks

**Data:** 2026-11-14
**Branch:** feat/fallout-2d20-improvements
**Depende de:** Fase 4a Inventário Vivo (completa, HEAD f7c7faf)

## Motivação

Armas não possuem ações de equipar/atirar na aba INV. Mods são itens inertes sem aplicação. Origens não concedem kit inicial. Perks na criação são ilimitadas e perks com requisitos não atendidos aparecem na lista sem filtro.

## Escopo

5 funcionalidades independentes que compartilham a camada de tipos e o wizard:

1. Equipar armas + botão Atirar (abre roller pré-configurado)
2. Instalar/remover mods em armas (weapon_mods apenas)
3. Kit de equipamento inicial por origem
4. Limite de perks por nível (criação e in-game)
5. Filtro de perks por requisitos (ocultar bloqueadas + toggle)

Fora de escopo (Fase 4b): aplicação de dano em alvo, custo de AP para atirar, mods de apparel, animações de combate.

## 1. Equipar Armas + Atirar

### Modelo

`FalloutWeaponItem` ganha:
- `skill: FalloutSkillName` — perícia de ataque (small_guns, energy_weapons, big_guns, melee_weapons, unarmed)
- `stashed: boolean` — guardar no stash (mesmo padrão apparel)

Regra: apenas 1 arma equipada por vez. Equipar outra desequipa a anterior automaticamente.

### Mapeamento de skill (itemCatalog.ts)

Default por heurística no mapper:
- damageType === "energy" → energy_weapons
- qualities inclui "two_handed" e damageDiceRating >= 5 → big_guns
- range === "close" e ammoType ausente → melee_weapons
- qualities inclui "thrown" → throwing
- resto → small_guns

O sourceData do Foundry pode ter campo `skill` explícito — se presente, usa ele.

### UI (PipBoySheet.tsx)

No accordion de arma (canEdit):
- Botão Equipar/Desequipar (Shield/ShieldOff, mesmo estilo apparel)
- Botão Guardar/Recuperar (Archive/ArchiveRestore)
- Botão "Atirar" (Crosshair icon) visível somente quando equipada — abre FalloutDiceRollerModal com initialAttr = defaultAttribute da skill e initialSkill = weapon.skill

### Lógica de equipar

```typescript
const handleEquipWeapon = (itemId: string) => {
  const items = character.items.map((item) => {
    if (item.type !== "weapon") return item;
    if (item.id === itemId) return { ...item, equipped: !item.equipped };
    return { ...item, equipped: false }; // desequipa outras
  });
  onUpdateCharacter({ items });
};
```

## 2. Mods em Armas

### Modelo

`FalloutWeaponItem` ganha:
- `installedMods: string[]` — ids dos itens mod instalados

Novo interface para mods:
```typescript
export interface FalloutModItem {
  id: string;
  name: string;
  type: "mod";
  description?: string;
  quantity: number;
  weight: number;
  costCaps: number;
  stashed: boolean;
  modTarget: "weapon" | "apparel";
  modEffects: {
    damageBonus?: number;
    qualitiesAdd?: FalloutWeaponQuality[];
    qualitiesRemove?: FalloutWeaponQuality[];
    fireRateBonus?: number;
    weightDelta?: number;
  };
}
```

`FalloutItem` union: substituir o branch genérico `"mod"` por `FalloutModItem`. O branch genérico fica apenas `"perk" | "miscellany"`.

### Mapeamento (itemCatalog.ts)

Para pack "weapon_mods": extrair modEffects do sourceData. Campos Foundry típicos:
- `damage.rating` → damageBonus (delta)
- `weaponQuality` entries com rank > 0 → qualitiesAdd
- `fireRate` delta → fireRateBonus
- `weight` delta → weightDelta

modTarget: "weapon" para weapon_mods, "apparel" para apparel_mods e robot_modules.

### UI (PipBoySheet.tsx)

No accordion de arma equipada, após PipBoyItemStats:
- Seção "Mods Instalados" com lista de nomes + botão Remover (X) por mod
- Botão "Instalar Mod" abre dropdown/lista inline dos mods type="mod" && modTarget="weapon" presentes no inventário (não instalados, não stashed)
- Instalar: move o mod do inventário para installedMods da arma, aplica efeitos nos campos da arma (damageDiceRating += damageBonus, qualities merge, fireRate += fireRateBonus, weight += weightDelta), decrementa quantity do mod (remove se 0)
- Remover: reverte efeitos, devolve mod ao inventário com quantity 1

### Aplicação de efeitos

Função pura em rules.ts:
```typescript
export function applyModToWeapon(weapon: FalloutWeaponItem, mod: FalloutModItem): FalloutWeaponItem;
export function removeModFromWeapon(weapon: FalloutWeaponItem, mod: FalloutModItem): FalloutWeaponItem;
```

## 3. Kit de Equipamento Inicial

### Modelo (origins.ts)

Novo campo em FalloutOriginConfig:
```typescript
startingItems: Array<{
  sourceKey: string;       // chave no catálogo para resolver
  name: string;            // fallback display
  quantity?: number;       // default 1
  fallback?: Partial<FalloutItem>; // stats inline se catálogo offline
}>;
```

### Kits (livro oficial p.50-57)

| Origem | Itens |
|--------|-------|
| vault_dweller | Vault Suit (apparel/outfit), 10mm Pistol (weapon), 10mm Round ×20 (ammo), Stimpak ×2 (consumable) |
| wastelander | Pipe Gun (weapon), .38 Round ×20 (ammo), Wastelander Outfit (apparel/outfit), Stimpak ×2 |
| brotherhood_initiate | Brotherhood Fatigues (apparel/outfit), Laser Pistol (weapon), Energy Cell ×20 (ammo), Stimpak ×2 |
| ghoul | Wastelander Outfit (apparel/outfit), Pipe Gun (weapon), .38 Round ×20 (ammo), Stimpak ×2, RadAway ×2 |
| super_mutant | Super Mutant Armor (apparel/armor), Hunting Rifle (weapon), .308 Round ×20 (ammo), Stimpak ×2 |
| mister_handy | [] (armas embutidas, sem kit) |
| survivor | Pipe Gun (weapon), .38 Round ×20 (ammo), Wastelander Outfit (apparel/outfit), Stimpak ×2 |

### Resolução

Função em rules.ts:
```typescript
export function resolveStartingItems(
  origin: FalloutOrigin,
  catalogLookup: (sourceKey: string) => CatalogItem | null,
): FalloutItem[];
```

Para cada entry: busca no catálogo via sourceKey → catalogItemToFalloutItem. Se não encontrar, usa fallback inline. Quantidade: para ammo/consumable, seta quantity. Para weapon/apparel, gera id único por instância.

### Aplicação

No `createInitialFalloutCharacter`: aceita parâmetro opcional `startingItems?: FalloutItem[]` e inclui no base.items.

No wizard handleSubmit: resolve os itens antes do POST e envia no body como `items`. O serviço createFalloutCharacterRecord já aceita items via input (adicionar campo ao validator).

### Preview no wizard

Na etapa Identidade, após selecionar origem, mostra lista read-only dos itens do kit (nome × quantidade). Usa os nomes do config, sem precisar do catálogo carregado.

## 4. Limite de Perks

### Regra

Fórmula oficial: `maxPerks(level) = Math.ceil(level / 2)`.
- Nível 1: 1 perk
- Nível 2: 1 perk
- Nível 3: 2 perks
- Nível 4: 2 perks
- Nível 5: 3 perks

Cada perk ocupa 1 slot independente do rank. Subir rank não consome slot.

### Função (rules.ts)

```typescript
export function getMaxFalloutPerks(level: number): number {
  return Math.ceil(Math.max(1, level) / 2);
}
```

### Wizard (StepPerks)

- `maxPerks = getMaxFalloutPerks(1)` = 1
- Counter: "1/1 selecionada" (ou "0/1")
- Botão "+" desabilita quando selectedPerks.length >= maxPerks
- addCustomPerk também respeita o limite
- Texto informativo atualizado: "Nível 1: máximo 1 perk. Perk customizado também conta."

### PipBoyPerkPickerModal (in-game)

- `maxPerks = getMaxFalloutPerks(character.level)`
- Se ownedNames.size >= maxPerks: banner "Limite de perks atingido (N/N)" + todos os botões desabilitados
- Rank up de perk existente não é afetado (não passa pelo picker)

## 5. Filtro de Perks por Requisitos

### Comportamento

Perks com `getUnmetPerkRequirements(requirements, attributes, level).length > 0` são ocultados da lista por default.

### Toggle "Mostrar bloqueadas"

Checkbox/switch no topo da lista (após os filtros de atributo):
- Label: "Mostrar perks bloqueadas"
- Default: false (ocultas)
- Quando ativo: perks bloqueadas aparecem com aviso âmbar e botão desabilitado (não pode adicionar mesmo revelando)

### Wizard

- Nível fixo 1 para getUnmetPerkRequirements
- Atributos: data.attributes (já distribuídos na etapa anterior)
- Perks que exigem Nível 2+ ficam ocultas por default

### Modal in-game

- Nível: character.level
- Atributos: character.attributes
- Mesmo toggle e comportamento

### Implementação

No filter de visiblePerks, adicionar:
```typescript
if (!showBlocked) {
  const unmet = getUnmetPerkRequirements(requirements, attributes, level);
  if (unmet.length > 0) return false;
}
```

O botão de adicionar fica disabled quando unmet.length > 0 (mesmo com toggle ativo).

## Testes

~25 novos testes:
- rules: getMaxFalloutPerks (3), applyModToWeapon/removeModFromWeapon (4), resolveStartingItems (3)
- itemCatalog: skill mapping (3), modEffects mapping (2)
- PipBoySheet: equip weapon (2), atirar abre roller (1), install/remove mod (2)
- Wizard: perk limit enforcement (2), filter hides blocked (2), toggle reveals (1), kit preview (1)
- PerkPickerModal: limit banner (1), filter (1)

## Constraints

- DATABASE_URL é Postgres remoto compartilhado — sem migration nova (installedMods e skill ficam no JSONB items)
- Sem novas rotas API — tudo via PATCH existente
- lucide-react para ícones (Crosshair, Wrench, Package)
- PT-BR em labels e mensagens
- Commit atômico por feature, HUSKY=0 --no-verify

---

## Status de Execução

**Fase 4a.1: COMPLETA (2026-11-20)**

Todas as 5 funcionalidades implementadas, testadas e commitadas:

| # | Feature | Commits | Testes |
|---|---------|---------|--------|
| 1 | Equipar/Atirar armas | 4a0610f | 4 (PipBoySheet INV) |
| 2 | Instalar/remover mods | 282dd45, 4a0610f | 4 (rules) + 2 (PipBoySheet) |
| 3 | Kits de origem | 282dd45, 0f79109 | 3 (rules) + 1 (wizard) |
| 4 | Limite de perks | 282dd45, 0f79109, 25e3327 | 3 (rules) + 2 (wizard) + 1 (modal) |
| 5 | Filtro por requisitos | 0f79109, 25e3327 | 4 (wizard) + 3 (modal) |

Validação final: `tsc --noEmit` limpo, **1469 testes / 181 arquivos / 0 falhas**.

### Commits da fase (ordem cronológica)

```
92ef0d4 docs(fallout): spec Fase 4a.1
6ce3269 docs(fallout): plano de implementacao Fase 4a.1
32b6c52 feat(fallout): tipos weapon skill/stashed/installedMods, FalloutModItem, origins startingItems
282dd45 feat(fallout): getMaxFalloutPerks, applyMod/removeMod, resolveStartingItems e kits por origem
ae8f9c2 feat(fallout): mapper skill por tipo de arma e modEffects para weapon_mods
4a0610f feat(fallout): equipar/atirar armas e instalar/remover mods na aba INV
0f79109 feat(fallout): limite de perks, filtro por requisitos e preview de kit no wizard
25e3327 feat(fallout): limite e filtro de perks no modal in-game
4d1c59b fix(fallout): bump DATA test character to level 5 so perk addition is not at limit
```

---

## Pendências e Próximas Fases

### 1. Integração da branch (BLOQUEADO — decisão do usuário)

A branch `feat/fallout-2d20-improvements` contém Fases 3 + 4a + 4a.1 completas, mas **nunca foi mergeada nem pushada**. A base do branch é `feat/fallout-2d20-system` (fork em `56c94cf`), não `main`.

Opções pendentes:
- **Merge em main** — integrar tudo de uma vez (Fases 3, 4a, 4a.1)
- **Push da branch** — manter separada para revisão/PR
- **Keep local** — continuar acumulando fases antes de integrar

Nenhuma ação de merge/push deve ser tomada sem escolha explícita do usuário.

### 2. Fase 4b — Ataque e Dano (PRÓXIMA)

Depende de 4a (items+ammo populados) — satisfeito.

Escopo planejado:
- Pipeline weapon → 2d20 pool (attribute+skill do weaponType, crítico=skill se tag senão 1, complication 20)
- DC de dano: `damage.rating + meleeBonus − tear`
- Hit location: `1dh` (dado de localização)
- Ammo decrement: `ammoPerShot`, gatling ×2/2, `least-shots-first`
- Efeito `vicious`: soma +damage por effect
- Wear-and-tear opcional (`tear` field)
- Botão "aplicar em alvo selecionado" no chat card — **extensão Libmork, não existe no upstream** (escolha deliberada a documentar na spec de 4b)

Pré-requisitos atendidos por 4a/4a.1:
- `weapon.skill` mapeado (4a.1)
- `ammo.shotsCurrent/shotsMax` populados (4a)
- `bodyParts[].resistances` recalculadas ao equipar (4a)
- `injuries` slots por parte (4a)
- Arma equipada com botão Atirar que abre roller (4a.1)

### 3. Fase 4c — Sobrevivência (DEPOIS DE 4b)

Depende de 4a + decisão de design sobre "world time" (relógio de jogo ainda não modelado no Libmork).

Escopo planejado:
- Hunger/thirst/sleep/fatigue com relógio de jogo
- Chem doses + addiction check (auto-criar Addiction item)
- Alcoholic check
- Irradiated food → rad roll
- Magazines + Comprehension perk
- drinkDirtyWater

**Bloqueador de design:** o Libmork não possui modelo de tempo de mundo. A spec de 4c precisa decidir como modelar isso (ticks por sessão? relógio manual do mestre? tempo real?). Não avançar sem essa decisão.

### 4. Itens fora de escopo (todas as fases)

- NPCs/creatures/robots/vehicles (só FalloutCharacter de jogador)
- Power armor frame com `frameId` aninhado (powerArmor = armor monolítico)
- Stash folder UI, sort por tipo
- Mods de apparel (modTarget="apparel" existe no tipo mas sem UI de aplicação)
- Animações de combate
- Custo de AP para atirar (ação de combate completa fica para 4b)

