import {spawn,spawnSync} from 'node:child_process';
import {openSync,mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
const root=resolve(import.meta.dir,'..');process.chdir(root);const port=Number(process.env.PORT)||4317;const url=`http://127.0.0.1:${port}`;
const open=()=>{const p=spawn('rundll32.exe',['url.dll,FileProtocolHandler',url],{detached:true,stdio:'ignore',windowsHide:true});p.unref();};
if(process.argv.includes('--stop')){try{const info=JSON.parse(readFileSync(join(root,'data','process.json'),'utf8'));if(info.root!==root)throw Error('Process does not belong to this app.');const r=await fetch(url+'/api/state',{signal:AbortSignal.timeout(1500)});const state=await r.json() as any;if(state.app!=='jobdesk'||state.pid!==info.pid)throw Error('Process changed; nothing was stopped.');process.kill(info.pid);console.log('JobDesk da dung.');}catch(e){console.log('Khong co JobDesk dang chay hoac khong the xac minh tien trinh.');}process.exit();}
try{const r=await fetch(url+'/api/state',{signal:AbortSignal.timeout(1500)});const s=await r.json() as any;if(s.app==='jobdesk'){console.log('JobDesk dang chay.');open();process.exit();}throw Error('Port in use');}catch{/* The server is not started yet. */}
console.log('Kiem tra ung dung truoc khi khoi dong...');
for(const args of [['run','check'],['test']]){const r=spawnSync(process.execPath,args,{cwd:root,stdio:'inherit',windowsHide:true});if(r.status!==0){console.error('Kiem tra that bai. Vui long xem thong bao o tren.');process.exit(1);}}
mkdirSync(join(root,'data'),{recursive:true});const out=openSync(join(root,'data','server.log'),'a');const err=openSync(join(root,'data','server-error.log'),'a');const child=spawn(process.execPath,[join(root,'src','server.ts')],{cwd:root,detached:true,stdio:['ignore',out,err],windowsHide:true});child.on('error',e=>{console.error(e.message);process.exitCode=1;});child.unref();writeFileSync(join(root,'data','process.json'),JSON.stringify({pid:child.pid,root}));
for(let i=0;i<30;i++){await Bun.sleep(250);try{const r=await fetch(url+'/api/state',{signal:AbortSignal.timeout(500)});const s=await r.json() as any;if(s.app==='jobdesk'&&s.pid===child.pid){console.log('JobDesk: '+url);open();process.exit();}}catch{}}
console.error('Khong khoi dong duoc. Xem data/server-error.log (co the cong da duoc su dung).');process.exit(1);
