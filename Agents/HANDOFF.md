# Hướng dẫn làm việc cho teammate và Codex

Mở toàn bộ repository trong Codex, đọc tài liệu theo thứ tự trong README rồi chọn công việc trong NEXT_STEPS. Cấu hình môi trường theo hướng dẫn repo và không đưa credentials vào source.

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
