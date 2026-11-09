# Plano A — Dano configurado com migração de dados (4 colunas + resolver puro)

**Issue:** #90 — ataque de NPC precisa de dano configurado
**Data:** 2026-11-09
**Estratégia:** Solução completa conforme proposta da própria issue — novas colunas `attack_expression`, `damage_expression`, `damage_type` e `critical_range` em `npc_pins`, com resolver puro e fallback legado. É o plano recomendado: elimina a causa raiz (heurística) e habilita stat blocks reais (crítico 19–20, tipo de dano).

## 1. Dados (migração aditiva)

- `drizzle/0024_npc_pin_damage.sql`:
  ```sql
  ALTER TABLE "npc_pins" ADD COLUMN IF NOT EXISTS "attack_expression" varchar(200);
  ALTER TABLE "npc_pins" ADD COLUMN IF NOT EXISTS "damage_expression" varchar(200);
  ALTER TABLE "npc_pins" ADD COLUMN IF NOT EXISTS "damage_type" varchar(30);
  ALTER TABLE "npc_pins" ADD COLUMN IF NOT EXISTS "critical_range" integer;
  ```
- Padrão aditivo do repo + script temporário idempotente (`scripts/migrate-db.js`), **sem** `db:push`. `roll_expression` permanece como campo legado.
- `src/lib/db/schema.ts` (`npcPins`): adicionar as 4 colunas espelhando o SQL.

## 2. Resolver puro — `src/lib/engine/npc-attack.ts`

```ts
resolveNpcPinAttack(pin: {attackExpression?, damageExpression?, damageType?, rollExpression?}): {
  attackExpr: string; damageExpr?: string; damageType?: string;
  source: "configured" | "legacy-paren" | "legacy-damage-only" | "none";
}
```

Regras:
1. Campos configurados → `source: "configured"`, usa como estão.
2. Sem campos novos → parser legado interno (hoje `parseNpcPinExpression` em `ActorOverlay.tsx:74-115`): `ataque(dano)` → `legacy-paren`; `1d8+3` puro → `legacy-damage-only`.
3. **Nunca inventar `1d6+X`**: remover o branch de modificador puro que gera dano; `+9` vira apenas ataque `1d20+9` com `source: "none"` para o dano.
4. `source: "none"` + `pinType === "attack"` → UI avisa explicitamente ("Ataque sem dano configurado — nenhum dano será aplicado").
5. `parseNpcPinExpression` é absorvida como caso interno (mantida exportada para compat durante a transição, removida no cleanup).

## 3. API / validadores

- `src/lib/validators/npcPin.ts`: campos opcionais nos schemas create/update — `attackExpression`/`damageExpression` `z.string().max(200)` (validadas com o parser do motor, erro PT-BR claro), `damageType` enum `cortante|contundente|perfurante` (aberto a "energético" depois), `criticalRange` `z.number().int().min(1).max(20).optional()`.
- `src/app/api/worlds/[worldId]/npcs/[npcId]/pins/route.ts` (POST/PATCH): repassar os 4 campos; quando vier só `rollExpression`, não derivar nada no servidor.

## 4. UI

- **`NpcManager.tsx:1126-1138`**: no editor de atalho attack, substituir o input único por `Ataque (ex.: 1d20+9)`, `Dano (ex.: 3d6+5)`, select `Tipo de dano` e `Crítico (ex.: 20 ou 19-20)`; placeholder legado renomeado. Presets rápidos de tipo de dano.
- **`ActorOverlay.tsx`**:
  - `:536` — usar `resolveNpcPinAttack(pin)` em vez de `parseNpcPinExpression`.
  - Tooltip do atalho: `1d20+9 → 3d6+5 cortante`.
  - Em combate (`handleConfirmTarget`), exibir o dano configurado no modal de alvo antes de confirmar.
  - Aviso de `source: "none"` em ambos os fluxos.
- **Importação PF2e** (`src/app/api/npcs/import-pf2e/route.ts:70-72`): popular `attackExpression`/`damageExpression` (e `damageType` quando parseável) a partir de "to Hit / Damage" do stat block.

## 5. Rolagem, log e dados 3D

- Fora de combate (`ActorOverlay.tsx:549-567`): rolar ataque **e** dano quando configurado; `formula: "1d20+9 (dano 3d6+5)"`, `rolledDice` com ataque + dano → alimenta dados 3D e log da sessão.
- Em combate (`:667-704`): usar dano configurado em `applyResolvedDamage` (NPC alvo) e `requestDefenseReaction.rawDamage` (jogador alvo) — fluxos já existem, só passam a receber o dano do resolver.
- Crítico (`critical_range`): rolagem de ataque ≥ limite dobra os dados de dano (implementação simples: re-rolar dano e somar; refinamento fica fora do escopo).

## 6. Testes

- Unidade `resolveNpcPinAttack`: configured / legado `ataque(dano)` / dano puro / modificador puro **sem inventar 1d6** / vazio / crítico.
- Rota: criar/atualizar pin com campos novos; rejeição de expressão inválida com mensagem PT-BR.
- Componente `ActorOverlay`: dano configurado subtrai HP de NPC-alvo; alvo jogador emite `requestDefenseReaction` com `rawDamage`; sem dano → aviso visível e nenhum HP alterado; `rollDice`/dados 3D carregam ataque+dano.
- Migração: script idempotente roda 2x sem erro.

## Critérios de aceite
Todos os 7 da issue, com foco em: `1d20+9 / 3d6+5 cortante` aplica exatamente o dano; nenhum caminho gera `1d6` inventado; aviso visível em vez de 0 silencioso; pins antigos continuam funcionando; PF2e importa ataque+dano; log/dados 3D mostram tudo.

## Riscos
- Maior superfície (migração + API + UI + importador), mas é o caminho que resolve de verdade; `roll_expression` legado garante compat sem backfill.
