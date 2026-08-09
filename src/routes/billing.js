import {Router} from 'express';
import crypto from 'crypto';
import {validWebhookSignature} from '../services/mercadopago.js';
import {auth} from '../middleware/auth.js';
import Payment from '../models/Payment.js';
import User from '../models/User.js';
import {addPlanPeriod} from '../services/subscription.js';
import {getPlan, listPlans} from '../services/plans.js';
import {sendMail} from '../services/mail.js';

const r=Router();
const cleanCpf=v=>String(v||'').replace(/\D/g,'');
function validCpf(cpf){
  cpf=cleanCpf(cpf); if(cpf.length!==11||/^(\d)\1+$/.test(cpf))return false;
  let sum=0;for(let i=0;i<9;i++)sum+=Number(cpf[i])*(10-i);let d=(sum*10)%11;if(d===10)d=0;if(d!==Number(cpf[9]))return false;
  sum=0;for(let i=0;i<10;i++)sum+=Number(cpf[i])*(11-i);d=(sum*10)%11;if(d===10)d=0;return d===Number(cpf[10]);
}
async function mp(path,options={}){
  if(!process.env.MERCADO_PAGO_ACCESS_TOKEN)throw Object.assign(new Error('Mercado Pago ainda não configurado.'),{status:503});
  const response=await fetch(`https://api.mercadopago.com${path}`,{...options,headers:{Authorization:`Bearer ${process.env.MERCADO_PAGO_ACCESS_TOKEN}`,'Content-Type':'application/json',...(options.headers||{})}});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw Object.assign(new Error(data.message||'Falha na comunicação com o Mercado Pago.'),{status:502,details:data});
  return data;
}
async function processPayment(p){
  const [userId,plan]=String(p.external_reference||'').split(':');
  const selectedPlan=getPlan(plan);
  if(!userId||!selectedPlan)return null;
  const externalId=String(p.id);
  const existingFilters=[{provider:'mercadopago',externalId}];
  if(p.preference_id)existingFilters.push({provider:'mercadopago',preferenceId:p.preference_id});
  let payment=await Payment.findOne({$or:existingFilters});
  if(payment?.processedAt&&payment.status==='approved')return payment;
  const tx=p.point_of_interaction?.transaction_data||{};
  const paidAmount=Number(p.transaction_amount||0);
  const update={$set:{userId,externalId,preferenceId:p.preference_id,status:p.status,statusDetail:p.status_detail,plan,amount:paidAmount||selectedPlan.price,paidAt:p.date_approved?new Date(p.date_approved):undefined,paymentMethod:p.payment_method_id||'pix',qrCode:tx.qr_code,qrCodeBase64:tx.qr_code_base64,ticketUrl:tx.ticket_url,expiresAt:p.date_of_expiration?new Date(p.date_of_expiration):undefined,payload:p}};
  payment=payment
    ? await Payment.findByIdAndUpdate(payment._id,update,{new:true,runValidators:true})
    : await Payment.findOneAndUpdate({provider:'mercadopago',externalId},update,{upsert:true,new:true,setDefaultsOnInsert:true,runValidators:true});
  if(p.status==='approved'&&!payment.processedAt){
    if(p.currency_id&&p.currency_id!=='BRL')throw new Error('Moeda do pagamento inválida.');
    if(Math.abs(paidAmount-selectedPlan.price)>0.01)throw new Error('Valor do pagamento não corresponde ao plano.');
    const user=await User.findById(userId); if(!user)return payment;
    user.status='active';user.plan=plan;user.subscriptionEndsAt=addPlanPeriod(user,plan);await user.save();
    payment.processedAt=new Date();await payment.save();
    await sendMail({to:user.email,subject:'Pagamento aprovado — acesso liberado',html:`<h2>Pagamento aprovado</h2><p>Olá, ${user.name}. Seu plano ${selectedPlan.name} foi ativado até ${user.subscriptionEndsAt.toLocaleDateString('pt-BR')}.</p>`});
  }
  return payment;
}
r.get('/plans',(_,res)=>res.json({trialDays:Number(process.env.TRIAL_DAYS||3),plans:listPlans()}));
r.get('/payments',auth,async(req,res)=>res.json({payments:await Payment.find({userId:req.user._id}).select('-payload -qrCodeBase64').sort({createdAt:-1}).limit(50)}));
r.get('/payments/:id/status',auth,async(req,res)=>{
  const payment=await Payment.findOne({_id:req.params.id,userId:req.user._id});if(!payment)return res.status(404).json({error:'Pagamento não encontrado.'});
  if(payment.externalId&&['pending','in_process'].includes(payment.status))try{await processPayment(await mp(`/v1/payments/${payment.externalId}`));}catch(e){console.error('consulta pagamento',e.message)}
  const updated=await Payment.findById(payment._id).select('-payload');res.json({payment:updated});
});
r.post('/pix',auth,async(req,res)=>{
  const plan=getPlan(req.body?.plan);if(!plan)return res.status(400).json({error:'Plano inválido.'});
  const cpf=cleanCpf(req.body?.cpf||req.user.cpf);if(!validCpf(cpf))return res.status(400).json({error:'Informe um CPF válido para gerar o Pix.'});
  if(!req.user.cpf){req.user.cpf=cpf;await req.user.save();}
  const externalReference=`${req.user.id}:${plan.id}:${crypto.randomUUID()}`;
  const expiration=new Date(Date.now()+Number(process.env.PIX_EXPIRATION_MINUTES||30)*60000).toISOString();
  const p=await mp('/v1/payments',{method:'POST',headers:{'X-Idempotency-Key':crypto.randomUUID()},body:JSON.stringify({transaction_amount:plan.price,description:`Controle Financeiro - Plano ${plan.name}`,payment_method_id:'pix',external_reference:externalReference,notification_url:`${process.env.BACKEND_URL||process.env.APP_URL}/api/billing/webhook`,date_of_expiration:expiration,payer:{email:req.user.email,first_name:req.user.name.split(' ')[0],identification:{type:'CPF',number:cpf}}})});
  const payment=await processPayment(p);res.status(201).json({paymentId:payment._id,externalId:String(p.id),status:p.status,plan:plan.id,amount:plan.price,expiresAt:p.date_of_expiration,qrCode:p.point_of_interaction?.transaction_data?.qr_code,qrCodeBase64:p.point_of_interaction?.transaction_data?.qr_code_base64,ticketUrl:p.point_of_interaction?.transaction_data?.ticket_url});
});
r.post('/checkout',auth,async(req,res)=>{
  const plan=getPlan(req.body?.plan);if(!plan)return res.status(400).json({error:'Plano inválido.'});
  const frontend=process.env.FRONTEND_URL||process.env.APP_URL;const backend=process.env.BACKEND_URL||process.env.APP_URL;const reference=`${req.user.id}:${plan.id}:${crypto.randomUUID()}`;
  const data=await mp('/checkout/preferences',{method:'POST',headers:{'X-Idempotency-Key':crypto.randomUUID()},body:JSON.stringify({items:[{id:`cf-${plan.id}`,title:`Controle Financeiro - Plano ${plan.name}`,quantity:1,currency_id:'BRL',unit_price:plan.price}],payer:{email:req.user.email},external_reference:reference,back_urls:{success:`${frontend}/?payment=success`,pending:`${frontend}/?payment=pending`,failure:`${frontend}/?payment=failure`},auto_return:'approved',notification_url:`${backend}/api/billing/webhook`,payment_methods:{excluded_payment_types:[{id:'ticket'}]},statement_descriptor:'CONTROLE FIN'})});
  await Payment.create({userId:req.user._id,preferenceId:data.id,status:'pending',plan:plan.id,amount:plan.price});res.json({checkoutUrl:data.init_point||data.sandbox_init_point,preferenceId:data.id});
});
r.post('/webhook',async(req,res)=>{
  const id=req.body?.data?.id||req.query?.['data.id'];if(!id)return res.sendStatus(200);if(!validWebhookSignature({secret:process.env.MERCADO_PAGO_WEBHOOK_SECRET,signature:req.headers['x-signature'],requestId:req.headers['x-request-id'],dataId:id}))return res.status(401).json({error:'Assinatura do webhook inválida.'});res.sendStatus(200);
  try{await processPayment(await mp(`/v1/payments/${id}`));}catch(e){console.error('webhook',e);}
});
export default r;
