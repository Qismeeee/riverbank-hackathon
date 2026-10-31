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
| C trước/sau sao kê | Trước: CIC `deferred_until_statement`; sau: gate/CIC chỉ chạy một lần và policy được đánh giá lại |
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
| Job sao kê | `202` có Location, lease hết hạn nhận lại, 5xx retry, 4xx dừng, không tạo E8 trùng |
| Event outbox | Rollback không publish, Kafka down để pending, retry có thể duplicate và consumer deduplicate |
| ModelGate | Cap song song/rate/circuit đúng provider, token lease an toàn, Memory/Valkey parity, store lỗi fail open |
| Named users | Subject lạ/role sai bị 401, seller không mạo danh seller_id, actor audit đúng |
| Code memo | Chủ thể, quan hệ, vai trò số, đơn vị và evidence khớp; không có model call |

## Tệp test theo mảng

- Engine/policy: `api/tests/test_cashflow.py`, `test_rules.py`, `test_golden.py`.
- Workflow/permission: `test_underwriting.py`, `test_auth.py`, `test_underwriting_shopee.py`.
- AI/evidence: `test_copilot.py`, `test_memo.py`, `test_statements.py`, `test_underwriting_gates.py`, `test_modelgate.py`.
- Hạ tầng workflow: `test_jobs.py`, `test_events.py`, test consumer idempotency và named directory.
- PD: `test_features.py`, `test_risk.py`, `test_underwriting_risk.py`.
- DB: `test_underwriting_postgres.py`, kiểm tra điều kiện skip trước khi kết luận persistence đạt.

## Copilot extract-plan

Bộ ca EP phải khóa ít nhất: FX-B sẵn sàng; cọc 50% tuần 0/trả nốt tuần 4; thiếu giá trị lô; số viết bằng chữ không được model tự tạo; phân biệt `150tr` với 150 tuần; lịch không cân; tuần chi vượt `sell_weeks`; requested amount vượt trần nhưng không bị hạ số; PII được che; injection/thuộc tính nhạy cảm bị chặn; seller/role sai bị 403; message rỗng hoặc quá dài bị 422.

Giá trị tiền khác `null` phải có trong `sanitized_message` sau chuẩn hóa đơn vị. `ready=true` chỉ khi đủ năm trường và `issues` rỗng. Số vượt trần được giữ nguyên để báo lỗi, không tự kéo về trần. UI chỉ hiện thẻ kế hoạch khi draft sẵn sàng; đường form không chat không được gọi extract-plan.

Sau thay engine/rule, đối chiếu `policy/worked-examples.md`, parameter parity và golden qua service thật. Chỉ cập nhật golden khi hành vi mới được chốt, không sửa expected để che regression. `make eval-report` ghi lại báo cáo Studio nên chạy khi task cần cập nhật artifact đó.

## Điều kiện hoàn thành task

Acceptance criteria của task đạt, kiểm tra phù hợp rủi ro, `make test` đạt trước PR, các skip được giải thích và không còn diff ngoài phạm vi. Cập nhật contract/docs nếu thay hành vi. Task mới liên quan policy approval, versioning hoặc P7 cần test mới cho bất biến tương ứng, không chỉ chứng minh happy path.

NFR latency/cost đo riêng có timestamp, cấu hình model, số case và percentile/trung bình. Không dùng thời gian pytest offline để suy ra SLA online.

Nghiệm thu phải phân biệt kiểm tra tài liệu, test backend offline, test tích hợp và kiểm tra môi trường triển khai.
