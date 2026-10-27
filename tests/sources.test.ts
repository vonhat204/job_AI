import {test,expect} from 'bun:test';
import {Database} from 'bun:sqlite';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {assignedJson,parseListing,parseDetail,parseYbox,searchUrl,makeJob} from '../src/sources';
import {SOURCES,NEW_SOURCES,defaults} from '../src/types';
import {sourceForUrl} from '../src/security';
import {assess,minExperience} from '../src/rank';
import {Store} from '../src/store';
const now=new Date('2026-10-27T16:00:00Z');
const fixture=(name:string)=>Bun.file(join(import.meta.dir,'fixtures',name)).text();

test('all ten sources have trusted search URLs, including quoted and Vietnamese queries',()=>{
 expect(SOURCES).toHaveLength(10);
 for(const source of SOURCES){const url=searchUrl(source,{...defaults,query:'Thiết kế UI "Figma"'});expect(sourceForUrl(url)).toBe(source);expect(url).not.toContain('undefined');}
 for(const host of ['ybox.vn','glints.com','jobsgo.vn','vieclam24h.vn'])expect(()=>sourceForUrl('https://'+host+'.evil.test/job')).toThrow();
 expect(new URL(searchUrl('glints',defaults)).pathname).toBe('/vn/opportunities/jobs/explore');
});

test('YBOX results stay unverified until a full JD is read; deadlines and post identity are enforced',async()=>{
 const payload=JSON.parse(await fixture('ybox-listing.json'));const jobs=parseYbox(payload,now);expect(jobs).toHaveLength(1);const j=jobs[0];expect(j.location).toContain('Hồ Chí Minh');expect(j.employmentType).toBe('INTERN');expect(j.verified).toBe(false);expect(j.company).toBe('');expect(j.postedAt).toBe('2026-10-24T08:12:00.000Z');
 const html=await fixture('ybox-detail.html');const d=parseDetail('ybox',html,j.url,now);expect(d.id).toBe(j.id);expect(d.verified).toBe(true);expect(d.description.length).toBeGreaterThan(1000);expect(d.active).toBe(true);expect(parseDetail('ybox',html,j.url,new Date('2026-11-10')).active).toBe(false);
 expect(()=>parseDetail('ybox',html,'https://ybox.vn/tuyen-dung/other-000000000000000000000000',now)).toThrow('không khớp');
 expect(parseYbox({data:{SearchPosts:{count:0,edges:[]}}},now)).toEqual([]);
 expect(()=>parseYbox({errors:[{message:'Unavailable'}],data:{SearchPosts:{count:0,edges:[]}}})).toThrow();
 expect(()=>parseYbox({data:{SearchPosts:{edges:[]}}})).toThrow();
 expect(()=>parseYbox({data:{SearchPosts:{count:null,edges:[]}}})).toThrow();
 expect(()=>parseYbox({data:{SearchPosts:{count:3,edges:[]}}})).toThrow();
 expect(()=>parseYbox({data:{SearchPosts:{count:1,edges:[{...payload.data.SearchPosts.edges[0],community:{url:'hoc-bong'}}]}}})).toThrow();
});

test('hydration extraction parses JSON only and rejects executable or malformed assignments',()=>{
 expect(assignedJson('<script>window.__INITIAL_STATE__ = {"content":"x } \\\" { y"}; throw Error("never run");</script>','__INITIAL_STATE__').content).toBe('x } " { y');
 expect(assignedJson('<script>window.__INITIAL_STATE__ = (()=>({x:1}))()</script>','__INITIAL_STATE__')).toBe(null);
 expect(assignedJson('<script>window.__INITIAL_STATE__ = {broken}</script>','__INITIAL_STATE__')).toBe(null);
});

test('Glints uses the original creation date rather than a recent edit and retains experience/location',async()=>{
 const jobs=parseListing('glints',await fixture('glints-listing.html'),'https://glints.com',now);expect(jobs).toHaveLength(1);const j=jobs[0];expect(j.title).toBe('AI Engineer');expect(j.location).toContain('Hồ Chí Minh');expect(j.postedAt).toBe('2026-08-12T16:38:31.424Z');expect(minExperience(j.description)).toBe(1);expect(assess(j,defaults,now).verdict).toBe('excluded');expect(j.url).not.toContain('utm_');
 const h=await fixture('glints-detail.html');const closed=h.replace('"status":"OPEN"','"status":"CLOSED"');const d=parseDetail('glints',closed,j.url,now);expect(d.active).toBe(false);expect(minExperience(d.description)).toBeGreaterThanOrEqual(1);expect(d.verified).toBe(true);
 expect(()=>parseListing('glints','<h1>Please sign in</h1>','https://glints.com')).toThrow();
 expect(parseListing('glints','<script id="__NEXT_DATA__">{"props":{"pageProps":{"initialJobs":{"jobsInPage":[]}}}}</script>','https://glints.com')).toEqual([]);
});

test('JobsGO does not use an update badge as a posting date; the detail supplies exact dates',async()=>{
 const [j]=parseListing('jobsgo',await fixture('jobsgo-listing.html'),'https://jobsgo.vn',now);expect(j.title).toBe('AI/Automation Engineer');expect(j.location).toBe('Hồ Chí Minh');expect(j.postedAt).toBe(null);expect(j.employmentType).toBe('FULL_TIME');expect(minExperience(j.description)).toBe(2);
 const d=parseDetail('jobsgo',await fixture('jobsgo-detail.html'),j.url,now);expect(d.postedAt).toBe('2026-10-27T10:25:55.000Z');expect(d.active).toBe(true);expect(d.verified).toBe(true);
});

test('Việc Làm 24h uses the application deadline rather than a paid promotion date',async()=>{
 const [j]=parseListing('vieclam24h',await fixture('vieclam24h-listing.html'),'https://vieclam24h.vn',now);expect(j.location).toBe('TP.HCM');expect(j.employmentType).toBe('FULL_TIME');expect(j.validUntil).toBe('2026-11-12T16:59:59.000Z');expect(j.verified).toBe(false);expect(j.description).toContain('tiếng Trung');expect(j.url).not.toContain('search_id');
 const d=parseDetail('vieclam24h',await fixture('vieclam24h-detail.html'),j.url,now);expect(d.verified).toBe(true);expect(d.validUntil).toBe('2026-11-06T16:59:59.000Z');expect(parseDetail('vieclam24h',await fixture('vieclam24h-detail.html'),j.url,new Date('2026-12-01')).active).toBe(false);
 expect(()=>parseListing('vieclam24h','<h1>Blocked</h1>','https://vieclam24h.vn')).toThrow();
});

test('upgrading existing settings enables new sources once and preserves saved jobs and later source choices',()=>{
 const dir=mkdtempSync(join(tmpdir(),'jobdesk-upgrade-'));const path=join(dir,'state.sqlite');let store:Store|undefined;
 try{const old=new Database(path);old.exec('CREATE TABLE settings(id INTEGER PRIMARY KEY,json TEXT NOT NULL)');old.query('INSERT INTO settings VALUES(1,?)').run(JSON.stringify({...defaults,query:'Figma',sources:['topcv'],days:14}));old.close();
 store=new Store(path);expect(store.settings().query).toBe('Figma');expect(store.settings().days).toBe(14);expect(store.settings().sources).toEqual(['topcv',...NEW_SOURCES]);const job=makeJob('ybox','https://ybox.vn/tuyen-dung/design-111111111111111111111111',{title:'Designer'});store.save({...job,status:'saved'});store.saveSettings({...store.settings(),sources:['topcv','glints']});store.close();store=undefined;
 store=new Store(path);expect(store.settings().sources).toEqual(['topcv','glints']);expect(store.get(job.id)?.status).toBe('saved');
 }finally{store?.close();if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw Error('Unexpected test cleanup path');rmSync(dir,{recursive:true,force:true});}
});
