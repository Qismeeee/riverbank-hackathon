# Kế hoạch kiểm thử và nghiệm thu

## Môi trường kiểm thử

BASE-01 đã cung cấp API `/health`, Makefile và test thực thi. Chạy từ gốc repository trong WSL/Linux với Python 3.12, uv 0.13.6 và GNU make. Docker/Buildx cần cho build và smoke test container; Postgres chưa thuộc implementation này. Mỗi báo cáo nghiệm thu ghi rõ cấu hình, lệnh và kết quả chạy.

```bash
make setup
make test
```

`make setup` dùng `uv sync --locked --dev` tạo môi trường từ `uv.lock` rồi cài Git pre-commit hooks. `make sync` cài cùng dependency mà không sửa hooks, dùng trong CI. Không cần chạy setup lại khi môi trường đã phù hợp. `make test` đồng bộ dependency với lock ở chế độ offline, chạy `ruff check api scripts`, `ruff format --check api scripts` và pytest; thiếu cache/dependency hoặc lock lệch phải báo lỗi.

Không cần `.env`, AWS, DB hoặc model API key để chạy API/test. Test dùng ASGI TestClient và chặn kết nối ra ngoài; socket nội bộ loopback của asyncio trên Windows được cho phép. Biến cấu hình và thư mục làm việc được cô lập khỏi `.env` local. Lần setup đầu cần mạng tải dependency. Xem lệnh PowerShell tương đương tại [README](../README.md); khi dùng chung checkout, giữ `.venv` của Windows và `.venv-linux` của WSL riêng.

```bash
make docker-build PLATFORM=linux/arm64
make docker-smoke PLATFORM=linux/arm64
```

Máy x86 cần QEMU/binfmt. Smoke test kiểm tra platform/user, chạy container, gọi HTTP `/health` và thực thi healthcheck trong image, rồi dừng container tạm. CI dùng cùng `make test`, build/smoke ARM64 và kiểm Compose/Caddy. Kết quả local không thay thế run GitHub hoặc kiểm chứng trên EC2 ARM64. Xem [hướng dẫn CI/CD](../README.md#cicd).

`make test` kiểm thêm cú pháp `infra/deploy.sh`. `api/tests/test_deploy.py` chạy Bash với Docker/curl giả lập, kiểm deploy thành công, rollback khi startup/health lỗi, lỗi lần đầu giữ volume và preflight không đổi stack đang chạy. Các test này chạy trên Linux (CI/WSL), skip có lý do trên Windows; không coi mock là bằng chứng SSH/AWS thật.

## Ma trận nghiệm thu

Ma trận nghiệp vụ dưới đây là yêu cầu cho các task sau; BASE-01 chưa triển khai hoặc nghiệm thu các luồng này.

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

## Tệp test theo mảng

Hiện có `api/tests/test_health.py`, `test_config.py` và `test_deploy.py`. Danh sách nghiệp vụ dưới đây là cấu trúc test dự kiến, chưa phải các test đã tồn tại hoặc đã pass.

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
