# Publicação passo a passo

## 1. Subir para o GitHub

```bash
cd ~/Downloads/controle_financeiro_mongodb
git init
git add .
git commit -m "Versao profissional com MongoDB"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/controle-financeiro-mongodb.git
git push -u origin main
```

O `.gitignore` já ignora `.env`, `node_modules`, `android`, `ios`, `dist` e `build`.

## 2. Publicar backend no Render

Configuração sugerida:

```txt
New → Web Service
Root Directory: backend
Runtime: Node
Build Command: npm install
Start Command: npm start
```

Variáveis de ambiente:

```env
NODE_ENV=production
PORT=10000
CLIENT_URL=https://URL-DO-SEU-FRONTEND.netlify.app
MONGO_URI=mongodb+srv://USUARIO:SENHA@cluster0.xxxxx.mongodb.net/controle_financeiro?retryWrites=true&w=majority&appName=Cluster0
JWT_SECRET=SUA_CHAVE_FORTE
JWT_EXPIRES_IN=7d
```

Teste depois de publicar:

```txt
https://URL-DO-SEU-BACKEND.onrender.com/api/health
```

## 3. Publicar frontend no Netlify

Antes de publicar, altere:

```txt
frontend/www/config.js
```

De:

```js
window.APP_CONFIG = {
  API_URL: 'http://localhost:3000/api'
};
```

Para:

```js
window.APP_CONFIG = {
  API_URL: 'https://URL-DO-SEU-BACKEND.onrender.com/api'
};
```

Depois publique a pasta:

```txt
frontend/www
```

## 4. Atualizar CORS no backend

Depois que o Netlify gerar sua URL final, volte no backend publicado e coloque:

```env
CLIENT_URL=https://URL-DO-SEU-FRONTEND.netlify.app
```

Depois reinicie/republique o backend.

## 5. Teste final

No frontend publicado:

1. Crie uma conta.
2. Faça login.
3. Cadastre uma receita.
4. Cadastre uma despesa.
5. Atualize a página.
6. Confirme que os dados continuam aparecendo.
