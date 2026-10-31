# Kế hoạch kiểm thử và nghiệm thu

## Môi trường kiểm thử

Chuẩn hóa các lệnh dưới đây trong task BASE-01, rồi chạy từ gốc repository trong WSL/Linux. Bộ tài liệu không bao gồm backend, Makefile hoặc bộ test thực thi. Python 3.12, uv, make là phụ thuộc. Docker/Postgres chỉ cần cho đường tích hợp DB. Mỗi báo cáo nghiệm thu ghi rõ cấu hình, lệnh và kết quả chạy.

```bash
make setup
make test
```

`make setup` tạo môi trường và cài dependency/pre-commit. Không chạy lại nếu đã có môi trường phù hợp. `make test` gồm ruff check, format check và pytest. Với PowerShell, Makefile hiện dùng `.venv/bin` và cú pháp biến môi trường POSIX, nên chọn WSL hoặc ghi rõ lệnh tương đương, không giả định chạy nguyên bản được trên Windows.

## Ma trận nghiệm thu

| Kịch bản | Kết quả bắt buộc |
|---|---|
| A gap 0 | Không CIC, không PD, không policy vay, không quyết định cấp vay |
| B có gap | Đúng golden, chờ người duyệt, evidence đầy đủ |
| C vượt mức sàn | Chờ sao kê khi chỉ thiếu R05, lệch thì chuyển người |
| E hard fail | Chuyển người, ghi chú không bypass hard fail |
| R10 thiếu PD | Chuyển người và chặn chấp nhận khi policy chưa cho phép quy trình thay thế, phân biệt với PD vượt trần |
| F injection/PII | Chặn hoặc làm sạch theo đường vào, không lọt chữ gốc ra model |
| Counter | Lịch/PD/policy chạy lại, lịch sử cũ còn, số cuối từ engine |
| Seller khác | 403 scope, không lộ dữ liệu và evidence |
| Thiếu consent | Không đọc dữ liệu sàn |
| Idempotency | Cùng key/body cùng kết quả, khác body có lỗi |
| Version cũ | Conflict, không ghi đè thao tác trước |
| Memo sai số/hash | Không phát hành memo hoặc ghi quyết định không hợp lệ |
| LOS lỗi/retry | Quyết định giữ nguyên, retry không tạo bàn giao trùng |
| Quyết định hết hạn | Handoff bị chặn, hướng dẫn tái thẩm định |
| CSV/PDF/ảnh | CSV parser, PDF chữ parser, scan/ảnh OCR có điều kiện và lỗi rõ |

## Nghiệm thu database mini

Thiết kế ở [database/riverbank-mini.dbml](../database/riverbank-mini.dbml), hiện chưa có SQL migration để chạy. Các kiểm tra sau phải được xây trong DB-01, không phải kết quả đã chạy:

- Migration tạo đúng bảng/enum/FK/check của DBML, kiểm PostgreSQL thực và rollback.
- Consent thuộc đúng seller, purpose/expiry/revocation được service kiểm trước source fetch. Null expiry xử lý theo contract đã chốt.
- Evidence và generated document không tham chiếu run/application khác. Decision chỉ chọn run COMPLETED và document PASSED cùng application.
- Mỗi application tối đa một quyết định cuối. Hai người quyết định đồng thời không ghi trùng, version_no được kiểm/tăng cùng transaction và event.
- Plan bất biến sau submit, counter tạo run mới, run COMPLETED và decision không sửa/xóa. application_events append-only ở cả API lẫn DB.
- Tiền NUMERIC/Decimal và chuỗi tiền JSONB round-trip chính xác, canonical hash ổn định. Fixture A/B giữ số cũ, kiểm phần lẻ theo rule được chốt.
- Cùng request key/body tạo application/decision không sinh thêm side effect, khác body báo lỗi. Run key unique không thay thế kiểm HTTP idempotency.
- Handoff tạo cùng decision transaction, payload/key đóng băng, retry/recovery không gửi hai gói logic, LOS lỗi không đổi quyết định.
- Document upload dùng object key/version và content hash, không lưu presigned URL làm tham chiếu gốc. Quyền tải file được kiểm theo application.
- DRAFT/BLOCKED_INPUT/VERIFYING/WITHDRAWN và run FAILED tuân thủ transition matrix đã khóa, không tự cho phép chuyển chỉ vì enum có giá trị đó.

Mini không có bảng version điều khoản ACTIVE/SUPERSEDED. Chỉ kiểm lifecycle đó sau khi VER-01/P7 được yêu cầu mở rộng và có schema riêng.

## Tệp test theo mảng

- Engine/policy: `api/tests/test_cashflow.py`, `test_rules.py`, `test_golden.py`.
- Workflow/permission: `test_underwriting.py`, `test_auth.py`, `test_underwriting_shopee.py`.
- AI/evidence: `test_copilot.py`, `test_memo.py`, `test_statements.py`, `test_underwriting_gates.py`.
- PD: `test_features.py`, `test_risk.py`, `test_underwriting_risk.py`.
- DB: `test_underwriting_postgres.py`, kiểm tra điều kiện skip trước khi kết luận persistence đạt.

Sau thay engine/rule, đối chiếu `policy/worked-examples.md`, parameter parity và golden qua service thật. Chỉ cập nhật golden khi hành vi mới được chốt, không sửa expected để che regression. `make eval-report` ghi lại báo cáo Studio nên chạy khi task cần cập nhật artifact đó.

## Điều kiện hoàn thành task

Acceptance criteria của task đạt, kiểm tra phù hợp rủi ro, `make test` đạt trước PR, các skip được giải thích và không còn diff ngoài phạm vi. Cập nhật contract/docs nếu thay hành vi. Task mới liên quan policy approval, versioning hoặc P7 cần test mới cho bất biến tương ứng, không chỉ chứng minh happy path.

NFR latency/cost đo riêng có timestamp, cấu hình model, số case và percentile/trung bình. Không dùng thời gian pytest offline để suy ra SLA online.

Nghiệm thu phải phân biệt kiểm tra tài liệu, test backend offline, test tích hợp và kiểm tra môi trường triển khai.
