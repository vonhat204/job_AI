import {test,expect} from 'bun:test';
import {createApp} from '../src/server';
import {Store} from '../src/store';
import {makeJob} from '../src/sources';
test('API persists settings/status, validates requests and finishes scan despite failed source',async()=>{
 const store=new Store(':memory:');store.saveSettings({...store.settings(),sources:['topcv','careerviet']});
 const app=createApp(store,{search:async(source)=>{if(source==='careerviet')throw Error('HTTP 403');return [makeJob('topcv','https://www.topcv.vn/viec-lam/a/123.html',{title:'Fresher AI',location:'Hồ Chí Minh',description:'Không yêu cầu kinh nghiệm'})];},detail:async()=>{throw Error('Blocked');},sendMail:async()=>({} as any)});
 const req=(path:string,method='GET',body?:any,extra={})=>app.handler(new Request('http://127.0.0.1:4317/api'+path,{method,headers:{'X-JobDesk':'local','Content-Type':'application/json',...extra},body:body?JSON.stringify(body):undefined}));
 try{
 expect((await req('/settings','PUT',{days:14})).status).toBe(200);expect(store.settings().days).toBe(14);
 expect((await req('/settings','PUT',{days:90})).status).toBe(400);
 expect((await req('/settings','PUT',{days:7},{Origin:'https://evil.test'})).status).toBe(403);
 expect((await app.handler(new Request('http://evil.test/api/state'))).status).toBe(403);
 expect((await app.handler(new Request('http://127.0.0.1/api/scan',{method:'POST'}))).status).toBe(403);
 await app.scan();expect(app.state().running).toBe(false);expect(store.jobs()).toHaveLength(1);expect(app.state().scans).toHaveLength(2);
 const id=store.jobs()[0].id;expect((await req('/jobs/'+id,'PATCH',{status:'saved'})).status).toBe(200);expect(store.get(id)?.status).toBe('saved');
 expect((await req('/jobs/'+id,'PATCH',{status:'garbage'})).status).toBe(400);
 expect((await req('/import','POST',{url:'http://localhost/secret'})).status).toBe(400);
 const data=await (await req('/state')).json() as any;expect(data.settings.recipient).toBe('your-email@example.com');expect(JSON.stringify(data)).not.toContain('GMAIL_APP_PASSWORD');
 expect((await req('/export')).headers.get('content-disposition')).toContain('jobdesk-jobs.json');
 }finally{app.close();store.close();}
});
