import nodemailer from 'nodemailer';
function transport(){if(!process.env.SMTP_HOST)return null;return nodemailer.createTransport({host:process.env.SMTP_HOST,port:Number(process.env.SMTP_PORT||587),secure:String(process.env.SMTP_SECURE)==='true',auth:process.env.SMTP_USER?{user:process.env.SMTP_USER,pass:process.env.SMTP_PASS}:undefined,disableFileAccess:true,disableUrlAccess:true});}
export async function sendMail({to,subject,html}){const t=transport(); if(!t){console.log('[email não configurado]',subject,to);return;} await t.sendMail({from:process.env.EMAIL_FROM,to,subject,html});}
