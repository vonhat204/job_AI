export const SOURCES = ['linkedin','itviec','vietnamworks','topcv','careerviet','careerlink','ybox','glints','jobsgo','vieclam24h'] as const;
export const NEW_SOURCES = ['ybox','glints','jobsgo','vieclam24h'] as const;
export type Source = typeof SOURCES[number];
export type Job = {id:string;source:Source;url:string;title:string;company:string;location:string;postedAt:string|null;description:string;employmentType:string;salary:string;active:boolean|null;verified:boolean;firstSeen?:string;score?:number;verdict?:string;reasons?:string[];status?:string;duplicateOf?:string|null;searchQuery?:string;validUntil?:string|null;checkedAt?:string};
export type Settings = {query:string;location:string;days:number;maxYears:number;excludeIntern:boolean;sources:Source[];skills:string[];recipient:string;notifications:boolean;intervalMinutes:number;minScore:number};
export const defaults:Settings = {query:'AI Engineer',location:'Ho Chi Minh City, Vietnam',days:7,maxYears:1,excludeIntern:true,sources:[...SOURCES],skills:['Python','PyTorch','Machine Learning','Computer Vision','AWS','Git'],recipient:'your-email@example.com',notifications:false,intervalMinutes:120,minScore:60};
export function normalize(s:string){return s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase();}

