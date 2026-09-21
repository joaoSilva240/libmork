# Documentação da Biblioteca de PDFs e Referências Externas (Issue #6)

Este documento descreve a arquitetura, configuração, modelos de dados, segurança e boas práticas para o gerenciamento de referências e visualização de documentos PDF (livros de regras, suplementos, erratas e aventuras) no Libmork.

---

## 1. Visão Geral

A biblioteca do Libmork centraliza o catálogo de documentos de RPG consultados por Mestres e Jogadores. O sistema não armazena arquivos binários pesados diretamente no banco de dados relacional PostgreSQL; em vez disso, armazena **metadados e referências externas**.

Os arquivos podem ser disponibilizados por:
1. **Compartilhamento de Rede / SMB (Samba ou Windows UNC)** através de streaming seguro HTTP (`/api/library/documents/stream`).
2. **Google Drive** com visualização incorporada nativa via `/preview`.
3. **Links Externos** (Notion, GitBook, portais públicos, wikis e CDNs externas).

---

## 2. Configuração de `LIBRARY_SMB_PATH`

A variável de ambiente `LIBRARY_SMB_PATH` define o diretório raiz absoluto no servidor onde os arquivos locais ou compartilhados estão acessíveis para leitura e streaming.

### 2.1. Ambiente Windows (UNC ou Driver de Rede)

No Windows Server ou máquina de desenvolvimento local:
- **Caminho UNC**: `\\SERVIDOR-OU-IP\Compartilhamento` ou `\\192.168.1.100\rpg-books`
- **Letra de Unidade Mapeada**: `Z:\rpg-books` ou `D:\BibliotecaRPG`

Exemplo em `.env.local`:
```env
LIBRARY_SMB_PATH=\\192.168.1.100\rpg-books
```
*Dica:* Em arquivos `.env`, a barra invertida padrão do Windows (`\`) é preservada; não inclua credenciais (usuário/senha) no caminho UNC. A conta de serviço do Windows responsável por rodar o processo Node.js/Next.js deve possuir permissão de leitura NTFS e SMB na pasta de destino.

### 2.2. Ambiente Linux e Docker / ZimaOS (Linux Mount)

Em servidores Linux, containers Docker ou ZimaOS, o compartilhamento SMB deve ser montado no sistema de arquivos do host antes de ser referenciado pelo Libmork.

#### Montagem via `/etc/fstab` (cifs-utils):
```bash
# Instalar utilitário cifs
sudo apt-get install cifs-utils

# Criar ponto de montagem
sudo mkdir -p /mnt/rpg-share

# Configurar montagem em /etc/fstab
//192.168.1.100/rpg-books /mnt/rpg-share cifs credentials=/etc/smbcredentials,ro,iocharset=utf8 0 0
```

#### Montagem em Docker Compose (Volume CIFS ou Bind Mount):
```yaml
services:
  app:
    image: libmork:latest
    environment:
      - LIBRARY_SMB_PATH=/mnt/rpg-share
    volumes:
      - /mnt/rpg-share:/mnt/rpg-share:ro
```

Exemplo em `.env.local`:
```env
LIBRARY_SMB_PATH=/mnt/rpg-share
```

---

## 3. Formato dos Documentos e Estrutura de Dados

Os documentos são modelados na tabela `library_documents` e no schema Zod `createLibraryDocumentSchema`.

### 3.1. Campos da Entidade

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | UUID | Identificador único do documento |
| `title` | String | Título do livro ou suplemento (ex: *Player's Handbook 2024*) |
| `description` | Text (opcional) | Sinopse ou anotações de uso |
| `coverUrl` | String (opcional) | Imagem de capa (URL web ou caminho relativo `/uploads/...`) |
| `externalUrl` | String | Caminho relativo dentro de `LIBRARY_SMB_PATH` ou URL HTTP/HTTPS |
| `provider` | Enum | `smb`, `gdrive`, `external`, `notion`, `gitbook` |
| `category` | Enum | `livro-base`, `suplemento`, `errata`, `aventura`, `outro` |
| `tags` | Array de Strings | Tags para busca (ex: `["dnd5e", "magias", "regras"]`) |
| `isOfficial` | Boolean | Define se é semente oficial do sistema ou homebrew/custom |
| `isPublic` | Boolean | Visibilidade geral para jogadores |
| `campaignId` | UUID (opcional) | Vínculo com campanha específica (null = global) |

### 3.2. Diferença entre Valores de `externalUrl` por Provedor

- **`smb`**: Deve conter o caminho relativo do arquivo em relação a `LIBRARY_SMB_PATH` (ex: `srd/5.1-SRD.pdf` ou `dnd5e/livros/jogador.pdf`).
- **`gdrive`**: URL de compartilhamento do Google Drive (ex: `https://drive.google.com/file/d/1B2C3D4E5F/view?usp=sharing`). O Libmork converte automaticamente para visualização `/preview`.
- **`external` / `notion` / `gitbook`**: URL completa HTTPS para leitura direta (ex: `https://media.wizards.com/2023/downloads/dnd/SRD_CC_v5.1.pdf`).

---

## 4. Como Adicionar Referências

Existem três formas de adicionar referências à biblioteca:

### 4.1. Pela Interface Gráfica (Mestre)
1. Navegue até **Biblioteca** no menu de navegação do Mestre (`/master/library`).
2. Clique no botão **"Adicionar Referência"**.
3. Preencha:
   - **Título** e **Categoria**.
   - **Provedor**: Selecione *Compartilhamento Local / SMB*, *Google Drive*, *Notion*, *GitBook* ou *Link Externo*.
   - **Caminho / URL**:
     - Se *SMB*: informe o caminho relativo do PDF dentro da pasta compartilhada (ex: `regras/guia-mestre.pdf`).
     - Se *Google Drive* ou *Link*: cole a URL completa.
   - **Capa (Opcional)** e **Tags**.
4. Clique em **Salvar Referência**.

### 4.2. Via API REST
Envie uma requisição autenticada (com cookie de sessão de Mestre ou Administrador):

```http
POST /api/library/documents
Content-Type: application/json

{
  "title": "Guia de Sobrevivência Mörk Borg",
  "category": "suplemento",
  "provider": "smb",
  "externalUrl": "morkborg/suplementos/guia.pdf",
  "tags": ["morkborg", "regras"],
  "isPublic": true
}
```

### 4.3. Sementes Fixas (Seeds Oficiais)
Documentos canônicos sob licenças abertas (como o SRD 5.1 Creative Commons) são versionados diretamente em `src/lib/library/seeds.ts`.

---

## 5. Análise de Segurança

### 5.1. Prevenção contra Path Traversal
A rota `/api/library/documents/stream` e a biblioteca `src/lib/library/storage.ts` implementam defesas em camadas:
- **Rejeição de Null Bytes**: Entradas contendo `\0` ou `%00` são imediatamente rejeitadas.
- **Normalização e bloqueio de `..`**: Qualquer segmento relativo com dois pontos (`..`) ou tentativas de evasão são bloqueadas tanto na validação do Zod quanto no resolver de caminhos.
- **Confinamento Estrito (`path.relative`)**: O caminho resolvido no disco é confrontado contra o diretório raiz absoluto (`normalizedRoot`). Se a relação iniciar com `..` ou for absoluta para fora do root, a operação é sumariamente abortada com status 400.

### 5.2. Prevenção contra SSRF (Server-Side Request Forgery)
- O backend **não realiza requisições HTTP server-side** para links remotos ou URLs web.
- Se o usuário tentar passar uma URL `http://` ou `https://` para a rota `/api/library/documents/stream`, o endpoint rejeita a requisição explicitamente, orientando o cliente a abrir o link diretamente no navegador.
- Não há fetch em loopback (`127.0.0.1`), endereços locais ou metadados de nuvem a partir de inputs de documentos.

### 5.3. Controle de Acesso e Autenticação
- Leitura de catálogo (`GET /api/library/documents`): Disponível para consulta da biblioteca pública e de campanhas.
- Criação, Edição e Exclusão (`POST /api/library/documents`, `PATCH /api/library/documents/[id]`, `DELETE /api/library/documents/[id]`): Exigem autenticação ativa (`requireAuth`).
- Streaming (`GET /api/library/documents/stream`): Não executa scripts ou arquivos executáveis; atende exclusivamente como `application/pdf` ou binário tipado e impede acesso a qualquer arquivo fora do diretório configurado.

### 5.4. Proteção de Credenciais em `.env.example`
- O arquivo de exemplo de ambiente `.env.example` **não contém** endereços IP de produção, credenciais de usuário ou senhas embutidas no caminho UNC. Utiliza apenas placeholders descritivos (`\\192.168.1.100\rpg-books`).

---

## 6. Limitações de Iframe, Provedores e Direitos Autorais (Copyright)

### 6.1. Bloqueios por Políticas de Iframe (`X-Frame-Options` e CSP)
Alguns serviços externos proíbem a renderização de suas páginas embutidas dentro de um `<iframe>`:
- **Notion e GitBook**: Costumam enviar cabeçalhos HTTP `X-Frame-Options: SAMEORIGIN` ou `Content-Security-Policy: frame-ancestors ...`, o que faz o navegador bloquear o carregamento dentro da janela modal do Libmork.
- **Google Drive**: Requer obrigatoriamente a rota `/preview`. URLs normais terminadas em `/view` falham ao carregar no iframe por conta das políticas do Google. O componente `PdfViewerModal` normaliza essa URL automaticamente.
- **Fallback Obrigatório**: O componente de visualização sempre provê o botão **"Abrir original"** em nova aba com `rel="noopener noreferrer"`, permitindo que o usuário acesse o conteúdo mesmo quando o provedor bloqueia iframes.

### 6.2. Orientações de Direitos Autorais (Copyright e Licenciamento)
- O Libmork não hospeda pirataria nem redistribui obras protegidas por direitos autorais sem licença.
- Utilize a biblioteca para:
  - Documentos sob licenças abertas (SRD 5.1 OGL / Creative Commons, ORC License).
  - Conteúdo Homebrew e criações da própria mesa.
  - Links para plataformas onde os jogadores adquiriram suas próprias cópias (DriveThruRPG, D&D Beyond, plataformas oficiais).
- Para o armazenamento em compartilhamento local/SMB privado da sua mesa, assegure-se de que o acesso seja restrito à rede local ou Tailscale dos participantes da campanha.
