# ♻️ Desperdício Zero - API (Back-end)

Esta é a API RESTful desenvolvida em Node.js para o aplicativo **Desperdício Zero**. O sistema gerencia o inventário de alimentos dos usuários, calcula a urgência de vencimento dos produtos e integra-se com a inteligência artificial do Google Gemini para sugerir receitas e incentivar a doação de alimentos próximos da validade para ONGs.

Este projeto foi desenvolvido como requisito acadêmico para o curso de Análise e Desenvolvimento de Sistemas (Turma de 2026), unindo conceitos de desenvolvimento back-end, banco de dados relacional e integração com IA.

## 🚀 Tecnologias Utilizadas

* **Node.js & Express:** Servidor e roteamento da API.
* **TypeScript:** Tipagem estática para maior segurança e escalabilidade.
* **Prisma ORM:** Modelagem do banco de dados e consultas.
* **MySQL:** Banco de dados relacional.
* **JSON Web Token (JWT) & Bcrypt:** Autenticação e criptografia de senhas.
* **Google Generative AI (Gemini):** Geração de receitas inteligentes e indicação de ONGs.

## 📋 Pré-requisitos

Antes de começar, você precisará ter instalado em sua máquina as seguintes ferramentas:
* [Node.js](https://nodejs.org/en/) (versão 18 ou superior)
* [MySQL](https://dev.mysql.com/downloads/mysql/) (ou um container Docker equivalente)
* Uma chave de API válida do [Google AI Studio](https://aistudio.google.com/)

## ⚙️ Configuração e Instalação

**1. Clone o repositório e entre na pasta do back-end:**
```bash
git clone <url-do-seu-repositorio>
cd desperdicio-zero-api
```

**2. Instale as dependências do projeto:**
```bash
npm install
```

**3. Configure as variáveis de ambiente:**
Crie um arquivo chamado `.env` na raiz do projeto e preencha com as suas credenciais, seguindo o exemplo abaixo:
```env
PORT=8000
DATABASE_URL="mysql://USUARIO:SENHA@localhost:3306/desperdicio_zero"
JWT_SECRET="sua_chave_secreta_jwt"
GEMINI_API_KEY="sua_chave_do_google_gemini"
```

**4. Configure o Banco de Dados com o Prisma:**
```bash
# Gera o client do Prisma
npx prisma generate

# Cria as tabelas no MySQL com base no schema
npx prisma db push
```

**5. Inicie o servidor em modo de desenvolvimento:**
```bash
npx ts-node-dev src/server.ts
```
O servidor estará rodando em `http://localhost:8000`.

## 📚 Endpoints Principais (API Reference)

A API exige que as rotas protegidas enviem o token JWT no cabeçalho da requisição: `Authorization: Bearer <token>`.

### Autenticação
* `POST /auth/register`: Cria um novo usuário (`email`, `password`).
* `POST /auth/login`: Autentica o usuário e retorna o *access_token* (requer `username` e `password` no formato *url-encoded*).

### Inventário (Requer Autenticação)
* `GET /inventory`: Lista todos os itens da despensa do usuário logado, calculando automaticamente os dias para o vencimento e o status de urgência (Verde, Amarelo, Vermelho).
* `POST /inventory`: Adiciona um novo alimento à despensa.
* `DELETE /inventory/:id`: Remove um item específico.

### Inteligência Artificial (Requer Autenticação)
* `POST /generate-recipe`: Recebe um array de ingredientes (`products`) e retorna uma receita gerada pelo Gemini, além de dicas de ONGs para doação sustentável.

## 🗂 Estrutura do Projeto

```text
/
├── prisma/
│   └── schema.prisma        # Modelagem das tabelas do MySQL
├── src/
│   ├── controllers/         # Lógica de negócio e regras das rotas
│   ├── middlewares/         # Interceptadores (ex: validação de JWT)
│   ├── app.ts               # Configuração do Express
│   └── server.ts            # Ponto de entrada (Listen da porta)
├── .env                     # Variáveis de ambiente (não versionado)
├── package.json             # Dependências e scripts
└── tsconfig.json            # Configurações do TypeScript
```