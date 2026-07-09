# Controle Financeiro Profissional — Web + Mobile + MongoDB

Este projeto transforma o app de controle financeiro em uma aplicação profissional com:

- Frontend PWA instalável no celular.
- Backend Node.js + Express.
- MongoDB/MongoDB Atlas como banco de dados.
- Cadastro e login de usuários.
- Senhas criptografadas com bcrypt.
- Autenticação com JWT.
- Dados privados por usuário.
- CRUD completo de receitas e despesas.
- Relatório mensal, impressão/PDF e exportação CSV.
- Base pronta para empacotar como Android/iOS com Capacitor.

## Estrutura

```txt
controle_financeiro_mongodb/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middlewares/
│   │   ├── models/
│   │   ├── routes/
│   │   └── server.js
│   ├── .env.example
│   └── package.json
│
├── frontend/
│   └── www/
│       ├── index.html
│       ├── config.js
│       ├── manifest.webmanifest
│       ├── service-worker.js
│       └── assets/icons/
│
├── capacitor.config.json
├── package.json
├── render.yaml
└── README.md
```

---

## 1. Configurar o MongoDB Atlas

Crie um cluster no MongoDB Atlas ou use MongoDB local.

Você vai precisar de uma string parecida com esta:

```txt
mongodb+srv://USUARIO:SENHA@cluster0.xxxxx.mongodb.net/controle_financeiro?retryWrites=true&w=majority
```

Nunca coloque essa string dentro do frontend. Ela deve ficar somente no backend, no arquivo `.env` ou nas variáveis de ambiente da hospedagem.

---

## 2. Rodar o backend localmente

Entre na pasta do backend:

```bash
cd backend
npm install
cp .env.example .env
```

Edite o arquivo `.env`:

```env
PORT=3000
CLIENT_URL=http://localhost:5500
MONGO_URI=sua_string_do_mongodb
JWT_SECRET=uma_chave_grande_e_segura
JWT_EXPIRES_IN=7d
NODE_ENV=development
```

Depois rode:

```bash
npm run dev
```

Teste no navegador:

```txt
http://localhost:3000/api/health
```

Se estiver funcionando, deve retornar um JSON com `status: "ok"`.

---

## 3. Rodar o frontend localmente

O frontend está em:

```txt
frontend/www
```

Abra o arquivo:

```txt
frontend/www/config.js
```

Em desenvolvimento, deixe assim:

```js
window.APP_CONFIG = {
  API_URL: 'http://localhost:3000/api'
};
```

Depois abra o `index.html` com uma extensão tipo **Live Server** do VS Code, ou publique a pasta `frontend/www` em qualquer hospedagem estática.

---

## 4. Publicar o backend

Você pode publicar em serviços como Render, Railway, VPS, Hostinger Node.js ou outro ambiente Node.

Variáveis obrigatórias na hospedagem:

```env
NODE_ENV=production
PORT=10000
CLIENT_URL=https://seu-frontend.com
MONGO_URI=sua_string_do_mongodb_atlas
JWT_SECRET=uma_chave_grande_e_segura
JWT_EXPIRES_IN=7d
```

O arquivo `render.yaml` já está incluído como base para deploy no Render.

---

## 5. Publicar o frontend web/PWA

Publique a pasta:

```txt
frontend/www
```

Antes de publicar, edite:

```txt
frontend/www/config.js
```

E coloque a URL real do backend:

```js
window.APP_CONFIG = {
  API_URL: 'https://sua-api-publicada.com/api'
};
```

Depois de publicado, o usuário pode acessar pelo navegador e instalar como aplicativo:

- Android: Chrome > Instalar app ou Adicionar à tela inicial.
- iPhone: Safari > Compartilhar > Adicionar à Tela de Início.

---

## 6. Gerar app Android/iOS com Capacitor

Na pasta raiz do projeto:

```bash
npm install
npm run mobile:add:android
npm run mobile:copy
npm run mobile:open:android
```

Para iOS, use macOS com Xcode:

```bash
npm run mobile:add:ios
npm run mobile:copy
npm run mobile:open:ios
```

Antes de empacotar, confira se o `frontend/www/config.js` aponta para a API publicada.

---

## Rotas principais da API

### Autenticação

```txt
POST /api/auth/register
POST /api/auth/login
GET  /api/auth/me
PUT  /api/auth/me/settings
```

### Lançamentos

```txt
GET    /api/transactions?month=2026-07
GET    /api/transactions/summary?month=2026-07
GET    /api/transactions/export?month=2026-07
POST   /api/transactions
PUT    /api/transactions/:id
DELETE /api/transactions/:id
```

---

## Segurança aplicada

- O frontend não conhece a senha do MongoDB.
- O backend protege as rotas com JWT.
- Cada lançamento possui o campo `user`, ligado ao usuário logado.
- As consultas sempre filtram por `user: req.user._id`.
- A senha do usuário é salva como hash, não como texto puro.
- O service worker não faz cache das rotas `/api/`, evitando armazenar dados privados da API.

---

## Observação importante

Na versão anterior, os dados ficavam no navegador usando `localStorage`. Nesta versão, os dados ficam no MongoDB, vinculados ao usuário logado. O app também tem um botão para importar dados antigos do navegador e enviá-los para o MongoDB.
