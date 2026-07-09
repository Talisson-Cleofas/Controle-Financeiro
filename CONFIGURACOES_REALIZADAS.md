# Configurações realizadas até aqui

Este pacote consolida a versão profissional do app **Controle Financeiro**, preparada para Web, PWA/mobile e publicação em produção.

## O que já está configurado

- Backend em **Node.js + Express**.
- Conexão com **MongoDB Atlas** via `MONGO_URI`.
- Autenticação de usuários com **JWT**.
- Senhas criptografadas com **bcryptjs**.
- Rotas protegidas por token.
- Usuários isolados por `userId`, para cada pessoa ver somente os próprios dados.
- Frontend PWA adaptado para consumir a API.
- `config.js` apontando para API local em desenvolvimento.
- `manifest.webmanifest` e `service-worker.js` para instalação como app no celular.
- Arquivo `render.yaml` para facilitar publicação do backend.
- Exemplos seguros de `.env`, sem credenciais reais.

## Configuração local usada nos testes

Backend local:

```txt
http://localhost:3000/api
```

Health check validado:

```txt
http://localhost:3000/api/health
```

Resposta esperada:

```json
{
  "status": "ok",
  "app": "Controle Financeiro API",
  "version": "2.0.0"
}
```

Frontend local:

```txt
http://localhost:5500
```

## Importante sobre segurança

Este ZIP **não inclui sua senha real do MongoDB, JWT real, token de login ou arquivo `.env` real**.

Antes de publicar para uso real:

1. Troque a senha do usuário no MongoDB Atlas.
2. Gere uma nova chave JWT:

```bash
openssl rand -base64 64
```

3. Coloque as credenciais somente no `.env` local ou nas variáveis de ambiente da hospedagem.
4. Nunca envie o arquivo `.env` para o GitHub.

## Comandos locais principais

### Backend

```bash
cd backend
cp .env.example .env
nano .env
npm install
npm run dev
```

### Frontend

```bash
cd frontend/www
python3 -m http.server 5500
```

Abra:

```txt
http://localhost:5500
```

## Testes via terminal

### Cadastro

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Talisson",
    "email": "talisson@teste.com",
    "password": "123456"
  }'
```

### Login

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "talisson@teste.com",
    "password": "123456"
  }'
```

## Próxima etapa

Publicar:

- Backend no Render, Railway ou VPS.
- Frontend no Netlify, Vercel, Hostinger ou GitHub Pages.
- Banco no MongoDB Atlas.
