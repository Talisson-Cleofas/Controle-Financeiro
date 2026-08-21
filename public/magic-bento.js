// MagicBento adaptado para HTML/CSS/JS puro usando GSAP.
import { gsap } from 'https://esm.sh/gsap@3.13.0';

const CONFIG = {
  glowColor:'132, 0, 255',
  spotlightRadius:300,
  particleCount:12,
  enableStars:true,
  enableSpotlight:true,
  enableBorderGlow:true,
  enableTilt:true,
  enableMagnetism:true,
  clickEffect:true
};

const CARD_SELECTOR = [
  '.card', '.stat', '.mini-kpi', '.smart-alert', '.health', '.insight',
  '.wallet-card', '.compare-card', '.account-column', '.empty'
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
  gsap.fromTo(p,{scale:0,opacity:0},{scale:1,opacity:1,duration:.28,ease:'back.out(1.7)'});
  gsap.to(p,{x:(Math.random()-.5)*100,y:(Math.random()-.5)*100,rotation:Math.random()*360,duration:2+Math.random()*2,ease:'none',repeat:-1,yoyo:true});
  gsap.to(p,{opacity:.3,duration:1.5,ease:'power2.inOut',repeat:-1,yoyo:true});
  return p;
}

function decorateCard(card){
  if(card.dataset.magicBentoReady==='true') return;
  if(card.closest('.tabs,.table-wrap,.modal,.dialog') || card.matches('.ui-number-stepper-wrap')) return;
  card.dataset.magicBentoReady='true';
  card.classList.add('magic-bento-card');
  card.style.setProperty('--magic-bento-glow',CONFIG.glowColor);

  let particles=[];
  const clearParticles=()=>{
    particles.forEach(p=>gsap.to(p,{scale:0,opacity:0,duration:.22,ease:'back.in(1.5)',onComplete:()=>p.remove()}));
    particles=[];
  };

  card.addEventListener('mouseenter',()=>{
    if(isMobile()) return;
    card.classList.add('magic-bento-active');
    if(CONFIG.enableStars && !particles.length){
      for(let i=0;i<CONFIG.particleCount;i++) setTimeout(()=>{ if(card.matches(':hover')) particles.push(createParticle(card)); },i*70);
    }
  });

  card.addEventListener('mousemove',e=>{
    if(isMobile()) return;
    const r=card.getBoundingClientRect();
    const x=e.clientX-r.left,y=e.clientY-r.top,cx=r.width/2,cy=r.height/2;
    const relX=(x/r.width)*100, relY=(y/r.height)*100;
    card.style.setProperty('--glow-x',`${relX}%`);
    card.style.setProperty('--glow-y',`${relY}%`);
    card.style.setProperty('--glow-radius',`${CONFIG.spotlightRadius}px`);
    card.style.setProperty('--glow-intensity','1');
    const rotateX=CONFIG.enableTilt?((y-cy)/cy)*-6:0;
    const rotateY=CONFIG.enableTilt?((x-cx)/cx)*6:0;
    const mx=CONFIG.enableMagnetism?(x-cx)*.025:0;
    const my=CONFIG.enableMagnetism?(y-cy)*.025:0;
    gsap.to(card,{rotateX,rotateY,x:mx,y:my,duration:.12,ease:'power2.out',transformPerspective:1000,overwrite:true});
  });

  card.addEventListener('mouseleave',()=>{
    card.classList.remove('magic-bento-active');
    card.style.setProperty('--glow-intensity','0');
    clearParticles();
    if(!isMobile()) gsap.to(card,{rotateX:0,rotateY:0,x:0,y:0,duration:.3,ease:'power2.out',overwrite:true});
  });

  card.addEventListener('click',e=>{
    if(isMobile() || !CONFIG.clickEffect) return;
    const r=card.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;
    const max=Math.max(Math.hypot(x,y),Math.hypot(x-r.width,y),Math.hypot(x,y-r.height),Math.hypot(x-r.width,y-r.height));
    const ripple=document.createElement('span');
    ripple.className='magic-bento-ripple';
    ripple.style.width=ripple.style.height=`${max*2}px`;
    ripple.style.left=`${x-max}px`;
    ripple.style.top=`${y-max}px`;
    card.appendChild(ripple);
    gsap.fromTo(ripple,{scale:0,opacity:1},{scale:1,opacity:0,duration:.8,ease:'power2.out',onComplete:()=>ripple.remove()});
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
    for(const c of cards){
      const r=c.getBoundingClientRect();
      const cx=r.left+r.width/2,cy=r.top+r.height/2;
      const effective=Math.max(0,Math.hypot(e.clientX-cx,e.clientY-cy)-Math.max(r.width,r.height)/2);
      min=Math.min(min,effective);
      const proximity=CONFIG.spotlightRadius*.5,fade=CONFIG.spotlightRadius*.75;
      const intensity=effective<=proximity?1:effective<=fade?(fade-effective)/(fade-proximity):0;
      c.style.setProperty('--glow-intensity',String(clamp(intensity,0,1)));
      c.style.setProperty('--glow-x',`${((e.clientX-r.left)/r.width)*100}%`);
      c.style.setProperty('--glow-y',`${((e.clientY-r.top)/r.height)*100}%`);
    }
    const proximity=CONFIG.spotlightRadius*.5,fade=CONFIG.spotlightRadius*.75;
    const opacity=min<=proximity?.78:min<=fade?((fade-min)/(fade-proximity))*.78:0;
    gsap.to(spot,{left:e.clientX,top:e.clientY,opacity,duration:.12,ease:'power2.out',overwrite:true});
  },{passive:true});
  document.addEventListener('mouseleave',()=>gsap.to(spot,{opacity:0,duration:.3}));
}

function scan(root=document){ root.querySelectorAll?.(CARD_SELECTOR).forEach(decorateCard); }
function init(){
  scan();
  setupSpotlight();
  const obs=new MutationObserver(m=>m.forEach(rec=>rec.addedNodes.forEach(n=>{if(n.nodeType===1){if(n.matches?.(CARD_SELECTOR)) decorateCard(n);scan(n);}})));
  obs.observe(document.body,{childList:true,subtree:true});
}

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true}); else init();
