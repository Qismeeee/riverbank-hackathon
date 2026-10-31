# Riverbank Hackathon

Riverbank thẩm định vốn lưu động theo dòng tiền payout của seller Shopee. Code tính số, model diễn giải, nhân sự ngân hàng quyết định.

Bắt đầu từ [Agents/README.md](Agents/README.md), đọc [AGENTS.md](AGENTS.md) và chọn công việc trong [NEXT_STEPS](Agents/NEXT_STEPS.md).

Khi bàn giao cho teammate, chia sẻ cả code nền và bộ schema/tài liệu theo [HANDOFF.md](Agents/HANDOFF.md). Tài liệu có thể mô tả code đang làm; xem trạng thái trong `tasklist.json` và các giới hạn trước khi sử dụng.

- `Agents/`: BRD, SRS, SAD, nghiệp vụ, API, dữ liệu, nghiệm thu và hướng dẫn Codex.
- `policy/`: tham số demo, ý nghĩa rule và fixture tính tay.
- `knowledge/`: prompt, thuật ngữ và guardrail.

Đây là bộ tài liệu khởi tạo dự án. Backend, frontend và kiểm thử nghiệp vụ được xây theo kế hoạch triển khai. Các đường dẫn code trong đặc tả xác định cấu trúc cần xây, không phải tuyên bố chức năng đã hoàn thành.

## Môi trường phát triển (BASE-01)

Cần Python 3.12, [uv](https://docs.astral.sh/uv/) và GNU Make. Từ gốc repo chạy:

```sh
make setup
make test
```

`make setup` dùng `uv.lock` tạo `.venv`, cài dependency phát triển và cài pre-commit hook vào Git. `make test` chạy Ruff lint, kiểm tra format và pytest; CI chạy cùng bộ kiểm tra trên Linux. Có thể chạy `uv run --locked pre-commit run --all-files` để kiểm tra hook. Các lệnh dùng shell POSIX; trên Windows dùng WSL.

Hiện có source layer, CashFlowEngine, kiểm thử offline và nền FastAPI; chưa có frontend hoặc HTTP workflow thẩm định. Chưa cấu hình database, model hay kết nối dịch vụ ngoài; không có chế độ DB/model/network đang hoạt động. Bộ kiểm thử hiện tại chạy offline sau khi cài dependency, không cần credentials hoặc dữ liệu thật. Việc cài dependency và CI cần mạng. Các adapter, cấu hình runtime và kiểm thử tích hợp sẽ được thêm trong task tương ứng, không suy ra từ môi trường này.

## Nguồn dữ liệu demo (SRC-01)

`api/services/underwriting/sources.py` định nghĩa scope seller/shop, consent theo mục đích và thời gian, payout VND nguyên, provenance và snapshot có SHA-256. `ScopedPayoutReader` kiểm scope và consent trước khi đọc, rồi kiểm lại scope dữ liệu nguồn trả về. `demo_sources.py` cung cấp fixture payout hoàn toàn mô phỏng, có nhãn và không gọi mạng.

Đây là lớp Python nội bộ: caller phải xác thực actor và chỉ sử dụng reader, không gọi adapter trực tiếp. Đã có repository demo giữ consent/snapshot và tuần tự hóa thu hồi/lần đọc trong cùng một process. Chưa có auth actor, persistence bền, transaction phân tán hoặc tích hợp sàn thực. Hash cho phép kiểm tra nội dung snapshot nhưng không tự chứng minh nguồn hoặc tạo audit. Không dùng lớp demo làm kiểm soát truy cập production.

## CashFlowEngine (một phần ENG-01)

`api/services/cashflow.py` tính bảng cơ sở/xấu, gap và lịch đề xuất bằng số nguyên VND và tỷ lệ chính xác. Engine nhận cấu hình từ caller, không tự nạp policy; file tham số demo chỉ được đọc trong test offline và chưa được phê duyệt cho vận hành. Kỳ payout được giả định diễn ra từ `payout_start_week` đến hết `sell_weeks`; median nửa đồng được làm tròn xuống VND nguyên. Khi lịch vẫn vượt trần tại kỳ hạn tối đa, `fits_deduction_cap` là false và caller phải xử lý fail closed.

Đã có hợp đồng feature cho payout và điều phối sơ bộ: gap 0 dừng trước PD; gap dương luôn INCOMPLETE vì CIC và policy chưa có. Đã thêm CIC gate và adapter synthetic độc lập nhưng chưa nối workflow; mục đích consent demo chưa phải hợp đồng ngân hàng. Chưa có model PD, CIC thật, rule engine hoặc workflow hoàn chỉnh. Các thay đổi mới chưa được kiểm thử; chưa hoàn thành ENG-01 và chưa chứng minh invariant ở cấp workflow. Không dùng kết quả tính như quyết định tín dụng.

Danh sách công việc và phụ thuộc theo tài liệu nằm tại `tasklist.json`. Kiểm thử mới được để lại sau đợt triển khai theo yêu cầu; policy chưa qua kiểm thử và xác nhận không được nạp.

## Nền API (một phần CORE-01)

`api.main:app` tạo FastAPI với CORS đóng mặc định; `create_app(ApiSettings(cors_origins=(... ,)))` cho phép cấu hình tường minh origin HTTP(S), không dùng wildcard. Không có secret trong cấu hình này. `GET /v1/auth/me` trả 401 nếu thiếu bearer và 503 nếu có bearer vì issuer, cơ chế kiểm token và ánh xạ quyền chưa được chốt; endpoint chưa xác thực người dùng. Chưa có adapter PostgreSQL, workflow hoặc endpoint nghiệp vụ. Không dùng app này làm API thẩm định production.

`api/security/auth.py` định nghĩa ranh giới cho verifier access token và nguồn quyền đáng tin cậy. Helper ban đầu vẫn gắn scope shop cho cả hai role; CORE-01.23 phải sửa để underwriter dùng role nền tảng và seller dùng ownership shop theo thiết kế hiện hành. `create_app` có thể nhận service từ adapter server-side, nhưng repo chưa có verifier hay nguồn quyền thực và chưa triển khai đăng nhập PKCE. Không truyền adapter chưa kiểm chứng vào ứng dụng; việc kiểm scope không thay consent đọc dữ liệu sàn. Thay đổi chưa được kiểm thử.

[Schema mini](database/riverbank-mini.dbml) đã có thiết kế danh tính OIDC, role, ownership seller/shop và audit quyền. Underwriter là nhân sự trên lending platform, dùng role nền tảng; quyết định tham chiếu đúng identity/assignment underwriter. [Thiết kế auth database](database/README.md) giải thích luồng kiểm quyền, thu hồi và các ràng buộc phải có trong migration. Chưa có migration hoặc resolver DB hoạt động.

Nền/auth CORE-01 có thể làm sau BASE-01; workflow đầy đủ qua gate ENG-01, VER-01, POL-01 và đối chiếu schema CORE-01.24. Provider/session OIDC vẫn chờ quyết định trong GAPS. Các kiểm thử mới và nghiệm thu để ở TEST-01 theo kế hoạch; không coi nền API là task đã hoàn thành.

Contract Plan nội bộ kiểm kiểu, tổng lịch trả, thời điểm trả và input cap do caller cung cấp; không tự nạp policy demo và chưa nối endpoint. Caller vẫn phải kiểm guard, xác thực, scope và consent. Thay đổi chưa được kiểm thử nghiệp vụ.

Repository case trong bộ nhớ chỉ dùng cho phát triển offline một process: lưu case/event tạo và idempotency theo seller, không xác thực actor hay lưu bền. Evidence envelope lưu payload JSON bất biến và hash gắn case/run, không xác thực nguồn. Chưa có optimistic concurrency, migration hoặc workflow nối hai thành phần; không dùng với dữ liệu thật. Kiểm thử nghiệp vụ chưa chạy.
