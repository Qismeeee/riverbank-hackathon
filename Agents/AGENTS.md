# Hướng dẫn Codex tiếp nhận Riverbank

Đọc `../AGENTS.md` và các chỉ dẫn cấp trên trước khi sửa repo. File này áp dụng trong `Agents/` và là điểm vào tài liệu sản phẩm, không thay thế chỉ dẫn cấp trên.

## Bất biến phải giữ

- Chỉ nhân sự ngân hàng quyết định `ACCEPTED`, `REJECTED` hoặc duyệt version `RESTRUCTURED_P7`. Không tự duyệt, tự từ chối, tự giãn nợ.
- Gap, tiền VND, kỳ hạn, lịch trích, PD và pass/fail rule do code tính. Tiền theo DBML mini: NUMERIC(18,2), Decimal và chuỗi decimal trong JSONB, không float. LLM chỉ trích dữ kiện hoặc viết trên số đã khóa.
- Gap bằng 0 thì không CIC, không PD, không rule vay. Bỏ qua toàn bộ R01 đến R10.
- Chưa consent thì không đọc dữ liệu sàn. Mọi snapshot, CIC, evidence và quyền truy cập phải đúng seller/shop.
- Che SĐT, CCCD và tài khoản trước khi chữ tự do ra khỏi server. CSV dùng parser Python. PDF có chữ ưu tiên parser, ảnh/scan mới OCR.
- Tờ trình chính thức có evidence hợp lệ và số khớp tuyệt đối. Theo danh sách từ cấm tại `../knowledge/guardrails.md`.
- Theo schema mini người dùng đã chọn, counter tạo assessment run mới, không sửa run đã hoàn thành. Mỗi application chỉ có một quyết định cuối bất biến. `application_events` chỉ thêm. Lifecycle ACTIVE/SUPERSEDED chỉ thuộc mở rộng P7, chưa có bảng trong mini.
- LLM không viết hợp đồng, khế ước hay ủy nhiệm chi. Không kết luận gian lận hoặc dùng thuộc tính nhạy cảm làm feature.
- Đổi policy phải có policy văn bản, tham số, rule, test và xác nhận của người theo chỉ dẫn cấp trên. Engine phải từ chối nạp bộ chưa đáp ứng quy trình này.

## Cách làm việc

1. Đọc `README.md`, `CONTEXT.md`, `GAPS.md`, rồi chọn một task trong `NEXT_STEPS.md`.
2. Kiểm tra working tree, giữ thay đổi sẵn có. Tìm implementation và test trước khi sửa.
3. Kiểm tra các skill có sẵn và dùng skill đúng phạm vi công việc.
4. PR nhỏ, mô tả yêu cầu, thay đổi và kiểm thử. Chỉ xác nhận code sẵn sàng PR khi `make test` đạt theo quy ước repo.
5. Ghi chính xác lệnh, môi trường, số pass/skip/fail. Kết quả phải đến từ lần chạy kiểm thử của task.
6. Cập nhật tài liệu liên quan và acceptance criteria. Không đưa secrets vào code, log hoặc bàn giao.

Thiết lập CI/deploy trong công việc hạ tầng, tách rõ quyền merge và quyền triển khai. Tài liệu sản phẩm và backlog không tự cấp quyền merge, deploy hoặc gọi dịch vụ thật.
