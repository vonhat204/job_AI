import {test,expect} from 'bun:test';
import {fetchPage} from '../src/security';
import {decodeWindowsResponse} from '../src/windows-http';

const topcv='https://www.topcv.vn/tim-viec-lam-ai-engineer-tai-ho-chi-minh-kl2';
const denied=(async()=>new Response('<title>Just a moment...</title>',{status:403})) as unknown as typeof fetch;

test('TopCV retries a denied Bun request once through the Windows HTTP reader',async()=>{
 let calls=0;const native=async(url:string)=>{calls++;expect(url).toBe(topcv);return new Response('<h1>Việc làm AI Engineer</h1>');};
 expect(await fetchPage(topcv,denied,native)).toContain('AI Engineer');expect(calls).toBe(1);
});

test('the Windows reader is not used for successful requests or other sources',async()=>{
 let calls=0;const native=async()=>{calls++;return new Response('Unexpected');};
 const ok=(async()=>new Response('<h1>Jobs</h1>')) as unknown as typeof fetch;
 expect(await fetchPage(topcv,ok,native)).toContain('Jobs');
 await expect(fetchPage('https://jobsgo.vn/',denied,native)).rejects.toThrow('HTTP 403');expect(calls).toBe(0);
});

test('Windows redirects are validated before a second network request',async()=>{
 let calls=0;const original=(async()=>{calls++;return new Response('Denied',{status:403});}) as unknown as typeof fetch;
 const native=async()=>decodeWindowsResponse('\nJOBDESK_HTTP_STATUS:302\nJOBDESK_REDIRECT:http://127.0.0.1/private');
 await expect(fetchPage(topcv,original,native)).rejects.toThrow();expect(calls).toBe(1);
});

test('an unsuccessful native response or browser challenge remains an explicit error',async()=>{
 await expect(fetchPage(topcv,denied,async()=>new Response('Denied',{status:403}))).rejects.toThrow('HTTP 403');
 await expect(fetchPage(topcv,denied,async()=>new Response('<title>Just a moment...</title>'))).rejects.toThrow('xác minh');
});

test('Windows response decoding retains Vietnamese text, rejects malformed metadata and limits bytes',async()=>{
 const response=decodeWindowsResponse('<h1>Việc làm</h1>\nJOBDESK_HTTP_STATUS:200\nJOBDESK_REDIRECT:');expect(response.status).toBe(200);expect(await response.text()).toBe('<h1>Việc làm</h1>');
 expect(()=>decodeWindowsResponse('No status')).toThrow();expect(()=>decodeWindowsResponse('x\nJOBDESK_HTTP_STATUS:000\nJOBDESK_REDIRECT:')).toThrow();
 expect(()=>decodeWindowsResponse('Đ'.repeat(2_000_001)+'\nJOBDESK_HTTP_STATUS:200\nJOBDESK_REDIRECT:')).toThrow('Trang quá lớn');
});
