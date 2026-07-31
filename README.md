# Controle Financeiro SaaS 2.0

Versão comercial do Controle Financeiro v10, preservando o painel, planejamento, contas, gráficos, relatórios, backup e PWA. A camada SaaS adiciona contas de usuário, sincronização no MongoDB, controle de acesso, teste grátis e cobrança pelo Mercado Pago.

## Oferta comercial

| Plano | Duração | Valor padrão |
|---|---:|---:|
| Mensal | 30 dias | R$ 19,90 |
| Semestral | 180 dias | R$ 99,90 |
| Anual | 365 dias | R$ 179,90 |
| Teste | 3 dias | Grátis, sem cartão |

Os valores são configuráveis por variáveis de ambiente. O backend é a fonte oficial dos preços exibidos na página de vendas.

## Arquitetura

- Frontend estático/PWA em `public/`, compatível com Vercel.
- API Node.js 20+, Express 5 e MongoDB Atlas em `src/`, compatível com Render.
- JWT para autenticação e bcrypt para senha.
- Mercado Pago para PIX e checkout com cartão.
- Webhook assinado e processamento idempotente de pagamentos.
- Sincronização com revisão otimista para evitar sobrescrita silenciosa entre dispositivos.
- Painel administrativo para clientes, pagamentos e ativações manuais.

## Desenvolvimento local

Pré-requisitos: Node.js 20+ e MongoDB.

```bash
npm install
cp .env.example .env
npm start
```

Acesse `http://localhost:3000`. Nunca versione o arquivo `.env`.

## Variáveis obrigatórias em produção

```env
NODE_ENV=production
MONGODB_URI=
JWT_SECRET=
FRONTEND_URL=https://SEU-FRONTEND.vercel.app
BACKEND_URL=https://SUA-API.onrender.com
CORS_ORIGINS=https://SEU-FRONTEND.vercel.app
TRIAL_DAYS=3
PLAN_MONTHLY_PRICE=19.90
PLAN_SEMIANNUAL_PRICE=99.90
PLAN_YEARLY_PRICE=179.90
MERCADO_PAGO_ACCESS_TOKEN=
MERCADO_PAGO_WEBHOOK_SECRET=
```

SMTP é opcional durante desenvolvimento, mas necessário para recuperação de senha e mensagens comerciais em produção. Consulte `.env.example`.

## Render — backend

O `render.yaml` contém a base do serviço. Configure no painel os segredos e URLs reais. O health check é:

```text
/api/health
```

Depois de publicar, valide que retorna `ok: true` e versão `2.0.0`.

## Vercel — frontend

1. Importe o repositório.
2. Use `public` como diretório de saída estática.
3. Copie `public/config.production.example.js` para `public/config.js`.
4. Substitua `SUA-API` pela URL real do Render.
5. Não coloque credenciais do MongoDB, SMTP ou Mercado Pago no frontend.

## Mercado Pago

Configure o webhook de pagamentos como:

```text
https://SUA-API.onrender.com/api/billing/webhook
```

Ative notificações de pagamentos e guarde a assinatura secreta em `MERCADO_PAGO_WEBHOOK_SECRET`. Teste primeiro com credenciais de teste.

Fluxos críticos a validar antes da produção:

- cadastro inicia exatamente 3 dias de teste;
- teste expirado bloqueia `/api/data` sem apagar dados;
- PIX pendente exibe QR Code e copia e cola;
- webhook aprovado ativa o plano uma única vez;
- cartão aprovado retorna ao frontend e libera o acesso;
- valor, moeda e plano do pagamento correspondem à oferta;
- renovação antes do vencimento preserva o período restante.

## Administração

Crie ou atualize o administrador somente em ambiente seguro:

```bash
npm run seed:admin
```

Defina `ADMIN_EMAIL` e `ADMIN_PASSWORD` no ambiente e remova `ADMIN_PASSWORD` após executar o seed.

## Verificações

```bash
npm test
node --check src/server.js
node --check src/routes/billing.js
```

## Pendências obrigatórias antes da venda pública

- preencher dados do responsável legal, contato de suporte, Termos de Uso e Política de Privacidade;
- configurar SMTP de produção;
- configurar credenciais e webhook do Mercado Pago;
- validar backup e restauração do MongoDB Atlas;
- executar compra completa com credenciais de teste;
- ativar monitoramento e alertas do Render e da Vercel.
