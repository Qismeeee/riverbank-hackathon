# Hướng dẫn phát triển Riverbank

Đọc [tài liệu sản phẩm](Agents/README.md) trước khi triển khai. Repo tổ chức theo BRD, SRS, SAD và kế hoạch trong Agents/NEXT_STEPS.md.

## Bất biến

- Chỉ người ngân hàng quyết định ACCEPTED, REJECTED hoặc duyệt RESTRUCTURED_P7.
- Code tính Gap, tiền, kỳ hạn, lịch trả, PD và pass/fail. LLM không tính hoặc sửa số.
- Gap bằng 0 không CIC, không PD, không rule vay.
- Dữ liệu sàn chỉ đọc khi có consent, hồ sơ đúng seller/shop.
- Che SĐT, CCCD và số tài khoản trước outbound. CSV qua parser Python.
- Memo có evidence và số khớp tuyệt đối, theo knowledge/guardrails.md.
- Đổi điều khoản INSERT version mới, bản trước SUPERSEDED, audit chỉ thêm.
- Policy/rule phải qua test và người xác nhận trước khi nạp.
- Không tự quyết định tín dụng, kết luận gian lận hoặc đưa thuộc tính nhạy cảm vào feature.
- LLM không viết hợp đồng, khế ước hoặc ủy nhiệm chi.

## Quy trình

Giữ thay đổi của người khác. Làm từng task có acceptance criteria. Thiết lập CI/test trong BASE-01, ghi rõ kiểm tra đã chạy. Không commit secrets hoặc raw PII. Không merge/deploy khi chưa được giao việc đó.
