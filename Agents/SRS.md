# Đặc tả yêu cầu phần mềm

Bảng này giữ nhóm ID để teammate truy vết, không đánh lại FR. Database mini theo [DBML do người dùng chọn](../database/riverbank-mini.dbml) và [DATA](DATA.md). Các đường dẫn implementation/test dưới đây là vị trí dự kiến, chưa có code thực thi.

## Yêu cầu và truy vết triển khai

Đường dẫn trong bảng tính từ gốc repo và xác định vị trí tổ chức triển khai, kiểm thử. Mỗi nhóm FR phải được nghiệm thu bằng hành vi quan sát được.

| Yêu cầu | Nghiệm thu | Implementation | Test liên quan |
|---|---|---|---|
| FR-01..04 nhận kế hoạch | Đủ trường, tổng lịch bằng lô, trần hợp lệ, chặn ghi chú độc hại | `api/services/underwriting/models.py`, `service.py` | `api/tests/test_underwriting.py`, `test_copilot.py` |
| FR-05..07 dữ liệu | Đúng seller/shop, có consent, snapshot/hash truy được | `api/services/underwriting/sources.py`, `shopee_features.py` | `api/tests/test_underwriting_shopee.py` |
| FR-08..15 dòng tiền | Hai bảng tuần, gap/tiền/lịch tái lập, gap 0 không chạy nhánh vay | `api/services/cashflow.py`, `underwriting/service.py` | `api/tests/test_cashflow.py`, `test_golden.py` |
| FR-16, FR-16b PD và CIC | PD/factors hợp lệ hoặc chuyển người, CIC chỉ có gap | `api/services/underwriting/risk.py`, `gates.py` | `api/tests/test_underwriting_risk.py`, `test_underwriting_gates.py` |
| FR-17..20 policy | R01..R10 có evidence, cứng fail chặn chấp nhận | `api/policy/`, `api/services/underwriting/service.py` | `api/tests/test_rules.py`, `test_underwriting.py` |
| FR-18 policy được xác nhận | Chỉ nạp policy đã test và người xác nhận | Loader kiểm hash, kiểm thử và xác nhận của người | Task POL-01 và test loader |
| FR-21..23 sao kê | Đúng điều kiện R05, đối chiếu cùng kỳ, lệch chuyển người | `api/services/statements/`, `underwriting/service.py` | `api/tests/test_statements.py` |
| FR-24..28 văn bản | Hai bản cùng evidence, không số mới, không lãi/phí tự tạo | `api/services/underwriting/memo.py`, `api/services/guard.py` | `api/tests/test_memo.py` |
| FR-29..31 hàng đợi/quyết định | Đúng role, ngân hàng quyết định và có actor | `api/routers/underwriting.py`, `api/routers/auth.py` | `api/tests/test_auth.py`, `test_underwriting.py` |
| FR-31b hết hiệu lực | Chặn handoff quá hạn, đích đến cần thẩm định lại | `api/services/underwriting/service.py` và luồng tái thẩm định | `api/tests/test_underwriting.py`, task EXP-01 |
| FR-32..34 sửa điều kiện | Tính lại PD/rule/lịch, không chấp nhận gap 0 hoặc hard fail | `api/services/underwriting/service.py` | `api/tests/test_underwriting.py`, `test_underwriting_risk.py` |
| FR-35..37 bàn giao | Gói đúng quyết định, retry không mất quyết định, không gọi tiền core | `api/services/underwriting/service.py`, `sources.py` | `api/tests/test_underwriting.py` |
| FR-38 audit | application_events chỉ thêm, có actor/time/evidence, commit cùng thay đổi hồ sơ | Repository và migration sẽ sinh từ `database/riverbank-mini.dbml` | `api/tests/test_underwriting_postgres.py` |

## Yêu cầu bổ sung từ chỉ dẫn dự án

Thiếu PD phải chuyển người. Quy trình xác minh thủ công thay thế, nếu có, phải được ngân hàng xác nhận trong policy trước khi triển khai. Xem quyết định cần chốt tại GAPS.

Theo schema mini người dùng chọn, mỗi application chỉ có một quyết định cuối bất biến. Trước quyết định, counter tạo assessment run mới, tính lại lịch/PD/policy và không sửa run đã COMPLETED. Điều kiện cuối lưu trong decisions.final_cashflow_result và các cột final_amount/final_tenor_weeks. Không tạo bảng version điều khoản riêng hoặc ACTIVE/SUPERSEDED trong mini. P7 cần schema mở rộng riêng.

applications.version_no dùng khóa ghi, khác run_no. Public case_id ánh xạ application_id. Kế hoạch bất biến sau submit, kế hoạch mới cần application mới. Mỗi seller UUID ứng với một external_shop_ref. Tiền NUMERIC(18,2)/Decimal, JSONB dùng chuỗi decimal, định dạng tiền HTTP và phần lẻ VND còn cần khóa trước engine.

Enum DBML có DRAFT/BLOCKED_INPUT/ANALYZING/VERIFYING/WITHDRAWN. Chưa có bảng chuyển state đầy đủ nên không tự suy ra quyền thao tác từ enum. Gap 0 vẫn không được cấp vay. Accept chỉ dùng run COMPLETED và generated document PASSED cùng application, không có ANALYZING → ACCEPTED.

Chữ tự do phải được che PII tại server trước mọi outbound model call. Kiểm tra riêng đường tạo case và Copilot vì hành vi chặn/làm sạch khác nhau. CSV không đi vision. Chấm phân loại sao kê qua Jev, tổng tiền bằng Python.

## Phi chức năng

NFR-01 và NFR-06: mục tiêu dưới 90 giây và dưới 0,10 USD/hồ sơ demo. Cần đo theo cấu hình model thực, gồm timeout/retry/fallback. Báo cáo nghiệm thu phải kèm dữ liệu đo.

NFR-02: kết quả deterministic của phần tính phải khớp tuyệt đối. NFR-03: 100% câu có số trong memo chính thức có evidence và sai lệch 0 đồng. NFR-04: thuộc tính nhạy cảm không vào feature/memo. NFR-05: người dùng thường không sửa/xóa audit.

Auth phải tách seller/underwriter, seller không đọc hồ sơ người khác hoặc evidence nội bộ. Chống ghi trùng bằng idempotency và chống mất cập nhật bằng expected version. Không làm mất quyết định khi LOS lỗi.
