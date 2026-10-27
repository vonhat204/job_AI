import {SOURCES,type Settings} from './types';
export function validateSettings(input:any,previous:Settings):Settings {if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Cấu hình không hợp lệ');const s={...previous};for(const key of Object.keys(input))if(!(key in previous))throw new Error(`Trường không được hỗ trợ: ${key}`);
for(const key of ['query','location','recipient'] as const){if(input[key]!==undefined){if(typeof input[key]!=='string'||!input[key].trim()||input[key].length>150)throw new Error(`${key} không hợp lệ`);s[key]=input[key].trim();}}
if(!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(s.recipient))throw new Error('Email nhận thông báo không hợp lệ');
for(const [key,min,max] of [['days',1,30],['maxYears',0,10],['intervalMinutes',15,1440],['minScore',0,100]] as const)if(input[key]!==undefined){if(!Number.isInteger(input[key])||input[key]<min||input[key]>max)throw new Error(`${key} phải từ ${min} đến ${max}`);s[key]=input[key];}
for(const key of ['excludeIntern','notifications'] as const)if(input[key]!==undefined){if(typeof input[key]!=='boolean')throw new Error(`${key} không hợp lệ`);s[key]=input[key];}
if(input.sources!==undefined){if(!Array.isArray(input.sources)||!input.sources.length||input.sources.some((x:any)=>!SOURCES.includes(x)))throw new Error('Chọn ít nhất một nguồn hợp lệ');s.sources=[...new Set(input.sources)] as Settings['sources'];}
if(input.skills!==undefined){if(!Array.isArray(input.skills)||input.skills.length>30||input.skills.some((x:any)=>typeof x!=='string'||!x.trim()||x.length>60))throw new Error('Danh sách kỹ năng không hợp lệ');s.skills=[...new Set(input.skills.map((x:string)=>x.trim()))] as string[];}
return s;}
