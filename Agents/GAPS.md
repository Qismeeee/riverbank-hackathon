# Các quyết định nghiệp vụ và thiết kế

Các quyết định dưới đây cần được chốt trước khi triển khai chức năng phụ thuộc. Mỗi quyết định phải có người chịu trách nhiệm, kết luận và tiêu chí nghiệm thu liên quan.

## Database mini đã chốt

Người dùng chọn [database/riverbank-mini.dbml](../database/riverbank-mini.dbml). Một shop/seller record, một hồ sơ/lô, một quyết định cuối/application, tiền NUMERIC(18,2)/Decimal và chuỗi decimal trong JSONB. applications/version_no/application_events thay các tên cũ. Counter tạo run mới, version ACTIVE/SUPERSEDED và P7 nằm ngoài mini. DBML được giữ nguyên, chưa phải migration.

## Quyết định còn mở

| Chủ đề | Câu hỏi cần chốt | Vai trò phụ trách | Ảnh hưởng |
|---|---|---|---|
| Chủ thể vay | Cá nhân hay hộ kinh doanh? | Ngân hàng và pháp chế | Hồ sơ, policy và áp dụng trần vay điện tử |
| Hạn mức | Mini theo lô đã chốt, ngân hàng xác nhận giới hạn/tổng dư nợ áp dụng ra sao? | Product và ngân hàng | Policy, không thêm hạn mức quay vòng vào mini |
| Lãi và phí | Công thức, biểu phí và thời điểm công bố? | Ngân hàng | Giải thích seller và gói bàn giao |
| CIC | Hiệu lực kết quả, consent và adapter tra cứu? | Ngân hàng và backend | Tái thẩm định và evidence |
| Thiếu PD | Có quy trình xác minh thủ công riêng không? | Ngân hàng và rủi ro | Mặc định chuyển người, chặn chấp nhận khi rule cứng chưa đạt. Ngoại lệ cần policy được xác nhận |
| Policy approval | Ai xác nhận bộ rule và bằng chứng xác nhận gồm gì? | Ngân hàng và tech lead | Loader chỉ nạp bộ đã test và xác nhận |
| Version điều khoản mở rộng | Nếu triển khai P7 sau mini, định danh/kích hoạt/thay thế ra sao? | Backend và đầu mối LOS | Cần schema riêng, không áp đặt loan_terms_versions vào mini |
| Tiền | Cho phép phần lẻ VND ở HTTP hay chỉ số nguyên? Lịch trích chia theo đơn vị nào? | Product và backend | NUMERIC(18,2) không tự quyết định rule làm tròn, giữ fixture A/B |
| Idempotency | Lưu request key/hash tạo application và decision ở đâu, scope thế nào? | Backend | DBML chỉ có key của run/handoff, chưa đủ chống trùng HTTP |
| Handoff claim | Khóa/lease/recovery thế nào khi worker/request crash? | Backend | Chưa có lease trong DBML, vẫn có handoff.lease_seconds ở policy config |
| Hiệu lực quyết định | Khóa config validity_days nào cho decision cũ? | Product và backend | DBML có decided_at, không có expires_at, không để config mới đổi hạn cũ |
| Trạng thái | Quyền rút hồ sơ, BLOCKED_INPUT lưu khi nào, VERIFYING và retry run ra sao? | Product và backend | Enum không tự xác định transition matrix |
| Snapshot JSON | Schema CIC, feature/payout, canonical JSON/hash, citation_map và lỗi thiếu dữ liệu? | Data và backend | DBML mô tả contract nhưng chưa đủ typed schema |
| Case D | Xác minh doanh thu ngoài sàn bằng nguồn nào? | Nghiệp vụ và rủi ro | Khớp payout sàn không chứng minh thu ngoài sàn |
| Trích thiếu | Thời gian xử lý, quá hạn và điều kiện đề xuất cơ cấu? | Ngân hàng và rủi ro | P7/P8 và tích hợp core |
| Chứng từ | Lưu file gốc ở đâu, ai đọc, trong bao lâu? | Ngân hàng và pháp chế | Object storage, quyền đọc và retention |
| Dữ liệu seller | Seller export hay OpenAPI có ủy quyền? | Đầu mối dữ liệu | Adapter, provenance và consent |
| Frontend | Vị trí package, môi trường API và auth? | Frontend và tech lead | Luồng seller, lender và studio |

## Nguyên tắc giải quyết

Không suy ra policy từ ví dụ minh họa. Ghi chú xác minh không tự ghi đè rule cứng. Trong mini, đổi điều kiện trước quyết định tạo run mới, tính lại phần tính/policy liên quan. Không sửa quyết định cuối hoặc thêm lifecycle P7 vào schema mini khi chưa có thiết kế mở rộng.

Kết luận phải được phản ánh vào BRD, SRS, SAD hoặc policy tương ứng. Công việc triển khai được theo dõi trong [NEXT_STEPS.md](NEXT_STEPS.md).
