import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {join} from 'node:path';
const execute=promisify(execFile);
const LIMIT=4_000_000;

// Windows' built-in HTTPS client handles sites that reject Bun's HTTP connection.
// No browser cookies, credentials, proxies or certificate-validation overrides are used.
export function decodeWindowsResponse(output:string):Response {
 const marker='\nJOBDESK_HTTP_STATUS:';
 const at=output.lastIndexOf(marker);
 if(at<0)throw Error('Không đọc được phản hồi HTTP của Windows.');
 const body=output.slice(0,at);
 if(Buffer.byteLength(body)>LIMIT)throw Error('Trang quá lớn');
 const meta=output.slice(at+marker.length);
 const match=/^(\d{3})\nJOBDESK_REDIRECT:([^\r\n]*)$/.exec(meta);
 if(!match)throw Error('Phản hồi HTTP của Windows không hợp lệ.');
 const status=Number(match[1]);
 if(status<200||status>599)throw Error('Không kết nối được trang tuyển dụng bằng Windows.');
 return new Response(body,{status,headers:match[2]?{Location:match[2]}:{}});
}

export async function fetchWindowsPage(url:string):Promise<Response> {
 const executable=join(process.env.SystemRoot||'C:\\Windows','System32','curl.exe');
 try{
  const {stdout}=await execute(executable,[
   '--silent','--show-error','--proto','=https','--connect-timeout','10','--max-time','20',
   '--max-filesize',String(LIMIT),'--user-agent','JobDesk/1.2 (personal job search)',
   '--header','Accept: text/html,application/xhtml+xml','--header','Accept-Language: vi,en;q=0.8',
   '--write-out','\nJOBDESK_HTTP_STATUS:%{http_code}\nJOBDESK_REDIRECT:%{redirect_url}',url
  ],{encoding:'utf8',windowsHide:true,timeout:22_000,maxBuffer:LIMIT+100_000});
  return decodeWindowsResponse(stdout);
 }catch(error){
  if(error instanceof Error&&/Trang quá lớn|phản hồi|Phản hồi/.test(error.message))throw error;
  throw Error('Windows chưa đọc được TopCV. Hãy mở trang gốc hoặc nhập JD.');
 }
}
