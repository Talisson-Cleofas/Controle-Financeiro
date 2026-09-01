import {Router} from 'express'; import User from '../models/User.js'; import Payment from '../models/Payment.js'; import {auth,admin} from '../middleware/auth.js'; import {sendMail} from '../services/mail.js'; import {addPlanPeriod} from '../services/subscription.js';
import mongoose from 'mongoose';
import WebhookJob from '../models/WebhookJob.js';
const r=Router();r.use(auth,admin);
r.get('/billing/jobs',async(req,res)=>res.json({jobs:await WebhookJob.find({status:{$in:['retry','dead']}}).select('-lockToken').sort({updatedAt:-1}).limit(100)}));
r.post('/billing/jobs/:id/retry',async(req,res)=>{
  if(!mongoose.isObjectIdOrHexString(req.params.id))return res.status(400).json({error:'Identificador inválido.'});
  const job=await WebhookJob.findOneAndUpdate({_id:req.params.id,status:{$in:['dead','retry']}},{$set:{status:'pending',attempts:0,availableAt:new Date(),lastError:''},$unset:{lockedUntil:1,lockToken:1}},{new:true}).select('-lockToken');
  if(!job)return res.status(409).json({error:'Evento não está disponível para reprocessamento.'});
  res.json({job});
});
r.get('/stats',async(req,res)=>{const [users,active,trial,pastDue,revenue]=await Promise.all([User.countDocuments(),User.countDocuments({status:'active'}),User.countDocuments({status:'trial'}),User.countDocuments({status:'past_due'}),Payment.aggregate([{$match:{status:'approved'}},{$group:{_id:null,total:{$sum:'$amount'}}}])]);res.json({users,active,trial,pastDue,revenue:revenue[0]?.total||0});});
r.get('/users',async(req,res)=>{const q=String(req.query.q||'').trim();const filter=q?{$or:[{name:{$regex:q,$options:'i'}},{email:{$regex:q,$options:'i'}}]}:{};res.json({users:await User.find(filter).select('-passwordHash -resetTokenHash').sort({createdAt:-1}).limit(500)});});
r.get('/payments',async(req,res)=>res.json({payments:await Payment.find().populate('userId','name email').select('-payload').sort({createdAt:-1}).limit(500)}));
r.patch('/users/:id',async(req,res)=>{const allowed=['status','plan','subscriptionEndsAt','trialEndsAt','role'];const patch={};for(const k of allowed)if(req.body[k]!==undefined)patch[k]=req.body[k];const user=await User.findByIdAndUpdate(req.params.id,patch,{new:true,runValidators:true}).select('-passwordHash -resetTokenHash');if(!user)return res.status(404).json({error:'Usuário não encontrado.'});res.json({user});});
r.post('/users/:id/activate',async(req,res)=>{const plan=['monthly','semiannual','yearly','lifetime'].includes(req.body?.plan)?req.body.plan:'monthly';const user=await User.findById(req.params.id);if(!user)return res.status(404).json({error:'Usuário não encontrado.'});user.status='active';user.plan=plan;user.subscriptionEndsAt=addPlanPeriod(user,plan);await user.save();if(req.body?.sendEmail!==false)await sendMail({to:user.email,subject:'Acesso ao Controle Financeiro liberado',html:`<h2>Acesso liberado</h2><p>Olá, ${user.name}. Seu plano ${plan} foi ativado${user.subscriptionEndsAt?` até ${user.subscriptionEndsAt.toLocaleDateString('pt-BR')}`:' sem vencimento'}.</p>`});res.json({user});});
r.post('/users/:id/email',async(req,res)=>{const user=await User.findById(req.params.id);if(!user)return res.status(404).json({error:'Usuário não encontrado.'});const subject=String(req.body?.subject||'Informações sobre sua conta');const message=String(req.body?.message||'Entre em contato com nosso suporte para mais informações.');await sendMail({to:user.email,subject,html:`<p>Olá, ${user.name}.</p><p>${message.replace(/\n/g,'<br>')}</p>`});res.json({ok:true});});
export default r;
