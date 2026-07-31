import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { accessState, normalizeExpiredUser } from '../services/subscription.js';

export async function auth(req,res,next){
  try{
    const token=(req.headers.authorization||'').replace(/^Bearer\s+/,'');
    if(!token)return res.status(401).json({error:'Não autenticado.'});
    const p=jwt.verify(token,process.env.JWT_SECRET);
    const user=await User.findById(p.sub);
    if(!user)return res.status(401).json({error:'Usuário não encontrado.'});
    await normalizeExpiredUser(user);
    req.user=user;
    next();
  }catch{return res.status(401).json({error:'Sessão inválida ou expirada.'});}
}
export function admin(req,res,next){if(req.user?.role!=='admin')return res.status(403).json({error:'Acesso restrito.'}); next();}
export function paidAccess(req,res,next){
  const state=accessState(req.user);
  if(!state.allowed)return res.status(402).json({error:state.reason,code:'SUBSCRIPTION_REQUIRED',access:state});
  req.access=state;
  next();
}
