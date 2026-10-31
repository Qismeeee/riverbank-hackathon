# Công việc tiếp theo

Kế hoạch triển khai được chia theo dependency và tiêu chí nghiệm thu. Bắt đầu BASE-01 để chuẩn bị môi trường, xây dữ liệu và engine, hoàn thiện workflow/evidence, sau đó nối frontend và mở rộng theo nhu cầu sản phẩm.

| Task | Ưu tiên và phụ thuộc | Kết quả cần giao | Nghiệm thu |
|---|---|---|---|
| BASE-01 chuẩn bị dự án | P0, độc lập | Cấu hình môi trường, dependency và bộ kiểm tra chất lượng | Môi trường tái lập được, DB/model/network mode rõ và kiểm tra chất lượng chạy được. Đã thiết lập nền tảng; xem README và kết quả kiểm tra của task |
| SRC-01 dữ liệu và consent | P1 sau BASE-01 | Contract seller/shop, consent, payout, provenance và adapter demo | Repository demo một process yêu cầu đăng ký case/scope và run/case, chặn grant ghi thời điểm tương lai; chưa kiểm thử thay đổi mới. Còn auth/case scope từ workflow, lưu bền, quyền lịch sử sau thu hồi và contract nguồn thật |
| ENG-01 dòng tiền và rủi ro | P1 sau SRC-01 | CashFlowEngine, FeatureBuilder, PD và CIC adapter có điều kiện | Đang thực hiện: tính dòng tiền, feature payout và điều phối sơ bộ gap 0; đã có CIC gate synthetic độc lập; còn model PD, tích hợp CIC, workflow, golden qua service và kiểm thử thay đổi mới |
| CORE-01 workflow và evidence | P1: nền/auth sau BASE-01; workflow qua gate ENG-01, VER-01, POL-01 và CORE-01.24 | API/auth, trạng thái, memo/validator, sao kê, quyết định và handoff | Đang làm: nền FastAPI, CORS đóng mặc định và ranh giới auth; chưa có provider xác thực hay workflow. A/B/C/E/F, audit và evidence chưa được nghiệm thu |
| FE-01 frontend lõi | P1 sau CORE-01 | Seller form/list/view, lender queue/detail/evidence/decision/handoff, studio | A/B/C/E/F qua UI, role đúng, idempotency và version conflict đúng, không tự tính tiền |
| VER-01 version điều khoản | P1 sau BASE-01 | Thiết kế/migration/repository cho version mới và SUPERSEDED | Counter thêm bản mới, lịch sử cũ không đổi, rollback/concurrency đúng, không nhầm cases.version |
| POL-01 xác nhận policy | P1 sau BASE-01 | Quy trình artifact policy/test/xác nhận, loader fail closed | Chặn bộ chưa xác nhận, hash lệch hoặc test không đạt, có audit người xác nhận |
| DOC-01 duy trì tài liệu | P1 sau BASE-01 | Cập nhật tài liệu theo các quyết định nghiệp vụ và contract | BRD/SRS/SAD/API thống nhất, các FR có tiêu chí nghiệm thu và test truy vết |
| QA-01 seller hỏi lại | P2 sau CORE-01 | Route copilot/ask, prompt và validator trên evidence mới nhất | Đúng seller, PII trước outbound, số không đổi, không đọc PD/CIC nội bộ cho seller |
| EXP-01 tái thẩm định hết hạn | P2 sau VER-01 | Luồng yêu cầu/tái thẩm định dữ liệu mới và audit | Hết hạn không bàn giao, run mới giữ evidence cũ, CIC/consent theo hiệu lực đã chốt |
| DATA-01 case D | P2, cần nghiệp vụ chốt | Phân biệt payout sàn và phần thu ngoài sàn | Khớp phần sàn không tự xác nhận phần ngoài sàn, routing có fixture mới |
| OBS-01 latency và cost | P2 sau CORE-01 | Meter theo case/model/retry, báo cáo demo | Đo riêng offline và online, mục tiêu SRS có bằng chứng, không log PII |
| P7-01 Monitor | P3 sau VER-01, policy/BL-11 đã chốt | Tính phương án bằng code, D22 có evidence, người duyệt version mới | Không đổi lịch ACTIVE trước duyệt, không tự cơ cấu, retry/idempotency đúng |
| BANK-01 adapter thật | Sau contract ngân hàng | CIC/LOS adapter với sandbox và auth phù hợp | Scope/consent/retry đúng, không dùng mock làm bằng chứng tích hợp thật |

## Trạng thái BASE-01 — 31/10/2026

Đã triển khai Python 3.12, uv lock, cấu hình tập trung, API `/health`, `make setup/test` và Docker ARM64. Hướng dẫn local/production được gom tại [README](../README.md). Bỏ entrypoint chỉ bọc exec; Docker chạy Python trực tiếp bằng exec-form CMD.

Đã cấu hình một workflow CI/CD theo GHCR → EC2 ARM64/Compose/Caddy. CD khóa sau CI, chỉ bật trên main khi có ENABLE_DEPLOY=true và cấu hình production. Có kiểm image/health/readiness, lưu release, rollback cả image và Compose/Caddy; trạng thái AWS thực tế cập nhật bên dưới. Bộ kiểm tra WSL mới nhất: `make UV=./.tools-linux/uv test` đạt 26 pytest pass, 0 skip/fail; Bash syntax, Ruff lint/format, ShellCheck và actionlint đạt. Biến môi trường local như README.

Docker: `make docker-build PLATFORM=linux/arm64` và `make UV=./.tools-linux/uv docker-smoke PLATFORM=linux/arm64` đạt trên Engine WSL/QEMU; smoke chờ trạng thái healthy thực tế. Compose config/Caddy validate đạt. Đã kiểm deployment thật trên project test riêng: bản đầu HTTP 200, bản Caddy lỗi cố ý trả 503, script trả lỗi và rollback về đúng image/config trước đó, HTTP 200 phục hồi; container test đã dừng, volume giữ lại. Không coi kiểm tra HTTP local này là bằng chứng certificate/HTTPS hoặc SSH AWS.

CI nền đã đạt Quality/Docker ARM64 trên PR #1/main; Deploy EC2 bị skip khi chưa bật CD. HTTPS AWS đã kiểm trực tiếp, CD GitHub qua GHCR/SSH của phần mới chưa chạy. Main đã bảo vệ bằng PR + hai required checks từ GitHub Actions, enforce admins và chặn force push; ENABLE_DEPLOY vẫn false. Các thay đổi cloud local cần được commit/push bởi người dùng để kiểm lại. Task sản phẩm tiếp theo là SRC-01; các hệ thống khác trong SAD vẫn cần xây theo task.

## Cấu hình dev dùng prod — 31/10/2026

Theo yêu cầu chủ dự án, `.env` local dùng RDS `riverbank` và bucket prod hiện hữu. Đã tạo AWS profile `riverbank`, SSH tunnel qua EC2 prod, xác minh TLS RDS với CA AWS; `SELECT 1` trong transaction read-only và S3 HeadBucket đạt HTTP 200. Không chạy migration hoặc ghi dữ liệu prod, không gọi model. Key và `.env` được Git bỏ qua. Đã thêm alias cấu hình cloud, che secret, CORS và SDK AWS/PostgreSQL; `make test` WSL đạt 17 pass, 0 skip/fail; Docker ARM64 build/smoke healthy đạt. Hướng dẫn mở tunnel và giới hạn kiểm chứng ở README. Thay đổi của lần cấu hình này chưa commit/push.

## AWS production — 31/10/2026

EC2 mới `i-06ab8a545deb7a7f3` có EIP `3.0.194.9`, HTTPS `3-0-194-9.sslip.io`; `/health` và `/ready` HTTP 200, TLS hợp lệ. Readiness kiểm RDS read-only qua Secrets Manager/role và S3 HeadBucket. Deletion protection RDS bật; backup giữ 1 ngày do Free Tier từ chối 7 ngày và chủ dự án chọn không nâng gói. S3 mã hóa, versioning, block public đã kiểm. Có log API/Caddy, datapoint RAM/đĩa và bốn alarm CloudWatch gắn SNS hiện hữu. Chưa test restore/giao thông báo SNS hoặc ghi dữ liệu; không gọi model.

Stack clone cũ trên máy mới đã dừng và giữ volume; máy cũ `13.214.87.165` không đổi, health HTTPS vẫn đạt. Image đang chạy là bản **validation từ working tree**, không giả release SHA. GitHub environment production và SSH riêng đã cấu hình/kiểm, CD tắt chờ người dùng push/merge. Chưa có run CD GitHub của phần mới; không tự commit/push/merge. `make test` đạt 26 pass, 0 skip; Docker ARM64 build/smoke đạt. Xem README để bật CD sau khi code mới ở main và các giới hạn HA/root EBS.

## Thực hiện FE-01

1. Xác định package frontend và thiết kế màn hình seller, lender, studio theo BRD/SRS.
2. Dùng API.md để xây typed client và OAuth 2.0/OIDC trước khi nối màn hình; chốt provider và session theo GAPS.
3. Nối seller tạo case, xem kết quả, sau đó lender evidence và quyết định, cuối cùng handoff/studio.
4. Dùng fixture với dữ liệu nguồn đúng. Hiển thị mock/simulated rõ, không thêm tổng lãi/phí khi server chưa cung cấp.
5. Kiểm A/B/C/E/F, lỗi quyền và conflict. Báo phần nào đã chạy thật, phần nào stub.

## Thực hiện VER-01 và POL-01

Thiết kế schema/repository và đọc skill nghiệp vụ đúng phạm vi. Migration phải có phương án rollback và kiểm tra tính toàn vẹn dữ liệu. Policy approval phải chốt ai có quyền xác nhận và bằng chứng xác nhận, không đặt một boolean mặc định true.

P7 cần một vòng đời điều khoản có thể truy vết. Không thêm nút “giãn nợ” làm ghi đè lịch hiện tại để chạy demo nhanh.

## Bàn giao SRC-01

Repository demo chỉ nhận dữ liệu synthetic, yêu cầu đăng ký case/scope từ trước, giữ snapshot theo case/run và khóa thao tác thu hồi cùng lần đọc trong một process. Không chấp nhận cấp lại consent có thời điểm cấp trước lần thu hồi. Caller phải xác thực actor và xác định case/run từ server; không sử dụng repository như ranh giới bảo mật hoặc persistence production. Cần chốt quyền đọc lịch sử sau thu hồi và nguồn thật, nối workflow/lưu bền, rồi bổ sung kiểm thử consent, scope, hết hạn, thu hồi đồng thời và lịch sử ở TEST-01. Chưa đánh dấu task hoàn tất. Phiên tiếp theo tiếp tục SRC-01 nếu các phụ thuộc được giải quyết; nếu không, mở phiên mới cho task lớn độc lập theo dependency.

Lần tiếp tục SRC-01: reader kiểm lại ownership/consent sau khi đọc và dùng thời điểm hoàn tất để chụp; repository demo ghi dấu thu hồi cả khi chưa có grant để chặn grant ghi lùi. Kiểm tra lại trong reader độc lập không nguyên tử và không chứng minh cùng grant còn hiệu lực. Cần kiểm thử các thay đổi này tại TEST-01, gồm thu hồi khi chưa có grant, cấp lại ghi lùi, hết hạn/thu hồi trong khi đọc và race; chưa có xác thực actor hay persistence bền để hoàn tất SRC-01. OIDC và contract nguồn vẫn chờ quyết định tại GAPS.

## Bàn giao CORE-01

Đã tạo app FastAPI và cấu hình CORS origin tường minh. `GET /v1/auth/me` trả 401 khi thiếu bearer và 503 khi có bearer: chưa có provider hay kiểm access token, không cấp role/scope giả. Chưa nối kho dữ liệu, nghiệp vụ hay dịch vụ ngoài. Cần chốt OIDC trong GAPS và hoàn tất ENG-01, VER-01, POL-01 trước khi nối các phần phụ thuộc; tiếp tục các subtask còn lại của CORE-01 trong phiên mới. Kiểm thử và nghiệm thu để ở TEST-01; không đánh dấu hoàn thành.

CORE-01.02: đã thêm contract nội bộ cho verifier access token và nguồn quyền theo issuer/subject; `auth/me` có thể nhận các adapter tin cậy qua cấu hình ứng dụng. Helper ban đầu vẫn gắn shop scope cho cả hai role, là phần còn thiếu phải sửa ở CORE-01.23 theo thiết kế hiện hành: underwriter dùng role nền tảng, seller dùng ownership shop. Không có adapter thực hoặc demo, nên app mặc định vẫn fail closed. Chưa có đăng nhập Authorization Code/PKCE, session hay kiểm quyền ở endpoint nghiệp vụ. Cần chốt các mục OAuth/OIDC trong GAPS, implement adapter theo contract provider và nguồn quyền thực, nối kiểm quyền vào từng endpoint và kiểm thử toàn bộ tại TEST-01. Không coi OAuth consent là consent sàn. Các thay đổi này chưa được kiểm thử và CORE-01.02 chưa hoàn thành.

Bổ sung thiết kế DB cho CORE-01.02: `database/riverbank-mini.dbml` có `auth_identities`, `identity_roles`, `seller_access_grants`, `authorization_events`; quyết định tham chiếu identity người ngân hàng và assignment underwriter, audit tách actor người/hệ thống. Seller là người vay có ownership shop; underwriter thuộc lending platform, dùng role cấp nền tảng mini một ngân hàng, không cần grant shop. Chọn DB làm nguồn quyền, giữ một shop mỗi seller và không tự cấp quyền từ đăng nhập. [Thiết kế và đánh giá](../database/README.md) ghi FK/CHECK, partial index, chống race thu hồi/quyết định và acceptance còn lại. Cần migration/privilege/transaction, provisioning được ngân hàng kiểm soát, resolver DB, tách helper/dependency role nền tảng khỏi ownership seller và chốt provider/session; CORE-01.02 vẫn `in_progress`. Kiểm thử backend/tích hợp để TEST-01.

Kiểm tra thiết kế 2026-10-31: DBML CLI 11.0.0 xuất PostgreSQL thành công; pglast/Python 3.12 parse 104 câu lệnh, 14 bảng và 21 `ALTER TABLE`, không chạy vào DB. JSON tasklist và `git diff --check` đạt. Lệnh, môi trường và giới hạn được ghi tại `database/README.md`; không chạy `make test`, không có kết quả test backend/tích hợp cho thiết kế này.

Rà soát tasklist 2026-10-31: thêm CORE-01.18–23 cho contract provider, migration auth/baseline sellers, resolver DB, provisioning/audit, verifier và helper/dependency tách role nền tảng khỏi ownership. CORE-01.18 đang blocked vì chưa có quyết định provider/session/control plane; CORE-01.19 có thể bắt đầu độc lập theo thiết kế DB và BASE-01. CORE-01.02 tích hợp sau các subtask này; login client thuộc FE-01.02. CORE-01.24 phải thống nhất tiền VND nguyên, tên DB/API, snapshot/idempotency/lease và version điều khoản trước business migration CORE-01.07. Không tự sửa policy hoặc coi schema mini đã thay bất biến.

Tasklist bổ sung documents schema và acceptance auth, giữ nguyên trạng thái task cũ, quy định mỗi task lớn một phiên và kiểm thử mới ở TEST-01; riêng POL-01.07 phải chạy trước xác nhận/nạp policy. `depends_on` yêu cầu artifact/quyết định liên quan, không yêu cầu mọi task triển khai thành `done` trước TEST-01. Sau implementation vẫn giữ `in_progress` đến khi đạt acceptance và kiểm thử; gate workflow không chặn nền/auth độc lập. TEST-01.09 bao phủ migration/quyền DB và TEST-01.08 phụ thuộc artifact OBS-01. Chưa triển khai code hoặc chạy kiểm thử backend trong lần rà soát kế hoạch này.

Đóng gói bàn giao Git 2026-10-31: code nền/config được commit WIP tại `72d9c3a` (28 file), hook Ruff lint và format đều Passed. Bộ schema/tài liệu/tasklist tiếp theo gồm 15 file theo HANDOFF.md. Chưa chạy `make test` hoặc nghiệm thu nghiệp vụ trong lần đóng gói; không đổi các trạng thái đang chờ code/test và không coi commit là đã push/merge/deploy.

Contract Plan nội bộ trong `api/services/underwriting/models.py` kiểm số nguyên, tổng lịch, kỳ trả và input cap truyền từ caller. Đây chưa phải kiểm quyền, consent hay guard; chưa có endpoint tạo hồ sơ, cấu hình cap được phép hoặc giới hạn kích thước request. Bổ sung kiểm thử tại TEST-01 trước nghiệm thu.

Repository case in-memory và evidence envelope mới chỉ là nền nội bộ: idempotency tạo case theo seller và scope shop, event tạo case, hash gắn case/run. Chưa có concurrency update, migration, persistence, quản lý run, provenance được xác thực hay phân quyền HTTP; không dùng với dữ liệu thật. Kiểm thử để tại TEST-01.

CORE-01.19: đã thêm SQL baseline seller/auth và Docker Compose local, API chỉ kiểm kết nối DB; chưa có repository business hoặc resolver. Chưa nghiệm thu migration, quyền DB và transaction; business migration vẫn chờ CORE-01.24/VER-01.01. Xem `database/README.md` để chạy và xử lý volume; không dùng dữ liệu thật.

CORE-01: thêm `database/drafts/002_business_draft.sql` minh họa chín bảng business trong DBML, dùng bigint cho cột tiền VND. Chỉ là bản nháp chưa chạy, không thay gate CORE-01.24/VER-01.01; còn thiếu lifecycle version điều khoản, contract JSON/snapshot/idempotency/lease và kiểm thử. Không coi là migration hoặc DB đã tích hợp.

Cập nhật 2026-10-31: draft business đã được áp dụng thủ công vào volume local theo yêu cầu, tổng 14 bảng; chưa tích hợp repository hoặc nghiệm thu, gate migration chính thức vẫn mở.

CORE-01.20: thêm `PostgresGrantResolver` đọc quyền theo identity đã xác minh, chỉ cấp scope seller từ ownership của assignment còn hiệu lực, không yêu cầu ownership cho role underwriter. Một truy vấn dùng cùng thời điểm DB; lỗi DB hoặc dữ liệu không hợp lệ đóng quyền. Chưa nối adapter vào app, chưa có verifier provider, runtime DB role hoặc provisioning, và helper role vẫn cần sửa tại CORE-01.23. Bổ sung kiểm thử trên PostgreSQL tại TEST-01. CORE-01.19 vẫn cần phân quyền runtime/control plane, audit transaction và kiểm chứng baseline; CORE-01.20 còn `in_progress`.

Kiểm tra thay đổi resolver trên macOS: `uv run --locked ruff check api/security/postgres_grants.py`, `uv run --locked ruff format --check api/security/postgres_grants.py`, `python3 -m json.tool tasklist.json > /dev/null` và `git diff --check` đều exit 0. Chưa chạy test nghiệp vụ, `make test` hoặc PostgreSQL trong phiên này theo kế hoạch TEST-01; chưa có số pass/skip/fail và chưa nghiệm thu.

CORE-01.19: thêm migration 002 tạo nhóm reader NOLOGIN với quyền SELECT theo cột tối thiểu cho resolver, cùng script thu hồi tại `database/rollback`. Resolver tham chiếu rõ schema `public`. Chưa áp dụng vào database đã tồn tại, chưa cấp membership hay cấu hình app. Cần kiểm quyền hiệu lực (PUBLIC, membership, owner, superuser), migration/rollback, và hoàn thiện control plane cùng audit transaction; xem `database/README.md`. Không đánh dấu hoàn tất trước TEST-01.

Kiểm tra phiên này trên macOS: `uv run --locked ruff check api/security/postgres_grants.py`, `uv run --locked ruff format --check api/security/postgres_grants.py`, `python3 -m json.tool tasklist.json > /dev/null` và `git diff --check` đều exit 0. Không chạy SQL trên PostgreSQL, `make test` hoặc test nghiệp vụ; không có số pass/skip/fail. Sau rollback role vẫn tồn tại, nên 002 cố ý không chạy lại thành công cho đến khi operator xử lý role và các phụ thuộc một cách có kiểm soát.

CORE-01.23: đã tách helper kiểm role underwriter nền tảng và ownership seller/shop; scoped grant chỉ nhận seller. Chưa nối dependency vào API, chưa có verifier provider hoặc kiểm thử; consent, liên kết nested resource và kiểm/khóa quyền khi ghi quyết định vẫn riêng. Tiếp tục tích hợp sau CORE-01.22, kiểm thử tại TEST-01; giữ `in_progress`.

Kiểm tra helper trên macOS: `uv run --locked ruff check api/security/auth.py`, `uv run --locked ruff format --check api/security/auth.py`, `python3 -m json.tool tasklist.json > /dev/null` và `git diff --check` đều exit 0. Chưa chạy `make test`, test nghiệp vụ hoặc PostgreSQL theo kế hoạch TEST-01; không có số pass/skip/fail.

CORE-01.02/23: `GET /v1/auth/me` dùng dependency xác thực chung, có dependency underwriter và helper ownership seller cho route tương lai. Cấu hình app mặc định vẫn fail closed; chỉ được inject verifier và resolver đáng tin cậy từ server. Chưa có provider, chưa mở endpoint hồ sơ hoặc nối repository/engine/policy; helper không thay kiểm resource, consent hoặc kiểm/khóa quyền trong transaction. Cần kiểm thử auth HTTP và các route tại TEST-01.

Kiểm tra API foundation trên macOS: `uv run --locked ruff check api/main.py api/security/dependencies.py`, `uv run --locked ruff format --check api/main.py api/security/dependencies.py`, `python3 -m json.tool tasklist.json > /dev/null` và `git diff --check` đều exit 0. Không chạy test HTTP, `make test` hoặc PostgreSQL theo kế hoạch TEST-01; không có số pass/skip/fail.

CORE-01.22: theo lựa chọn Auth0 cho hackathon, thêm verifier JWT RS256 và cấu hình tùy chọn theo issuer, audience, client ID; JWKS lấy từ issuer cấu hình với timeout/cache, role vẫn lấy từ DB. `api.main:app` chỉ bật auth khi đủ cấu hình Auth0 và PG; cấu hình thiếu giữ 503. Đây là code chưa kiểm thử, chưa gọi Auth0, chưa xác minh contract tenant thực hoặc tạo login frontend. Cần xác nhận access-token subject map đúng OIDC subject, audience/azp, provisioning/control plane và session; CORE-01.18 vẫn blocked và CORE-01.22 `in_progress`. Không dùng với dữ liệu thật trước kiểm thử/thiết lập quyền DB.

Kiểm tra phiên Auth0 trên macOS: `uv run --locked ruff check api/main.py api/security/auth0.py`, `uv run --locked ruff format --check api/main.py api/security/auth0.py`, `python3 -m json.tool tasklist.json > /dev/null` và `git diff --check` exit 0 sau khi format. Chưa chạy test verifier/HTTP, `make test` hay PostgreSQL theo kế hoạch TEST-01; chưa gọi Auth0, không có số pass/skip/fail.

## Bàn giao TEST-01 (2026-10-31)

Đã thêm kiểm thử offline assessment sơ bộ golden A/B/E, feature/PD, CIC và consent tách biệt, role/ownership, JWT Auth0 bằng khóa tổng hợp, idempotency đồng thời trong một process, evidence hash/scope và thu hồi consent demo. `ScopedPayoutReader` được kiểm tra thu hồi trong lúc đọc; đây không chứng minh thao tác nguyên tử hoặc cùng grant. Các test không chạy policy chưa phê duyệt và không gọi dịch vụ thật.

macOS 26.6.2, Python 3.12.16, uv 0.13.6: `uv run --locked pytest` đạt 45 passed, 0 skipped, 0 failed. `make test` đạt sau khi định dạng khối Python trong `database/README.md`; lint, format và pytest đều đạt. Docker Compose local đang chạy, nhưng chưa chạy test PostgreSQL: volume hiện có dữ liệu/schema thử nghiệm và chưa có fixture DB cô lập. Chưa có test tích hợp provider/JWKS thực, HTTP nghiệp vụ, migration/privilege/rollback, provisioning/race DB, policy, workflow, memo/guard, UI, handoff/LOS hoặc đo OBS. Không suy diễn test offline thành nghiệm thu các phần đó; tiếp tục TEST-01 và các phụ thuộc trong phiên phù hợp, chưa đánh dấu hoàn thành hay sẵn sàng PR.

CORE-01.08: thêm `api/services/underwriting/cashflow_evidence.py` để đóng gói kết quả CashFlowEngine vào E5, giữ hai bảng, gap, ngưỡng cảnh báo và đề xuất/lịch nếu có. Helper chỉ tuần tự hóa kết quả đã được truyền vào; không xác thực nguồn hay chứng minh kết quả được tính từ snapshot, không truy cập dữ liệu sàn, không nối workflow hoặc lưu bền. Workflow phải thiết lập liên kết case/run, snapshot và kết quả, đồng thời qua các gate CORE-01.24, VER-01 và POL-01 trước tích hợp. Cần bổ sung kiểm thử E5 cùng các nhánh gap 0/gap dương tại TEST-01; CORE-01 vẫn chưa hoàn tất.

Kiểm tra helper trong phiên này: `uv run --locked ruff check api/services/underwriting/cashflow_evidence.py`, `uv run --locked ruff format --check api/services/underwriting/cashflow_evidence.py`, `python3 -m json.tool tasklist.json > /dev/null` và `git diff --check` đều exit 0. Chưa chạy test nghiệp vụ hay `make test` theo kế hoạch TEST-01; không có số pass/skip/fail mới và chưa nghiệm thu.

## Kế hoạch endpoint theo module

CORE-01.25 ghi yêu cầu đưa toàn bộ HTTP handler vào `api/routers/`, tách schema/service/repository và chỉ lắp router trong `main.py`. Bản đồ endpoint, module và task nằm tại [API.md](API.md). Các subtask endpoint CORE-01.02–17 vẫn giữ dependency và gate hiện tại; QA-01, EXP-01, P7-01 và BANK-01 giữ contract và gate riêng. Đây là kế hoạch, chưa triển khai hoặc nghiệm thu endpoint mới. Phiên tiếp theo chọn một task lớn và đọc đầy đủ tài liệu theo tasklist trước khi triển khai.

## Bàn giao thiết kế luồng trong tasklist

DOC-01: đã bổ sung `flow_design` trong `tasklist.json` để truy vết 14 luồng theo API, logic, repository, gate và acceptance; bổ sung các subtask SRC-01.08–.10, CORE-01.26–.29, QA-01.05, EXP-01.05, P7-01.06 và TEST-01.10 cho các khoảng trống được phát hiện. Các task mới là kế hoạch, giữ trạng thái `pending` hoặc `blocked`, không mở endpoint, nạp policy hoặc triển khai luồng. Các contract consent, nguồn thật, retention, tái thẩm định và P7 vẫn chờ quyết định có thẩm quyền; không tự suy method/path. Các task lớn tiếp theo cần được triển khai trong phiên mới theo dependency, và DOC-01.01–.02 còn phải đối chiếu implementation/test thực tế.

Kiểm tra trong phiên này: `python3 -m json.tool tasklist.json > /dev/null` và `git diff --check` exit 0; script kiểm tra 132 ID task/subtask không trùng, mọi tham chiếu `depends_on` tồn tại và có 14 bản ghi flow. Đây là kiểm tra cấu trúc backlog, không phải kiểm thử nghiệp vụ; không chạy `make test` và không thay đổi trạng thái nghiệm thu.

## Bàn giao CORE-01.25

Đã chuyển `GET /health/db` và `GET /v1/auth/me` sang `api/routers/health.py` và `api/routers/auth.py`; kiểm tra kết nối DB nằm trong `api/services/health.py`. App vẫn dùng dependency xác thực và cấu hình như trước; chưa mở endpoint nghiệp vụ. CORE-01.25 còn `in_progress`: các endpoint khác phụ thuộc gate riêng, cần kiểm thử HTTP/OpenAPI, quyền và lỗi tại TEST-01 trước nghiệm thu.

Kiểm tra tĩnh trong phiên: Ruff lint và format cho các file Python thay đổi, kiểm tra JSON và `git diff --check`. Không chạy test HTTP hoặc `make test` theo kế hoạch TEST-01; không có kết quả pass/skip/fail mới.

CORE-01.25 tiếp tục: đã khai báo schema phản hồi `auth/me` tại `api/schemas/auth.py`, gồm identity, roles và seller scoped grants; FastAPI dùng schema này để mô tả và validate response. Chưa kiểm thử HTTP/OpenAPI hoặc xác minh provider thật. Kiểm tra tĩnh Ruff, JSON và `git diff --check` trong phiên này; chưa chạy `make test` theo kế hoạch TEST-01.

## Kiểm tra nghiệm thu CORE-01 foundation (2026-10-31)

Đã bổ sung kiểm thử HTTP offline qua ASGI cho `auth/me`: thiếu/sai token, verifier hoặc resolver không sẵn sàng, thiếu cấu hình và trả identity/role/seller scope từ adapter giả. Kiểm `health/db` với cấu hình thiếu, kết nối lỗi và kết nối giả thành công; kiểm OpenAPI bảo vệ `auth/me`, schema response và ẩn health. Không kết nối DB hoặc provider thật.

macOS, Python 3.12.16, pytest 8.4.2: `make test` đạt lint, format và 47 passed, 0 skipped, 0 failed. CORE-01.25 chưa hoàn tất: endpoint nghiệp vụ, quyền resource, idempotency/conflict và kiểm thử tương ứng còn thiếu. CORE-01.02/.19/.20/.22/.23 chưa đủ nghiệm thu DB/provider, quyền giao dịch và contract tenant/provisioning. CORE-01.18 và VER-01.01 vẫn chờ quyết định có thẩm quyền; kết quả offline không thay xác nhận đó. Giữ trạng thái các task và gate hiện tại.

## Đăng nhập hai role cho hackathon

Người dùng xác nhận bốn thành viên đều cần role seller và underwriter, dùng tài khoản/dữ liệu giả lập. `GET /v1/auth/me` đã trả được đồng thời hai role từ resolver; hướng dẫn FE tại API.md. Đã thêm `RIVERBANK_CORS_ORIGINS` tường minh cho app và Compose, mặc định đóng. Chưa gắn quyền cho bốn người: cần issuer và subject đã xác minh, seller/shop tương ứng và control plane/provisioning có audit; không tự provision từ đăng nhập. Tenant, callback, audience, client, session và subject mapping còn cần xác nhận; CORE-01.18/.21 chưa hoàn tất.

macOS, Python 3.12.16: `make test` đạt lint, format và 49 passed, 0 skipped, 0 failed. Kiểm HTTP và quyền dùng adapter giả; chưa kiểm tra Auth0, PostgreSQL hay đăng nhập frontend thực.

## Ưu tiên hiện tại: logic lõi và API

Theo yêu cầu, tạm hoãn cấu hình Auth0 tenant và cấp quyền bốn thành viên. Tiếp tục trong CORE-01 với CORE-01.30: service assessment nội bộ dùng dữ liệu synthetic và engine hiện có; tiếp theo CORE-01.31: schema và contract API lõi. Các mục này chỉ chuẩn bị tích hợp; không mở endpoint nghiệp vụ hoặc truy cập dữ liệu thật khi chưa có xác thực, ownership, consent, persistence và các gate policy/version tương ứng. Giữ gap 0 không gọi PD/CIC/rule, không tự quyết định tín dụng và không nạp policy chưa được test/xác nhận.

CORE-01.18/.21 và các dependency hiện có không bị xóa; việc cấu hình Auth0 và provisioning trở lại trước khi tích hợp hoặc vận hành với tài khoản thật. Kiểm thử theo TEST-01, ngoại lệ POL-01.07 phải chạy trước phê duyệt/nạp policy. Cập nhật này chỉ thay kế hoạch, chưa triển khai hoặc nghiệm thu service/API mới.

### Tiến độ CORE-01.30–31

Đã thêm service tính fixture synthetic nội bộ và schema preview/request cùng mapping lỗi idempotency; chưa bật route. Gap 0 bỏ nhánh vay; gap dương giữ `INCOMPLETE` vì consent, PD, CIC và policy chưa được xác minh/tích hợp. Các tham số do caller cung cấp không phải policy đã phê duyệt. Tiếp tục kiểm thử tại TEST-01 và hoàn thiện contract case, input guard, quyền, consent, persistence và các gate trước khi tích hợp HTTP. Hai subtask vẫn `in_progress`.

Phiên này trên macOS: `uv run --locked ruff check` và `uv run --locked ruff format --check` cho ba file mới đạt; `python3 -m json.tool tasklist.json` và `git diff --check` đạt. Không chạy hoặc bổ sung kiểm thử nghiệp vụ theo kế hoạch TEST-01; không có số pass/skip/fail trong phiên này.

### Route lõi fail closed

Các path lõi SRS đã được đăng ký như placeholder có xác thực và role, trả 503 `WORKFLOW_UNAVAILABLE` khi đến handler. POST case kiểm thêm schema, idempotency header và ownership từ grant; các route chưa thực hiện workflow, chưa có đầy đủ schema body, và quyền trên case/resource chưa được kiểm qua repository. Hoàn thiện từng route sau gate tương ứng, kiểm thử tại TEST-01; CORE-01.25 vẫn in_progress. Xem HANDOFF để biết lệnh kiểm tra phiên này.

### DOC-01: hợp nhất SRS đích ngày 2026-10-31

Đã thay SRS tóm tắt bằng SRS 1.2 hợp nhất từ bản đính kèm người dùng: giữ đủ 41 FR nghiệp vụ và 6 NFR, thêm 6 AUTH (OAuth 2.0/OIDC, access token và quyền server) cùng 2 CONSIST. Ma trận khác biệt và cách dung hòa nằm trong `SRS_GAP_ANALYSIS.md`; không kế thừa báo cáo code “đạt” của commit lịch sử. GAPS ghi thêm consent và hiệu lực/tái thẩm định từ blocker có sẵn. DOC-01 giữ in_progress; việc hợp nhất tài liệu không nghiệm thu code hoặc phê duyệt policy.

Kiểm tra tài liệu: script Python xác nhận đủ ID nguồn đích, không trùng, mỗi FR có acceptance; liên kết local, JSON tasklist, ID/dependency/document paths hợp lệ; `git diff --check` đạt. Không chạy kiểm thử nghiệp vụ trong thay đổi tài liệu. Tiếp theo triển khai/kiểm thử theo tasklist và chốt các quyết định bên ngoài còn mở.

CORE-01.02/25: khôi phục `auth/me` dùng access token qua verifier Auth0 và resolver DB, bỏ route cấp token/mật khẩu khỏi app. Các router nghiệp vụ được cung cấp vẫn giữ trong repo nhưng chưa lắp: tạm dùng placeholder fail closed trong `api/routers/foundation` vì ownership/consent/policy chưa được tích hợp và nghiệm thu. Docker API khởi động; `/docs` trả 200, `/v1/auth/me` không token trả 401. Ruff check/format và `git diff --check` đạt; chưa chạy bộ test hoặc kiểm Auth0/DB thực. Cần cấu hình và xác nhận tenant, provisioning, kiểm thử TEST-01 và tích hợp quyền/resource trước khi mở workflow.
