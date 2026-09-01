import {Router} from 'express';
import crypto from 'crypto';
import auth from '../../middlewares/auth.js';
import Payment from '../models/Payment.js';
import {getPlan, listPlans} from '../services/plans.js';
import {mp, mercadoPagoTestMode} from '../services/mercadopago-client.js';
import {processPayment, processOrder} from '../services/payment-processing.js';
import {createWebhookHandler} from '../services/billing-webhooks.js';

const r=Router();
const asyncRoute = handler => (req,res,next) => Promise.resolve(handler(req,res,next)).catch(next);
const get = r.get.bind(r), post = r.post.bind(r);
r.get = (path,...handlers) => get(path,...handlers.map(asyncRoute));
r.post = (path,...handlers) => post(path,...handlers.map(asyncRoute));
const cleanCpf=v=>String(v||'').replace(/\D/g,'');
function validCpf(cpf){
  cpf=cleanCpf(cpf); if(cpf.length!==11||/^(\d)\1+$/.test(cpf))return false;
  let sum=0;for(let i=0;i<9;i++)sum+=Number(cpf[i])*(10-i);let d=(sum*10)%11;if(d===10)d=0;if(d!==Number(cpf[9]))return false;
  sum=0;for(let i=0;i<10;i++)sum+=Number(cpf[i])*(11-i);d=(sum*10)%11;if(d===10)d=0;return d===Number(cpf[10]);
}
r.get('/plans',(_,res)=>res.json({trialDays:Number(process.env.TRIAL_DAYS||3),plans:listPlans()}));
r.get('/payments',auth,async(req,res)=>res.json({payments:await Payment.find({userId:req.user._id}).select('-payload -qrCodeBase64').sort({createdAt:-1}).limit(50)}));
r.get('/payments/:id/status',auth,async(req,res)=>{
  const payment=await Payment.findOne({_id:req.params.id,userId:req.user._id});if(!payment)return res.status(404).json({error:'Pagamento não encontrado.'});
  if(['pending','in_process'].includes(payment.status))try{
    if(mercadoPagoTestMode()&&payment.preferenceId?.startsWith('ORD'))await processOrder(await mp(`/v1/orders/${payment.preferenceId}`));
    else if(payment.externalId)await processPayment(await mp(`/v1/payments/${payment.externalId}`));
  }catch(e){console.error('consulta pagamento',e.message)}
  const updated=await Payment.findById(payment._id).select('-payload');res.json({payment:updated});
});
r.post('/pix',auth,async(req,res)=>{
  const plan=getPlan(req.body?.plan);if(!plan)return res.status(400).json({error:'Plano inválido.'});
  const cpf=cleanCpf(req.body?.cpf||req.user.cpf);if(!validCpf(cpf))return res.status(400).json({error:'Informe um CPF válido para gerar o Pix.'});
  if(!req.user.cpf){req.user.cpf=cpf;await req.user.save();}
  const externalReference=`${req.user.id}:${plan.id}:${crypto.randomUUID()}`;
  const expiration=new Date(Date.now()+Number(process.env.PIX_EXPIRATION_MINUTES||30)*60000).toISOString();
  if(mercadoPagoTestMode()){
    const testAmount='50.00';const testReference=`${req.user.id}_${plan.id}_${crypto.randomUUID().slice(0,8)}`;await Payment.create({userId:req.user._id,plan:plan.id,amount:Number(testAmount),expectedAmount:Number(testAmount),externalReference:testReference});const order=await mp('/v1/orders',{method:'POST',headers:{'X-Idempotency-Key':crypto.randomUUID()},body:JSON.stringify({type:'online',external_reference:testReference,total_amount:testAmount,payer:{email:'test_user_br@testuser.com',first_name:'APRO'},transactions:{payments:[{amount:testAmount,payment_method:{id:'pix',type:'bank_transfer'}}]}})});
    const tx=order.transactions?.payments?.[0]||{};const method=tx.payment_method||{};const payment=await processOrder(order);
    return res.status(201).json({paymentId:payment._id,externalId:String(tx.id||order.id),status:payment.status,plan:plan.id,amount:Number(testAmount),testMode:true,expiresAt:null,qrCode:method.qr_code,qrCodeBase64:method.qr_code_base64,ticketUrl:method.ticket_url});
  }
  await Payment.create({userId:req.user._id,plan:plan.id,amount:plan.price,expectedAmount:plan.price,externalReference});
  const p=await mp('/v1/payments',{method:'POST',headers:{'X-Idempotency-Key':crypto.randomUUID()},body:JSON.stringify({transaction_amount:plan.price,description:`Controle Financeiro - Plano ${plan.name}`,payment_method_id:'pix',external_reference:externalReference,notification_url:`${process.env.BACKEND_URL||process.env.APP_URL}/api/billing/webhook`,date_of_expiration:expiration,payer:{email:req.user.email,first_name:req.user.name.split(' ')[0],identification:{type:'CPF',number:cpf}}})});
  const payment=await processPayment(p);res.status(201).json({paymentId:payment._id,externalId:String(p.id),status:p.status,plan:plan.id,amount:plan.price,expiresAt:p.date_of_expiration,qrCode:p.point_of_interaction?.transaction_data?.qr_code,qrCodeBase64:p.point_of_interaction?.transaction_data?.qr_code_base64,ticketUrl:p.point_of_interaction?.transaction_data?.ticket_url});
});
r.post('/checkout',auth,async(req,res)=>{
  const plan=getPlan(req.body?.plan);if(!plan)return res.status(400).json({error:'Plano inválido.'});
  const frontend=process.env.FRONTEND_URL||process.env.APP_URL;const backend=process.env.BACKEND_URL||process.env.APP_URL;const reference=`${req.user.id}:${plan.id}:${crypto.randomUUID()}`;
  const intent=await Payment.create({userId:req.user._id,plan:plan.id,amount:plan.price,expectedAmount:plan.price,externalReference:reference});
  const data=await mp('/checkout/preferences',{method:'POST',headers:{'X-Idempotency-Key':crypto.randomUUID()},body:JSON.stringify({items:[{id:`cf-${plan.id}`,title:`Controle Financeiro - Plano ${plan.name}`,quantity:1,currency_id:'BRL',unit_price:plan.price}],payer:{email:req.user.email},external_reference:reference,back_urls:{success:`${frontend}/?payment=success`,pending:`${frontend}/?payment=pending`,failure:`${frontend}/?payment=failure`},auto_return:'approved',notification_url:`${backend}/api/billing/webhook`,payment_methods:{excluded_payment_types:[{id:'ticket'}]},statement_descriptor:'CONTROLE FIN'})});
  await Payment.updateOne({_id:intent._id},{$set:{preferenceId:data.id}});
  const checkoutUrl=mercadoPagoTestMode()?data.sandbox_init_point:data.init_point;
  if(!checkoutUrl)throw Object.assign(new Error('Checkout indisponível para o ambiente selecionado.'),{status:502});
  res.json({checkoutUrl,preferenceId:data.id});
});
r.post('/webhook',createWebhookHandler());
export default r;
