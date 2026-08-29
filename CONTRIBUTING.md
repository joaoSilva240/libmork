# Guia de Contribuição — Libmork

Obrigado por considerar contribuir com o **Libmork**! Este documento descreve o workflow de desenvolvimento, convenções de código e processo de submissão de PRs.

## 🛠️ Setup de Desenvolvimento

### Pré-requisitos
- Node.js 22+
- PostgreSQL 14+ (local ou via Docker)
- npm 10+
- Git

### Instalação
```bash
git clone https://github.com/joaoSilva240/libmork.git
cd libmork
npm install
cp .env.example .env.local
# Edite .env.local com suas credenciais de banco
npm run db:push
npm run dev
```

## 📝 Convenções de Código

- **Linting:** ESLint 9 (executar `npm run lint` antes de commit)
- **Formatação:** Prettier 3 (`npm run format`)
- **TypeScript:** strict mode habilitado, sem `any` não justificado
- **Commits:** Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`)

## 🧪 Testes

```bash
npm run test              # Testes unitários (Vitest)
npm run test:coverage     # Cobertura de código
```

## 🔄 Workflow de Branches

- `main` — branch estável, protegida
- `feature/*` — novas features
- `fix/*` — correções de bugs
- `refactor/*` — refatorações sem mudança de comportamento

## 🚀 Submissão de PRs

1. Fork o repositório e crie uma branch a partir de `main`
2. Implemente suas mudanças seguindo as convenções acima
3. Adicione testes para novas features ou fixes
4. Garanta que `npm run lint`, `npm run test` e `npm run build` passam
5. Abra um PR descrevendo:
   - **O quê:** resumo das mudanças
   - **Por quê:** motivação e contexto
   - **Como testar:** passo a passo para o revisor validar
6. Aguarde revisão — PRs são mergeados via squash commit

## 🐳 Hook Pre-push

O projeto usa Husky para rebuild da imagem Docker local antes de push:
- Hook: `.husky/pre-push`
- Ação: `docker compose -f docker-compose.local.yml build && up -d`
- Para pular (não recomendado): `git push --no-verify`

## 📚 Referências

- [Análise de Requisitos](./docs/01-analise-de-requisitos.md)
- [Plano de Execução](./docs/02-plano-de-execucao.md)
- [Deploy ZimaOS](./docs/deploy-zimaos.md)

## 📧 Dúvidas?

Abra uma issue ou entre em contato: joao.silvaoliver240@gmail.com
