import mongoose from 'mongoose';
const schema = new mongoose.Schema({
 name:{type:String,required:true,trim:true}, email:{type:String,required:true,unique:true,lowercase:true,trim:true}, passwordHash:{type:String,required:true}, cpf:{type:String,trim:true}, phone:{type:String,trim:true},
 role:{type:String,enum:['user','admin'],default:'user'}, status:{type:String,enum:['trial','active','past_due','blocked','cancelled'],default:'trial'},
 trialEndsAt:Date, subscriptionEndsAt:Date, plan:{type:String,enum:['trial','monthly','semiannual','yearly','lifetime'],default:'trial'},
 resetTokenHash:String, resetTokenExpiresAt:Date, lastLoginAt:Date,
 billingRevision:{type:Number,default:0}
},{timestamps:true});
export default mongoose.model('User',schema);
