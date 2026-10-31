# Thuật ngữ Riverbank

| Thuật ngữ | Nghĩa |
|---|---|
| Gap | Độ lớn đáy âm dòng tiền cơ sở, không âm thì bằng 0 |
| Payout cơ sở | Median lịch sử payout hợp lệ |
| Payout xấu | Phần nguyên payout cơ sở nhân stress_factor |
| NO_LOAN_NEEDED | Không thiếu vốn, bỏ PD/CIC/rule vay |
| AWAITING_STATEMENT | Chờ chứng từ theo R05 |
| PENDING_REVIEW | Chờ người ngân hàng quyết định |
| ESCALATED | Chuyển người xử lý, không phải từ chối |
| ACCEPTED / REJECTED | Quyết định của người ngân hàng |
| ACCEPT_PROPOSAL | Chấp nhận đề xuất |
| ACCEPT_COUNTER | Chấp nhận bộ điều kiện khác sau khi tính lại |
| ACTIVE / SUPERSEDED | Lifecycle version điều khoản cho mở rộng P7, chưa có trong database mini |
| SYSTEM_PROPOSED / HUMAN_MODIFIED / RESTRUCTURED_P7 | Nguồn version điều khoản mở rộng, không phải enum của schema mini |
| RESTRUCTURE_PROPOSED | Đề xuất cơ cấu, chưa thay lịch đang áp dụng |
| evidence_id | Định danh bằng chứng cụ thể |
| E4 / E5 / E6 / E6a / E7 / E8 | Feature / dòng tiền / PD / CIC / rule / sao kê |
| D09 / D10 / D22 | Tờ trình / giải thích seller / đề xuất cơ cấu |

Handoff có trạng thái riêng PENDING, SENDING, SUCCEEDED, FAILED, không đổi quyết định tín dụng.

Database mini dùng application_id UUID, applications.version_no cho khóa ghi và application_events cho audit. Tên HTTP case_id map tới application_id. Một seller record ứng với một external_shop_ref. Tiền cột SQL là NUMERIC(18,2)/Decimal, tiền JSONB là chuỗi decimal. Counter tạo run mới trước một quyết định cuối bất biến.
