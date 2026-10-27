import {load} from 'cheerio';
for(const source of ['topcv','careerviet']){
const $=load(await Bun.file(`data/${source}.html`).text());
console.log(source, 'forms', $('form').map((i,e)=>({action:$(e).attr('action'),inputs:$(e).find('input,select').map((i,x)=>[$(x).attr('name'),$(x).attr('value')].join(':')).get().slice(0,10)})).get().slice(0,3));
const links=$('a[href]').filter((i,e)=>source==='topcv'? /\/viec-lam\/[^?]+\d+\.html/.test($(e).attr('href')!):/\/tim-viec-lam\/[^/?]+\.[a-z0-9]+\.html/i.test($(e).attr('href')!));
console.log('links',links.length);
console.log(links.filter((i,e)=>$(e).text().trim().length>8).slice(0,2).map((i,e)=>$(e).parent().parent().html()?.slice(0,9000)).get());
console.log('jsonld',$('script[type="application/ld+json"]').map((i,e)=>$(e).text().slice(0,400)).get());
}
