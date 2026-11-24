import https from 'node:https';
import {readFile,writeFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
export const sha=data=>createHash('sha256').update(data).digest('hex');
export async function transfer(user,method,slot,data,digest){
  if(user!==null&&!['alice','bob'].includes(user))throw Error('Unknown test identity');
  const pem=name=>readFile('state/'+name);
  const opts={hostname:'127.0.0.1',port:Number(process.env.PORT||8443),path:'/files/'+slot,method,ca:await pem('ca.pem'),minVersion:'TLSv1.3',agent:false};
  if(user){opts.cert=await pem(user+'.pem');opts.key=await pem(user+'.key');}
  if(method==='PUT')opts.headers={'Content-Length':data.length,'X-SHA256':digest??sha(data)};
  return new Promise((resolve,reject)=>{
    const req=https.request(opts,res=>{
      const chunks=[];res.on('error',reject);res.on('data',chunk=>chunks.push(chunk));res.on('end',()=>resolve({status:res.statusCode,data:Buffer.concat(chunks)}));
    });req.on('error',reject);req.setTimeout(30000,()=>req.destroy(Error('timeout')));req.end(data);
  });
}
if(import.meta.url===pathToFileURL(process.argv[1]).href){
  const [user,action,slot,path]=process.argv.slice(2);
  if(!['put','get'].includes(action)||!path||!/^([0-7])$/.test(slot))throw Error('Usage: node client.mjs alice|bob put|get SLOT FILE');
  if(action==='put'&&(await stat(path)).size>16777216)throw Error('16 MiB limit');
  const r=await transfer(user,action.toUpperCase(),slot,action==='put'?await readFile(path):undefined);
  if(r.status>=300)throw Error('HTTP '+r.status);
  if(action==='get')await writeFile(path,r.data,{flag:'wx'});
  console.log('HTTP',r.status,action,slot);
}
