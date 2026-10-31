# Hướng dẫn làm việc cho teammate và Codex

Mở toàn bộ repository trong Codex, đọc tài liệu theo thứ tự trong README rồi chọn công việc trong NEXT_STEPS. Cấu hình môi trường theo hướng dẫn repo và không đưa credentials vào source.

## Prompt tiếp nhận

```text
Bạn đang phát triển Riverbank, sản phẩm thẩm định vốn lưu động theo payout seller Shopee.
Đọc các AGENTS.md có hiệu lực, rồi Agents/README.md và CONTEXT.md.
Đọc BRD, BUSINESS, SRS, SAD, DATA, API, GAPS và TEST_PLAN trong Agents/.
Dùng NEXT_STEPS để xác định dependency và acceptance criteria.
Kiểm tra môi trường, cấu trúc repo và thay đổi sẵn có trước khi sửa.
Giữ người ngân hàng quyết định, code tính số, gap 0 bỏ CIC/PD/rule vay,
consent và scope đúng seller, PII được che trước outbound.
Memo phải đúng evidence, điều khoản thêm version mới, audit chỉ thêm.
```

## Prompt triển khai một task

```text
Thực hiện task [TASK_ID] trong Agents/NEXT_STEPS.md đến khi đạt acceptance criteria.
Đọc AGENTS.md và kiểm tra skill có sẵn đúng phạm vi trước khi sửa.
Dùng SRS để xác định hành vi, SAD/API/DATA để triển khai contract.
Giữ thay đổi sẵn có của người khác, chia công việc thành thay đổi nhỏ có thể review.
Triển khai và kiểm thử phù hợp, chạy make test trước khi báo sẵn sàng PR.
Nếu thiếu môi trường hoặc quyết định nghiệp vụ, nêu rõ phần bị phụ thuộc.
Cập nhật tài liệu liên quan, báo file đổi, hành vi mới và kết quả kiểm thử.
Không tự merge, deploy hoặc gửi dữ liệu thật ra dịch vụ ngoài.
```

## Báo cáo hoàn thành

Ghi task, acceptance đã đạt, file chính, lệnh và kết quả kiểm thử, phần skip/blocker, thay đổi schema/contract và bước tiếp theo. Nếu công việc chưa xong, nêu điểm dừng và cách tiếp tục. Không ghi token, khóa hoặc raw PII.
