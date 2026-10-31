# Chính sách tín dụng Riverbank

Ngưỡng được quản lý trong [parameters.yaml](parameters.yaml). Công thức và tiêu chí kiểm thử nằm trong [worked-examples.md](worked-examples.md). Đây là cấu hình demo cần ngân hàng xác nhận trước khi áp dụng vào sản phẩm thực.

## Quy trình policy

Sửa policy và tham số, sinh rule cùng test, chạy pytest rồi người có thẩm quyền xác nhận. Engine từ chối bộ rule chưa hoàn thành quy trình. Lưu version, hash và bằng chứng xác nhận. Đổi rule phải thẩm định lại hồ sơ trước quyết định khi kết quả không còn dùng policy hiệu lực.

## Rule

| Rule | Loại | Đạt khi |
|---|---|---|
| R01 | Cứng | Số tiền không vượt max_amount_vnd |
| R02 | Cứng | Tuổi shop đạt min_shop_age_months |
| R03 | Mềm | Tỷ lệ hoàn không vượt max_return_rate |
| R04 | Cứng | Kỳ hạn trong min_tenor_weeks đến max_tenor_weeks |
| R05 | Cứng | max(số xin, số đề xuất) không vượt doc_required_multiple × mức sàn, hoặc chứng từ đã xác minh |
| R06 | Cứng | Nhóm nợ CIC không vượt max_cic_group |
| R07 | Mềm | Dư nợ không vượt max_outstanding_to_monthly_payout × payout xấu × 4 |
| R08 | Cứng | Kỳ trích lớn nhất không vượt phần nguyên payout xấu × deduction_cap_of_stress_payout |
| R09 | Cứng | Khoản vay cá nhân không vượt e_lending_cap_vnd theo cấu hình demo |
| R10 | Cứng | PD không vượt max_pd_bps |

Thứ tự: R09, R01, R04, R08, R02, R03, R05, R06, R07, R10. Rule cứng thiếu dữ liệu phải được xử lý fail closed. Quy trình thay thế cho PD thiếu dữ liệu cần ngân hàng xác nhận riêng.

## Định tuyến

Gap bằng 0 dừng trước PD, CIC và rule vay. Có gap thì chấm PD, tra CIC có điều kiện qua adapter ngân hàng và chạy policy. Chỉ thiếu chứng từ R05 thì chờ sao kê. Hard fail hoặc sao kê lệch thì chuyển người. Rule mềm fail chỉ cảnh báo. Không tự duyệt hoặc tự từ chối.

Người ngân hàng quyết định, không ghi đè hard fail bằng ghi chú. Theo [database mini](../database/riverbank-mini.dbml), counter tạo assessment run mới và chạy lại lịch, PD, toàn bộ rule trước khi lưu một quyết định cuối bất biến. Không sửa run COMPLETED. Audit application_events chỉ thêm. Lifecycle điều khoản ACTIVE/SUPERSEDED thuộc mở rộng ngoài mini.

## Ranh giới pháp lý

Các ngưỡng demo không phải kết luận pháp lý. Ngân hàng/pháp chế xác nhận chủ thể vay, trần áp dụng, biểu phí, CIC và cách xử lý trích thiếu trước tích hợp thật.
