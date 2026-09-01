# Pagamentos compatíveis com o backend de produção

## Escopo

Adaptação isolada sobre main. Mantém backend/ como raiz no Render, CommonJS,
MONGO_URI, coleção users/transactions, hash bcrypt, JWT e rotas /api/auth e
/api/transactions. Nenhum menu, ícone, domínio, configuração da
Vercel ou aplicativo Colo de Deus é substituído. As correções complementares em
public/ preservam os oito menus, ícones e identidade visual, acrescentam vendas.html
e substituem somente o sincronizador antigo. O módulo ESM vive somente em
backend/src/billing; Express 4 encaminha erros assíncronos explicitamente.

## Implantação segura e acesso

BILLING_ENABLED e BILLING_ENFORCE_ACCESS são false por omissão. Apenas salvar
credenciais não cria cobranças nem bloqueia usuários. Com cobrança desativada,
/api/billing responde 503 e não inicia processamento ou índices de pagamento.

Quando BILLING_ENABLED=true, novos cadastros recebem três dias de teste e uma
data de adesão. Contas existentes sem billingEnrolledAt conservam o acesso;
não há atualização em massa, mudança de senha ou conversão automática em licença.
O cliente não pode definir role, plan, status ou billingEnrolledAt no cadastro.

BILLING_ENFORCE_ACCESS=true é uma segunda etapa, dependente da interface comercial
validada. Conta comercial vencida não pode criar/editar/excluir lançamentos,
mas mantém login, leitura, exportação e acesso à renovação. Administradores e
licenças vitalícias são preservados. Bloqueio administrativo explícito precede
a exceção de legado. Nunca ativar bloqueio antes de validar a renovação na UI.

## Configuração para ativação posterior

- MERCADO_PAGO_ACCESS_TOKEN: credencial produtiva da aplicação Financeiro.
- MERCADO_PAGO_WEBHOOK_SECRET: segredo dessa mesma aplicação, nunca no git.
- MERCADO_PAGO_ENV=production.
- BACKEND_URL=https://controle-financeiro-e1pp.onrender.com
- FRONTEND_URL=https://controle-financeiro-v10-planejament.vercel.app
- Webhook produtivo: BACKEND_URL/api/billing/webhook, evento payment.
- BILLING_ENABLED=true somente após revisão e teste controlado.
- BILLING_ENFORCE_ACCESS=false até validar UI, dados e renovação.

PIX usa /v1/payments e cartão Checkout Pro. O recebedor é determinado pelo
Access Token, não por uma chave PIX estática. Conferir a conta recebedora antes
de qualquer pagamento real. Não houve cobrança real nesta implementação.

Plano mensal: R$19,90/30 dias; semestral: R$99,90/180 dias; anual: R$179,90/365 dias.
Valores herdados do módulo comercial; revisar antes de ativar. Variáveis
PLAN_MONTHLY_PRICE, PLAN_SEMIANNUAL_PRICE e PLAN_YEARLY_PRICE podem sobrescrevê-los.

MongoDB precisa suportar transações (replica set/Atlas/mongos). Índices são
aditivos: nenhum índice ou documento de produção é removido automaticamente.
Se houver índice antigo incompatível, parar e planejar migração explícita.

## Garantias e limites

Webhook exige assinatura produtiva; responde 202 somente após persistência da
fila. Worker consulta a API autenticada, valida recurso, conta/plano/moeda/valor,
e aplica licença e pagamento na mesma transação. Duplicatas e concorrência não
repetem concessões. Retentativas usam lease e backoff; jobs dead e pagamentos
needsReview precisam de revisão operacional. Este patch não oferece painel
administrativo para reprocessamento. Estornos integrais removem apenas dias não
consumidos; parciais ou alterações manuais são encaminhados para revisão.

E-mail é opcional via SMTP; não é condição para conceder licença e não há fila
durável de e-mail. Recuperação de senha não foi adicionada neste patch.

## Sincronização e renovação

/api/data GET/PUT agora opera sobre a coleção transactions já existente, não
UserData. User.financialSettings preserva carteiras, recorrências e categorias;
monthlyBudget continua canônico. IDs antigos são conservados e IDs locais ficam
em clientId. uiData guarda somente metadados visuais conhecidos. Todos os escritores
financeiros incrementam financialRevision numa transação, inclusive as rotas
legadas e orçamento. PUT obsoleto retorna 409 sem sobrescrever dados. Exclusões
usam deletedAt e podem ser recuperadas; listas/relatórios ignoram removidos.

ATENÇÃO: esta versão exige replica set/Atlas/mongos também com cobrança desligada,
pois a sincronização depende de transações. O startup verifica essa capacidade;
não publicar sem confirmar a topologia. Nenhuma migração externa foi executada.

No navegador, erros de conexão não encerram sessão. Cópia local precede substituição,
conflitos preservam rascunhos e importação de cache sem dono exige confirmação.
Se faltar espaço para backup, não substitui os dados. Há controle de recarga e
download das cópias locais. Backups locais permanecem no dispositivo, não são
enviados a outras contas automaticamente. Revisar retenção antes do lançamento.

/vendas permite login, escolha de planos com preços da API, PIX copia e cola,
cartão externo e consulta autenticada de pagamentos. Query de retorno não concede
licença. Cobrança continua opt-in; não houve teste financeiro real. O aviso de
vencimento não impede leitura/exportação. Validar visualmente o fluxo completo
em homologação antes de publicar e confirmar recebedor antes de pagamento real.

## Testes

Em backend/: npm ci && npm test. CI Node 22/24 usa MongoDB replica set descartável,
sem banco de produção e sem credenciais reais. Testes cobrem processamento,
concorrência, rollback, estornos, HMAC, filas, autenticação antiga, orçamento,
lançamentos pendentes, dados privados, cadastro sem escalada e Express 4.

Não executar testes com MONGO_URI produtivo. A suíte ignora essa variável e cria
explicitamente um banco descartável. Para reverter antes da ativação, basta
reverter este patch: nenhum dado de usuário é migrado.
