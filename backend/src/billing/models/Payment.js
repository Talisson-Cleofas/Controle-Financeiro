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
  externalReference:{type:String,index:true}, expectedAmount:Number,
  providerUpdatedAt:Date, refundedAmount:{type:Number,default:0},
  licenseStartsAt:Date, licenseEndsAt:Date, licenseReversedAt:Date,
  needsReview:{type:Boolean,default:false}, reviewReason:String,
  paymentMethod:{type:String,default:'pix'}, qrCode:String, qrCodeBase64:String, ticketUrl:String, expiresAt:Date, payload:mongoose.Schema.Types.Mixed
},{timestamps:true});
schema.index({provider:1,externalId:1},{unique:true,name:'provider_externalId_unique_when_present_v2',partialFilterExpression:{externalId:{$type:'string'}}});
const Payment = mongoose.model('Payment',schema);
export async function ensurePaymentIndexes(){
  // Additive only: incompatible pre-existing indexes require an explicit migration.
  await Payment.collection.createIndex(
    {provider:1,externalId:1},
    {unique:true,name:'provider_externalId_unique_when_present_v2',partialFilterExpression:{externalId:{$type:'string'}}}
  );
}
export default Payment;

