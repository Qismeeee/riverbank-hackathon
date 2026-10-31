# Guardrail Riverbank

## Đầu vào

Che SĐT, CCCD và số tài khoản trước mọi outbound model call. Chặn injection, yêu cầu ép duyệt và thuộc tính nhạy cảm theo ngưỡng `guardrail.block_probability` trong parameters. Model lỗi không cho dữ liệu nguy hiểm đi tiếp. Dữ liệu sàn cần consent và đúng seller/shop.

CSV dùng parser Python. PDF có chữ ưu tiên parser, ảnh/scan mới dùng OCR. Model chỉ bóc dòng, Jev phân loại và Python cộng tổng.

## Đầu ra

Tờ trình chính thức có evidence_id hợp lệ, claims đúng payload và số trong câu khớp tuyệt đối. Sai lệch dù 1 đồng phải fail. Không phát hành bản thảo chưa validate. Memo dùng số đã khóa, không thay policy hoặc trạng thái.

Từ cấm trong văn bản phát hành: `gian lận`, `lừa đảo`, `giả mạo`, `chiếm đoạt`, `fraud`, `scam`. Dùng “không khớp” và “cần xác minh”.

Không tự thêm lãi, phí hoặc tổng phải trả khi chưa có biểu phí ngân hàng. Seller không nhận PD/CIC nội bộ. LLM không viết hợp đồng, khế ước hoặc ủy nhiệm chi.

Số lần thử tối đa lấy từ `memo.max_attempts`. Không đạt thì ESCALATED và đánh dấu bản thảo, không tự quyết định tín dụng.
