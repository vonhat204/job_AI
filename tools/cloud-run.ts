import {mkdirSync,existsSync,readFileSync,writeFileSync,cpSync,renameSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {Store} from '../src/store';
import {validateSettings} from '../src/settings';
import {runScan} from '../src/scanner';
import {assess} from '../src/rank';
import {seal,unseal,validateKey} from '../src/cloud-crypto';

export async function cloudRun(root:string,env:NodeJS.ProcessEnv=process.env,deps?:Parameters<typeof runScan>[2]){
 const stateKey=env.JOBDESK_STATE_KEY||'',viewKey=env.JOBDESK_VIEW_KEY||'';validateKey(stateKey);validateKey(viewKey);if(stateKey===viewKey)throw Error('Mã xem trang phải khác khóa lưu dữ liệu.');
 if(!env.JOBDESK_SETTINGS)throw Error('Thiếu secret JOBDESK_SETTINGS.');
 const dir=join(root,'.cloud-state'),site=join(root,'cloud-site');mkdirSync(dir,{recursive:true});mkdirSync(site,{recursive:true});
 const encrypted=join(dir,'state.enc');const restored=existsSync(encrypted);
 if(!restored&&env.JOBDESK_BOOTSTRAP!=='true')throw Error('Không có bản lưu cloud. Dừng gửi để tránh báo lặp; phục hồi bản lưu hoặc chạy bootstrap thủ công.');
 const input=restored?encrypted:join(root,'cloud','seed.enc');const dbPath=join(dir,'runtime.sqlite');
 // A fresh runner restores one complete SQLite snapshot, including notification history.
 if(existsSync(input))writeFileSync(dbPath,await unseal(readFileSync(input,'utf8'),stateKey));else if(existsSync(dbPath))throw Error('Có dữ liệu tạm chưa được xác minh; không khởi tạo đè.');
 const store=new Store(dbPath);let result:Awaited<ReturnType<typeof runScan>>|undefined;
 try{
  const settings=validateSettings(JSON.parse(env.JOBDESK_SETTINGS),store.settings());
  if(env.JOBDESK_QUERY?.trim())settings.query=validateSettings({query:env.JOBDESK_QUERY},settings).query;
  store.saveSettings(settings);
  if(settings.notifications&&env.JOBDESK_DRY_RUN!=='true'&&(!env.GMAIL_USER||!env.GMAIL_APP_PASSWORD))throw Error('Thiếu Gmail secrets; chưa gửi thư.');
  const startedAt=new Date().toISOString();
  result=await runScan(store,settings,deps,env.JOBDESK_DRY_RUN!=='true');
  // Bound cloud storage while retaining saved/applied jobs and all send receipts.
  const cutoff=new Date(Date.now()-30*86400000).toISOString();
  store.db.query("DELETE FROM jobs WHERE json_extract(json,'$.status') IN ('new','hidden') AND json_extract(json,'$.firstSeen') < ? AND COALESCE(json_extract(json,'$.postedAt'),'') < ?").run(cutoff,cutoff);
  const report={version:1,startedAt,finishedAt:new Date().toISOString(),query:settings.query,days:settings.days,minScore:settings.minScore,notifications:settings.notifications,dryRun:env.JOBDESK_DRY_RUN==='true',sent:result.sent,mailError:result.mailError,sources:store.scans(),jobs:store.jobs().filter(j=>j.searchQuery===settings.query).map(j=>({...j,...assess(j,settings)})).filter(j=>j.verdict!=='excluded'&&j.status!=='hidden'&&!j.duplicateOf).sort((a,b)=>(b.score||0)-(a.score||0)).slice(0,150)};
  cpSync(join(root,'cloud','web'),site,{recursive:true});
  writeFileSync(join(site,'report.enc'),await seal(new TextEncoder().encode(JSON.stringify(report)),viewKey));
  const repo=env.GITHUB_REPOSITORY||'';if(!/^[\w.-]+\/[\w.-]+$/.test(repo))throw Error('GITHUB_REPOSITORY không hợp lệ.');
  writeFileSync(join(site,'config.json'),JSON.stringify({actionsUrl:`https://github.com/${repo}/actions/workflows/jobdesk-cloud.yml`}));
 }finally{
  // Persist successful sends even if a later source/report step failed.
  const snapshot=store.db.serialize();store.close();
  writeFileSync(encrypted+'.tmp',await seal(snapshot,stateKey));renameSync(encrypted+'.tmp',encrypted);
 }
 if(result?.sourceSuccesses===0)throw Error('Tất cả nguồn đều lỗi; xem nhật ký cloud.');
 if(result?.mailError)throw Error('Gửi Gmail thất bại; lịch sử được giữ, lượt sau sẽ thử lại.');
 return result;
}
if(import.meta.main){try{const result=await cloudRun(resolve(import.meta.dir,'..'));console.log(`Cloud scan: ${result?.sourceSuccesses} nguồn đọc được; ${result?.sent} tin gửi thành công.`);}catch(e){console.error(e instanceof Error?e.message:'Cloud scan thất bại.');process.exitCode=1;}}
