# Frontend PWA — Controle Financeiro

Frontend em HTML, CSS e JavaScript puro, pronto para publicar como site estático e instalar no celular como PWA.

## Configuração da API

Edite:

```txt
www/config.js
```

Exemplo local:

```js
window.APP_CONFIG = {
  API_URL: 'http://localhost:3000/api'
};
```

Exemplo produção:

```js
window.APP_CONFIG = {
  API_URL: 'https://sua-api.com/api'
};
```

## Publicação

Publique a pasta:

```txt
frontend/www
```

Ela pode ir para Vercel, Netlify, GitHub Pages, Hostinger ou qualquer hospedagem de arquivos estáticos.

## PWA

O projeto já possui:

- `manifest.webmanifest`
- `service-worker.js`
- ícones 192x192 e 512x512

No celular, o usuário poderá adicionar à tela inicial.
