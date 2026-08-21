// UI Lab — substitui as setas nativas do budgetInput por controles customizados.
(function(){
  function initBudgetStepper(){
    const input = document.getElementById('budgetInput');
    if(!input || input.dataset.uiStepperReady === 'true') return;

    const wrap = document.createElement('div');
    wrap.className = 'ui-budget-stepper-wrap';

    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);

    const stepper = document.createElement('div');
    stepper.className = 'ui-budget-stepper';
    stepper.innerHTML = `
      <button type="button" class="ui-budget-stepper-btn" data-direction="up" aria-label="Aumentar limite mensal" title="Aumentar">+</button>
      <button type="button" class="ui-budget-stepper-btn" data-direction="down" aria-label="Diminuir limite mensal" title="Diminuir">−</button>
    `;
    wrap.appendChild(stepper);

    const stepValue = () => {
      const configured = Number(input.step);
      return Number.isFinite(configured) && configured > 0 ? configured : 100;
    };

    function change(direction){
      const current = Number(input.value || 0);
      const min = input.min === '' ? -Infinity : Number(input.min);
      const max = input.max === '' ? Infinity : Number(input.max);
      const next = Math.min(max, Math.max(min, current + direction * stepValue()));
      input.value = String(next);
      input.dispatchEvent(new Event('input', {bubbles:true}));
      input.dispatchEvent(new Event('change', {bubbles:true}));
      input.focus({preventScroll:true});
    }

    stepper.querySelector('[data-direction="up"]').addEventListener('click', () => change(1));
    stepper.querySelector('[data-direction="down"]').addEventListener('click', () => change(-1));
    input.dataset.uiStepperReady = 'true';
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', initBudgetStepper, {once:true});
  }else{
    initBudgetStepper();
  }
})();
