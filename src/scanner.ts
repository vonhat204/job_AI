import type {Store} from './store';
import type {Settings} from './types';
import {search,detail} from './sources';
import {assess} from './rank';
import {notifyJobs,sendMail} from './mail';

export const scanDependencies={search,detail,sendMail};
export async function runScan(store:Store,s:Settings,deps=scanDependencies,sendNotifications=s.notifications){
 let sourceSuccesses=0;
 for(let start=0;start<s.sources.length;start+=2){await Promise.allSettled(s.sources.slice(start,start+2).map(async source=>{try{const jobs=await deps.search(source,s);for(const j of jobs)store.ingest({...j,searchQuery:s.query});store.scan(source,'ok',`${jobs.length} tin từ trang kết quả đầu tiên; tiếp tục lọc theo hồ sơ.`,jobs.length);sourceSuccesses++;}catch(e){store.scan(source,'error',e instanceof Error?e.message:'Lỗi tải nguồn',0);}}));}
 const candidates=store.jobs().filter(j=>j.searchQuery===s.query&&(!j.verified||!j.checkedAt||Date.now()-Date.parse(j.checkedAt)>86400000)&&assess(j,s).verdict!=='excluded').sort((a,b)=>assess(b,s).score-assess(a,s).score).slice(0,10);
 for(const j of candidates){try{const d=await deps.detail(j.url);store.save({...j,...d,company:d.company||j.company,location:d.location||j.location,postedAt:d.postedAt||j.postedAt,employmentType:d.employmentType||j.employmentType,salary:d.salary||j.salary});}catch{/* Missing details remain unverified. */}}
 let sent=0,mailMessage='',mailError=false;
 if(sendNotifications&&s.notifications){try{sent=await notifyJobs(store,s,deps.sendMail);mailMessage=sent?`Đã gửi ${sent} tin mới đến ${s.recipient}`:'Chưa có tin mới đủ điều kiện gửi.';}catch(e){mailMessage=e instanceof Error?e.message:'Lỗi gửi email';mailError=true;store.scan('gmail','error',mailMessage,0);}}
 return {sourceSuccesses,sent,mailMessage,mailError};
}
