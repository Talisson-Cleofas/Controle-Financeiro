# Correção de confiabilidade dos pagamentos

Base: `feat/comercial-saas-v2`, commit `3eb1ffff48cd909213260079ba9b1b3ca1447408`.
Não promover esta branch diretamente para produção: a interface e a configuração
produtivas estão em outra linha de desenvolvimento.

## Alterações

- O webhook responde 202 somente após salvar o evento em `WebhookJob`. Sem gravação,
  responde 503 para permitir nova entrega. Nenhum dado de aprovação do corpo do
  webhook é usado para conceder licença; o worker consulta a API autenticada.
- Worker com lease de dois minutos, recuperação após reinício, oito tentativas,
  espera progressiva e estado `dead` para intervenção. Mais de uma instância pode
  executar o worker. Não há fila que dependa exclusivamente da memória do processo.
- Pagamento e licença são escritos na mesma transação MongoDB. Um contador na conta
  serializa também renovações diferentes. O índice único do pagamento continua ativo.
- A intenção de compra armazena referência e preço antes de chamar o provedor.
  Mudanças posteriores na tabela não invalidam uma compra já iniciada.
- A notificação de reembolso não é ignorada por um pagamento já estar aprovado.
  Aprovações atrasadas não restauram compras estornadas.
- Falha SMTP ocorre fora da transação e não duplica o período. Entrega garantida de
  e-mails não faz parte desta correção; configurar SMTP e revisar falhas separadamente.

## Tratamento de acesso após estorno

Reembolso integral ou estado `charged_back` remove apenas a parte não consumida do
período rastreável daquela compra. Renovações posteriores são deslocadas, preservando
suas durações. Dias já consumidos não são descontados de uma compra posterior.

Reembolso parcial, pagamento legado sem período rastreável ou validade modificada
manualmente: marcar `needsReview`/`reviewReason`, sem adivinhar uma redução de acesso.
Esses campos aparecem na API administrativa de pagamentos. Contas bloqueadas ou
canceladas administrativamente não são desbloqueadas pelo pagamento. Acesso de
administrador ou vitalício não é substituído pelo plano comprado.

Nenhum estorno é iniciado no Mercado Pago por este código. Ele apenas processa o
estado retornado pela API de pagamentos. A disputa de chargeback em si e seu tópico
específico não são implementados; a reversão depende do estado do recurso `payment`.

## Requisitos e operação

- MongoDB replica set ou cluster compatível com transações (por exemplo Atlas).
  O servidor falha explicitamente se conectado a MongoDB standalone; não há fallback
  que execute gravações financeiras sem transação.
- Índices de `Payment` e `WebhookJob` são inicializados antes de iniciar o worker.
- Manter tópicos de pagamentos e credenciais do Controle Financeiro separados dos
  do Colo de Deus. O adaptador Orders sem HMAC permanece exclusivo de `test`.
- `GET /api/admin/billing/jobs`: lista até 100 eventos em retry/dead.
- `POST /api/admin/billing/jobs/:id/retry`: reprocessa somente retry/dead.
  Ambas as rotas exigem autenticação e papel admin. Corrigir a causa antes de repetir.
- Não remover históricos financeiros ou filas no rollback.

## Validação

```sh
npm ci
npm test
```

Os testes de integração iniciam seu próprio MongoDB replica set descartável através
de `mongodb-memory-server`. Não leem `MONGODB_URI`, não usam dados reais e não chamam
o Mercado Pago. O binário MongoDB é baixado no ambiente de desenvolvimento/teste.
O ambiente precisa permitir iniciar esse processo e usar sockets locais.

Cobertura: concorrência de confirmações e renovações, rollback entre gravações,
estornos repetidos/sucessivos, preservação de outras compras, registros legados,
preço contratado, moeda/valor incorretos, recuperação de jobs, leases, resposta HTTP
após persistência, falha de armazenamento e isolamento do bypass de sandbox.

Em 01/09/2026 a suíte completa foi executada no GitHub Actions, em runners isolados:
37 testes passaram, sem falhas nem testes ignorados, em Node 22 e Node 24.
Evidência: https://github.com/Talisson-Cleofas/Controle-Financeiro/actions/runs/33541902135
O CI resolveu o bloqueio de permissão do MongoDB no ambiente local sem usar banco real.

O workflow usa permissões somente de leitura, actions fixadas por SHA, MongoDB
descartável e não recebe credenciais de banco, pagamento ou SMTP.

Esses resultados validam a lógica e as transações com provedor simulado, não uma
cobrança real. Antes da liberação comercial, validar PIX/cartão e o ciclo de licença
na homologação conectada ao Mercado Pago. Cobrança real e deploy de produção
continuam fora desta alteração.
