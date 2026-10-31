# Yêu cầu nghiệp vụ Riverbank

Nguồn chi tiết: [BRD gốc](BRD.md). Mã BR và BL được dùng để truy vết nghiệp vụ sang yêu cầu phần mềm. Các quyết định cần chốt nằm tại [GAPS.md](GAPS.md).

## Bài toán và giá trị

Seller phải trả xưởng trước khi nhận payout nên có thể thiếu vốn dù bán tốt. Riverbank xác định có thiếu tiền không, thiếu bao nhiêu, thiếu trong bao lâu và lịch trích payout có đáp ứng được không. Đầu ra là hồ sơ thẩm định có thể kiểm chứng để nhân sự ngân hàng quyết định.

| Bên liên quan | Nhu cầu | Trách nhiệm |
|---|---|---|
| Seller | Kế hoạch vốn dễ hiểu và đúng dòng tiền | Khai kế hoạch, consent, bổ sung chứng từ |
| Thẩm định viên | Memo, bằng chứng, rule và lịch sử | Xác minh, chấp nhận hoặc từ chối |
| Ngân hàng | Đúng policy, thẩm quyền và audit | Ban hành policy, chịu trách nhiệm tín dụng và vận hành tiền |
| Shopee/nguồn seller | Dữ liệu dùng đúng mục đích | Cấp dữ liệu theo quyền/consent và khả năng tích hợp |
| Team dev/QA | Contract rõ, fixture tái lập | Xây dựng, kiểm thử, ghi rõ mô phỏng |

## Mục tiêu nghiệm thu

| Mục tiêu | Điều kiện |
|---|---|
| Không tạo nhu cầu vay giả | Case không có tuần âm trả `NO_LOAN_NEEDED` |
| Đề xuất theo nhu cầu thực | Tiền/kỳ hạn từ CashFlowEngine, không gán số seller xin |
| Hồ sơ kiểm toán được | Mọi câu có số trỏ evidence, sai lệch 0 đồng |
| Chứng từ theo điều kiện | R05 quyết định cần sao kê theo ngưỡng policy |
| Người quyết định | Mọi chấp nhận/từ chối có actor ngân hàng và audit |

## Phạm vi lõi

BR-01 đến BR-07: nhận kế hoạch một lô, chặn đầu vào, kiểm consent, lấy payout đúng seller, tính dòng tiền và nhánh không vay.

BR-08 đến BR-15 và BR-21: đề xuất tiền/kỳ hạn, giới hạn kỳ trích, PD, CIC có điều kiện, policy và đối chiếu sao kê.

BR-16 đến BR-20: memo và bản seller cùng evidence, người duyệt, đóng gói bàn giao và nhật ký.

P0 định danh thực, P4 hợp đồng, P5 giải ngân, P6 trích tiền, P8 xử lý khoản vay thuộc tích hợp ngân hàng, ngoài phạm vi lõi. P7 là mở rộng đề xuất cơ cấu có người duyệt. Không xây cơ chế tự giải ngân hoặc tự quyết định tín dụng.

## Điều kiện và quyết định cần chốt

Lãi, phí và tổng phải trả chỉ được công bố khi có biểu phí ngân hàng. Chưa có thì hiển thị tình trạng chưa có dữ liệu, không suy ra lãi bằng model.

Ngân hàng/pháp chế cần chốt loại chủ thể vay, hạn mức theo lô hay quay vòng, phạm vi áp dụng trần vay điện tử, biểu phí, hiệu lực CIC, lưu trữ chứng từ và cách xử lý trích thiếu. Các trần trong repo là cấu hình demo, không phải kết luận pháp lý cập nhật.

Product cần chốt xử lý doanh thu ngoài sàn của case D. Payout sàn khớp không tự chứng minh nguồn thu ngoài sàn. Ưu tiên hoàn thành luồng A/B/C/E/F trước mở rộng P7.
