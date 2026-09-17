# Importação de Personagem para Campanha

## Visão Geral

Este documento descreve o fluxo de importação de personagens existentes para campanhas, implementado como parte da Issue #4. A importação cria um **vínculo por referência** entre um personagem existente e uma campanha, sem duplicar dados do personagem.

## Modelo de Dados

### Vínculo por Referência

A importação **nunca duplica** o registro do personagem na tabela `characters`. Em vez disso, cria um novo registro na tabela `character_campaigns` que vincula o personagem à campanha:

```typescript
{
  characterId: string,      // UUID do personagem existente
  campaignId: string,       // UUID da campanha de destino
  origin: "imported",       // Origem do vínculo
  approvalStatus: "approved" // Status de aprovação automática
}
```

### Escopo Global Compartilhado

Como o personagem não é duplicado, **todos os atributos são globais** e compartilhados entre todas as campanhas em que o personagem está vinculado:

- **Pontos de Vida (HP)**: `hitPointsCurrent`, `hitPointsMax`
- **Pontos de Mana**: `manaCurrent`, `manaMax`
- **Experiência (XP)**: `experience`, `level`
- **Atributos base**: força, destreza, constituição, inteligência, sabedoria, carisma
- **Inventário e equipamentos**
- **Nome, imagem e descrição**

Alterações feitas em uma campanha refletem em todas as campanhas vinculadas.

## Endpoint de API

### `POST /api/campaigns/:id/import-character`

Vincula um personagem existente do jogador autenticado a uma campanha específica.

#### Requisição

**Headers:**
```
Authorization: Bearer <session-token>
Content-Type: application/json
```

**Body:**
```json
{
  "characterId": "550e8400-e29b-41d4-a716-446655440000"
}
```

#### Validações

O endpoint aplica as seguintes validações na ordem:

1. **Autenticação obrigatória** (401)
   - O usuário deve estar autenticado
   
2. **Formato UUID válido** (400)
   - `characterId` deve ser um UUID válido

3. **Propriedade do personagem** (404)
   - O personagem deve existir
   - `characters.ownerId` deve corresponder ao `session.user.id`

4. **Convite ativo** (403)
   - Deve existir registro em `campaignInvites` onde:
     - `userId = session.user.id`
     - `campaignId = :id` (da URL)
     - `revoked = false`

5. **Vínculo único** (409)
   - Não deve existir registro em `character_campaigns` com o mesmo `characterId` e `campaignId`

#### Respostas

**201 Created** — Vínculo criado com sucesso
```json
{
  "success": true,
  "data": {
    "characterId": "550e8400-e29b-41d4-a716-446655440000",
    "campaignId": "camp-123",
    "origin": "imported",
    "approvalStatus": "approved"
  }
}
```

**400 Bad Request** — UUID inválido
```json
{
  "success": false,
  "error": "Dados inválidos",
  "errors": [...]
}
```

**401 Unauthorized** — Não autenticado
```json
{
  "success": false,
  "error": "Não autenticado"
}
```

**403 Forbidden** — Sem convite ativo
```json
{
  "success": false,
  "error": "Você não tem convite ativo para esta campanha"
}
```

**404 Not Found** — Personagem não encontrado ou não pertence ao usuário
```json
{
  "success": false,
  "error": "Personagem não encontrado"
}
```

**409 Conflict** — Personagem já vinculado
```json
{
  "success": false,
  "error": "Este personagem já está vinculado a esta campanha"
}
```

**500 Internal Server Error** — Erro interno
```json
{
  "success": false,
  "error": "Erro interno do servidor"
}
```

## Fluxo de Autorização

### Requisitos

Para importar um personagem, o jogador deve atender **todos** os requisitos:

1. Estar autenticado no sistema
2. Ser o proprietário do personagem (`characters.ownerId = session.user.id`)
3. Ter um convite ativo e não revogado para a campanha (`campaignInvites`)

### Segurança

- Jogadores **não podem** importar personagens de outros jogadores
- Jogadores **não podem** importar para campanhas sem convite
- O sistema valida ownership antes de todas as outras verificações de negócio

## Interface do Usuário

### Modal de Importação

O componente `PlayerDashboard` implementa um modal de importação acessível através do botão **"↩ Importar Personagem Existente"** na aba "Campanhas".

#### Funcionalidades

- **Busca por nome**: Campo de texto para filtrar personagens disponíveis
- **Lista de personagens**: Exibe apenas personagens que o jogador possui e que ainda não estão vinculados à campanha
- **Feedback visual**: Toasts informativos para sucesso, aviso e erro
- **Validação client-side**: Verifica disponibilidade antes de permitir importação

#### Mensagens de Feedback

- **Sucesso (201)**: "Personagem vinculado com sucesso!"
- **Conflito (409)**: "Este personagem já está nesta campanha"
- **Sem personagens disponíveis**: "Você não tem personagens para importar"

## Invalidação de Cache

Após importação bem-sucedida (201), o cliente invalida automaticamente a query:

```typescript
queryClient.invalidateQueries({ queryKey: queryKeys.player.campaigns() });
```

Isso força o refetch da lista de campanhas, atualizando a UI com o personagem recém-vinculado.

## Testes

### Testes de API (`route.test.ts`)

- ✅ Retorna 401 quando não autenticado
- ✅ Retorna 400 quando `characterId` não é UUID válido
- ✅ Retorna 404 quando personagem não existe ou não pertence ao usuário
- ✅ Retorna 403 quando usuário não tem convite ativo
- ✅ Retorna 409 quando personagem já está vinculado
- ✅ Retorna 201 e cria vínculo quando todas as validações passam

### Testes de UI (`PlayerDashboard.import.test.tsx`)

- ✅ Abre modal ao clicar em "Importar Personagem Existente"
- ✅ Filtra personagens por nome na busca
- ✅ Submete importação com sucesso e refaz fetch da lista de campanhas
- ✅ Exibe toast de aviso quando personagem já está vinculado (409)
- ✅ Exibe toast informativo quando não há personagens disponíveis para importar

## Arquivos Relacionados

### Backend
- `src/app/api/campaigns/[id]/import-character/route.ts` — Endpoint de importação
- `src/app/api/campaigns/[id]/import-character/__tests__/route.test.ts` — Testes de API

### Frontend
- `src/components/player/PlayerDashboard.tsx` — Modal de importação e integração de UI
- `src/components/player/__tests__/PlayerDashboard.import.test.tsx` — Testes de UI
- `src/lib/client/queryKeys.ts` — Chaves de query para cache

### Documentação
- `docs/character-campaign-import.md` — Este documento
