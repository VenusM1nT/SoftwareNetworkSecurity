import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {X509Certificate} from 'node:crypto';
import {join,resolve} from 'node:path';
const root=resolve('state');
mkdirSync(root,{mode:0o700});
function ssl(...args){execFileSync('openssl',args,{cwd:root,stdio:['ignore','pipe','pipe']});}
ssl('req','-x509','-newkey','rsa:3072','-nodes','-days','30','-subj','/CN=EX1B Local CA','-addext','basicConstraints=critical,CA:TRUE','-addext','keyUsage=critical,keyCertSign,cRLSign','-keyout','ca.key','-out','ca.pem');
const users={};
for(const name of ['server','alice','bob']){
  ssl('req','-new','-newkey','rsa:2048','-nodes','-subj','/CN='+name,'-keyout',name+'.key','-out',name+'.csr');
  const server=name==='server';
  writeFileSync(join(root,'leaf.ext'),'basicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature\nextendedKeyUsage='+ (server?'serverAuth\nsubjectAltName=DNS:localhost,IP:127.0.0.1':'clientAuth')+'\n');
  ssl('x509','-req','-in',name+'.csr','-CA','ca.pem','-CAkey','ca.key','-CAcreateserial','-days','7','-extfile','leaf.ext','-out',name+'.pem');
  if(!server)users[new X509Certificate(readFileSync(join(root,name+'.pem'))).fingerprint256]=name;
}
writeFileSync(join(root,'users.json'),JSON.stringify(users));
console.log('Created local CA, server certificate and two registered client certificates.');
