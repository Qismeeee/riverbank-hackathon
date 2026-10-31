# Riverbank Hackathon

Riverbank thẩm định vốn lưu động theo dòng tiền payout của seller Shopee. Code tính số, model diễn giải, nhân sự ngân hàng quyết định. Đọc [AGENTS.md](AGENTS.md) và [tài liệu sản phẩm](Agents/README.md) trước khi phát triển.

Hiện có FastAPI `/health`, `/ready`, cấu hình RDS/S3/model, SDK AWS/PostgreSQL, CORS, test offline, Docker ARM64 và CI/CD cho EC2 + Compose + Caddy. Engine, auth, frontend, repository/migration nghiệp vụ chưa triển khai. Kafka/Redis đã được dựng cho repo mới. Các thành phần trong SAD là kiến trúc đích.

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

Cấu hình tập trung tại `api/config.py`. `.env` là tùy chọn, mẫu `.env.example` không có secret; biến môi trường ưu tiên hơn file. Không commit `.env`, accessKeys CSV hoặc credentials. Các tên `RIVERBANK_ENV=cloud`, `AWS_PROFILE`, `DATABASE_URL`, `S3_BUCKET`, `ALLOWED_ORIGINS` và key provider được đọc trực tiếp; secret được che trong repr. Đọc cấu hình và khởi động API không tự gọi AWS/model. `/health` là liveness; `/ready` ở cloud/production kiểm `SELECT 1` read-only và S3 HeadBucket, lỗi trả HTTP 503; khi cấu hình Kafka/Redis thì kiểm cả hai dịch vụ. Local/test trả readiness rỗng mà không gọi mạng. Chưa kiểm quyền ghi hoặc nghiệp vụ qua endpoint này.

## Dùng RDS/S3 prod từ máy dev

Theo lựa chọn của chủ dự án, `.env` local hiện trỏ bucket và database prod hiện hữu. AWS profile `riverbank` được cấu hình ngoài repo; profile `default` giữ nguyên. Không tạo DB/bucket mới, không mở RDS ra Internet. Các key model đã có được giữ trong `.env`, chưa gọi model để kiểm chứng.

RDS private được nối qua SSH tới EC2 mới `3.0.194.9`. Giữ một terminal mở tunnel:

```powershell
.\.tools\Scripts\uv.exe run --offline --no-sync python -m scripts.db_tunnel
```

Mở terminal thứ hai cho Kafka/Redis:

```powershell
.\.tools\Scripts\uv.exe run --offline --no-sync python -m scripts.db_tunnel --services
```

Trong WSL/Linux dùng `make db-tunnel` và `make services-tunnel`. Tunnel dịch vụ đọc IP container hiện tại qua SSH; khởi động lại tunnel nếu container được recreate. Kafka ở `127.0.0.1:19092`, Redis ở `127.0.0.1:16379` trên máy dev. Trên EC2 hai dịch vụ không publish cổng ra host/Internet. `.env` dev chứa mật khẩu lấy từ Secrets Manager, được Git bỏ qua; không đưa file này sang FE.

Terminal khác chạy API bằng `python -m api` qua uv như trên. Trên Linux/WSL có thể dùng `make db-tunnel` với profile, đường dẫn key và CA phù hợp môi trường đó. `.env` được tạo trong phiên hiện tại dành cho Windows; không sao chép các đường dẫn máy cá nhân sang EC2 hoặc máy teammate.

`DATABASE_URL` đã chứa credential thật, dùng cổng local 15432 qua `hostaddr=127.0.0.1`, đồng thời xác minh TLS theo hostname RDS với `sslmode=verify-full` và CA của AWS. Key SSH, known_hosts và CA local ở `.cache/`, được Git bỏ qua. Khi Secrets Manager xoay mật khẩu DB, cần cập nhật credential trong `.env`; không sửa URL thủ công bằng cách bỏ xác minh TLS. Kết nối đã được kiểm bằng `SELECT 1` trong transaction read-only và S3 `HeadBucket`; chưa chạy migration, ghi dữ liệu hoặc kiểm quyền ghi S3.

## Docker

Cần Docker Engine Linux/Buildx và QEMU nếu máy x86 chạy ARM64:

```bash
make docker-build PLATFORM=linux/arm64
make docker-smoke PLATFORM=linux/arm64
```

Image khóa Python/uv theo digest, chạy user `10001:10001`, chỉ có runtime dependency. API, healthcheck và proxy trong container dùng cổng 8000. Smoke test kiểm tra platform, user, HTTP và chờ Docker báo healthy rồi dừng container tạm. Docker Desktop máy hiện tại lỗi bootstrap; kiểm chứng dùng Docker Engine của WSL Ubuntu 24.04.

## Hạ tầng hiện tại — 31/10/2026

| Thành phần | Cấu hình và bằng chứng |
|---|---|
| EC2 | `i-06ab8a545deb7a7f3`, ARM64 t4g.small 2 GB; EIP `3.0.194.9` |
| API | `https://3-0-194-9.sslip.io`; `/health` và `/ready` HTTP 200, TLS hợp lệ |
| RDS | Database cũ được chủ dự án chọn dùng chung; private, mã hóa, verify-full, `SELECT 1` read-only đạt |
| Backup RDS | 1 ngày theo Free plan đã chọn; deletion protection bật. Chưa diễn tập restore |
| S3 | Dùng bucket hiện hữu; HeadBucket đạt, mã hóa AES256, versioning, block public. Quyền object của role mới chỉ ở `riverbank-hackathon/*` |
| Kafka | Apache 4.1.2, KRaft một broker, SASL PLAIN trong mạng Docker internal; RAM 768 MB/heap 256 MB, volume riêng |
| Topics | `riverbank-hackathon.commands`, `.events`, `.dlq`; 3 partition, replication 1, retention 24 giờ/128 MiB mỗi partition |
| Redis | Redis 7.4.12, ACL chỉ namespace `riverbank-hackathon:*`, default user tắt; maxmemory 64 MB/noeviction, container 192 MB, AOF everysec |
| Secrets | Credential Kafka/Redis độc lập trong Secrets Manager; trên host nằm trong thư mục mode 700, chỉ mount file cần thiết vào container |
| IAM | EC2 dùng `riverbank-hackathon-runtime`; deploy dùng `riverbank-hackathon-deploy`; cả hai có permissions boundary, không có quyền sửa IAM |
| Cognito | Essentials, public client Code flow, FE dùng PKCE S256; TOTP MFA bắt buộc; groups seller/underwriter |
| Registry | ECR private `riverbank-hackathon-api`, tag immutable, scan-on-push bật; đã push/pull image validation qua IAM |
| Monitoring | CloudWatch log API/Caddy/Kafka/Redis, giữ 30 ngày; RAM/đĩa và ServiceReady; 7 alarm gửi SNS `riverbank-alerts` |
| Budget | 30 USD/tháng trước credit, cảnh báo 50/80/100%; không phải hard spending cap |

Máy cũ `13.214.87.165` giữ nguyên và health HTTPS vẫn đạt. Stack clone trên máy mới đã dừng/tắt restart, giữ config/volume. Không có nghiệp vụ, worker hoặc model thật được kích hoạt. Không migration/ghi dữ liệu RDS; Kafka/Redis chỉ kiểm bằng dữ liệu giả rồi xóa dữ liệu test.

API đang chạy image `riverbank-hackathon:validation-7cfa72663e0f`, cấu hình ở `current -> releases/validation-7cfa72663e0f-network`. Đây là **working tree đã kiểm, chưa phải release commit từ GitHub**. ECR cũng có tag validation cùng digest. `current/image` cho biết image thực tế; các release và named volume được giữ để rollback.

Hệ thống một máy/RDS Single-AZ chưa có HA; dữ liệu Kafka/Redis vẫn phụ thuộc EBS của máy đó, root EBS hiện hữu chưa mã hóa. Retention Kafka không thay thế audit/outbox trong RDS. Không lưu raw PII lên Kafka/Redis khi chưa có chính sách dữ liệu. Dùng domain riêng khi vận hành lâu dài. Credit không bỏ giới hạn Free plan và không bảo đảm chi phí bằng 0.

## Cognito bàn giao FE/BE

| Giá trị | Production |
|---|---|
| User Pool | `ap-southeast-1_IwpfqsPbI` |
| Client ID | `6bn75vdg2p0pomc8k0e7gle1ld` — public, không có client secret |
| Issuer | `https://cognito-idp.ap-southeast-1.amazonaws.com/ap-southeast-1_IwpfqsPbI` |
| JWKS | Issuer + `/.well-known/jwks.json` |
| Login domain | `https://riverbank-hackathon-424016506356.auth.ap-southeast-1.amazoncognito.com` |
| Callback | `https://ezxriverbank-hackathon.vercel.app/auth/callback`, `http://localhost:3000/auth/callback` |
| Logout | `https://ezxriverbank-hackathon.vercel.app`, `http://localhost:3000` |

Đã kiểm discovery/JWKS và trang đăng nhập Code + PKCE: HTTP 200; chưa tạo tài khoản hoặc đổi code lấy token. FE cần triển khai callback, state và PKCE; BE kiểm JWT qua JWKS, issuer, expiration, client_id, token_use=access, groups và quyền từng hồ sơ/seller/shop. Không dùng ID token thay access token cho API. Membership underwriter do admin cấp, không cho FE tự gán. `.env.frontend` local chỉ chứa các biến công khai NEXT_PUBLIC để bàn giao cho Next.js; backend `.env` giữ riêng.

CORS đã cho `http://localhost:3000` và `https://ezxriverbank-hackathon.vercel.app`. Cognito infrastructure không đồng nghĩa auth/role nghiệp vụ đã có trong API.

## CI/CD

Một workflow: **Quality → Docker ARM64 → Deploy EC2**. PR chạy Quality/Docker; main được bảo vệ bằng hai checks từ GitHub Actions, strict update, bắt buộc PR và chặn force push. Quality dùng cùng `make test`, gồm Ruff, cfn-lint và pytest offline. Docker/Deploy dùng runner **ubuntu-24.04-arm native**; không tắt Redis ARM64 kernel self-test để chạy dưới QEMU.

CI kiểm container HTTP và Kafka/Redis authenticated IO, Python clients, ACL, không publish cổng, persistence sau restart. Không gọi AWS hoặc model trong unit test. Local x86 dùng `make services-smoke PLATFORM=linux/amd64`; kiểm ARM64 native đã chạy trên EC2. Các volume test được giữ, không tự prune.

Production dùng **GitHub OIDC → STS → ECR/S3 release artifact → SSM → EC2 Compose/Caddy**, không cần AWS access key hoặc SSH key trong workflow mới. Trust khớp repo subject immutable có owner/repo ID và environment production; environment chỉ cho main. Chỉ role deploy được push repo ECR của dự án, ghi prefix release và gọi đúng SSM document/EC2 được chỉ định. Instance role chỉ pull image và đọc đúng secret/prefix object cần dùng.

GitHub environment production đã có variables `AWS_ROLE_ARN`, `ECR_REPOSITORY`, `EC2_INSTANCE_ID`, `DEPLOY_BUCKET`, `SITE_ADDRESS`. Legacy SSH secrets chưa dùng bởi workflow mới; giữ trong lúc chuyển đổi, thu hồi sau khi CD mới chạy đạt. **ENABLE_DEPLOY=false** để tránh workflow cũ deploy trước khi người dùng push/merge phiên bản mới.

Image CD dùng full commit SHA immutable. Khi rerun cùng commit đã có image, workflow tái sử dụng tag đó. SSM tải artifact tương ứng, materialize service secrets, login ECR bằng role, gọi deploy script. Script có flock, kiểm architecture/image, container healthy và HTTPS health/readiness; chỉ promote khi đạt. Nếu lỗi, phục hồi image và Compose/Caddy trước đó, giữ volumes và trả lỗi. Rollback image không rollback schema hoặc message data.

Sau khi người dùng push, mở PR và merge code mới vào main, tự bật/chạy CD:

```bash
gh variable set ENABLE_DEPLOY --repo Qismeeee/riverbank-hackathon --body true
gh workflow run ci.yml --repo Qismeeee/riverbank-hackathon --ref main
```

Chưa chạy các lệnh này trong phiên hạ tầng. OIDC trust đã cấu hình, SSM verify thực tế Success, ECR push/pull đạt; **chưa có run GitHub chứng minh OIDC assume role và CD mới end-to-end**. Không gọi bước Verify của SSM là đã deploy một commit.

## Tái tạo và vận hành

`infra/platform.yaml` quản lý Cognito/ECR/OIDC/roles/profile/SSM bằng CloudFormation, stack `riverbank-hackathon-platform`. Template giữ lại pool, registry và secrets khi thay/xóa; tái sử dụng EC2/RDS/S3 cũ. Hai secret hiện hữu được truyền bằng parameters ExistingKafkaSecretArn/ExistingRedisSecretArn. Khi update stack, giữ nguyên ExistingGitHubProviderArn đã dùng để không vô tình đổi ownership provider.

Admin tạo managed policy RiverbankHackathonRoleBoundary từ `infra/aws-role-boundary.json`. User setup dùng `infra/aws-setup-policy.json` và `infra/aws-platform-policy.json` (tách để dưới 6.144 ký tự); runtime policy cũ không cần gắn vào role mới vì template có inline policy riêng. Không trao quyền setup cho GitHub hoặc API; thu hồi quyền setup rộng sau bàn giao. Không áp template vào tài khoản khác hoặc xóa stack/pool chỉ để retry lỗi.

Trên EC2, `.env` mode 600 chỉ chứa region, domain, DB/S3/secret references, SERVICE_SECRETS_DIR, CORS và Cognito public IDs; bản local `.env.production` dành cho Linux, không chứa mật khẩu. `scripts/service_secrets.py --aws` lấy credential từ role và ghi file trong thư mục bảo vệ; không in secret. Không tự rotate password service khi broker đang chạy: cập nhật file + restart có kiểm tra, giữ bản rollback và dữ liệu.

`scripts/monitor_services.py` chạy bằng cron mỗi phút, kiểm Docker và HTTPS readiness rồi gửi ServiceReady lên CloudWatch. Alarm thiếu datapoint cũng được xử lý như lỗi. Bốn alarm host cộng ba alarm availability hiện OK; SNS có subscription xác nhận, chưa có xác nhận nhận thông báo thử ở inbox.

## Kiểm chứng

`make test`: 34 passed, không skip trên Linux; cfn-lint, Ruff, actionlint, ShellCheck đạt. Pytest còn deprecation warnings từ kafka-python, không suppress để làm xanh. Docker API ARM64 build/health đạt; Kafka/Redis ARM64 native IO, ACL, clients và persistence đạt trên EC2. Windows dev qua SSH cũng kiểm được DB/S3/Redis/Kafka. RDS chỉ SELECT 1 read-only; chưa kiểm nghiệp vụ, ghi S3, restore hoặc token exchange/login đầy đủ. Xem thêm Agents/NEXT_STEPS.md và Agents/TEST_PLAN.md.
