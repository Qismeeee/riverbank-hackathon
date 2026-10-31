# Bối cảnh repo mới và hạ tầng Riverbank cũ

## Nguồn và trạng thái kiểm chứng

Đối chiếu ngày 31/10/2026:

- Repo mới: `Qismeeee/riverbank-hackathon`, thư mục làm việc `E:/SeaHackathon/riverbank-hackathon`, nhánh quan sát `docs/agents-foundation`, commit `56f8bbc`.
- Repo mới có `AGENTS.md`, `Agents/`, `policy/`, `knowledge/` và README. Chưa có `api/`, frontend, `infra/`, Makefile, dependency, test hay `.github/workflows/`. Không có skill DevOps trước lần bổ sung này.
- Các đường dẫn implementation trong Agents là thiết kế cần xây. Một số đoạn DATA/TEST_PLAN nói tới parser hoặc Makefile như đã có; kiểm tra file thực tế và README trước khi kết luận chúng tồn tại.
- Source tham chiếu cũ: `E:/riverbank`, commit local quan sát `87f49eb`. Đây là repository khác; không sửa repository đó như tác dụng phụ của task ở repo mới.
- Sơ đồ ngoài repo: `C:/Users/LOQ/Downloads/Riverbank-architecture-2026-10-30.drawio`, trang `Riverbank AWS`. Nội dung liên quan đã được tóm tắt dưới đây, không cần có file local này để dùng skill.
- Đã đọc Compose, `.env.prod` không chứa secret, CI/deploy workflow, Dockerfile, entrypoint và phần cấu hình ứng dụng của source cũ. Chưa kiểm kê AWS trực tiếp cho task này.

Snapshot này không khẳng định nhánh, commit hoặc phần đã triển khai sẽ giữ nguyên. Đọc lại repository trước mỗi công việc.

## Thiết kế của repo mới

`Agents/SAD.md` chọn FastAPI sau Caddy trên EC2 ARM64, RDS PostgreSQL, S3 cho raw ETL, Secrets Manager qua IAM role và GitHub Actions. Frontend dự kiến Next.js; vị trí package và môi trường tích hợp còn cần chốt với tech lead theo GAPS.

`Agents/TEST_PLAN.md` yêu cầu Python 3.12, uv, make, test offline; Docker/Postgres cần cho đường tích hợp DB. BASE-01 phải tạo các công cụ này trong repo, không được báo chúng đã chạy chỉ vì xuất hiện trong tài liệu.

Lộ trình trao đổi với người dùng: CI ngay từ đầu, CD cho mỗi phiên bản merge vào `main`, kiểm chứng API HTTPS tối thiểu trước khi dựng toàn bộ hệ thống. Kafka/Valkey của bản cũ là tham chiếu cho bước bổ sung, chưa phải phụ thuộc bắt buộc của BASE-01.

Account AWS, VPC/subnet, tên/domain/IP, IAM ARN, database/secret ARN, loại máy, ngân sách và quyền deploy của môi trường mới chưa được kiểm chứng. Terraform và OIDC/SSM từng được đề xuất như lựa chọn, chưa phải implementation hoặc quyết định bắt buộc. Không tạo cloud chỉ từ thông tin trong reference.

## Bản đồ hạ tầng cũ

| Thành phần | Quan sát từ sơ đồ và source cũ |
|---|---|
| Region/network | `ap-southeast-1`; EC2 public subnet có Elastic IP, RDS private subnet |
| Frontend | Next.js trên Vercel, gọi API qua HTTPS |
| EC2 | Sơ đồ ghi `riverbank-app`, `t4g.small`, RAM 2 GB, Docker Compose |
| Caddy | Cổng host 80/443; chuyển request API tới `api:8000`, `/db` tới pgweb, `/kafka` tới Console; hai đường quản trị qua Basic Auth |
| API | Python 3.12, Uvicorn 2 worker; container có hạn mức RAM `1200m` |
| Trong API | Engine, ModelGate, worker OCR và event relay; worker/relay khởi động trong lifespan, không phải container riêng |
| Database | Sơ đồ ghi RDS PostgreSQL 18, `db.t4g.micro`, Single-AZ; một Postgres cho feature và workflow |
| File sao kê | Compose đặt document store `local`, mount volume `statement_files` vào `/var/lib/riverbank/statements` |
| S3 | Raw ETL và export; không suy ra file sao kê đang lên S3 từ mô tả TDD cũ |
| Kafka | `apache/kafka:3.9.1`, KRaft một node, volume `kafka_data`; topic `riverbank.case-events`, 6 partition, replication factor 1 |
| Khởi tạo topic | Service một lần `kafka-topics` đợi broker healthy và tạo topic nếu chưa tồn tại |
| Kafka Console | `redpandadata/console:v3.12.0`, xem broker qua `/kafka`; sơ đồ ghi chưa có consumer nghiệp vụ |
| Valkey | `valkey/valkey:8.1-alpine`, port nội bộ 6379, tắt snapshot và AOF; bộ đếm/trạng thái ModelGate |
| pgweb | `sosedoff/pgweb:0.16.2`, kết nối RDS bằng thông tin đặt riêng trên EC2 |
| Secrets | Các secret LLM/auth và thông tin DB đọc bằng IAM role; không có AWS access key cần đặt trong source |
| Giám sát | Compose dùng driver `awslogs`, log group `/riverbank/app`; CloudWatch alarm thông báo qua SNS |
| Volume khác | `caddy_data` giữ certificate và `caddy_config` giữ cấu hình runtime |

Profile `events` trong Compose gom Kafka, topic initializer, Console và Valkey. `.env.prod` cũ bật profile này, chọn message bus Kafka, event relay `on`, KV store Valkey. Các mặc định `memory/off/memory` trong Compose không phản ánh trạng thái khi `.env.prod` này được nạp.

Luồng nghiệp vụ tham chiếu: API ghi hồ sơ/event/outbox; worker xử lý job OCR qua ModelGate; relay đọc outbox và publish Kafka với key `case_id`. Không dùng kiểm tra broker hoặc `/health` để suy ra các bước đó đã chạy đúng.

Sơ đồ ghi ModelGate 8 lượt song song, 120 lượt/phút, mật khẩu DB xoay 7 ngày và 4 alarm. README cũ ghi 3 alarm. Số alarm và chu kỳ xoay mật khẩu phải kiểm lại trên AWS; chúng không được định nghĩa đầy đủ bởi Compose/workflow. Không coi RAM hoặc model provider của bản cũ là cấu hình đã được chọn cho dự án mới.

## CI/CD cũ và phần cần cải thiện

- `ci.yml`: mọi PR và push nhánh khác `main`; Ubuntu, Python 3.12, pip cache, Ruff lint/format trên `api`, `eval`, `data/synth`, rồi pytest ở mode local.
- `deploy.yml`: push `main` hoặc chạy thủ công; ba job phụ thuộc `test -> build -> deploy`, concurrency `deploy-prod`, không hủy run đang chạy.
- Test của CD cũ chỉ `ruff check` trên API và pytest, thiếu format check và hai thư mục còn lại so với CI. Bản mới cần chung một bộ kiểm tra.
- Build context cũ là `api`, thêm named context `knowledge`; Dockerfile copy knowledge vào image. Không mang nguyên build config sang repo chỉ có tài liệu rồi coi là build được.
- Build `linux/arm64` qua QEMU/Buildx, push GHCR bằng `GITHUB_TOKEN`, gắn `latest` và SHA 7 ký tự. EC2 được chọn tag SHA khi deploy.
- SSH chép `infra/` tới thư mục deploy; `.env.prod` được chép thành `.env`, ghi tag image; `.env.local` trên máy được giữ lại.
- EC2 login GHCR, pull image, Compose up và reload Caddy. Smoke test gọi HTTPS `/health` tối đa 12 lần, nghỉ 5 giây giữa các lần thất bại.
- Khi smoke test thất bại, workflow cũ báo lỗi; chưa có rollback tự động. Runbook cũ đổi image tag rồi cập nhật container API.
- Hai workflow này triển khai ứng dụng lên AWS đã dựng sẵn. Repo cũ không có Terraform/CloudFormation để tái tạo toàn bộ hạ tầng.

## Chuyển cấu hình sang dự án mới

Tên dưới đây là đề xuất để phân biệt tài nguyên, chưa phải tài nguyên đã tạo:

| Nơi chỉnh khi có implementation | Giá trị cần tách |
|---|---|
| Compose và workflow build | Image `ghcr.io/qismeeee/riverbank-hackathon-api` |
| Workflow SSH | Đích mới, thư mục `/opt/riverbank-hackathon`; GitHub secrets `EC2_HOST`, `EC2_USER`, `EC2_SSH_KEY` nếu tiếp tục dùng SSH |
| Compose/API config | `DB_HOST`, `DB_SECRET_ID`, đặt rõ `DB_NAME`; dùng database/user của dự án mới |
| Config secret | Namespace đề xuất `riverbank-hackathon/*`; nguồn cũ ghi cố định `riverbank/openai`, `riverbank/anthropic`, `riverbank/openrouter`, `riverbank/auth` và một số adapter |
| IAM role | Quyền Secrets Manager, S3 và CloudWatch ứng với tài nguyên mới |
| Compose/S3 | Bucket riêng cho raw/export; không copy tên bucket hoặc endpoint môi trường cũ |
| Logging/alerts | Log group `/riverbank-hackathon/app`, SNS/alarm riêng hoặc được cấu hình rõ cho dự án |
| `.env.prod` mẫu | Domain mới, CORS origin của FE mới, profile theo tính năng; không sao chép IP/domain đang chạy của dự án cũ |
| Smoke test | URL đích mới; đổi `SITE_ADDRESS` không tự đổi URL đang ghi cố định trong workflow cũ |
| `.env.local` trên EC2 | Thông tin Basic Auth và pgweb sau khi tạo DB role; không commit file thật |
| Nếu chia sẻ Kafka/Valkey | Tách topic, consumer group, client ID và KV prefix; truyền topic thống nhất cho cả API lẫn initializer |

API cũ nạp secret nhà cung cấp ngay khi import cấu hình ở mode prod, kể cả nhà cung cấp không dùng trong `/health`. Chỉ chép infra và đổi IAM namespace sẽ không đủ: cần sửa cách tham chiếu trong app hoặc cung cấp cấu hình mới phù hợp. BASE-01 của repo mới nên khởi động offline độc lập các provider này.

Docker volume tồn tại trên máy/ổ đĩa đang chạy; deploy sang EC2 mới không tự chuyển file sao kê, dữ liệu Kafka hoặc certificate. GAPS của repo mới chưa chốt lưu file gốc/quyền đọc/retention; giữ quyết định đó tách khỏi việc tái sử dụng volume bản cũ.

Khi tự dựng RDS ở region Singapore, DB subnet group cần subnet ở ít nhất hai Availability Zone, kể cả instance chạy Single-AZ. Xem [hướng dẫn AWS](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_CreateDBInstance.html). Sơ đồ chỉ vẽ một khối private subnet, không cung cấp đủ CIDR, route table, security group hoặc IAM policy để dựng nguyên xi.

## Nguồn cần kiểm tra khi vận hành

- Repo này: `AGENTS.md`, `Agents/SAD.md`, `Agents/TEST_PLAN.md`, `Agents/GAPS.md`, `Agents/NEXT_STEPS.md` và implementation khi đã có.
- Nếu còn truy cập source cũ: `infra/docker-compose.yml`, `infra/.env.prod`, `infra/.env.local.example`, `infra/Caddyfile`, `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`, `api/Dockerfile`, `api/docker-entrypoint.sh`, `api/config.py`.
- Trên GitHub: workflow run/job thật, image tag, ruleset và required checks. Khi app connector cần đăng nhập lại, GitHub CLI đã đọc được repo trong phiên đối chiếu; xác minh kết nối hiện tại trước khi dùng.
- Trên AWS: chỉ kết luận trạng thái sau kiểm kê đúng môi trường; sơ đồ hoặc một lần deploy xanh trước đây không chứng minh tài nguyên mới tồn tại.
