import https from 'node:https';
import {readFileSync,createReadStream,createWriteStream} from 'node:fs';
import {mkdir,mkdtemp,link,rm,stat} from 'node:fs/promises';
import {pipeline} from 'node:stream/promises';
import {Transform} from 'node:stream';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
const load=name=>readFileSync(join('state',name));
const users=new Map(Object.entries(JSON.parse(load('users.json'))));
const busy=new Set();
const server=https.createServer({key:load('server.key'),cert:load('server.pem'),ca:load('ca.pem'),requestCert:true,rejectUnauthorized:true,minVersion:'TLSv1.3',maxHeaderSize:8192},async(req,res)=>{
  const end=(status,msg='')=>{res.writeHead(status,{'Connection':'close'});res.end(msg);};
  const user=users.get(req.socket.getPeerCertificate().fingerprint256);
  if(!user)return end(403);
  if(!/^\/files\/[0-7]$/.test(req.url))return end(404);
  const dir=join('state','store',user), file=join(dir,req.url.slice(-1));
  let tmp,locked=false;
  try{
    if(req.method==='GET'){
      const info=await stat(file);
      res.writeHead(200,{'Content-Length':info.size,'Content-Type':'application/octet-stream'});
      await pipeline(createReadStream(file),res);return;
    }
    if(req.method!=='PUT')return end(405);
    const size=Number(req.headers['content-length']), digest=req.headers['x-sha256'];
    if(!Number.isSafeInteger(size)||size<0||size>16*1024*1024)return end(413);
    if(!/^[0-9a-f]{64}$/.test(digest??''))return end(400);
    if(busy.has(user))return end(429);
    busy.add(user);locked=true;
    await mkdir(dir,{recursive:true});tmp=await mkdtemp(join(dir,'pending-'));
    const part=join(tmp,'data'), hash=createHash('sha256');
    await pipeline(req,new Transform({transform(chunk,enc,next){hash.update(chunk);next(null,chunk);}}),createWriteStream(part,{flags:'wx'}));
    if(hash.digest('hex')!==digest)return end(422);
    await link(part,file);end(201);
  }catch(e){if(!res.headersSent&&!res.destroyed)end(e.code==='ENOENT'?404:e.code==='EEXIST'?409:500);}
  finally{try{if(tmp)await rm(tmp,{recursive:true,force:true});}finally{if(locked)busy.delete(user);}}
});
server.maxConnections=32;server.headersTimeout=5000;server.requestTimeout=30000;server.setTimeout(10000,s=>s.destroy());server.maxRequestsPerSocket=1;
server.listen(Number(process.env.PORT||8443),'127.0.0.1',()=>console.log('Listening https://127.0.0.1:'+server.address().port+' (TLS 1.3, client certificate required)'));
