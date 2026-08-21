// MagicBento adaptado para HTML/CSS/JS puro usando GSAP — aplicado em todas as telas.
import { gsap } from 'https://esm.sh/gsap@3.13.0';

const CONFIG = {
  glowColor:'132, 0, 255',
  spotlightRadius:220,
  particleCount:4,
  enableStars:true,
  enableSpotlight:true,
  enableBorderGlow:true,
  enableTilt:true,
  enableMagnetism:true,
  clickEffect:true,
  maxGlow:.45
};

// Elementos visuais principais presentes nas diferentes abas do app.
const CARD_SELECTOR = [
  '.screen .card',
  '.screen .stat',
  '.screen .mini-kpi',
  '.screen .smart-alert',
  '.screen .health',
  '.screen .insight',
  '.screen .wallet-card',
  '.screen .compare-card',
  '.screen .account-column',
  '.screen .account-card',
  '.screen .chart-card',
  '.screen .table-wrap',
  '.screen .empty',
  '.screen .ai-answer',
  '.screen .budget-card',
  '.screen .goal-card',
  '.screen .planning-card'
].join(',');

const isMobile = () => window.innerWidth <= 768 || matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v,min,max) => Math.max(min,Math.min(max,v));

function createParticle(card){
  const rect=card.getBoundingClientRect();
  const p=document.createElement('i');
  p.className='magic-bento-particle';
  p.style.left=`${Math.random()*rect.width}px`;
  p.style.top=`${Math.random()*rect.height}px`;
  card.appendChild(p);
  gsap.fromTo(p,{scale:0,opacity:0},{scale:.75,opacity:.55,duration:.35,ease:'power2.out'});
  gsap.to(p,{x:(Math.random()-.5)*46,y:(Math.random()-.5)*46,rotation:Math.random()*160,duration:3+Math.random()*2,ease:'sine.inOut',repeat:-1,yoyo:true});
  gsap.to(p,{opacity:.16,duration:1.8,ease:'sine.inOut',repeat:-1,yoyo:true});
  return p;
}

function decorateCard(card){
  if(card.dataset.magicBentoReady==='true') return;
  if(card.closest('.tabs,.modal,.dialog') || card.matches('.ui-number-stepper-wrap')) return;
  card.dataset.magicBentoReady='true';
  card.classList.add('magic-bento-card');
  card.style.setProperty('--magic-bento-glow',CONFIG.glowColor);

  let particles=[];
  const clearParticles=()=>{
    particles.forEach(p=>gsap.to(p,{scale:0,opacity:0,duration:.28,ease:'power2.in',onComplete:()=>p.remove()}));
    particles=[];
  };

  card.addEventListener('mouseenter',()=>{
    if(isMobile()) return;
    card.classList.add('magic-bento-active');
    if(CONFIG.enableStars && !particles.length){
      for(let i=0;i<CONFIG.particleCount;i++) setTimeout(()=>{ if(card.matches(':hover')) particles.push(createParticle(card)); },i*110);
    }
  });

  card.addEventListener('mousemove',e=>{
    if(isMobile()) return;
    const r=card.getBoundingClientRect();
    if(!r.width || !r.height) return;
    const x=e.clientX-r.left,y=e.clientY-r.top,cx=r.width/2,cy=r.height/2;
    card.style.setProperty('--glow-x',`${(x/r.width)*100}%`);
    card.style.setProperty('--glow-y',`${(y/r.height)*100}%`);
    card.style.setProperty('--glow-radius',`${CONFIG.spotlightRadius}px`);
    card.style.setProperty('--glow-intensity',String(CONFIG.maxGlow));
    const rotateX=CONFIG.enableTilt?((y-cy)/cy)*-1.8:0;
    const rotateY=CONFIG.enableTilt?((x-cx)/cx)*1.8:0;
    const mx=CONFIG.enableMagnetism?(x-cx)*.007:0;
    const my=CONFIG.enableMagnetism?(y-cy)*.007:0;
    gsap.to(card,{rotateX,rotateY,x:mx,y:my,duration:.22,ease:'power2.out',transformPerspective:1200,overwrite:true});
  });

  card.addEventListener('mouseleave',()=>{
    card.classList.remove('magic-bento-active');
    card.style.setProperty('--glow-intensity','0');
    clearParticles();
    if(!isMobile()) gsap.to(card,{rotateX:0,rotateY:0,x:0,y:0,duration:.4,ease:'power2.out',overwrite:true});
  });

  card.addEventListener('click',e=>{
    if(isMobile() || !CONFIG.clickEffect) return;
    if(e.target.closest('button,input,select,textarea,a,.ui-modern-select,.ui-number-stepper-wrap')) return;
    const r=card.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;
    const max=Math.max(Math.hypot(x,y),Math.hypot(x-r.width,y),Math.hypot(x,y-r.height),Math.hypot(x-r.width,y-r.height));
    const ripple=document.createElement('span');
    ripple.className='magic-bento-ripple';
    ripple.style.width=ripple.style.height=`${max*2}px`;
    ripple.style.left=`${x-max}px`;
    ripple.style.top=`${y-max}px`;
    card.appendChild(ripple);
    gsap.fromTo(ripple,{scale:0,opacity:.55},{scale:1,opacity:0,duration:.65,ease:'power2.out',onComplete:()=>ripple.remove()});
  });
}

function setupSpotlight(){
  if(!CONFIG.enableSpotlight || isMobile() || document.querySelector('.magic-bento-global-spotlight')) return;
  const spot=document.createElement('div');
  spot.className='magic-bento-global-spotlight';
  spot.style.setProperty('--magic-bento-glow',CONFIG.glowColor);
  document.body.appendChild(spot);
  document.addEventListener('mousemove',e=>{
    const cards=[...document.querySelectorAll('.magic-bento-card')].filter(c=>c.offsetParent!==null);
    let min=Infinity;
    const proximity=CONFIG.spotlightRadius*.5,fade=CONFIG.spotlightRadius*.8;
    for(const c of cards){
      const r=c.getBoundingClientRect();
      if(!r.width || !r.height) continue;
      const cx=r.left+r.width/2,cy=r.top+r.height/2;
      const effective=Math.max(0,Math.hypot(e.clientX-cx,e.clientY-cy)-Math.max(r.width,r.height)/2);
      min=Math.min(min,effective);
      const raw=effective<=proximity?1:effective<=fade?(fade-effective)/(fade-proximity):0;
      const intensity=clamp(raw*CONFIG.maxGlow,0,CONFIG.maxGlow);
      c.style.setProperty('--glow-intensity',String(intensity));
      c.style.setProperty('--glow-x',`${((e.clientX-r.left)/r.width)*100}%`);
      c.style.setProperty('--glow-y',`${((e.clientY-r.top)/r.height)*100}%`);
    }
    const rawOpacity=min<=proximity?1:min<=fade?(fade-min)/(fade-proximity):0;
    gsap.to(spot,{left:e.clientX,top:e.clientY,opacity:rawOpacity*.18,duration:.22,ease:'power2.out',overwrite:true});
  },{passive:true});
  document.addEventListener('mouseleave',()=>gsap.to(spot,{opacity:0,duration:.35}));
}

function scan(root=document){ root.querySelectorAll?.(CARD_SELECTOR).forEach(decorateCard); }

function rescanVisibleScreen(){
  const active=document.querySelector('.screen.active');
  if(active) scan(active);
}

function init(){
  scan();
  setupSpotlight();

  // Reaplica ao trocar de aba e cobre conteúdo criado dinamicamente.
  document.addEventListener('click',e=>{
    if(e.target.closest('.tab-btn,[data-screen],[data-tab]')) setTimeout(rescanVisibleScreen,0);
  });

  const obs=new MutationObserver(m=>m.forEach(rec=>rec.addedNodes.forEach(n=>{
    if(n.nodeType===1){
      if(n.matches?.(CARD_SELECTOR)) decorateCard(n);
      scan(n);
    }
  })));
  obs.observe(document.body,{childList:true,subtree:true});
}

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true}); else init();
