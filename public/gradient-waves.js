// GradientWaves adaptado para JavaScript puro, preservando a configuracao solicitada.
import { Renderer, Program, Mesh, Triangle } from 'https://esm.sh/ogl@1.0.11';

const config = {
  horizonColor:'#5227FF', waveColor:'#FF9FFC', crestColor:'#FFFFFF',
  speed:0.4, amplitude:2.5, waveScale:0.6, waveRatio:0.9,
  swell:35, turbulence:20, tilt:1.11, zoom:1.0, height:5.5,
  fogDepth:15, detail:'medium', brightness:1.0, opacity:1.0,
  mouseInteraction:true, parallaxStrength:0.5, grain:true, grainIntensity:0.05
};

const hex = value => {
  const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(value);
  return m ? [parseInt(m[1],16)/255,parseInt(m[2],16)/255,parseInt(m[3],16)/255] : [1,1,1];
};
const steps = value => value === 'low' ? 40 : value === 'high' ? 110 : 70;

const vertex = `#version 300 es
in vec2 position;
void main(){gl_Position=vec4(position,0.,1.);}`;

const fragment = `#version 300 es
precision highp float;
uniform vec2 r,m; uniform float t,spd,amp,sc,ratio,swell,turb,tilt,zoom,hgt,fog,st,bright,alpha,grain,grainI,par; uniform vec3 hc,wc,cc;
out vec4 frag;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float field(vec3 p){float x=p.x+swell*sin((p.y+p.x)/20.+t*.9);float y=p.y+turb*cos(p.x/23.+t*.35);return p.z-(sin(x*sc/7.)*amp+sin(y*(sc*ratio)/3.)*amp+hgt);}
float march(vec3 ro,vec3 rd){float d=0.;for(int i=0;i<128;i++){if(float(i)>=st)break;float ds=field(ro+d*rd);if(abs(ds)<.1)break;d+=.9*ds;if(abs(d)>20000.)return 20000.;}return d;}
void main(){vec2 uv=gl_FragCoord.xy/r-.5;uv.x*=r.x/r.y;uv.y*=-1.;float fov=(3.14159/2.3)/max(zoom,.05);vec3 rd=normalize(vec3(uv*fov,-1.));float c=cos(tilt),s=sin(tilt);rd=mat3(c,0.,s,0.,1.,0.,-s,0.,c)*rd;float yaw=(m.x-.5)*par*.4,pitch=(m.y-.5)*par*.4;c=cos(yaw);s=sin(yaw);rd=mat3(c,0.,s,0.,1.,0.,-s,0.,c)*rd;c=cos(pitch);s=sin(pitch);rd=mat3(1.,0.,0.,0.,c,-s,0.,s,c)*rd;float d=march(vec3(0.,0.,30.),rd);vec3 p=vec3(0.,0.,30.)+d*rd;float f=clamp(fog/max(d,.001),0.,1.);vec3 body=mix(wc,cc,clamp(p.z*.08+.5,0.,1.));vec3 col=clamp(mix(hc,body,f)*bright,0.,1.);float a=clamp(f*alpha,0.,1.);if(grain>.5)a=clamp(a+(hash(gl_FragCoord.xy+t*11.)-.5)*grainI,0.,1.);frag=vec4(col*a,a);}`;

function mount(){
  if(document.getElementById('gradientWavesBg') || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const host=document.createElement('div'); host.id='gradientWavesBg'; document.body.prepend(host);
  const renderer=new Renderer({webgl:2,alpha:true,premultipliedAlpha:true,antialias:false,dpr:Math.min(devicePixelRatio||1,2)});
  const gl=renderer.gl; gl.clearColor(0,0,0,0); host.appendChild(gl.canvas);
  const geometry=new Triangle(gl); const program=new Program(gl,{vertex,fragment,uniforms:{
    r:{value:new Float32Array([1,1])},m:{value:new Float32Array([.5,.5])},t:{value:0},spd:{value:config.speed},amp:{value:config.amplitude},sc:{value:config.waveScale},ratio:{value:config.waveRatio},swell:{value:config.swell},turb:{value:config.turbulence},tilt:{value:config.tilt},zoom:{value:config.zoom},hgt:{value:config.height},fog:{value:config.fogDepth},st:{value:steps(config.detail)},bright:{value:config.brightness},alpha:{value:config.opacity},grain:{value:config.grain?1:0},grainI:{value:config.grainIntensity},par:{value:config.mouseInteraction?config.parallaxStrength:0},hc:{value:new Float32Array(hex(config.horizonColor))},wc:{value:new Float32Array(hex(config.waveColor))},cc:{value:new Float32Array(hex(config.crestColor))}
  }}); const mesh=new Mesh(gl,{geometry,program});
  const resize=()=>{const rect=host.getBoundingClientRect();renderer.setSize(Math.max(1,rect.width),Math.max(1,rect.height));program.uniforms.r.value[0]=gl.drawingBufferWidth;program.uniforms.r.value[1]=gl.drawingBufferHeight;};
  new ResizeObserver(resize).observe(host); resize();
  const target=[.5,.5], current=[.5,.5];
  if(config.mouseInteraction){window.addEventListener('pointermove',e=>{target[0]=e.clientX/innerWidth;target[1]=1-e.clientY/innerHeight;},{passive:true});}
  const start=performance.now(); let raf=0;
  const loop=now=>{program.uniforms.t.value=(now-start)*.001*config.speed;current[0]+=.05*(target[0]-current[0]);current[1]+=.05*(target[1]-current[1]);program.uniforms.m.value[0]=current[0];program.uniforms.m.value[1]=current[1];renderer.render({scene:mesh});raf=requestAnimationFrame(loop);};
  const visibility=()=>{if(document.hidden){cancelAnimationFrame(raf);raf=0;}else if(!raf){raf=requestAnimationFrame(loop);}}; document.addEventListener('visibilitychange',visibility); raf=requestAnimationFrame(loop);
}

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',mount,{once:true}); else mount();
