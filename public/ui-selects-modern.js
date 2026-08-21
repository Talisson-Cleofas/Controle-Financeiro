// Enhancement visual para selects nativos, preservando o select original e seus eventos.
const SELECTOR='select:not([multiple]):not([size])';
const registry=new WeakMap();
let openInstance=null;
let rafPosition=0;

function positionMenu(instance){
  if(!instance || !instance.menu.classList.contains('is-open')) return;
  const r=instance.trigger.getBoundingClientRect();
  const gap=8;
  const margin=10;
  const viewportH=window.innerHeight;
  const viewportW=window.innerWidth;
  const desiredWidth=Math.max(r.width,220);
  const width=Math.min(desiredWidth,viewportW-margin*2);

  instance.menu.style.width=`${width}px`;
  instance.menu.style.left=`${Math.max(margin,Math.min(r.left,viewportW-width-margin))}px`;

  // Mede depois de abrir para decidir se a lista fica abaixo ou acima.
  const menuH=Math.min(instance.menu.scrollHeight,Math.max(180,viewportH*.45));
  const spaceBelow=viewportH-r.bottom-gap-margin;
  const spaceAbove=r.top-gap-margin;
  const openAbove=spaceBelow<Math.min(menuH,220) && spaceAbove>spaceBelow;

  instance.menu.classList.toggle('opens-up',openAbove);
  instance.menu.style.maxHeight=`${Math.max(140,Math.min(menuH,openAbove?spaceAbove:spaceBelow))}px`;
  instance.menu.style.top=openAbove
    ? `${Math.max(margin,r.top-gap-Math.min(menuH,spaceAbove))}px`
    : `${Math.min(viewportH-margin,r.bottom+gap)}px`;
}

function schedulePosition(){
  if(!openInstance||rafPosition) return;
  rafPosition=requestAnimationFrame(()=>{
    rafPosition=0;
    if(openInstance) positionMenu(openInstance);
  });
}

function closeCurrent(){
  if(!openInstance) return;
  openInstance.wrapper.classList.remove('is-open');
  openInstance.menu.classList.remove('is-open','opens-up');
  openInstance.trigger.setAttribute('aria-expanded','false');
  openInstance.highlight=-1;
  openInstance=null;
}

function optionsFor(select){
  return [...select.options].map((o,index)=>({
    index,value:o.value,label:o.textContent||o.label||o.value,disabled:o.disabled,selected:o.selected
  }));
}

function sync(instance,rebuild=false){
  const {select,wrapper,trigger,valueEl,menu}=instance;
  wrapper.classList.toggle('is-disabled',select.disabled);
  trigger.disabled=select.disabled;
  const selected=select.options[select.selectedIndex];
  valueEl.textContent=selected?.textContent||select.getAttribute('placeholder')||'Selecione';
  trigger.title=valueEl.textContent;
  if(rebuild){
    menu.replaceChildren();
    optionsFor(select).forEach(opt=>{
      const b=document.createElement('button');
      b.type='button';
      b.className='ui-modern-select__option';
      b.dataset.index=String(opt.index);
      b.textContent=opt.label;
      b.disabled=opt.disabled;
      b.setAttribute('role','option');
      b.setAttribute('aria-selected',String(opt.selected));
      if(opt.selected) b.classList.add('is-selected');
      b.addEventListener('click',e=>{
        e.preventDefault();
        e.stopPropagation();
        choose(instance,opt.index);
      });
      menu.appendChild(b);
    });
  }else{
    [...menu.children].forEach((el,i)=>{
      const selectedNow=i===select.selectedIndex;
      el.classList.toggle('is-selected',selectedNow);
      el.setAttribute('aria-selected',String(selectedNow));
    });
  }
}

function choose(instance,index){
  const {select}=instance;
  const option=select.options[index];
  if(!option||option.disabled) return;
  const changed=select.selectedIndex!==index;
  select.selectedIndex=index;
  sync(instance,false);
  if(changed){
    select.dispatchEvent(new Event('input',{bubbles:true}));
    select.dispatchEvent(new Event('change',{bubbles:true}));
  }
  closeCurrent();
  instance.trigger.focus({preventScroll:true});
}

function setHighlight(instance,next,scroll=false){
  const buttons=[...instance.menu.querySelectorAll('.ui-modern-select__option:not(:disabled)')];
  buttons.forEach(b=>b.classList.remove('is-highlighted'));
  if(!buttons.length) return;
  instance.highlight=(next+buttons.length)%buttons.length;
  const el=buttons[instance.highlight];
  el.classList.add('is-highlighted');
  if(scroll) el.scrollIntoView({block:'nearest'});
}

function open(instance){
  if(instance.select.disabled) return;
  if(openInstance&&openInstance!==instance) closeCurrent();
  sync(instance,true);
  instance.wrapper.classList.add('is-open');
  instance.menu.classList.add('is-open');
  instance.trigger.setAttribute('aria-expanded','true');
  openInstance=instance;
  positionMenu(instance);
  const enabled=[...instance.menu.querySelectorAll('.ui-modern-select__option:not(:disabled)')];
  const selectedPos=enabled.findIndex(el=>Number(el.dataset.index)===instance.select.selectedIndex);
  setHighlight(instance,selectedPos>=0?selectedPos:0,false);
}

function enhance(select){
  if(registry.has(select)||select.closest('.ui-modern-select')) return;
  if(select.dataset.nativeSelect==='true') return;

  const wrapper=document.createElement('div');
  wrapper.className='ui-modern-select';
  const parent=select.parentNode;
  parent.insertBefore(wrapper,select);
  wrapper.appendChild(select);

  const trigger=document.createElement('button');
  trigger.type='button';
  trigger.className='ui-modern-select__trigger';
  trigger.setAttribute('aria-haspopup','listbox');
  trigger.setAttribute('aria-expanded','false');
  const valueEl=document.createElement('span');
  valueEl.className='ui-modern-select__value';
  const chev=document.createElement('span');
  chev.className='ui-modern-select__chevron';
  chev.setAttribute('aria-hidden','true');
  trigger.append(valueEl,chev);
  wrapper.appendChild(trigger);

  // Menu em portal global para não ser cortado por cards com overflow:hidden.
  const menu=document.createElement('div');
  menu.className='ui-modern-select__menu';
  menu.setAttribute('role','listbox');
  document.body.appendChild(menu);

  const instance={select,wrapper,trigger,valueEl,menu,highlight:-1};
  registry.set(select,instance);
  sync(instance,true);

  trigger.addEventListener('click',e=>{
    e.preventDefault();
    e.stopPropagation();
    wrapper.classList.contains('is-open')?closeCurrent():open(instance);
  });

  trigger.addEventListener('keydown',e=>{
    if(e.key==='ArrowDown'||e.key==='ArrowUp'){
      e.preventDefault();
      if(!wrapper.classList.contains('is-open')) open(instance);
      else setHighlight(instance,instance.highlight+(e.key==='ArrowDown'?1:-1),true);
    }else if(e.key==='Enter'||e.key===' '){
      e.preventDefault();
      if(!wrapper.classList.contains('is-open')) open(instance);
      else{
        const highlighted=menu.querySelector('.is-highlighted');
        if(highlighted) choose(instance,Number(highlighted.dataset.index));
      }
    }else if(e.key==='Escape'){
      e.preventDefault();
      closeCurrent();
    }else if(e.key==='Home'||e.key==='End'){
      if(wrapper.classList.contains('is-open')){
        e.preventDefault();
        const enabled=menu.querySelectorAll('.ui-modern-select__option:not(:disabled)');
        setHighlight(instance,e.key==='Home'?0:Math.max(0,enabled.length-1),true);
      }
    }
  });

  select.addEventListener('change',()=>sync(instance,false));
  select.addEventListener('input',()=>sync(instance,false));
  const mo=new MutationObserver(()=>{
    sync(instance,true);
    if(openInstance===instance) schedulePosition();
  });
  mo.observe(select,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled','selected','label','value']});
}

function scan(root=document){
  if(root.matches?.(SELECTOR)) enhance(root);
  root.querySelectorAll?.(SELECTOR).forEach(enhance);
}

function init(){
  scan();
  document.addEventListener('pointerdown',e=>{
    if(!openInstance) return;
    const insideTrigger=openInstance.wrapper.contains(e.target);
    const insideMenu=openInstance.menu.contains(e.target);
    if(!insideTrigger&&!insideMenu) closeCurrent();
  },true);

  window.addEventListener('blur',closeCurrent);
  window.addEventListener('resize',schedulePosition,{passive:true});
  document.addEventListener('scroll',schedulePosition,true);

  new MutationObserver(records=>records.forEach(r=>r.addedNodes.forEach(n=>{
    if(n.nodeType===1) scan(n);
  }))).observe(document.body,{childList:true,subtree:true});
}

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true}); else init();
