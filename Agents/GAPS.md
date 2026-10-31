# Các quyết định nghiệp vụ và thiết kế

Các quyết định dưới đây cần được chốt trước khi triển khai chức năng phụ thuộc. Mỗi quyết định phải có người chịu trách nhiệm, kết luận và tiêu chí nghiệm thu liên quan.

| Chủ đề | Câu hỏi cần chốt | Vai trò phụ trách | Ảnh hưởng |
|---|---|---|---|
| Chủ thể vay | Cá nhân hay hộ kinh doanh? | Ngân hàng và pháp chế | Hồ sơ, policy và áp dụng trần vay điện tử |
| Hạn mức | Theo từng lô hay quay vòng? | Product và ngân hàng | Lifecycle hồ sơ và điều khoản |
| Lãi và phí | Công thức, biểu phí và thời điểm công bố? | Ngân hàng | Giải thích seller và gói bàn giao |
| CIC | Hiệu lực kết quả, consent và adapter tra cứu? | Ngân hàng và backend | Tái thẩm định và evidence |
| Thiếu PD | Có quy trình xác minh thủ công riêng không? | Ngân hàng và rủi ro | Mặc định chuyển người, chặn chấp nhận khi rule cứng chưa đạt. Ngoại lệ cần policy được xác nhận |
| Policy approval | Ai xác nhận bộ rule và bằng chứng xác nhận gồm gì? | Ngân hàng và tech lead | Loader chỉ nạp bộ đã test và xác nhận |
| Version điều khoản | Định danh, kích hoạt, thay thế version thế nào? | Backend và đầu mối LOS | INSERT bản mới, bản trước SUPERSEDED |
| Case D | Xác minh doanh thu ngoài sàn bằng nguồn nào? | Nghiệp vụ và rủi ro | Khớp payout sàn không chứng minh thu ngoài sàn |
| Trích thiếu | Thời gian xử lý, quá hạn và điều kiện đề xuất cơ cấu? | Ngân hàng và rủi ro | P7/P8 và tích hợp core |
| Chứng từ | Lưu file gốc ở đâu, ai đọc, trong bao lâu? | Ngân hàng và pháp chế | Object storage, quyền đọc và retention |
| Dữ liệu seller | Seller export hay OpenAPI có ủy quyền? | Đầu mối dữ liệu | Adapter, provenance và consent |
| Frontend | Vị trí package, môi trường API và auth? | Frontend và tech lead | Luồng seller, lender và studio |

## Nguyên tắc giải quyết

Không suy ra policy từ ví dụ minh họa. Ghi chú xác minh không tự ghi đè rule cứng. Đổi tiền, thời hạn hoặc lịch trả phải tạo version điều khoản mới và chạy lại phần tính/policy liên quan.

Kết luận phải được phản ánh vào BRD, SRS, SAD hoặc policy tương ứng. Công việc triển khai được theo dõi trong [NEXT_STEPS.md](NEXT_STEPS.md).
