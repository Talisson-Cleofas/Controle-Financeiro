window.CloudSync = (() => {
  const TK='cf_saas_token', REV='cf_cloud_revision', OWNER='cf_cloud_owner', DIRTY='cf_cloud_dirty';
  const TX='controleFinanceiro_v2_transactions', SETTINGS='controleFinanceiro_v2_settings';
  let timer, ready=false, sending=false, again=false, allowed=true, sessionToken=null, sessionOwner=null;
  const token=()=>localStorage.getItem(TK);
  const status=text=>{const el=document.getElementById('saasSync');if(el)el.textContent=text;const notice=document.getElementById('syncNotice');if(notice)notice.textContent=text;};
  async function api(path,options={}) {
    const base=String(window.APP_CONFIG?.API_URL||'').replace(/\/$/,'');
    const response=await fetch(base+path,{...options,cache:'no-store',headers:{'Content-Type':'application/json',...options.headers,...(token()?{Authorization:'Bearer '+token()}:{})}});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw Object.assign(new Error(data.error||data.message||'Erro na operação.'),{status:response.status});
    return data;
  }
  function backup() {
    // Fail closed on quota errors: never replace local data without a saved copy.
    const key='cf_recovery_'+Date.now();
    localStorage.setItem(key,JSON.stringify({owner:localStorage.getItem(OWNER),transactions:JSON.parse(localStorage.getItem(TX)||'[]'),settings:JSON.parse(localStorage.getItem(SETTINGS)||'{}'),revision:localStorage.getItem(REV)}));
    return key;
  }
  function setAccount(user) {
    document.getElementById('saasGate')?.classList.add('hidden');
    const name=document.getElementById('saasUserName');if(name)name.textContent=user.name;
    allowed=user.access?.allowed!==false;
    if(!allowed && !document.getElementById('subscriptionBlock')) {
      const box=document.createElement('aside');box.id='subscriptionBlock';box.setAttribute('role','status');
      box.style.cssText='position:fixed;bottom:12px;left:12px;right:12px;z-index:9999;padding:16px;background:#151b27;color:#fff;border:1px solid #5b7cfa;border-radius:16px';
      const text=document.createElement('span');text.textContent='Acesso vencido. Você pode consultar e exportar seus dados. ';
      const link=document.createElement('a');link.href='/vendas';link.textContent='Renovar plano';link.style.color='#a5b4fc';
      box.append(text,link);document.body.append(box);
    } else if(allowed) document.getElementById('subscriptionBlock')?.remove();
  }
  const snapshot=()=>({transactions:JSON.parse(localStorage.getItem(TX)||'[]'),settings:JSON.parse(localStorage.getItem(SETTINGS)||'{}'),revision:Number(localStorage.getItem(REV))});
  async function push() {
    if(!ready||!token()||!allowed||token()!==sessionToken||localStorage.getItem(OWNER)!==sessionOwner)return;
    if(sending){again=true;return;}
    sending=true;const authToken=token(),owner=localStorage.getItem(OWNER);
    try {
      const body=snapshot(),serialized=JSON.stringify(body);status('Sincronizando…');
      const result=await api('/api/data',{method:'PUT',body:serialized});
      if(token()!==authToken||localStorage.getItem(OWNER)!==owner)return;
      const unchanged=JSON.stringify(snapshot())===serialized;
      localStorage.setItem(REV,String(result.revision));
      if(unchanged)localStorage.removeItem(DIRTY);else again=true;
      status(unchanged?'Sincronizado':'Alterações pendentes');
    } catch(error) {
      if(error.status===409){ready=false;status('Conflito: seus dados locais foram mantidos. Use “Recarregar nuvem” após salvar um backup.');}
      else status(error.status===403?'Acesso vencido: alterações apenas neste dispositivo.': 'Sem conexão: alterações guardadas neste dispositivo.');
    } finally {sending=false;if(again&&ready){again=false;queue();}}
  }
  function queue(){localStorage.setItem(DIRTY,'1');clearTimeout(timer);timer=setTimeout(push,700);}
  function markReady(){ready=true;if(allowed)window.dispatchEvent?.(new Event('cf-sync-ready'));}
  function assertEditable(){
    if(!ready||!allowed||token()!==sessionToken||localStorage.getItem(OWNER)!==sessionOwner){
      const message=!allowed?'Renove o plano para salvar alterações.':'Aguarde a sincronização. Se a conta mudou em outra aba, recarregue esta página antes de editar.';
      status(message);alert(message);throw new Error(message);
    }
  }
  function installControls(){
    if(document.getElementById('syncNotice'))return;
    const footer=document.createElement('div');footer.style.cssText='padding:12px;text-align:center;font-size:14px';
    const notice=document.createElement('span');notice.id='syncNotice';notice.setAttribute('role','status');
    const reload=document.createElement('button');reload.className='btn ghost small';reload.textContent='Recarregar nuvem';
    reload.onclick=async()=>{if(sending)return; if(!confirm('Salvar uma cópia local de segurança e carregar os dados da nuvem? Alterações locais não enviadas ficarão nessa cópia.'))return;try{backup();localStorage.removeItem(DIRTY);localStorage.removeItem('cf_cloud_loaded');await boot(true);}catch(error){status(error.message);}};
    const download=document.createElement('button');download.className='btn ghost small';download.textContent='Recuperar cópia local';
    download.onclick=()=>{
      const owner=localStorage.getItem(OWNER);
      const copies=Object.keys(localStorage).filter(key=>key.startsWith('cf_recovery_')).sort().reverse().map(key=>({key,data:JSON.parse(localStorage.getItem(key))})).filter(copy=>!copy.data.owner||copy.data.owner===owner);
      if(!copies.length){status('Nenhuma cópia anterior. Use Backup para exportar os dados atuais.');return;}
      const choice=prompt('Qual cópia deseja baixar? Depois use o menu Backup para importar.\n'+copies.map((copy,i)=>`${i+1}: ${new Date(Number(copy.key.slice(12))).toLocaleString('pt-BR')} (${copy.data.transactions.length} lançamentos)`).join('\n'),'1');
      if(choice===null)return;const copy=copies[Number(choice)-1];if(!copy)return;
      const url=URL.createObjectURL(new Blob([JSON.stringify({version:2,...copy.data},null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='financeiro-recuperacao.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    };
    const plans=document.createElement('a');plans.href='/vendas';plans.className='btn ghost small';plans.textContent='Planos e renovação';
    footer.append(notice,' ',reload,' ',download,' ',plans);document.body.append(footer);
  }
  async function boot(force=false) {
    installControls();if(!token())return;
    const authToken=token();
    try {
      const {user}=await api('/api/auth/me');if(token()!==authToken)return;
      const data=await api('/api/data');if(token()!==authToken)return;
      const owner=user.id||user._id, sameOwner=localStorage.getItem(OWNER)===owner;
      sessionToken=authToken;sessionOwner=owner;
      allowed=user.access?.allowed!==false;
      if(sameOwner)setAccount(user);
      const local=JSON.parse(localStorage.getItem(TX)||'[]');
      if(!force && sameOwner && localStorage.getItem(DIRTY)==='1'){
        if(Number(localStorage.getItem(REV))!==data.revision){status('Conflito: mantenha um backup e use Recarregar nuvem.');return;}
        markReady();await push();return;
      }
      if(!force && sameOwner && localStorage.getItem('cf_cloud_loaded')==='1' && Number(localStorage.getItem(REV))===data.revision){markReady();status(localStorage.getItem(DIRTY)?'Alterações pendentes':'Sincronizado');return;}
      if(local.length||localStorage.getItem(SETTINGS))backup();
      // Never silently upload an unowned cache into a different account.
      if(!force && !sameOwner && local.length && !data.transactions.length && allowed && confirm('Há lançamentos locais e esta conta está vazia na nuvem. Esses dados são seus e devem ser importados para esta conta?')){
        const result=await api('/api/data',{method:'PUT',body:JSON.stringify({transactions:local,settings:JSON.parse(localStorage.getItem(SETTINGS)||'{}'),revision:data.revision})});
        localStorage.setItem(REV,String(result.revision));
      }else{
        localStorage.setItem(TX,JSON.stringify(data.transactions));localStorage.setItem(SETTINGS,JSON.stringify(data.settings));localStorage.setItem(REV,String(data.revision));
      }
      localStorage.setItem(OWNER,owner);localStorage.setItem('cf_cloud_loaded','1');localStorage.removeItem(DIRTY);location.reload();
    }catch(error){if(error.status===401){localStorage.removeItem(TK);document.getElementById('saasGate')?.classList.remove('hidden');}status(error.message);}
  }
  async function authenticate(path,body){const d=await api(path,{method:'POST',body:JSON.stringify(body)});localStorage.setItem(TK,d.token);location.reload();}
  const startCheckout=()=>{location.href='/vendas';};
  window.startCheckout=startCheckout;
  return {boot,queue,api,assertEditable,startCheckout,login:(email,password)=>authenticate('/api/auth/login',{email,password}),register:(name,email,password)=>authenticate('/api/auth/register',{name,email,password}),logout(){clearTimeout(timer);ready=false;localStorage.removeItem(TK);location.reload();}};
})();
