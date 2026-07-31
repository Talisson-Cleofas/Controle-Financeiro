import mongoose from 'mongoose';
const schema = new mongoose.Schema({userId:{type:mongoose.Schema.Types.ObjectId,ref:'User',unique:true,required:true},transactions:{type:Array,default:[]},settings:{type:mongoose.Schema.Types.Mixed,default:{}},revision:{type:Number,default:1}},{timestamps:true});
export default mongoose.model('UserData',schema);
