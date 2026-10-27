import {normalize,type Job,type Settings} from './types';
export function minExperience(text:string):number|null {const s=normalize(text);const patterns=[/(\d+)\s*(?:[-–]\s*\d+)?\s*\+?\s*(?:years?|nam)\s*(?:of\s*)?(?:relevant\s*|professional\s*|working\s*|hands-on\s*|practical\s*)?(?:experience|kinh nghiem)/g,/(?:kinh nghiem|experience)\s*[:：]?\s*(?:tu\s*|at least\s*)?(\d+)\s*(?:[-–]\s*\d+)?\s*\+?\s*(?:nam|years?)/g];const nums=patterns.flatMap(re=>[...s.matchAll(re)].map(m=>Number(m[1])));return nums.length?Math.max(...nums):/no (?:prior |professional )?experience|khong yeu cau kinh nghiem/.test(s)?0:null;}
export function assess(job:Job,s:Settings,now=new Date()){const reasons:string[]=[];const blockers:string[]=[];const all=normalize(job.title+' '+job.description);let score=30;let uncertain=false;
 const queryTerms=normalize(s.query).split(/[^a-z0-9]+/).filter(t=>t.length>1&&!['fresher','junior','intern','senior','ho','chi','minh','hcm','vietnam'].includes(t));const hits=queryTerms.filter(t=>t==='engineer'?/\b(engineer|developer|scientist)\b|ky su|ki su|lap trinh/.test(all):t==='ai'?/\bai\b|artificial intelligence|machine learning|genai|llm|computer vision/.test(all):new RegExp(`\\b${t}\\b`).test(all));if(queryTerms.length&&hits.length===0)blockers.push('Nội dung chưa liên quan đến từ khóa tìm kiếm.');else if(hits.length<queryTerms.length){uncertain=true;reasons.push('Chỉ khớp một phần từ khóa tìm kiếm.');}
 if(job.active===false||(job.validUntil&&Date.parse(job.validUntil)<now.getTime()))blockers.push('Tin đã hết hạn / ngừng tuyển.');
 const title=normalize(job.title);const seniorTitle=/\b(senior|sr|principal|principle|director|manager|architect|lead|leader|middle|mid|mid-level)\b|truong nhom|truong phong/.test(title)||/\bstaff\s+(?:(?:machine learning|software|data|ai|ml|platform|cloud|devops|back[ -]?end|front[ -]?end|full[ -]?stack)\s+)*(?:engineer|developer|scientist)\b/.test(title);
 if(s.maxYears<3&&seniorTitle)blockers.push('Chức danh yêu cầu cấp độ có kinh nghiệm.');
 if(s.excludeIntern&&/\bintern(?:ship)?\b|thuc tap/.test(normalize(job.title+' '+job.employmentType)))blockers.push('Vị trí thực tập.');
 if(/part.?time|ban thoi gian|freelance/.test(normalize(job.employmentType)))blockers.push('Không phải công việc toàn thời gian.');
 const years=minExperience(job.description||job.title);if(years!==null&&years>s.maxYears)blockers.push(`Yêu cầu từ ${years} năm kinh nghiệm, vượt mức ${s.maxYears} năm.`);
 const fresh=/\bfresher\b|\bjunior\b|entry.level|moi tot nghiep|khong yeu cau kinh nghiem/.test(all);if(fresh){score+=25;reasons.push('Có tín hiệu Fresher / Junior trong nội dung.');}else if(years!==null&&years<=s.maxYears){score+=25;reasons.push(`Kinh nghiệm tối thiểu ${years} năm.`);}else{uncertain=true;reasons.push('Chưa xác định được yêu cầu kinh nghiệm.');}
 const loc=normalize(job.location);if(!loc){uncertain=true;reasons.push('Chưa rõ địa điểm làm việc.');}else if(/ho chi minh|hcm|sai gon/.test(normalize(s.location))){if(/ho chi minh|hcm|sai gon|thu duc|cu chi|tan binh|binh thanh|quan \d/.test(loc))score+=15;else if(!/remote|tu xa/.test(loc))blockers.push('Địa điểm chưa khớp TP.HCM.');else {uncertain=true;reasons.push('Remote — cần kiểm tra khu vực được nhận.');}}
 if(job.postedAt){const t=Date.parse(job.postedAt);const age=(now.getTime()-t)/86400000;if(!Number.isFinite(t)||age< -1){uncertain=true;reasons.push('Ngày đăng không hợp lệ.');}else if(age>s.days)blockers.push(`Tin cũ hơn ${s.days} ngày.`);else score+=10;}else{uncertain=true;reasons.push('Nguồn chưa cung cấp ngày đăng.');}
 const matched=s.skills.filter(k=>all.includes(normalize(k)));if(matched.length){score+=Math.min(20,matched.length*5);reasons.push('Kỹ năng trùng: '+matched.join(', '));}
 if(!job.verified){uncertain=true;reasons.push('Chưa đọc đầy đủ JD; cần kiểm tra trước khi ứng tuyển.');}
 if(!job.employmentType){uncertain=true;reasons.push('Chưa xác nhận hình thức làm việc.');}
 if(job.active===null){uncertain=true;reasons.push('Chưa xác nhận tin còn nhận hồ sơ.');}
 return {score:blockers.length?Math.min(30,score):Math.min(100,score),verdict:blockers.length?'excluded':uncertain?'review':'match',reasons:[...blockers,...reasons]};}



