// Configure aqui a URL da API depois que publicar o backend.
// Desenvolvimento local: http://localhost:3000/api
// Produção exemplo: https://sua-api.onrender.com/api
window.APP_CONFIG = {
  API_URL: 'https://controle-financeiro-e1pp.onrender.com/api'
};

// UI Lab: camada visual isolada para experimentos de interface.
// Mantida fora do index.html para permitir rollback simples sem afetar a lógica.
(() => {
  const href = 'ui-lab.css?v=1';
  if (document.querySelector(`link[href="${href}"]`)) return;

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
})();
