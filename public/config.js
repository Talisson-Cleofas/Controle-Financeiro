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
})();
