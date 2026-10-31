# Riverbank Hackathon

Riverbank thẩm định vốn lưu động theo dòng tiền payout của seller Shopee. Code tính số, model diễn giải, nhân sự ngân hàng quyết định. Đọc [AGENTS.md](AGENTS.md) và [tài liệu sản phẩm](Agents/README.md) trước khi phát triển.

Hiện có FastAPI `/health`, cấu hình, test offline, Docker ARM64 và cấu hình CI/CD cho EC2 + Compose + Caddy. Engine, auth, frontend, DB, Kafka và Valkey chưa triển khai. Các thành phần trong SAD là kiến trúc đích.

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

Cấu hình tập trung tại `api/config.py`. `.env` là tùy chọn, mẫu `.env.example` không có secret; biến môi trường ưu tiên hơn file. Không commit `.env` hoặc credentials. `RIVERBANK_ENVIRONMENT` hiện chỉ là nhãn, không bật tích hợp ngoài.

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

Không dùng IP/domain, bucket hoặc secret namespace của Riverbank cũ. Không cần AWS access key cho flow GHCR/SSH này. GITHUB_TOKEN dùng để publish/pull GHCR; credentials trên host được lưu tạm rồi xóa. SSH bắt buộc kiểm host key.

Chuẩn bị EC2 Ubuntu ARM64 có Docker Engine, Compose v2, Bash, curl và flock; user SSH có quyền Docker. Security group mở 80/443, SSH theo nguồn truy cập đã chọn; DNS domain trỏ tới IP mới. Tạo `/opt/riverbank-hackathon` thuộc user deploy và file `.env` chỉ chứa:

```dotenv
SITE_ADDRESS=api.example.com
```

Giá trị phải khớp GitHub variable. Caddy cấp chứng chỉ HTTPS và giữ certificate trong named volume. API không mở port ra host. Chưa có Terraform hoặc tài nguyên AWS được tạo bởi repo này.

Deploy lưu mỗi bản tại `releases/<SHA>`, chờ container healthy, kiểm image đang chạy và HTTP HTTPS. Thành công mới đổi symlink `current`, giữ `previous`. Thất bại tự phục hồi **image và cấu hình Compose/Caddy trước đó**, kiểm lại health và vẫn trả lỗi để run đỏ. Lần đầu lỗi thì dừng stack, giữ volume. Có khóa chống deploy đồng thời; không tự prune image/volume. Compose một máy có thể gián đoạn ngắn; rollback này chưa xử lý migration DB.

## Kiểm chứng

Local đã chạy Python 3.12 trong WSL, `make test`, Docker ARM64 qua QEMU, Compose/Caddy và bài kiểm tra rollback. Kết quả chi tiết của lần cập nhật mới nhất ở [NEXT_STEPS](Agents/NEXT_STEPS.md). Workflow chưa có run GitHub thực tế; GHCR push, SSH production và HTTPS AWS chưa kiểm chứng. Sau run đầu đạt, đặt required checks **Quality** và **Docker ARM64** cho `main`. Không đặt job Deploy EC2 làm required check cho PR.
