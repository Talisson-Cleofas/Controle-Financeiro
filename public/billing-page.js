(() => {
  const $=id=>document.getElementById(id),money=n=>Number(n).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  let plans=[],user=null,busy=false;
  const say=text=>{$('message').textContent=text;};
  async function api(path,options={}){
    const base=String(window.APP_CONFIG?.API_URL||'').replace(/\/$/,'');
    const response=await fetch(base+path,{...options,cache:'no-store',headers:{'Content-Type':'application/json',Authorization:'Bearer '+(localStorage.getItem('cf_saas_token')||'')}});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw Object.assign(new Error(data.error||data.message||'Não foi possível concluir a operação.'),{status:response.status});
    return data;
  }
  const selected=()=>plans.find(p=>p.id===document.querySelector('input[name=plan]:checked')?.value);
  function summary(){const plan=selected(),pix=document.querySelector('input[name=method]:checked').value==='pix';$('summary').textContent=plan?`${plan.name}: ${money(plan.price)} por ${plan.days} dias.`:'';$('cpfLabel').hidden=!pix;$('cpf').required=pix;$('pay').textContent=pix?'Gerar PIX':'Continuar no Mercado Pago';}
  async function account(){const data=await api('/api/auth/me');user=data.user;$('account').textContent=`${user.name}${user.subscriptionEndsAt?' • Plano válido até '+new Date(user.subscriptionEndsAt).toLocaleDateString('pt-BR'):''}`;$('login').hidden=true;$('history').hidden=false;}
  async function payments(){
    const {payments}=await api('/api/billing/payments');$('payments').replaceChildren();
    const labels={approved:'Aprovado',pending:'Pendente',in_process:'Em análise',rejected:'Recusado',refunded:'Estornado',charged_back:'Contestado',cancelled:'Cancelado'};
    for(const payment of payments){const li=document.createElement('li');li.textContent=`${money(payment.amount)} • ${labels[payment.status]||payment.status}`;$('payments').append(li);}
    if(!payments.length){const li=document.createElement('li');li.textContent='Nenhum pagamento registrado.';$('payments').append(li);}
    return payments;
  }
  async function load(){
    try{
      if(localStorage.getItem('cf_saas_token'))await account();else $('login').hidden=false;
      const data=await api('/api/billing/plans');plans=data.plans;$('plans').replaceChildren();
      const requested=new URLSearchParams(location.search).get('plan');
      for(const [i,plan] of plans.entries()){const label=document.createElement('label');label.className='plan';const radio=document.createElement('input');radio.type='radio';radio.name='plan';radio.value=plan.id;radio.checked=plans.some(p=>p.id===requested)?plan.id===requested:i===0;const name=document.createElement('span');name.textContent=plan.name;const price=document.createElement('strong');price.textContent=money(plan.price);const days=document.createElement('span');days.textContent=plan.days+' dias de acesso';label.append(radio,name,price,days);$('plans').append(label);}
      $('purchase').hidden=!user;summary();say(user?'Escolha seu plano. Nenhum pagamento será feito sem sua confirmação.':'Entre para continuar.');if(user)await payments();
    }catch(error){say(error.message);if(error.status===401){user=null;$('purchase').hidden=true;$('login').hidden=false;}}
  }
  $('login').onsubmit=async event=>{event.preventDefault();try{const data=await api('/api/auth/login',{method:'POST',body:JSON.stringify({email:$('email').value,password:$('password').value})});localStorage.setItem('cf_saas_token',data.token);$('password').value='';await load();}catch(error){say(error.message);}};
  $('purchase').onchange=summary;
  $('purchase').onsubmit=async event=>{
    event.preventDefault();if(busy||!selected())return;const plan=selected(),pix=document.querySelector('input[name=method]:checked').value==='pix';
    if(!confirm(`Continuar com ${plan.name} por ${money(plan.price)}?`))return;
    busy=true;$('pay').disabled=true;say('Preparando pagamento…');
    try{
      const data=await api(pix?'/api/billing/pix':'/api/billing/checkout',{method:'POST',body:JSON.stringify({plan:plan.id,...(pix?{cpf:$('cpf').value}:{})})});
      if(!pix){const url=new URL(data.checkoutUrl);if(url.protocol!=='https:'||!(url.hostname==='mercadopago.com.br'||url.hostname.endsWith('.mercadopago.com.br')))throw new Error('Endereço de checkout inválido.');location.assign(url.href);return;}
      if(!data.qrCode)throw new Error('Código PIX indisponível. Verifique o pagamento antes de tentar novamente.');
      $('pix').hidden=false;$('pixCode').value=data.qrCode;$('pixInfo').textContent=`${money(data.amount)}${data.testMode?' • AMBIENTE DE TESTE':''}${data.expiresAt?' • Válido até '+new Date(data.expiresAt).toLocaleString('pt-BR'):''}`;
      if(data.qrCodeBase64&&/^[A-Za-z0-9+/=]+$/.test(data.qrCodeBase64)){$('qr').src='data:image/png;base64,'+data.qrCodeBase64;$('qr').hidden=false;}else $('qr').hidden=true;
      say('PIX gerado. Após pagar, clique em Verificar pagamento.');await payments();
    }catch(error){say(error.message);}finally{busy=false;$('pay').disabled=false;}
  };
  $('copy').onclick=async()=>{try{await navigator.clipboard.writeText($('pixCode').value);say('Código copiado.');}catch{$('pixCode').select();say('Selecione e copie o código PIX.');}};
  $('refresh').onclick=async()=>{$('refresh').disabled=true;try{const rows=await payments();for(const row of rows.filter(p=>['pending','in_process'].includes(p.status)).slice(0,5))await api(`/api/billing/payments/${encodeURIComponent(row._id)}/status`);await payments();await account();say('Situação consultada. Pagamentos pendentes ainda não liberam acesso.');}catch(error){say(error.message);}finally{$('refresh').disabled=false;}};
  load();
})();
