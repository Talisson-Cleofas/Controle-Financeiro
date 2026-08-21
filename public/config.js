window.APP_CONFIG = window.APP_CONFIG || {
  API_URL: 'https://controle-financeiro-e1pp.onrender.com'
};

// UI Lab: carrega a camada visual somente nesta branch de preview.
(function loadUiLabStyles(){
  if (!document.querySelector('link[data-ui-lab="true"]')) {
    const lab = document.createElement('link');
    lab.rel = 'stylesheet';
    lab.href = './ui-lab.css?v=current-production';
    lab.dataset.uiLab = 'true';
    document.head.appendChild(lab);
  }

  if (!document.querySelector('link[data-ui-lab-values="true"]')) {
    const vibrant = document.createElement('link');
    vibrant.rel = 'stylesheet';
    vibrant.href = './ui-values-vibrant.css?v=2';
    vibrant.dataset.uiLabValues = 'true';
    document.head.appendChild(vibrant);
  }

  if (!document.querySelector('link[data-ui-budget-stepper="true"]')) {
    const stepperCss = document.createElement('link');
    stepperCss.rel = 'stylesheet';
    stepperCss.href = './ui-budget-stepper.css?v=2';
    stepperCss.dataset.uiBudgetStepper = 'true';
    document.head.appendChild(stepperCss);
  }

  if (!document.querySelector('script[data-ui-budget-stepper="true"]')) {
    const stepperJs = document.createElement('script');
    stepperJs.src = './ui-budget-stepper.js?v=2';
    stepperJs.defer = true;
    stepperJs.dataset.uiBudgetStepper = 'true';
    document.head.appendChild(stepperJs);
  }

  if (!document.querySelector('link[data-gradient-waves="true"]')) {
    const wavesCss = document.createElement('link');
    wavesCss.rel = 'stylesheet';
    wavesCss.href = './gradient-waves.css?v=1';
    wavesCss.dataset.gradientWaves = 'true';
    document.head.appendChild(wavesCss);
  }

  if (!document.querySelector('script[data-gradient-waves="true"]')) {
    const wavesJs = document.createElement('script');
    wavesJs.type = 'module';
    wavesJs.src = './gradient-waves.js?v=1';
    wavesJs.dataset.gradientWaves = 'true';
    document.head.appendChild(wavesJs);
  }

  if (!document.querySelector('link[data-specular-buttons="true"]')) {
    const specularCss = document.createElement('link');
    specularCss.rel = 'stylesheet';
    specularCss.href = './specular-buttons.css?v=2';
    specularCss.dataset.specularButtons = 'true';
    document.head.appendChild(specularCss);
  }

  if (!document.querySelector('script[data-specular-buttons="true"]')) {
    const specularJs = document.createElement('script');
    specularJs.type = 'module';
    specularJs.src = './specular-buttons.js?v=3';
    specularJs.dataset.specularButtons = 'true';
    document.head.appendChild(specularJs);
  }

  if (!document.querySelector('link[data-magic-bento="true"]')) {
    const bentoCss = document.createElement('link');
    bentoCss.rel = 'stylesheet';
    bentoCss.href = './magic-bento.css?v=2';
    bentoCss.dataset.magicBento = 'true';
    document.head.appendChild(bentoCss);
  }

  if (!document.querySelector('script[data-magic-bento="true"]')) {
    const bentoJs = document.createElement('script');
    bentoJs.type = 'module';
    bentoJs.src = './magic-bento.js?v=2';
    bentoJs.dataset.magicBento = 'true';
    document.head.appendChild(bentoJs);
  }

  if (!document.querySelector('link[data-modern-selects="true"]')) {
    const selectCss = document.createElement('link');
    selectCss.rel = 'stylesheet';
    selectCss.href = './ui-selects-modern.css?v=2';
    selectCss.dataset.modernSelects = 'true';
    document.head.appendChild(selectCss);
  }

  if (!document.querySelector('script[data-modern-selects="true"]')) {
    const selectJs = document.createElement('script');
    selectJs.src = './ui-selects-modern.js?v=2';
    selectJs.defer = true;
    selectJs.dataset.modernSelects = 'true';
    document.head.appendChild(selectJs);
  }

  if (!document.querySelector('link[data-carteiras-layout="true"]')) {
    const carteirasCss = document.createElement('link');
    carteirasCss.rel = 'stylesheet';
    carteirasCss.href = './ui-carteiras-layout.css?v=1';
    carteirasCss.dataset.carteirasLayout = 'true';
    document.head.appendChild(carteirasCss);
  }
})();
