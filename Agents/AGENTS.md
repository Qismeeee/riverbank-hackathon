# Hướng dẫn Codex tiếp nhận Riverbank

Đọc `../AGENTS.md` và các chỉ dẫn cấp trên trước khi sửa repo. File này áp dụng trong `Agents/` và là điểm vào tài liệu sản phẩm, không thay thế chỉ dẫn cấp trên.

## Bất biến phải giữ

- Chỉ nhân sự ngân hàng quyết định `ACCEPTED`, `REJECTED` hoặc duyệt version `RESTRUCTURED_P7`. Không tự duyệt, tự từ chối, tự giãn nợ.
- Gap, tiền VND, kỳ hạn, lịch trích, PD và pass/fail rule do code tính. Tiền dùng `int`. D09/D10 do code viết từ evidence và semantic frame, không gọi LLM.
- Gap bằng 0 thì không CIC, không PD, không rule vay. Bỏ qua toàn bộ R01 đến R10.
- Chưa consent thì không đọc dữ liệu sàn. Mọi snapshot, CIC, evidence và quyền truy cập phải đúng seller/shop.
- Che SĐT, CCCD và tài khoản trước khi chữ tự do ra khỏi server. CSV dùng parser Python. PDF có chữ ưu tiên parser, ảnh/scan mới OCR.
- Tờ trình chính thức có evidence hợp lệ và số khớp tuyệt đối. Theo danh sách từ cấm tại `../knowledge/guardrails.md`.
- Đổi tiền, kỳ hạn hoặc lịch trả phải thêm version, bản trước thành `SUPERSEDED`. `case_events` chỉ thêm.
- LLM không viết hợp đồng, khế ước hay ủy nhiệm chi. Không kết luận gian lận hoặc dùng thuộc tính nhạy cảm làm feature.
- External model call phải qua ModelGate. Kafka không nằm trên request critical path; case event ghi outbox cùng transaction và consumer deduplicate theo `event_id`.
- Đổi policy phải có policy văn bản, tham số, rule, test và xác nhận của người theo chỉ dẫn cấp trên. Engine phải từ chối nạp bộ chưa đáp ứng quy trình này.

## Cách làm việc

1. Đọc `README.md`, `CONTEXT.md`, `GAPS.md`, rồi chọn một task trong `NEXT_STEPS.md`.
2. Kiểm tra working tree, giữ thay đổi sẵn có. Tìm implementation và test trước khi sửa.
3. Kiểm tra các skill có sẵn và dùng skill đúng phạm vi công việc.
4. PR nhỏ, mô tả yêu cầu, thay đổi và kiểm thử. Chỉ xác nhận code sẵn sàng PR khi `make test` đạt theo quy ước repo.
5. Ghi chính xác lệnh, môi trường, số pass/skip/fail. Kết quả phải đến từ lần chạy kiểm thử của task.
6. Cập nhật tài liệu liên quan và acceptance criteria. Không đưa secrets vào code, log hoặc bàn giao.

Thiết lập CI/deploy trong công việc hạ tầng, tách rõ quyền merge và quyền triển khai. Tài liệu sản phẩm và backlog không tự cấp quyền merge, deploy hoặc gọi dịch vụ thật.

Runtime model allowlist mặc định: `copilot-extract`, `copilot-qa`, `statement-ocr`, `monitor-proposal` khi P7 được bật, và các task Jev đã nêu trong `../knowledge/README.md`. `data-analyst` và `policy-explainer` không được nạp runtime nếu chưa có phê duyệt mở rộng.
