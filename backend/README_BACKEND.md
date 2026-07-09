# Backend — Controle Financeiro

API em Node.js + Express + MongoDB.

## Instalação

```bash
npm install
cp .env.example .env
npm run dev
```

## Variáveis de ambiente

```env
PORT=3000
CLIENT_URL=http://localhost:5500
MONGO_URI=mongodb://127.0.0.1:27017/controle_financeiro
JWT_SECRET=troque_esta_chave
JWT_EXPIRES_IN=7d
NODE_ENV=development
```

## Modelos

### User

- name
- email
- passwordHash
- monthlyBudget

### Transaction

- user
- type: income ou expense
- description
- amount
- category
- status: paid ou pending
- date
- notes

## Privacidade

Todas as consultas e alterações de lançamentos usam o usuário autenticado:

```js
{ user: req.user._id }
```

Assim, um usuário não consegue acessar os dados de outro.
