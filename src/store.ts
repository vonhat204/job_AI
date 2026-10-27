import {Database} from 'bun:sqlite';
import {defaults,NEW_SOURCES,normalize,type Job,type Settings} from './types';
export class Store {
 db:Database;
 constructor(path:string){this.db=new Database(path,{create:true});this.db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS settings(id INTEGER PRIMARY KEY, json TEXT NOT NULL); CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY, json TEXT NOT NULL); CREATE TABLE IF NOT EXISTS scans(id INTEGER PRIMARY KEY AUTOINCREMENT, source TEXT, status TEXT, message TEXT, count INTEGER, time TEXT); CREATE TABLE IF NOT EXISTS notified(key TEXT PRIMARY KEY, time TEXT); CREATE TABLE IF NOT EXISTS migrations(id TEXT PRIMARY KEY);');
 this.db.transaction(()=>{const id='2026-10-add-vietnam-sources';if(this.db.query('SELECT 1 FROM migrations WHERE id=?').get(id))return;const row=this.db.query('SELECT json FROM settings WHERE id=1').get() as {json:string}|null;if(row){const saved=JSON.parse(row.json);this.saveSettings({...defaults,...saved,sources:[...new Set([...(saved.sources||defaults.sources),...NEW_SOURCES])]});}this.db.query('INSERT INTO migrations VALUES(?)').run(id);})();}
 settings():Settings {const row=this.db.query('SELECT json FROM settings WHERE id=1').get() as any;return {...defaults,...(row?JSON.parse(row.json):{})};}
 saveSettings(s:Settings){this.db.query('INSERT OR REPLACE INTO settings VALUES(1,?)').run(JSON.stringify(s));}
 jobs():Job[]{return (this.db.query('SELECT json FROM jobs').all() as any[]).map(r=>JSON.parse(r.json));}
 get(id:string):Job|undefined {const r=this.db.query('SELECT json FROM jobs WHERE id=?').get(id) as any;return r?JSON.parse(r.json):undefined;}
 save(j:Job){const old=this.get(j.id);const dup=old?undefined:this.jobs().find(x=>x.source!==j.source&&normalize(x.title)===normalize(j.title)&&j.company&&normalize(x.company)===normalize(j.company));const next={...old,...j,firstSeen:old?.firstSeen||new Date().toISOString(),status:j.status||old?.status||'new',duplicateOf:old?.duplicateOf||j.duplicateOf||dup?.id||null};this.db.query('INSERT OR REPLACE INTO jobs VALUES(?,?)').run(next.id,JSON.stringify(next));return next;}
 ingest(j:Job){const old=this.get(j.id);if(old?.verified){return this.save({...j,...old,postedAt:j.postedAt||old.postedAt,active:j.active===false?false:old.active});}return this.save(j);}
 scan(source:string,status:string,message:string,count:number){this.db.query('INSERT INTO scans(source,status,message,count,time) VALUES(?,?,?,?,?)').run(source,status,message,count,new Date().toISOString());this.db.exec('DELETE FROM scans WHERE id NOT IN (SELECT id FROM scans ORDER BY id DESC LIMIT 100)');}
 scans(){return this.db.query('SELECT * FROM scans ORDER BY id DESC LIMIT 30').all();}
 notified(key:string){return !!this.db.query('SELECT 1 FROM notified WHERE key=?').get(key);}
 markNotified(key:string){this.db.query('INSERT OR IGNORE INTO notified VALUES(?,?)').run(key,new Date().toISOString());}
 close(){this.db.close();}
}


