import {load} from 'cheerio';
import {mkdirSync} from 'node:fs';
mkdirSync('data/source-research',{recursive:true});
const entries=process.argv.slice(2).map(value=>{const at=value.indexOf('=');return [value.slice(0,at),value.slice(at+1)] as const;});
await Promise.all(entries.map(async([name,url])=>{try{
 const response=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0 (compatible; JobDesk/1.0; personal-job-search)','Accept-Language':'vi,en;q=0.8'},signal:AbortSignal.timeout(20000)});
 const html=await response.text(); await Bun.write(`data/source-research/${name}.html`,html);
 const $=load(html); console.log(JSON.stringify({name,url:response.url,status:response.status,length:html.length,title:$('title').text(),forms:$('form').map((_,e)=>({action:$(e).attr('action'),inputs:$(e).find('input,select').map((_,x)=>({name:$(x).attr('name'),placeholder:$(x).attr('placeholder')})).get()})).get().slice(0,5),scripts:$('script[src]').map((_,e)=>$(e).attr('src')).get().slice(0,12),json:$('script[type="application/ld+json"],script#__NEXT_DATA__').map((_,e)=>$(e).text().slice(0,350)).get().slice(0,4),links:$('a[href]').filter((_,e)=>/tuyen-dung|\/jobs\/|tim-kiem|viec-lam|search|recruitment/.test($(e).attr('href')||'')).map((_,e)=>({text:$(e).text().trim().slice(0,120),href:$(e).attr('href')})).get().slice(0,12)}));
 }catch(e){console.log(JSON.stringify({name,error:String(e)}));}}));
