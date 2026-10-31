# Hướng dẫn làm việc cho teammate và Codex

Mở toàn bộ repository trong Codex, đọc tài liệu theo thứ tự trong README rồi chọn công việc trong NEXT_STEPS. Cấu hình môi trường theo hướng dẫn repo và không đưa credentials vào source.

## Bàn giao SRC-01

Repository nguồn demo hiện yêu cầu `runs` ánh xạ run ID sang case ID đã đăng ký khi khởi tạo, và từ chối grant consent ghi thời điểm trong tương lai. Đây vẫn là dữ liệu synthetic trong một process; đăng ký case/run và actor chưa được nối với workflow xác thực. SRC-01.06 còn phụ thuộc resolver quyền, workflow và thiết kế persistence/schema; quyền đọc lịch sử sau thu hồi và contract nguồn thực vẫn cần quyết định. Không dùng repository demo cho dữ liệu thật.

Đã chạy `uv run --locked ruff check api/services/underwriting/demo_repository.py`, `uv run --locked ruff format --check api/services/underwriting/demo_repository.py`, `python3 -m json.tool tasklist.json > /dev/null` và `git diff --check` trên macOS: đều thành công. Chưa chạy hoặc bổ sung kiểm thử nghiệp vụ theo kế hoạch TEST-01; chưa có số pass/skip/fail và chưa nghiệm thu SRC-01. Cần kiểm thử các trường hợp run sai case/chưa đăng ký, grant tương lai và các race consent đã nêu trong tasklist. Phiên tiếp theo phải mở phiên Codex mới trước khi bắt đầu task lớn khác.

## Prompt tiếp nhận

```text
Bạn đang phát triển Riverbank, sản phẩm thẩm định vốn lưu động theo payout seller Shopee.
Đọc các AGENTS.md có hiệu lực, rồi Agents/README.md và CONTEXT.md.
Đọc BRD, BUSINESS, SRS, SAD, DATA, API, GAPS và TEST_PLAN trong Agents/.
Đọc database/riverbank-mini.dbml, database/README.md và tasklist.json.
Dùng tasklist và NEXT_STEPS để xác định dependency và acceptance criteria.
Kiểm tra môi trường, cấu trúc repo và thay đổi sẵn có trước khi sửa.
Giữ người ngân hàng quyết định, code tính số, gap 0 bỏ CIC/PD/rule vay,
consent và scope đúng seller, PII được che trước outbound.
Memo phải đúng evidence, điều khoản thêm version mới, audit chỉ thêm.
```

## Prompt triển khai một task

```text
Thực hiện task [TASK_ID] trong tasklist.json và Agents/NEXT_STEPS.md.
Đọc AGENTS.md và kiểm tra skill có sẵn đúng phạm vi trước khi sửa.
Đọc documents của task/subtask, dùng SRS và SAD/API/DATA/database để triển khai contract.
Mỗi task lớn một phiên Codex mới; không bắt đầu task lớn kế tiếp trong cùng phiên.
Giữ thay đổi sẵn có của người khác, chia công việc thành thay đổi nhỏ có thể review.
Để kiểm thử nghiệp vụ mới ở TEST-01; riêng policy phải test và người xác nhận trước nạp.
Chưa đủ kiểm thử bắt buộc thì giữ in_progress; make test phải đạt trước sẵn sàng PR.
Nếu thiếu môi trường hoặc quyết định nghiệp vụ, nêu rõ phần bị phụ thuộc.
Cập nhật tài liệu liên quan, báo file đổi, hành vi mới và kết quả kiểm thử.
Không tự merge, deploy hoặc gửi dữ liệu thật ra dịch vụ ngoài.
```

## Báo cáo hoàn thành

Ghi task, acceptance đã đạt, file chính, lệnh và kết quả kiểm thử, phần skip/blocker, thay đổi schema/contract và bước tiếp theo. Nếu công việc chưa xong, nêu điểm dừng và cách tiếp tục. Không ghi token, khóa hoặc raw PII.

## Bộ commit để teammate tiếp nhận

Nhánh bàn giao là `docs/implement`, có merge commit `219ec13` lấy schema từ `origin/docs/mini-database-schema` và giữ tài liệu nhánh hiện tại. Code nền đã được ghi trong commit `72d9c3a`; schema/tài liệu/tasklist được đóng gói thành commit tiếp theo cùng tài liệu này. Push nhánh chia sẻ sau khi review để teammate nhận cả hai. Việc tạo commit không chứng minh code đã nghiệm thu hoặc nhánh đã được push.

Khi chuẩn bị bàn giao, code `api/`, dependency/lockfile, CI và Makefile chưa được Git theo dõi. Chúng đã được đưa vào commit nền `72d9c3a` vì tài liệu và tasklist mô tả code đó. Danh mục dưới ghi lại hai nhóm file và lệnh chọn file; teammate nhận đủ baseline thì không cần chạy lại lệnh tạo commit cũ.

### Commit 1: code nền và môi trường, ghi rõ WIP

| Nhóm file | Nội dung bàn giao |
|---|---|
| `api/main.py`, `api/config.py`, `api/__init__.py` | Nền FastAPI/CORS; auth/me mặc định fail closed |
| `api/security/` | Contract verifier/resolver và helper quyền còn phải sửa tại CORE-01.23 |
| `api/services/`, `api/tests/` | Source/consent/snapshot demo, cashflow, risk/CIC interfaces, repository/evidence và test hiện có; đây là baseline mà tasklist đang mô tả |
| `pyproject.toml`, `uv.lock`, `.python-version` | Dependency và Python tái lập |
| `Makefile`, `.pre-commit-config.yaml`, `.github/workflows/ci.yml` | Lệnh setup/check và CI |
| `.gitignore` | Loại cache, venv, env secrets khỏi Git |

Lệnh từ gốc repo đã dùng cho commit nền:

```sh
git add -- .gitignore .python-version .pre-commit-config.yaml Makefile pyproject.toml uv.lock .github/workflows/ci.yml api/
git diff --cached --stat
git diff --cached --check
git commit -m "chore: share backend development foundation (WIP)"
```

Không coi commit snapshot này là code sẵn sàng PR/vận hành. Không có provider thật, auth migration hoặc resolver DB. Helper cũ vẫn đòi shop scope cho underwriter; thiết kế mới và CORE-01.23 là hướng sửa, không được lấy hành vi cũ làm yêu cầu. Các kiểm thử mới/nghiệm thu vẫn theo TEST-01 và gate policy bắt buộc. Commit hook có thể chạy lint/format; xử lý lỗi hook nếu có, không bỏ qua hook để tạo commit.

### Commit 2: schema, quyết định thiết kế và hướng dẫn đồng bộ

| Nhóm file | Vai trò |
|---|---|
| `database/riverbank-mini.dbml`, `database/README.md` | Bốn bảng auth, ownership seller, role underwriter nền tảng, FK/CHECK actor và thiết kế thu hồi/audit |
| `AGENTS.md`, `Agents/AGENTS.md`, `Agents/README.md`, `Agents/HANDOFF.md` | Bất biến, thứ tự đọc, quy trình task/phiên, bàn giao |
| `Agents/API.md`, `Agents/DATA.md`, `Agents/SAD.md`, `Agents/SRS.md` | Contract OIDC/quyền, tên schema đích và mapping với code cũ |
| `tasklist.json`, `Agents/GAPS.md`, `Agents/NEXT_STEPS.md`, `Agents/TEST_PLAN.md`, `README.md` | Task/dependency/acceptance, blocker, tiến độ, kiểm thử và điểm vào repo |

```sh
git add -- AGENTS.md Agents/AGENTS.md Agents/README.md Agents/HANDOFF.md Agents/API.md Agents/DATA.md Agents/GAPS.md Agents/NEXT_STEPS.md Agents/SAD.md Agents/SRS.md Agents/TEST_PLAN.md README.md tasklist.json database/riverbank-mini.dbml database/README.md
git diff --cached --stat
git diff --cached --check
git commit -m "docs: align OIDC roles, database design and development handoff"
```

Review diff đã stage thay vì `git add .`: không thêm `.env`, token, raw PII, `.venv`, cache hoặc SQL xuất tạm trong `/tmp`. Các file policy/knowledge/BRD/BUSINESS không có thay đổi trong bộ bàn giao hiện tại; không đưa nội dung cũ của nhánh nguồn đè lên chúng.

Nếu chỉ gửi thiết kế/tài liệu mà không gửi commit code nền, phải sửa tiến độ và mọi tuyên bố code/môi trường cho đúng với snapshot được chia sẻ. Bộ hai commit trên giữ code và tiến độ cùng baseline.

Sau khi đã review và commit cả hai bộ, người phụ trách nhánh có thể chia sẻ:

```sh
git push -u origin docs/implement
```

Teammate nhận baseline đã chia sẻ và tạo nhánh làm việc riêng:

```sh
git fetch origin
git switch --no-track -c feature/core-auth-db origin/docs/implement
```

Không dùng lại tài liệu cũ từ `docs/mini-database-schema` để thay tài liệu trên nhánh chia sẻ. Quy ước hiện hành là người vay có shop ownership, underwriter thuộc lending platform một ngân hàng, access token được kiểm phía server và consent sàn độc lập. API giữ `/v1/cases`; persistence ánh xạ sang `applications/application_events/version_no`. Những mâu thuẫn còn mở về tiền/schema/version được giữ tại CORE-01.24 và GAPS, không âm thầm chọn cách bỏ invariant.

## Chia việc để giảm xung đột

- Chọn task/subtask và thống nhất người phụ trách trước khi code; mỗi người dùng nhánh riêng từ cùng baseline, mỗi task lớn dùng phiên Codex mới.
- CORE-01.19 có thể bắt đầu migration auth/baseline sellers sau BASE-01; người phụ trách migration làm `api/db/` và thống nhất thay đổi DBML với người giữ schema.
- CORE-01.18 cần quyết định provider/session/provisioning; không tự chọn provider hoặc coi login đã hoạt động.
- CORE-01.20/23 xử lý resolver/helper ở `api/security/` sau các dependency; không đồng thời giao cùng file cho hai người. Underwriter không cần ownership shop.
- Một đầu mối cập nhật các file chung `database/riverbank-mini.dbml`, `tasklist.json`, GAPS và NEXT_STEPS khi nhận thay đổi từ các nhánh. Giữ patch tài liệu nhỏ theo task, đọc thay đổi mới nhất trước khi sửa.
- Tạm giữ business migration CORE-01.07 đến khi CORE-01.24 và quyết định version liên quan đã thống nhất. Không đánh dấu hoàn thành các task đang chờ code/test chỉ vì đã chia sẻ snapshot.

## Kiểm tra lúc đóng gói ngày 2026-10-31

Commit `72d9c3a` chứa 28 file code/config. `git diff --cached --check` đạt trước commit; hook `ruff check` và `ruff format check` đều Passed, không bỏ qua hook. Bộ schema/tài liệu/tasklist có 15 file theo danh mục trên. JSON, document paths, dependency graph và staged diff được kiểm tra khi đóng gói; chưa chạy `make test` hoặc bổ sung test nghiệp vụ trong lần tạo commit WIP này. CORE-01 và các task đang làm giữ nguyên trạng thái chờ triển khai/kiểm thử bắt buộc.

## Handoff CORE-01.19: PostgreSQL local

Đã thêm `api/db/migrations/001_auth_baseline.sql`, `Dockerfile`, `compose.yaml` và kiểm tra kết nối `/health/db`. Compose chỉ là môi trường local; SQL chỉ tự chạy trên volume mới, API chưa có repository PostgreSQL. Business schema bị chặn bởi CORE-01.24/VER-01.01; không export DBML thành migration business. Cần hoàn thiện runtime DB privileges, provisioning/audit transaction và kiểm thử PostgreSQL tại TEST-01. Hướng dẫn khởi chạy/rollback và giới hạn tại `database/README.md`. Trạng thái CORE-01.19 là in_progress, chưa sẵn sàng PR.

Kiểm tra phiên này: Compose config, Ruff trên `api/main.py`, JSON tasklist và `git diff --check` đạt. Docker daemon không chạy (`docker info` thất bại), nên chưa build/chạy container, chạy migration hoặc kiểm tra kết nối thật; chưa chạy `make test` theo kế hoạch TEST-01.

### Bản nháp business schema

`database/drafts/002_business_draft.sql` phác thảo chín bảng DBML còn lại dựa trên baseline auth và đổi cột tiền sang bigint VND. Bản nháp chưa được chạy hoặc kiểm thử, không gắn vào Compose và không phải migration chính thức. Trước khi migrate cần chốt CORE-01.24/VER-01.01, lifecycle điều khoản, hợp đồng snapshot/JSON, idempotency/lease và bảo vệ lịch sử/quyền; xem `database/README.md`. Không dùng dữ liệu thật. Kiểm tra lần này: DBML CLI xuất SQL thành công, `git diff --check` được chạy; không chạy test nghiệp vụ hay migration theo kế hoạch hiện tại.

Cập nhật 2026-10-31: theo yêu cầu người dùng, đã chạy draft business SQL thủ công vào volume PostgreSQL local hiện tại và restart db; `\dt` trả 14 bảng, `/health/db` reachable. Đây vẫn là schema tạm, không tự chạy trên volume mới, chưa có repository PostgreSQL hoặc nghiệm thu business migration.

### TEST-01: kiểm thử offline từng phần (2026-10-31)

Xem `NEXT_STEPS.md` để biết kết quả 45 passed và giới hạn. `make test` đạt sau khi định dạng khối mã trong `database/README.md`. Cần fixture PostgreSQL cô lập và các thành phần/phụ thuộc còn thiếu trước kiểm thử tích hợp và nghiệm thu; không sử dụng volume local hiện có làm bằng chứng test sạch. TEST-01 vẫn in_progress.

## Handoff CORE-01.30–31: lõi synthetic

`api/services/underwriting/synthetic_assessment.py` nhận Plan, input caps, cấu hình và record synthetic do caller cung cấp; kiểm scope, tính bằng CashFlowEngine và không đọc nguồn. Gap 0 trả `NO_LOAN_NEEDED`; gap dương trả `INCOMPLETE`, không gọi PD/CIC/policy. Nhãn synthetic không xác minh consent hay provenance và tham số caller cung cấp không chứng minh policy đã duyệt. Service chỉ dành cho fixture nội bộ, không dùng cho dữ liệu thật.

`api/schemas/core.py` có schema request Plan, response preview synthetic và envelope lỗi; `core_contract.py` chuyển kết quả và ánh xạ lỗi idempotency có domain type. Response preview không phải contract case cuối; mapping lỗi còn lại, input guard, xác thực, consent, persistence và endpoint chờ task/gate tương ứng. Cần kiểm thử A/B/E, sai scope, nhãn synthetic, caps, nhánh gap 0/gap dương và schema/mapping tại TEST-01. Hai subtask giữ in_progress; không kết luận sẵn sàng PR.

## Handoff CORE-01: route placeholder

Các router cases, copilot, underwriting, statements và studio đăng ký path lõi trong API.md. Các route yêu cầu auth và role server; POST case còn kiểm Plan, Idempotency-Key và seller/shop ownership. Chúng luôn trả 503 `WORKFLOW_UNAVAILABLE` sau các kiểm tra đó, không gọi service synthetic hoặc truy cập dữ liệu. Các contract body còn thiếu, kiểm ownership từ case và nested resource, consent, transaction và toàn bộ workflow cần hoàn thiện theo từng subtask trước khi thay placeholder. Không thể coi các route này là endpoint nghiệp vụ hoạt động.

Phiên này: `uv run --locked ruff check` và `ruff format --check` trên router/security/availability/main đạt; khởi tạo app và tạo OpenAPI offline thành công (15 path); `python3 -m json.tool tasklist.json` và `git diff --check` đạt. Chưa chạy/bổ sung kiểm thử nghiệp vụ hoặc HTTP mới theo kế hoạch TEST-01; chưa sẵn sàng PR.
