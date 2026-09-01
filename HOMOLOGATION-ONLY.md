# Não promover esta branch para produção

Branch hmg/billing-validation, baseada no PR #8 (1ab68a4).
Usa exclusivamente srv-d9p2gebl550s73flltc0, MongoDB controle_financeiro_v2_staging
e Mercado Pago test. Credenciais existentes ficam no Render, nunca no código.
Frontend aponta somente para a API de staging. Root npm ci instala backend/;
npm start inicia o backend com cobrança e controle de acesso de teste habilitados.
Nenhuma migração de UserData é executada. Use uma conta nova de homologação para
validar este contrato: contas do aplicativo antigo podem não ter lançamentos
na coleção transactions. Os documentos antigos não são apagados.
Não usar dados ou cartões reais nesta prévia. Para produção, revisar o PR #8,
não mesclar esta branch de configuração de testes.
