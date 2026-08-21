window.APP_CONFIG = window.APP_CONFIG || {
  API_URL: 'https://controle-financeiro-e1pp.onrender.com'
};

// UI Lab: carrega a camada visual somente nesta branch de preview.
(function loadUiLabStyles(){
  if (document.querySelector('link[data-ui-lab="true"]')) return;

  const lab = document.createElement('link');
  lab.rel = 'stylesheet';
  lab.href = './ui-lab.css?v=current-production';
  lab.dataset.uiLab = 'true';
  document.head.appendChild(lab);

  const vibrant = document.createElement('link');
  vibrant.rel = 'stylesheet';
  vibrant.href = './ui-values-vibrant.css?v=1';
  vibrant.dataset.uiLabValues = 'true';
  document.head.appendChild(vibrant);
})();
