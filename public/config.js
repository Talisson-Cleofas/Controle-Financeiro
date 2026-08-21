window.APP_CONFIG = window.APP_CONFIG || {
  API_URL: 'https://controle-financeiro-e1pp.onrender.com'
};

// UI Lab: carrega a camada visual somente nesta branch de preview.
(function loadUiLabStyles(){
  if (document.querySelector('link[data-ui-lab="true"]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = './ui-lab.css?v=current-production';
  link.dataset.uiLab = 'true';
  document.head.appendChild(link);
})();
