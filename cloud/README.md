# JobDesk Cloud — triển khai miễn phí

Chạy tìm việc trên **GitHub Actions (Windows standard runner)** và xem kết quả qua **GitHub Pages**. Sau khi triển khai, không cần bật máy cá nhân. Thư Gmail có tiêu đề, công ty, điểm khớp, nút mở tin và đường link gốc dạng văn bản.

## Cách hoạt động

- GitHub Actions đọc cùng 10 nguồn và chạy cùng bộ lọc với ứng dụng local. Mỗi lượt vẫn chỉ đọc trang đầu, tối đa 30 tin/nguồn và chi tiết 10 tin có triển vọng.
- Lịch mặc định: phút 17 mỗi 2 giờ theo UTC, tương ứng khoảng **01:17, 03:17, …, 23:17 tại Việt Nam**. GitHub có thể chạy trễ, không bảo đảm đúng từng phút.
- Chỉ gửi tin mới đạt điểm tối thiểu; gửi thành công mới đánh dấu. Tin đã báo, đã ẩn hoặc đã ứng tuyển trong bản lưu cloud được giữ giữa các lượt.
- SQLite được chụp nhất quán rồi mã hóa AES-256-GCM trước khi lưu trong Actions cache và artifact. Không đưa SQLite hoặc `.env` gốc vào repo.
- Trang Pages là **trang xem kết quả**, không phải toàn bộ API của ứng dụng local. Dữ liệu được giải mã trong trình duyệt bằng mã xem riêng; không gửi mã đó lên máy chủ. Đóng/tải lại tab cần nhập lại mã. Bộ lọc cloud chỉnh bằng `JOBDESK_SETTINGS`; thay đổi trong local không tự đồng bộ.
- Nếu bản lưu cache bị mất, lượt chạy dừng gửi để tránh báo lặp. Phục hồi bản lưu mã hóa từ artifact trước khi chạy lại. Không tự reset lịch sử.

## Điều kiện miễn phí

Dùng repo **public** chỉ chứa mã nguồn đã loại dữ liệu riêng. GitHub miễn phí standard hosted runners cho repo public và hỗ trợ Pages trên GitHub Free. Không chọn larger runner, không bật dịch vụ trả phí. Private repo có quota riêng, Pages private cần gói phù hợp.

Scheduled workflows trong repo public có thể bị tắt sau 60 ngày không có hoạt động repo; cần kiểm tra Actions định kỳ và bật lại khi GitHub yêu cầu. Cache và artifact có thời hạn lưu; đây không phải cơ sở dữ liệu có SLA. SMTP có thể gặp giới hạn/đánh dấu Spam của Gmail; cần kiểm tra lần gửi đầu. Trang tuyển dụng có thể chặn IP cloud dù máy local đọc được; lỗi được hiển thị rõ trong nhật ký.

Nguồn: [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions), [Schedule events](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule), [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages).

## Triển khai

1. Tạo repo public riêng cho JobDesk. Chỉ tải mã nguồn trong bộ đóng gói đã kiểm tra; không tải cả thư mục CV hoặc thư mục cài đặt gốc.
2. Trong **Settings → Secrets and variables → Actions → New repository secret**, tạo 5 secrets:
   - `GMAIL_USER`: Gmail gửi thông báo.
   - `GMAIL_APP_PASSWORD`: mật khẩu ứng dụng Gmail gửi thư, không phải mật khẩu đăng nhập.
   - `JOBDESK_STATE_KEY`: khóa ngẫu nhiên 32 byte dạng base64, dùng mã hóa bản lưu.
   - `JOBDESK_VIEW_KEY`: khóa khác, cùng định dạng, dùng mở trang kết quả.
   - `JOBDESK_SETTINGS`: JSON bộ lọc hiện tại, gồm recipient và notifications. Giữ `intervalMinutes:120` để phù hợp lịch workflow. Lịch thực tế được quy định trong YAML, không phải giá trị này.
3. Nếu chuyển từ local, dùng snapshot mã hóa `cloud/seed.enc` và đúng `JOBDESK_STATE_KEY` để giữ lịch sử đã gửi. Chụp seed lần cuối ngay trước khi chuyển lịch sang cloud.
4. Trong **Settings → Pages → Build and deployment**, chọn **GitHub Actions**.
5. Vào **Actions → JobDesk Cloud → Run workflow**. Lần đầu bật **bootstrap**, giữ **dry_run** để kiểm tra nguồn và dựng trang, chưa gửi Gmail.
6. Kiểm tra workflow và trang Pages, mở kết quả bằng `JOBDESK_VIEW_KEY`. Chưa coi triển khai xong nếu runner hoặc Pages chưa báo thành công.
7. Khi lượt thử cloud thành công, tắt thông báo ở local, chụp lại seed nếu cần đồng bộ các thư vừa gửi, rồi chạy cloud không bật dry_run. Lịch kế tiếp tự gửi khi có việc mới đủ điều kiện. Không giữ cả hai lịch gửi cùng chạy.

Không đưa mật khẩu, khóa hoặc JSON bộ lọc vào workflow YAML, Git history, ảnh chụp màn hình, issue, hoặc URL. Mã xem cho phép đọc kết quả: chỉ chia sẻ cho người được phép xem.

## Phục hồi

Tải artifact `jobdesk-state-…` của lượt thành công mới nhất; ZIP chỉ có `state.enc` đã mã hóa. Khôi phục chính file này vào Actions cache có prefix `jobdesk-state-v1-`, hoặc thay `cloud/seed.enc` bằng file đó rồi chạy thủ công với bootstrap. Không tạo khóa lưu mới nếu vẫn cần mở dữ liệu cũ. Không bootstrap bằng seed cũ sau khi đã gửi nhiều thư: việc đó có thể làm báo lại các tin từ sau thời điểm seed.

Tắt lịch: **Actions → JobDesk Cloud → … → Disable workflow**. Đổi bộ lọc/địa chỉ nhận: sửa secret `JOBDESK_SETTINGS`, chạy lại workflow không bật bootstrap. Không cần sửa mã nguồn.

Nếu SMTP gửi thành công nhưng runner bị dừng trước khi lưu cache, lần kế tiếp có thể báo lặp một thư. Lịch sử gửi không thể bảo đảm giao dịch nguyên tử với máy chủ SMTP.
