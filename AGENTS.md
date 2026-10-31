# Hướng dẫn phát triển Riverbank

Đọc [tài liệu sản phẩm](Agents/README.md) trước khi triển khai. Repo tổ chức theo BRD, SRS, SAD và kế hoạch trong Agents/NEXT_STEPS.md.

## Bất biến

- Chỉ người ngân hàng quyết định ACCEPTED, REJECTED hoặc duyệt RESTRUCTURED_P7.
- Code tính Gap, tiền, kỳ hạn, lịch trả, PD và pass/fail. LLM không tính hoặc sửa số.
- Gap bằng 0 không CIC, không PD, không rule vay.
- Dữ liệu sàn chỉ đọc khi có consent, hồ sơ đúng seller/shop.
- Đăng nhập dùng OpenID Connect trên OAuth 2.0; API xác thực access token và kiểm quyền phía server. Seller là người vay, giới hạn theo ownership seller/shop; underwriter là người ngân hàng trên lending platform một ngân hàng, dùng role nền tảng và không cần membership/grant shop. OAuth consent đăng nhập không thay consent đọc dữ liệu sàn.
- Che SĐT, CCCD và số tài khoản trước outbound. CSV qua parser Python.
- Memo có evidence và số khớp tuyệt đối, theo knowledge/guardrails.md.
- Đổi điều khoản INSERT version mới, bản trước SUPERSEDED, audit chỉ thêm.
- Policy/rule phải qua test và người xác nhận trước khi nạp.
- Không tự quyết định tín dụng, kết luận gian lận hoặc đưa thuộc tính nhạy cảm vào feature.
- LLM không viết hợp đồng, khế ước hoặc ủy nhiệm chi.

## Quy trình

Giữ thay đổi của người khác. Làm từng task có acceptance criteria. Thiết lập CI/test trong BASE-01, ghi rõ kiểm tra đã chạy. Không commit secrets hoặc raw PII. Không merge/deploy khi chưa được giao việc đó.

## Phiên làm việc theo task

- Mỗi task lớn trong `tasklist.json` được thực hiện trong một phiên Codex mới; không bắt đầu task lớn tiếp theo trong cùng phiên. Nếu không thể tự mở phiên mới, bàn giao task tiếp theo để người dùng mở phiên mới.
- Trong mỗi phiên, trước khi triển khai task hoặc subtask, đọc các AGENTS.md có hiệu lực, mục task trong `tasklist.json`, các tài liệu được liệt kê tại `documents` và các chỉ dẫn liên quan; kiểm tra working tree và giữ thay đổi có sẵn.
- Cập nhật tiến độ, phần còn thiếu và handoff sau task. Theo yêu cầu hiện tại, để kiểm thử mới đến giai đoạn cuối; ngoại lệ bắt buộc là policy/rule phải được test và người có thẩm quyền xác nhận trước khi nạp. Không đánh dấu hoàn thành hoặc sẵn sàng PR khi chưa đạt kiểm thử bắt buộc.
