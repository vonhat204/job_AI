import {defaults} from '../src/types';
import {validateSettings} from '../src/settings';
import {sendMail} from '../src/mail';
import {escapeHtml} from '../src/security';

if(import.meta.main){
 const repo=process.env.GITHUB_REPOSITORY||'';
 if(!/^[\w.-]+\/[\w.-]+$/.test(repo))throw Error('GITHUB_REPOSITORY không hợp lệ.');
 if(!process.env.JOBDESK_SETTINGS)throw Error('Thiếu cấu hình nhận Gmail.');
 const settings=validateSettings(JSON.parse(process.env.JOBDESK_SETTINGS),defaults);
 const [owner,name]=repo.split('/');
 const url=`https://${owner}.github.io/${encodeURIComponent(name)}/`;
 await sendMail(settings.recipient,'[JobDesk Cloud] Kết nối Gmail thành công',
  `<h2>JobDesk đã gửi thư từ cloud</h2><p>Đây là thư kiểm tra kết nối Gmail sau khi triển khai. Máy tính cá nhân không cần bật để cloud quét và gửi việc mới.</p><p>Lịch kiểm tra: mỗi 2 giờ. Chỉ gửi thông báo khi có tin mới vượt bộ lọc; mỗi tin có đường link tuyển dụng gốc để xem và ứng tuyển.</p><p><a href="${escapeHtml(url)}">Mở JobDesk Cloud ↗</a></p><p>Đường dẫn: ${escapeHtml(url)}</p><p>Mã xem riêng nằm trong file view-access.txt trên máy của bạn. Thư này không chứa mã truy cập hay mật khẩu Gmail.</p>`);
 console.log('Cloud SMTP test email sent successfully.');
}
