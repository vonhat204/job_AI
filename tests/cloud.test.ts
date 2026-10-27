import {test,expect} from 'bun:test';
import {randomBytes} from 'node:crypto';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,dirname,basename} from 'node:path';
import {seal,unseal} from '../src/cloud-crypto';
import {cloudRun} from '../tools/cloud-run';
import {defaults} from '../src/types';
import {makeJob} from '../src/sources';
import {Store} from '../src/store';
const key=()=>randomBytes(32).toString('base64');
function cleanup(path:string){if(dirname(resolve(path))!==resolve(tmpdir())||!basename(path).startsWith('jobdesk-cloud-'))throw Error('Unsafe test path');rmSync(path,{recursive:true,force:true});}
test('cloud encryption authenticates the state and uses a fresh nonce',async()=>{const k=key(),bytes=new TextEncoder().encode('private notification history');const a=await seal(bytes,k),b=await seal(bytes,k);expect(a).not.toBe(b);expect(new TextDecoder().decode(await unseal(a,k))).toBe('private notification history');expect(a).not.toContain('private');await expect(unseal(a,key())).rejects.toThrow();const tampered=JSON.parse(a);tampered.data=Buffer.alloc(50).toString('base64');await expect(unseal(JSON.stringify(tampered),k)).rejects.toThrow();await expect(seal(bytes,'weak')).rejects.toThrow();});
test('cloud bootstrap requires an explicit opt-in and bad keys never reach source or SMTP',async()=>{const root=mkdtempSync(join(tmpdir(),'jobdesk-cloud-'));let calls=0;const deps={search:async()=>{calls++;return [];},detail:async()=>{throw Error();},sendMail:async()=>{calls++;return {} as any;}};try{const env={JOBDESK_STATE_KEY:key(),JOBDESK_VIEW_KEY:key(),JOBDESK_SETTINGS:JSON.stringify(defaults)};await expect(cloudRun(root,env,deps)).rejects.toThrow('Không có bản lưu');await expect(cloudRun(root,{...env,JOBDESK_STATE_KEY:'weak',JOBDESK_BOOTSTRAP:'true'},deps)).rejects.toThrow();expect(calls).toBe(0);}finally{cleanup(root);}});
test('cloud restores local notification history, preserves new sends and retries SMTP failures',async()=>{
 const root=mkdtempSync(join(tmpdir(),'jobdesk-cloud-')),stateKey=key(),viewKey=key();let sent=0,fail=false;const urls=['https://www.topcv.vn/viec-lam/a/123.html','https://www.topcv.vn/viec-lam/b/124.html'];
 const jobs=urls.map((url,i)=>makeJob('topcv',url,{title:'Fresher AI Engineer '+i,company:'Example '+i,location:'Hồ Chí Minh',postedAt:new Date().toISOString(),description:'Không yêu cầu kinh nghiệm. Python và Git để xây dựng ứng dụng AI, kiểm thử và làm việc với dữ liệu.',employmentType:'FULL_TIME',active:true,verified:true,checkedAt:new Date().toISOString()}));
 const settings={...defaults,sources:['topcv'],notifications:true,minScore:50};const env={JOBDESK_STATE_KEY:stateKey,JOBDESK_VIEW_KEY:viewKey,JOBDESK_SETTINGS:JSON.stringify(settings),GITHUB_REPOSITORY:'example/jobdesk',GMAIL_USER:'sender@example.com',GMAIL_APP_PASSWORD:'fake-test-only'};
 const deps={search:async()=>jobs,detail:async(url:string)=>jobs.find(j=>j.url===url)!,sendMail:async(_to:string,_subject:string,html:string)=>{if(fail)throw Error('temporary SMTP');expect(html).toContain(urls[1]);sent++;return {} as any;}};
 try{
  mkdirSync(join(root,'cloud','web'),{recursive:true});writeFileSync(join(root,'cloud','web','index.html'),'test');
  const local=new Store(':memory:');local.markNotified(`${settings.recipient}:${jobs[0].id}`);writeFileSync(join(root,'cloud','seed.enc'),await seal(local.db.serialize(),stateKey));local.close();
  const first=await cloudRun(root,{...env,JOBDESK_BOOTSTRAP:'true',JOBDESK_DRY_RUN:'true'},deps);expect(first?.sent).toBe(0);expect(sent).toBe(0);
  fail=true;await expect(cloudRun(root,env,deps)).rejects.toThrow('Gửi Gmail thất bại');expect(sent).toBe(0);
  fail=false;expect((await cloudRun(root,env,deps))?.sent).toBe(1);expect((await cloudRun(root,env,deps))?.sent).toBe(0);expect(sent).toBe(1);
  const report=JSON.parse(new TextDecoder().decode(await unseal(readFileSync(join(root,'cloud-site','report.enc'),'utf8'),viewKey)));expect(report.jobs).toHaveLength(2);expect(report.jobs[1].url).toContain('topcv.vn');expect(JSON.stringify(report)).not.toContain('fake-test-only');expect(JSON.stringify(report)).not.toContain(settings.recipient);
  const encrypted=readFileSync(join(root,'.cloud-state','state.enc'),'utf8');expect(encrypted).not.toContain(settings.recipient);await expect(unseal(encrypted,viewKey)).rejects.toThrow();
 }finally{cleanup(root);}
});
