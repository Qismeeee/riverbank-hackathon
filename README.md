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

Hiện có source layer, CashFlowEngine, kiểm thử offline và nền FastAPI; chưa có frontend hoặc HTTP workflow thẩm định. Có cấu hình PostgreSQL local tùy chọn cho kiểm tra kết nối; chưa có repository PostgreSQL, model hay kết nối dịch vụ ngoài. Bộ kiểm thử hiện tại chạy offline sau khi cài dependency, không cần credentials hoặc dữ liệu thật. Việc cài dependency và CI cần mạng. Các adapter, cấu hình runtime và kiểm thử tích hợp sẽ được thêm trong task tương ứng, không suy ra từ môi trường này.

## Nguồn dữ liệu demo (SRC-01)

`api/services/underwriting/sources.py` định nghĩa scope seller/shop, consent theo mục đích và thời gian, payout VND nguyên, provenance và snapshot có SHA-256. `ScopedPayoutReader` kiểm scope và consent trước khi đọc, rồi kiểm lại scope dữ liệu nguồn trả về. `demo_sources.py` cung cấp fixture payout hoàn toàn mô phỏng, có nhãn và không gọi mạng.

Đây là lớp Python nội bộ: caller phải xác thực actor và chỉ sử dụng reader, không gọi adapter trực tiếp. Đã có repository demo giữ consent/snapshot và tuần tự hóa thu hồi/lần đọc trong cùng một process. Chưa có auth actor, persistence bền, transaction phân tán hoặc tích hợp sàn thực. Hash cho phép kiểm tra nội dung snapshot nhưng không tự chứng minh nguồn hoặc tạo audit. Không dùng lớp demo làm kiểm soát truy cập production.

## CashFlowEngine (một phần ENG-01)

`api/services/cashflow.py` tính bảng cơ sở/xấu, gap và lịch đề xuất bằng số nguyên VND và tỷ lệ chính xác. Engine nhận cấu hình từ caller, không tự nạp policy; file tham số demo chỉ được đọc trong test offline và chưa được phê duyệt cho vận hành. Kỳ payout được giả định diễn ra từ `payout_start_week` đến hết `sell_weeks`; median nửa đồng được làm tròn xuống VND nguyên. Khi lịch vẫn vượt trần tại kỳ hạn tối đa, `fits_deduction_cap` là false và caller phải xử lý fail closed.

Đã có hợp đồng feature cho payout và điều phối sơ bộ: gap 0 dừng trước PD; gap dương luôn INCOMPLETE vì CIC và policy chưa có. Đã thêm CIC gate và adapter synthetic độc lập nhưng chưa nối workflow; mục đích consent demo chưa phải hợp đồng ngân hàng. Chưa có model PD, CIC thật, rule engine hoặc workflow hoàn chỉnh. Các thay đổi mới chưa được kiểm thử; chưa hoàn thành ENG-01 và chưa chứng minh invariant ở cấp workflow. Không dùng kết quả tính như quyết định tín dụng.

Danh sách công việc và phụ thuộc theo tài liệu nằm tại `tasklist.json`. Kiểm thử mới được để lại sau đợt triển khai theo yêu cầu; policy chưa qua kiểm thử và xác nhận không được nạp.

## Nền API (một phần CORE-01)

`api.main:app` đóng CORS mặc định; đặt `RIVERBANK_CORS_ORIGINS` thành danh sách origin HTTP(S) tường minh phân cách bằng dấu phẩy để frontend gọi API. `GET /v1/auth/me` xác thực access token và trả role server nếu cấu hình Auth0 và PostgreSQL đầy đủ; thiếu bearer trả 401, thiếu cấu hình trả 503. Adapter và provisioning chưa nghiệm thu trên tenant/DB thực; chưa có workflow hoặc endpoint nghiệp vụ. Xem [contract đăng nhập](Agents/API.md). Không dùng app này làm API thẩm định production.

`api/security/auth.py` định nghĩa ranh giới cho verifier access token và nguồn quyền đáng tin cậy. Helper ban đầu vẫn gắn scope shop cho cả hai role; CORE-01.23 phải sửa để underwriter dùng role nền tảng và seller dùng ownership shop theo thiết kế hiện hành. `create_app` có thể nhận service từ adapter server-side, nhưng repo chưa có verifier hay nguồn quyền thực và chưa triển khai đăng nhập PKCE. Không truyền adapter chưa kiểm chứng vào ứng dụng; việc kiểm scope không thay consent đọc dữ liệu sàn. Thay đổi chưa được kiểm thử.

[Schema mini](database/riverbank-mini.dbml) đã có thiết kế danh tính OIDC, role, ownership seller/shop và audit quyền. Underwriter là nhân sự trên lending platform, dùng role nền tảng; quyết định tham chiếu đúng identity/assignment underwriter. [Thiết kế auth database](database/README.md) giải thích luồng kiểm quyền, thu hồi và các ràng buộc phải có trong migration. Đã có SQL baseline auth cho Docker local, chưa có resolver DB hoặc migration được nghiệm thu.

Nền/auth CORE-01 có thể làm sau BASE-01; workflow đầy đủ qua gate ENG-01, VER-01, POL-01 và đối chiếu schema CORE-01.24. Provider/session OIDC vẫn chờ quyết định trong GAPS. Các kiểm thử mới và nghiệm thu để ở TEST-01 theo kế hoạch; không coi nền API là task đã hoàn thành.

Contract Plan nội bộ kiểm kiểu, tổng lịch trả, thời điểm trả và input cap do caller cung cấp; không tự nạp policy demo và chưa nối endpoint. Caller vẫn phải kiểm guard, xác thực, scope và consent. Thay đổi chưa được kiểm thử nghiệp vụ.

Repository case trong bộ nhớ chỉ dùng cho phát triển offline một process: lưu case/event tạo và idempotency theo seller, không xác thực actor hay lưu bền. Evidence envelope lưu payload JSON bất biến và hash gắn case/run, không xác thực nguồn. Chưa có optimistic concurrency, migration hoặc workflow nối hai thành phần; không dùng với dữ liệu thật. Kiểm thử nghiệp vụ chưa chạy.

## PostgreSQL và Docker local

Có cấu hình Docker Compose cho API và PostgreSQL cùng baseline seller/auth đang phát triển. Hướng dẫn khởi chạy, giới hạn và cách xử lý volume nằm ở [database/README.md](database/README.md#postgresql-local-tạm-thời-core-0119). API có thể kiểm tra kết nối qua `/health/db`, nhưng chưa lưu hồ sơ vào database. Business schema và migration còn phụ thuộc quyết định tại CORE-01.24/VER-01.01; không dùng thiết lập này cho dữ liệu thật.


## Deployment and operations from main

# Riverbank Hackathon

Riverbank thẩm định vốn lưu động theo dòng tiền payout của seller Shopee. Code tính số, model diễn giải, nhân sự ngân hàng quyết định. Đọc [AGENTS.md](AGENTS.md) và [tài liệu sản phẩm](Agents/README.md) trước khi phát triển.

Hiện có FastAPI `/health`, `/ready`, cấu hình RDS/S3/model, SDK AWS/PostgreSQL, CORS, test offline, Docker ARM64 và CI/CD cho EC2 + Compose + Caddy. Engine, auth, frontend, repository/migration nghiệp vụ, Kafka và Valkey của repo mới chưa triển khai. Các thành phần trong SAD là kiến trúc đích.

## Local

Cần Python 3.12, uv **0.13.6**, GNU make và Bash. Từ gốc repo:

```bash
uv python install 3.12
make setup
make test
make run
```

`make setup` cài dependency từ `uv.lock` và pre-commit hooks; CI dùng `make sync` để không cài hooks. Lần đầu cần mạng tải dependency. Sau setup, test và API chạy offline, không cần AWS, DB hoặc model key. `/health` mặc định tại `http://127.0.0.1:8000/health`, trả `{"status":"ok"}`; đây là liveness của API.

Nếu dùng chung checkout Windows/WSL, đặt `export UV_PROJECT_ENVIRONMENT=.venv-linux` trong WSL để giữ riêng môi trường. Máy hiện tại có uv tại `./.tools-linux/uv`; dùng `make UV=./.tools-linux/uv test` với `UV_CACHE_DIR=$PWD/.cache/uv-linux`.

PowerShell, sau khi đã cài Python 3.12:

```powershell
py -3.12 -m venv .tools
.\.tools\Scripts\python.exe -m pip install uv==0.13.6
$uv = (Resolve-Path .tools/Scripts/uv.exe).Path
& $uv sync --locked --dev --python 3.12
& $uv run --offline --no-sync ruff check api scripts
& $uv run --offline --no-sync ruff format --check api scripts
& $uv run --offline --no-sync pytest
& $uv run --offline --no-sync python -m api
```

Test deploy cần Bash/flock của Linux; trên Windows chúng được skip có lý do. Bộ nghiệm thu đầy đủ là `make test` trong WSL/Linux, bao gồm Bash syntax, Ruff và pytest.

Cấu hình tập trung tại `api/config.py`. `.env` là tùy chọn, mẫu `.env.example` không có secret; biến môi trường ưu tiên hơn file. Không commit `.env`, accessKeys CSV hoặc credentials. Các tên `RIVERBANK_ENV=cloud`, `AWS_PROFILE`, `DATABASE_URL`, `S3_BUCKET`, `ALLOWED_ORIGINS` và key provider được đọc trực tiếp; secret được che trong repr. Đọc cấu hình và khởi động API không tự gọi AWS/model. `/health` là liveness; `/ready` ở cloud/production kiểm `SELECT 1` read-only và S3 HeadBucket, lỗi trả HTTP 503. Local/test trả readiness rỗng mà không gọi mạng. Chưa kiểm quyền ghi hoặc nghiệp vụ qua endpoint này.

## Dùng RDS/S3 prod từ máy dev

Theo lựa chọn của chủ dự án, `.env` local hiện trỏ bucket và database prod hiện hữu. AWS profile `riverbank` được cấu hình ngoài repo; profile `default` giữ nguyên. Không tạo DB/bucket mới, không mở RDS ra Internet. Các key model đã có được giữ trong `.env`, chưa gọi model để kiểm chứng.

RDS private được nối qua SSH tới EC2 prod. Giữ một terminal mở tunnel:

```powershell
.\.tools\Scripts\uv.exe run --offline --no-sync python -m scripts.db_tunnel
```

Terminal khác chạy API bằng `python -m api` qua uv như trên. Trên Linux/WSL có thể dùng `make db-tunnel` với profile, đường dẫn key và CA phù hợp môi trường đó. `.env` được tạo trong phiên hiện tại dành cho Windows; không sao chép các đường dẫn máy cá nhân sang EC2 hoặc máy teammate.

`DATABASE_URL` đã chứa credential thật, dùng cổng local 15432 qua `hostaddr=127.0.0.1`, đồng thời xác minh TLS theo hostname RDS với `sslmode=verify-full` và CA của AWS. Key SSH, known_hosts và CA local ở `.cache/`, được Git bỏ qua. Khi Secrets Manager xoay mật khẩu DB, cần cập nhật credential trong `.env`; không sửa URL thủ công bằng cách bỏ xác minh TLS. Kết nối đã được kiểm bằng `SELECT 1` trong transaction read-only và S3 `HeadBucket`; chưa chạy migration, ghi dữ liệu hoặc kiểm quyền ghi S3.

## Docker

Cần Docker Engine Linux/Buildx và QEMU nếu máy x86 chạy ARM64:

```bash
make docker-build PLATFORM=linux/arm64
make docker-smoke PLATFORM=linux/arm64
```

Image khóa Python/uv theo digest, chạy user `10001:10001`, chỉ có runtime dependency. API, healthcheck và proxy trong container dùng cổng 8000. Smoke test kiểm tra platform, user, HTTP và chờ Docker báo healthy rồi dừng container tạm. Docker Desktop máy hiện tại lỗi bootstrap; kiểm chứng dùng Docker Engine của WSL Ubuntu 24.04.

## CI/CD

Một [workflow](.github/workflows/ci.yml): **Quality → Docker ARM64 → Deploy EC2**. Dev push nhánh và mở PR để chạy kiểm tra; cập nhật PR chạy lại. Push `main` và chạy thủ công cũng kiểm tra. Không có workflow CD thứ hai chạy lặp test. `Quality` dùng chính `make test`; Docker build/smoke ARM64 và kiểm Compose/Caddy.

CD chỉ chạy trên `main`, sau tất cả kiểm tra, khi repository variable `ENABLE_DEPLOY=true`. Mặc định chưa đặt biến thì chỉ chạy CI, không publish/deploy. Job CD dùng cache build đã kiểm, publish GHCR tag **full commit SHA**, SSH tới EC2 và gọi `infra/deploy.sh`. Không dùng `latest`. PR được hủy run cũ; main chạy tuần tự, giữ run đang chạy và tối đa một run mới nhất chờ.

Trước khi bật CD, tạo GitHub Environment **production**, giới hạn deployment branch `main`, cấu hình:

| Loại | Tên | Giá trị |
|---|---|---|
| Repository variable | `ENABLE_DEPLOY` | `true` sau khi host đã sẵn sàng |
| Production variable | `SITE_ADDRESS` | Domain API, ví dụ `api.example.com`, không kèm scheme/path |
| Production secrets | `EC2_HOST`, `EC2_USER` | Host và user của **dự án mới** |
| Production secret | `EC2_SSH_KEY` | Private key của user deploy |
| Production secret | `EC2_KNOWN_HOSTS` | Dòng known_hosts đã xác minh host key qua kênh tin cậy |

EC2/domain của repo mới tách khỏi máy ứng dụng cũ. Chủ dự án đã chọn dùng chung RDS/S3 hiện hữu; chưa cho phép migration hoặc ghi thử dữ liệu. Không cần AWS access key cho flow GHCR/SSH này. GITHUB_TOKEN dùng để publish/pull GHCR; credentials trên host được lưu tạm rồi xóa. SSH bắt buộc kiểm host key.

Chuẩn bị EC2 Ubuntu ARM64 có Docker Engine, Compose 2.24.4+, Bash, curl và flock; user SSH có quyền Docker. Security group mở 80/443, SSH theo nguồn truy cập đã chọn. Tạo `/opt/riverbank-hackathon` thuộc user deploy và file `.env` mode 600, ví dụ:

```dotenv
SITE_ADDRESS=api.example.com
AWS_REGION=ap-southeast-1
DB_HOST=your-private-rds-endpoint
DB_PORT=5432
DB_NAME=your-database
DB_SECRET_ID=your-existing-database-secret
S3_BUCKET=your-existing-bucket
ALLOWED_ORIGINS=http://localhost:3000
CLOUDWATCH_LOG_GROUP=/riverbank-hackathon/app
```

Domain phải khớp GitHub variable; thêm đúng origin HTTPS khi FE được xuất bản. Caddy giữ certificate trong named volume. API không mở port ra host. Container dùng instance role, không truyền AWS_PROFILE/access key/mật khẩu DB; `/ready` đọc AWSCURRENT từ Secrets Manager và xác minh TLS RDS bằng CA khóa checksum trong image. Không dùng `.env` Windows có SSH tunnel cho EC2.

CD dùng thêm `infra/compose.aws.yaml` để gửi log lên CloudWatch với buffer giới hạn, non-blocking. Tạo log group retention 30 ngày trước; role host cần quyền ghi stream. Compose base giữ log local để test. Hai policy `infra/aws-setup-policy.json` và `infra/aws-runtime-policy.json` lần lượt dành cho user vận hành và instance role hiện hữu. Setup policy có quyền sửa SG/RDS, nên admin cần thu hồi sau khi cấu hình xong; không gắn cho container hoặc GitHub Actions. Agent RAM/đĩa dùng `infra/cloudwatch-agent.json`.

Deploy lưu mỗi bản tại `releases/<SHA>`, chờ container healthy, kiểm image và HTTPS `/health` + `/ready`. Thành công mới đổi symlink `current`, giữ `previous`. Thất bại tự phục hồi **image và cấu hình Compose/Caddy trước đó**, kiểm lại health/readiness và vẫn trả lỗi. Lần đầu lỗi thì dừng stack, giữ volume. Có khóa chống deploy đồng thời; không tự prune image/volume. Compose một máy có thể gián đoạn ngắn; rollback này chưa xử lý migration DB.

## AWS đã kiểm — 31/10/2026

| Thành phần | Kết quả thực tế |
|---|---|
| EC2 mới | `i-06ab8a545deb7a7f3`, ARM64, EIP `3.0.194.9` |
| HTTPS | `https://3-0-194-9.sslip.io/health` và `/ready`: HTTP 200, chứng chỉ hợp lệ |
| RDS | Private, mã hóa, TLS verify-full, đọc secret bằng role, `SELECT 1` read-only đạt |
| Bảo vệ RDS | Deletion protection bật; backup **1 ngày** do Free Tier từ chối 7 ngày, chủ dự án chọn giữ Free Tier |
| S3 | HeadBucket đạt; block public, mã hóa AES256 và versioning bật |
| CloudWatch | Log API/Caddy thực tế, retention 30 ngày; có datapoint RAM/đĩa |
| Alarm | CPU ≥80%/10 phút, status check lỗi/2 phút, RAM ≥85%/5 phút, đĩa ≥80%/5 phút; SNS `riverbank-alerts` |
| GitHub | Environment production chỉ cho main; main bắt buộc PR + Quality/Docker ARM64, chặn force push; SSH key riêng/pinned host key đã kiểm; CD đang tắt |

Máy cũ `13.214.87.165` giữ nguyên, HTTPS health vẫn HTTP 200. Stack clone trên máy mới đã dừng, tắt restart và giữ config/volume. RDS chỉ thêm TCP 5432 từ SG EC2 mới; không mở public DB. Không chạy migration, ghi thử dữ liệu hoặc gọi model. Chưa diễn tập restore hay kiểm giao thông báo SNS.

Để kiểm AWS mà không tự commit/push, phiên này chuyển image từ working tree đã test, tag `riverbank-hackathon:validation-114a0e8ebf61`. Bản này đang chạy; mốc rollback `current -> releases/validation-114a0e8ebf61` ghi rõ nguồn local, **không phải release SHA GitHub**. `.env.production` local và `.env` trên host chỉ chứa tham chiếu, không có password DB/model key.

Người dùng cần commit/push phần cập nhật, mở PR và merge sau Quality/Docker ARM64 đạt. Khi code mới đã ở main, bật CD và chạy workflow:

```bash
gh variable set ENABLE_DEPLOY --repo Qismeeee/riverbank-hackathon --body true
gh workflow run ci.yml --repo Qismeeee/riverbank-hackathon --ref main
```

Các lệnh trên chưa chạy trong phiên này. Kiểm job Deploy EC2 và hai endpoint; `current/image` phải là tag full commit SHA mới. Hệ thống một EC2/RDS Single-AZ chưa có HA, root EBS hiện hữu chưa mã hóa. Cần domain riêng cho vận hành lâu dài. Auth/engine chưa xây nên chưa tiếp nhận hồ sơ tín dụng thật. EKS/Jenkins/ArgoCD/Grafana/Prometheus chưa cần cho phạm vi một máy này.

## Kiểm chứng

Local đã chạy Python 3.12 trong WSL, `make test` (26 pass), Docker ARM64 qua QEMU, Compose/Caddy và bài kiểm rollback. Kết quả ở [NEXT_STEPS](Agents/NEXT_STEPS.md). CI nền đã đạt **Quality** và **Docker ARM64** trên GitHub; phần cloud/readiness mới chưa commit/push để kiểm CI lại. AWS đã kiểm trực tiếp như trên; CD qua GHCR/SSH từ GitHub của phần mới chưa chạy. Required checks cho `main` là **Quality** và **Docker ARM64**; không dùng Deploy EC2 làm required check PR.
