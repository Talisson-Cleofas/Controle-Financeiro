import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  userId:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true,index:true},
  provider:{type:String,default:'mercadopago'},
  externalId:{type:String,index:true,sparse:true},
  preferenceId:{type:String,index:true,sparse:true},
  status:{type:String,default:'pending',index:true},
  statusDetail:String,
  plan:{type:String,enum:['monthly','semiannual','yearly','lifetime']},
  amount:Number,
  currency:{type:String,default:'BRL'},
  paidAt:Date,
  processedAt:Date,
  paymentMethod:{type:String,default:'pix'}, qrCode:String, qrCodeBase64:String, ticketUrl:String, expiresAt:Date, payload:mongoose.Schema.Types.Mixed
},{timestamps:true});
schema.index({provider:1,externalId:1},{unique:true,sparse:true});
export default mongoose.model('Payment',schema);
