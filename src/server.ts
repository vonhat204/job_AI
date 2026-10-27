import {mkdirSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {Store} from './store';
import {SOURCES,normalize,type Source,type Job} from './types';
import {assess} from './rank';
import {detail,search,searchUrl,labels,makeJob} from './sources';
import {sourceForUrl} from './security';
import {validateSettings} from './settings';
import {mailReady,sendMail} from './mail';
import {runScan} from './scanner';

const root=resolve(import.meta.dir,'..');
export function createApp(store:Store,deps={search,detail,sendMail}){
let running=false;let lastRun=0;let mailMessage='';let testMailAt=0;
async function scan(){if(running)return;running=true;lastRun=Date.now();const s=store.settings();try{
const result=await runScan(store,s,deps);if(result.mailMessage)mailMessage=result.mailMessage;
}finally{running=false;}}
function state(){const settings=store.settings();return {app:'jobdesk',version:'1.3.0',pid:process.pid,settings,running,mail:{ready:mailReady(),message:mailMessage},sources:SOURCES.map(id=>({id,name:labels[id],url:searchUrl(id,settings)})),jobs:store.jobs().map(j=>({...j,...assess(j,settings)})),scans:store.scans(),lastRun: lastRun||null};}
const headers={'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",'Cache-Control':'no-store'};
const json=(value:unknown,status=200)=>Response.json(value,{status,headers});
async function handler(req:Request){const u=new URL(req.url);if(!['127.0.0.1','localhost','[::1]'].includes(u.hostname))return json({error:'Localhost only'},403);if(req.headers.get('origin')&&req.headers.get('origin')!==u.origin)return json({error:'Nguồn yêu cầu không hợp lệ'},403);
if(u.pathname.startsWith('/api/')&&!['GET','HEAD'].includes(req.method)&&req.headers.get('X-JobDesk')!=='local')return json({error:'Thiếu xác thực yêu cầu nội bộ'},403);
try{
if(u.pathname==='/api/state'&&req.method==='GET')return json(state());
if(u.pathname==='/api/settings'&&req.method==='PUT'){const s=validateSettings(await req.json(),store.settings());if(s.notifications&&!mailReady())return json({error:'Cần cấu hình Gmail trong .env trước khi bật thông báo.'},400);store.saveSettings(s);return json(s);}
if(u.pathname==='/api/scan'&&req.method==='POST'){if(running)return json({error:'Đang quét tin, vui lòng chờ.'},409);void scan();return json({started:true},202);}
if(u.pathname==='/api/import'&&req.method==='POST'){const data=await req.json() as any;if(typeof data.url!=='string'||data.url.length>2000)throw new Error('Đường dẫn không hợp lệ');const source=sourceForUrl(data.url);let j:Job;
if(data.description){for(const key of ['title','company','location','description','employmentType','postedAt'])if(data[key]!==undefined&&(typeof data[key]!=='string'||data[key].length>25000))throw new Error('Nội dung nhập không hợp lệ');if(!data.title?.trim()||data.description.trim().length<30)throw new Error('Cần tiêu đề và nội dung JD (ít nhất 30 ký tự).');const date=data.postedAt?Date.parse(data.postedAt):NaN;if(data.postedAt&&!Number.isFinite(date))throw new Error('Ngày đăng không hợp lệ');j=makeJob(source,data.url,{title:data.title.trim(),company:data.company||'',location:data.location||'',description:data.description.trim(),employmentType:data.employmentType||'',postedAt:Number.isFinite(date)?new Date(date).toISOString():null,verified:true,active:null});}
else j=await deps.detail(data.url);return json(store.save({...j,searchQuery:store.settings().query}),201);}
const match=u.pathname.match(/^\/api\/jobs\/([a-f0-9]{24})(\/details)?$/);if(match){const job=store.get(match[1]);if(!job)return json({error:'Không tìm thấy tin'},404);if(req.method==='PATCH'&&!match[2]){const body=await req.json() as any;if(!['new','saved','applied','hidden'].includes(body.status))throw new Error('Trạng thái không hợp lệ');return json(store.save({...job,status:body.status}));}if(req.method==='POST'&&match[2]){const d=await deps.detail(job.url);return json(store.save({...job,...d,company:d.company||job.company,location:d.location||job.location,postedAt:d.postedAt||job.postedAt,employmentType:d.employmentType||job.employmentType,salary:d.salary||job.salary}));}}
if(u.pathname==='/api/mail/test'&&req.method==='POST'){if(Date.now()-testMailAt<60000)return json({error:'Vui lòng chờ một phút trước khi gửi thử lần nữa.'},429);if(!mailReady())throw new Error('Gmail chưa được cấu hình.');testMailAt=Date.now();await deps.sendMail(store.settings().recipient,'[JobDesk] Kiểm tra kết nối Gmail','<p>Kết nối Gmail của JobDesk đã hoạt động. Bạn có thể bật thông báo việc mới trong ứng dụng.</p>');mailMessage='Email thử đã gửi thành công.';return json({message:mailMessage});}
if(u.pathname==='/api/export'&&req.method==='GET')return new Response(JSON.stringify(store.jobs().map(j=>({...j,...assess(j,store.settings())})),null,2),{headers:{...headers,'Content-Type':'application/json; charset=utf-8','Content-Disposition':'attachment; filename="jobdesk-jobs.json"'}});
if(u.pathname.startsWith('/api/'))return json({error:'Không tìm thấy chức năng'},404);
const assets:Record<string,string>={'/':'index.html','/app.js':'app.js','/style.css':'style.css','/favicon.svg':'favicon.svg'};if(req.method==='GET'&&assets[u.pathname])return new Response(Bun.file(join(root,'public',assets[u.pathname])),{headers});return json({error:'Không tìm thấy trang'},404);
}catch(e){return json({error:e instanceof Error?e.message:'Có lỗi xảy ra'},400);}}
const timer=setInterval(()=>{const s=store.settings();if(s.notifications&&Date.now()-lastRun>=s.intervalMinutes*60000)void scan();},60000);
return {handler,scan,state,close:()=>clearInterval(timer)};
}
if(import.meta.main){mkdirSync(join(root,'data'),{recursive:true});const store=new Store(join(root,'data','jobdesk.sqlite'));const app=createApp(store);const port=Number(process.env.PORT)||4317;const server=Bun.serve({hostname:'127.0.0.1',port,maxRequestBodySize:100000,fetch:app.handler,idleTimeout:60});console.log(`JobDesk đang chạy: http://127.0.0.1:${server.port}`);process.on('SIGINT',()=>{app.close();server.stop();store.close();process.exit();});}

