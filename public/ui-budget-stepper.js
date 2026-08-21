// UI Lab — aplica controles + / − customizados a todos os campos numéricos do app.
(function(){
  function stepValue(input){
    const configured = Number(input.step);
    return Number.isFinite(configured) && configured > 0 ? configured : 1;
  }

  function decimalsForStep(input){
    const raw = String(input.step || '1');
    return raw.includes('.') ? raw.split('.')[1].length : 0;
  }

  function enhanceInput(input){
    if(!input || input.dataset.uiStepperReady === 'true') return;
    if(input.type !== 'number' || input.disabled || input.readOnly) return;

    const parent = input.parentNode;
    if(!parent) return;

    const wrap = document.createElement('div');
    wrap.className = 'ui-budget-stepper-wrap';

    parent.insertBefore(wrap, input);
    wrap.appendChild(input);

    const stepper = document.createElement('div');
    stepper.className = 'ui-budget-stepper';
    stepper.innerHTML = `
      <button type="button" class="ui-budget-stepper-btn" data-direction="up" aria-label="Aumentar valor" title="Aumentar"><span>+</span></button>
      <button type="button" class="ui-budget-stepper-btn" data-direction="down" aria-label="Diminuir valor" title="Diminuir"><span>−</span></button>
    `;
    wrap.appendChild(stepper);

    function change(direction){
      const current = Number(input.value || 0);
      const min = input.min === '' ? -Infinity : Number(input.min);
      const max = input.max === '' ? Infinity : Number(input.max);
      const step = stepValue(input);
      const precision = decimalsForStep(input);
      const nextRaw = Math.min(max, Math.max(min, current + direction * step));
      const next = precision > 0 ? Number(nextRaw.toFixed(precision)) : nextRaw;

      input.value = String(next);
      input.dispatchEvent(new Event('input', {bubbles:true}));
      input.dispatchEvent(new Event('change', {bubbles:true}));
      input.focus({preventScroll:true});
    }

    stepper.querySelector('[data-direction="up"]').addEventListener('click', () => change(1));
    stepper.querySelector('[data-direction="down"]').addEventListener('click', () => change(-1));
    input.dataset.uiStepperReady = 'true';
  }

  function enhanceAll(){
    document.querySelectorAll('input[type="number"]').forEach(enhanceInput);
  }

  function init(){
    enhanceAll();

    // Algumas áreas do app criam formulários dinamicamente; mantém o padrão também nelas.
    const observer = new MutationObserver(() => enhanceAll());
    observer.observe(document.body, {childList:true, subtree:true});
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init, {once:true});
  }else{
    init();
  }
})();
