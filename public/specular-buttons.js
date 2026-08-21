// React Bits SpecularButton — adaptacao JS pura para o app atual.
import { Renderer, Program, Mesh, Triangle, Color } from 'https://esm.sh/ogl@1.0.11';

const PAD = 0;
const VERT = `#version 300 es
in vec2 position;
void main(){gl_Position=vec4(position,0.0,1.0);}`;
const FRAG = `#version 300 es
precision highp float;
uniform vec2 uCenter; uniform vec2 uHalfSize; uniform float uRadius; uniform float uAngle; uniform float uPx;
uniform vec3 uLineColor; uniform vec3 uBaseColor; uniform float uIntensity; uniform float uShineSize; uniform float uShineFade; uniform float uThickness; uniform float uBaseWidth;
out vec4 fragColor;
float sdRoundedRect(vec2 p, vec2 b, float r){vec2 q=abs(p)-b+r;return length(max(q,0.0))+min(max(q.x,q.y),0.0)-r;}
float gaussianLine(float d,float sigma){float x=d/(sigma+1e-6);float k=mix(1.0,1.6,smoothstep(0.0,1.5,x));return exp(-k*x*x);}
void main(){
  vec2 p=gl_FragCoord.xy-uCenter; float d=sdRoundedRect(p,uHalfSize,uRadius); vec2 L=vec2(cos(uAngle),sin(uAngle));
  float base=(1.0-smoothstep(0.0,uBaseWidth,abs(d)))*0.30;
  vec2 nEll=normalize(p/(uHalfSize*uHalfSize)+1e-6);
  float phi=acos(clamp(abs(dot(nEll,L)),0.0,1.0));
  float rim=1.0-smoothstep(uShineSize-uShineFade,uShineSize+uShineFade+1e-4,phi);
  float line=gaussianLine(d,uThickness); float edgeClamp=1.0-smoothstep(0.5*uPx,3.0*uPx,abs(d));
  float hi=line*rim*edgeClamp*uIntensity; vec3 col=uBaseColor*base+uLineColor*hi; float a=clamp(base+hi,0.0,1.0);
  fragColor=vec4(col,a);
}`;

const settings = {
  radius:18,lineColor:'#ffffff',baseColor:'#525252',intensity:.65,shineSize:9,shineFade:34,thickness:.9,speed:.28,followMouse:true,proximity:180,autoAnimate:false
};
let pointer={x:-9999,y:-9999};
window.addEventListener('pointermove',e=>{pointer.x=e.clientX;pointer.y=e.clientY},{passive:true});

function isActionButton(btn){
  if(!(btn instanceof HTMLButtonElement) || btn.disabled) return false;
  if(btn.closest('.saas-tabs,.tabs,.tabs-primary,.tabs-secondary,.nav,.top-nav,.segmented,.ui-number-stepper-wrap')) return false;
  if(btn.matches('.ui-budget-stepper-btn,[role="tab"],.tab,.tab-btn,.nav-item,.icon-btn,[aria-label*="menu" i],[aria-label*="fechar" i]')) return false;
  const text=(btn.textContent||'').trim().toLowerCase();
  if(!text || text.includes('esqueci minha senha')) return false;
  const r=btn.getBoundingClientRect();
  if(r.width<88 || r.height<36) return false;

  const isPrimaryClass=btn.matches('.btn,.primary,.btn-primary,.cta,.btn-action,.btn-save,.btn-login');
  const actionWords=['entrar','salvar','adicionar','criar','confirmar','continuar','pagar','gerar','importar','exportar','despesa','receita','backup','restaurar'];
  const hasActionWord=actionWords.some(word=>text.includes(word));
  return isPrimaryClass || hasActionWord;
}

function mount(btn){
  if(btn.dataset.specularReady==='true' || !isActionButton(btn)) return;
  btn.dataset.specularReady='true'; btn.classList.add('ui-specular-button');
  const fx=document.createElement('span'); fx.className='ui-specular-button__fx'; fx.setAttribute('aria-hidden','true'); btn.prepend(fx);
  const dpr=Math.min(window.devicePixelRatio||1,2);
  let renderer;
  try{ renderer=new Renderer({alpha:true,premultipliedAlpha:true,antialias:true,dpr}); }catch{return;}
  const gl=renderer.gl; gl.clearColor(0,0,0,0); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
  const geometry=new Triangle(gl); if(geometry.attributes.uv) delete geometry.attributes.uv;
  const program=new Program(gl,{vertex:VERT,fragment:FRAG,uniforms:{
    uCenter:{value:[0,0]},uHalfSize:{value:[1,1]},uRadius:{value:0},uAngle:{value:2.4},uPx:{value:dpr},
    uLineColor:{value:[1,1,1]},uBaseColor:{value:[.32,.32,.32]},uIntensity:{value:0},uShineSize:{value:.17},uShineFade:{value:.7},uThickness:{value:1},uBaseWidth:{value:dpr}
  }});
  const mesh=new Mesh(gl,{geometry,program}); fx.appendChild(gl.canvas);
  let size={w:1,h:1}; const resize=()=>{const r=btn.getBoundingClientRect();size={w:r.width,h:r.height};renderer.setSize(r.width,r.height);program.uniforms.uCenter.value=[r.width/2*dpr,r.height/2*dpr];program.uniforms.uHalfSize.value=[Math.max(1,r.width/2*dpr-1),Math.max(1,r.height/2*dpr-1)];};
  const ro=new ResizeObserver(resize); ro.observe(btn); resize();
  let angle=2.4,idle=2.4,bright=0,last=performance.now(),raf=0,visible=true;
  const lineC=new Color(settings.lineColor),baseC=new Color(settings.baseColor);
  const io=new IntersectionObserver(entries=>{visible=entries[0]?.isIntersecting!==false; if(visible&&!raf) raf=requestAnimationFrame(loop);}); io.observe(btn);
  function loop(now){
    raf=0; if(!visible||!document.body.contains(btn)) return;
    const dt=Math.min((now-last)/1000,.05); last=now; const r=btn.getBoundingClientRect(); const cx=r.left+r.width/2,cy=r.top+r.height/2;
    const dx=Math.max(r.left-pointer.x,0,pointer.x-r.right),dy=Math.max(r.top-pointer.y,0,pointer.y-r.bottom),dist=Math.hypot(dx,dy);
    let pointerAngle=null; if(dist===0){const nx=(pointer.x-cx)/(r.width/2),ny=(cy-pointer.y)/(r.height/2);pointerAngle=Math.atan2(2/r.height,-2/r.width)+nx*.2+ny*.1;} else pointerAngle=Math.atan2(cy-pointer.y,pointer.x-cx);
    const t=Math.max(0,1-dist/Math.max(settings.proximity,1)),prox=t*t*(3-2*t); idle+=settings.speed*dt;
    const target=settings.followMouse?pointerAngle:idle; const diff=((target-angle+Math.PI*3)%(Math.PI*2))-Math.PI; angle+=diff*(1-Math.exp(-dt*7));
    const brightTarget=settings.autoAnimate?1:prox; bright+=(brightTarget-bright)*(1-Math.exp(-dt*8));
    program.uniforms.uAngle.value=angle; program.uniforms.uRadius.value=Math.min(settings.radius,Math.min(size.w,size.h)/2)*dpr;
    program.uniforms.uLineColor.value=[lineC.r,lineC.g,lineC.b]; program.uniforms.uBaseColor.value=[baseC.r,baseC.g,baseC.b];
    program.uniforms.uIntensity.value=settings.intensity*bright; program.uniforms.uShineSize.value=settings.shineSize*Math.PI/180; program.uniforms.uShineFade.value=settings.shineFade*Math.PI/180; program.uniforms.uThickness.value=settings.thickness*dpr;
    renderer.render({scene:mesh}); raf=requestAnimationFrame(loop);
  }
  raf=requestAnimationFrame(loop);
}

function scan(root=document){root.querySelectorAll?.('button').forEach(mount)}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>scan(),{once:true}); else scan();
const mo=new MutationObserver(muts=>muts.forEach(m=>m.addedNodes.forEach(n=>{if(n.nodeType===1){if(n.matches?.('button')) mount(n);scan(n);}}))); mo.observe(document.documentElement,{childList:true,subtree:true});
