import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {randomBytes} from 'node:crypto';
import assert from 'node:assert/strict';
import {transfer,sha} from './client.mjs';
import {fileURLToPath} from 'node:url';
const child=spawn(process.execPath,[fileURLToPath(new URL('server.mjs',import.meta.url))],{stdio:['ignore','pipe','inherit']});
try{
  const ready=await Promise.race([once(child.stdout,'data'),once(child,'exit').then(()=>{throw Error('server failed to start');})]);
  console.log(String(ready[0]).trim());
  const a=randomBytes(1048576),b=randomBytes(1048593);
  const upload=await Promise.all([transfer('alice','PUT',0,a),transfer('bob','PUT',0,b)]);
  assert.deepEqual(upload.map(r=>r.status),[201,201]);
  console.log('PASS simultaneous upload to slot 0: Alice 201 / Bob 201');
  const downloads=await Promise.all(['alice','bob'].map(u=>transfer(u,'GET',0)));
  for(const [i,data] of [a,b].entries()){
    assert.equal(downloads[i].status,200);assert.deepEqual(downloads[i].data,data);
    console.log('PASS byte comparison:',i?'Bob':'Alice',data.length,'bytes');console.log('SHA256 '+sha(data));
  }
  assert.equal((await transfer('alice','PUT',1,a,'0'.repeat(64))).status,422);
  assert.equal((await transfer('alice','GET',1)).status,404);
  console.log('PASS digest mismatch: 422 / unpublished slot: 404');
  assert.equal((await transfer('alice','PUT',0,b)).status,409);
  assert.deepEqual((await transfer('alice','GET',0)).data,a);
  console.log('PASS overwrite rejected: 409 / original bytes intact');
  await assert.rejects(transfer(null,'GET',0),e=>/certificate required|ECONNRESET/i.test(e.message+' '+e.code));
  console.log('PASS missing client certificate: TLS handshake rejected');
  assert.equal((await transfer('bob','PUT',7,Buffer.alloc(0))).status,201);
  assert.equal((await transfer('bob','GET',7)).data.length,0);
  console.log('PASS empty file round trip');
}finally{child.kill();}
