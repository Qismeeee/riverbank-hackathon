# Kế hoạch kiểm thử và nghiệm thu

## Môi trường kiểm thử

Chạy các lệnh dưới đây từ gốc repository trong macOS hoặc WSL/Linux. BASE-01 cung cấp Makefile và smoke test môi trường; SRC-01 bổ sung source layer và test consent/scope offline; ENG-01 có test tính dòng tiền A/B/E ở cấp engine. Workflow và kiểm thử tích hợp chưa triển khai. Python 3.12, uv, make là phụ thuộc. Docker/Postgres chỉ cần cho đường tích hợp DB. Mỗi báo cáo nghiệm thu ghi rõ cấu hình, lệnh và kết quả chạy.

```bash
make setup
make test
```

`make setup` tạo môi trường và cài dependency/pre-commit. Không chạy lại nếu đã có môi trường phù hợp. `make test` dùng `uv run --locked` để chạy ruff check, format check và pytest. Các lệnh hướng dẫn theo shell POSIX; với Windows dùng WSL hoặc ghi rõ lệnh tương đương đã kiểm chứng.

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
| Danh tính OIDC | Cùng issuer/subject không trùng row; cùng subject khác issuer là hai danh tính; phân biệt hoa/thường, subject tối đa 255 ký tự; không nối bằng email |
| Quyền DB | Danh tính chưa provision/disable, role hoặc ownership seller thiếu/hết hạn/thu hồi không truy cập dữ liệu; role seller không tự cấp mọi shop |
| Seller và underwriter | Seller ở A không đọc seller-view của B hoặc ra quyết định; underwriter nền tảng đang có hiệu lực đọc queue/thẩm định/quyết định mà không cần grant shop; FK chặn actor quyết định dùng assignment seller |
| Thu hồi và audit quyền | Regrant role không hồi sinh scope cũ; quyết định tuần tự hóa với disable/revoke; audit chỉ thêm, actor người/hệ thống đúng và client không giả được |
| Thiếu consent | Không đọc dữ liệu sàn |
| Idempotency | Cùng key/body cùng kết quả, khác body có lỗi |
| Version cũ | Conflict, không ghi đè thao tác trước |
| Memo sai số/hash | Không phát hành memo hoặc ghi quyết định không hợp lệ |
| LOS lỗi/retry | Quyết định giữ nguyên, retry không tạo bàn giao trùng |
| Quyết định hết hạn | Handoff bị chặn, hướng dẫn tái thẩm định |
| CSV/PDF/ảnh | CSV parser, PDF chữ parser, scan/ảnh OCR có điều kiện và lỗi rõ |

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

Thiết kế auth tại `database/riverbank-mini.dbml` và `database/README.md` mới được kiểm tra ở mức schema; chưa chứng minh migration/transaction, provider hoặc phân quyền HTTP. Bổ sung kiểm thử các hàng auth ở TEST-01 sau khi có migration và adapter. Kiểm DBML/xuất SQL không được tính là kiểm thử tích hợp.
