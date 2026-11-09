# Plano B — Sem migração: convenção estruturada no `roll_expression` + correção do parser

**Issue:** #90 — ataque de NPC precisa de dano configurado
**Data:** 2026-11-09
**Estratégia:** Incremental, **zero migração de banco**. Mantém a coluna única `roll_expression` e adota a convenção já suportada `ataque(dano)` como formato canônico — a UI passa a *escrever* essa convenção de forma estruturada e o parser deixa de inventar dano. Resolve os sintomas mais graves (dano inventado e 0 silencioso) com diff pequeno; deixa tipo de dano/crítico para um follow-up.

## 1. Resolver puro — `src/lib/engine/npc-attack.ts` (mesma assinatura do Plano A)

```ts
resolveNpcPinAttack(pin: {rollExpression?}): {
  attackExpr: string; damageExpr?: string;
  source: "legacy-paren" | "legacy-damage-only" | "attack-only" | "none";
}
```

Correções no parser (movido de `ActorOverlay.tsx:74-115` para o módulo puro):
1. `1d20+5(1d8+3)` → ataque+dano (`legacy-paren`) — comportamento atual preservado.
2. **Modificador puro (`+5`/`-2`)**: vira apenas ataque `1d20+5`; **remove o branch que gera `1d6+5`** (causa do dano inventado). `source: "attack-only"`.
3. `1d20+7` → ataque puro, `source: "attack-only"` (antes: dano ausente, 0 silencioso).
4. `1d8+3` (dano puro) → ataque padrão `1d20` + dano (`legacy-damage-only`), igual hoje.
5. Vazio em pin `attack` → `source: "none"`; a UI trata como erro configurável, não como `1d20` mudo.

## 2. UI — editor escreve a convenção canônica

- **`NpcManager.tsx:1126-1138`**: dois campos, `Ataque (ex.: 1d20+9)` e `Dano (ex.: 3d6+5)`; ao salvar, **o cliente compõe** `rollExpression = "1d20+9(3d6+5)"` quando ambos preenchidos; só ataque → `1d20+9` (o parser agora trata como attack-only com aviso). Um único input persiste no banco, então fichas/PDFs/APIs existentes não mudam.
- **`ActorOverlay.tsx:536`**: trocar `parseNpcPinExpression` por `resolveNpcPinAttack`; tooltip `1d20+9 → 3d6+5`; aviso explícito de "sem dano configurado" em combate e fora de combate.

## 3. Rolagem / combate

- Fora de combate: rolar ataque e dano quando `damageExpr` existir; `formula: "1d20+9 (dano 3d6+5)"`, `rolledDice` combinado.
- Em combate: fluxos `applyResolvedDamage` / `requestDefenseReaction` inalterados — passam a receber dano real com mais frequência; quando `damageExpr` ausente, bloqueia a aplicação com aviso (nunca 0 silencioso).
- `damage_type` e `critical_range`: **fora do escopo** (o tipo de dano pode ser anotado no `label` do atalho, ex.: "Mordissa (cortante)").

## 4. Validadores / API

- `src/lib/validators/npcPin.ts`: manter `rollExpression` único, mas validar a convenção `ataque(dano)` com o parser puro, rejeitando expressões ambíguas com erro PT-BR claro. Nenhuma rota muda de forma estrutural.

## 5. Testes

- Unidade `resolveNpcPinAttack`: todos os casos da matriz da issue — `+9` não gera `1d6+9`; `1d20+7` gera aviso, não 0 silencioso; `ataque(dano)` intacto; dano puro intacto.
- Componente: combate aplica HP com dano configurado; aviso sem dano; `rolledDice` de ataque+dano no log/3D.
- Editor: salvar com os dois campos produz `ataque(dano)`; editar pin legado `ataque(dano)` pré-preenche os dois campos (round-trip).

## Critérios de aceite cobertos
- ✅ Nenhum dano inventado (`1d6`) — branch removido.
- ✅ Ataque sem dano → aviso visível, não 0 silencioso.
- ✅ Pins antigos continuam funcionando (sem migração de dados).
- ✅ Log/3D com ataque+dano.
- ⚠️ Parcial: mestre pode configurar `1d20+9 / 3d6+5` via dois campos, mas **sem** tipo de dano estruturado nem faixa de crítico, e **sem** preenchimento automático na importação PF2e (follow-up).

## Trade-offs vs. Plano A
- ✅ Diff pequeno, zero migração, zero risco de schema, entrega imediata dos dois bugs principais.
- ⚠️ Convenção por string é frágil a médio prazo (parênteses no label, dano com vírgulas, etc.).
- ⚠️ Não resolve stat blocks reais (crítico 19–20, tipo de dano) nem importação PF2e — provavelmente vira a issue de follow-up que o Plano A implementaria.
