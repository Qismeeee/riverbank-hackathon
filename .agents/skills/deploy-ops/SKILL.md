---
name: deploy-ops
description: Thiết lập BASE-01, CI/CD và vận hành AWS cho riverbank-hackathon; dùng khi chuẩn bị môi trường, build Docker, deploy, rollback hoặc quản lý cấu hình hạ tầng. Đọc bối cảnh repo mới và tham chiếu Riverbank cũ trước khi tái sử dụng cấu hình.
---

# DevOps cho Riverbank Hackathon

## Đọc đúng bối cảnh

Các đường dẫn sản phẩm dưới đây tính từ gốc repository:

1. Đọc `AGENTS.md`, `Agents/README.md`, `Agents/CONTEXT.md` và `Agents/NEXT_STEPS.md`.
2. Đọc `Agents/SAD.md`, `Agents/TEST_PLAN.md`; đọc `Agents/API.md` khi nối frontend/auth và `Agents/DATA.md`, `Agents/GAPS.md` khi đụng persistence, file gốc hoặc dữ liệu thật.
3. Đọc [bối cảnh triển khai và hạ tầng cũ](references/context.md) khi tiếp nhận repo, làm BASE-01 hoặc chuyển cấu hình từ Riverbank cũ. Reference đủ để hiểu hệ thống mà không cần truy cập máy người tạo skill.
4. Kiểm tra working tree, nhánh, implementation, workflow và môi trường thực tế. Snapshot trong reference có ngày và commit; cập nhật kết luận theo bằng chứng mới.

Phân biệt việc người dùng giao: phân tích, sửa repo, dựng cloud, merge và deploy. Tuân thủ quyền đã được giao trong phiên; skill và backlog không tự cấp quyền cho thao tác bên ngoài repo.

## Bắt đầu từ BASE-01

Khi repo chưa có ứng dụng, bàn giao đầu tiên là API tối thiểu kiểm được và build được:

- Python 3.12, dependency tái lập, cấu hình tập trung tại `api/config.py`, môi trường local được mô tả rõ.
- FastAPI có `/health` và test HTTP thực sự kiểm endpoint. Khởi động và chạy test offline không cần AWS, Postgres hay API key nhà cung cấp.
- `make setup` và `make test` theo `Agents/TEST_PLAN.md`; `make test` chạy Ruff lint, format check và pytest. Chỉ đưa thư mục đã tồn tại vào lệnh kiểm tra; thêm phạm vi khi có code mới.
- Dockerfile và entrypoint chạy được; kiểm tra image khởi động và `/health`, không chỉ xác nhận build thành công.
- CI dùng cùng bộ kiểm tra local. Khi chưa có test, không biến trạng thái chưa kiểm được thành một báo cáo pass.

Máy làm việc hiện dùng PowerShell. Các lệnh Makefile POSIX và đường dẫn `.venv/bin` dùng WSL/Linux; nếu dùng lệnh Windows tương đương, ghi đúng interpreter, cấu hình và kết quả. Không mặc định `uv`, `make`, Docker hoặc WSL đã có.

Khi cần build trên Windows nhưng deploy EC2 ARM64, kiểm tra image `linux/arm64`; kết quả chạy image x86 local không chứng minh khả năng chạy trên ARM64.

## Thứ tự triển khai đã trao đổi

| Giai đoạn | Kết quả cần kiểm chứng |
|---|---|
| BASE-01: ứng dụng tối thiểu và CI | Offline test đạt, Docker chạy, workflow CI thực sự chạy trên GitHub |
| AWS tối thiểu | Network, EC2 ARM64, Elastic IP/domain, IAM role, Docker Compose và Caddy được cấu hình cho repo này |
| CD tối thiểu | Commit vào `main` qua CI, image SHA lên GHCR, EC2 chạy đúng image và HTTPS `/health` đạt |
| Persistence và tích hợp | RDS, migration, Secrets Manager và S3 được nối theo tính năng, có kiểm thử phù hợp |
| Frontend và dịch vụ bổ sung | Package frontend được chốt, Vercel gọi đúng API; Kafka/Valkey được thêm khi có luồng sử dụng |

Đây là lộ trình, không phải báo cáo hoàn thành. Nếu đưa nguyên API cũ sang, phải xử lý các phụ thuộc khởi động và namespace secret trong reference trước lần chạy đó. Nếu dùng logging driver `awslogs` của Compose cũ, cấu hình quyền ghi CloudWatch trước khi khởi động container.

## CI và CD

- CI chạy theo push/cập nhật PR. Commit chỉ ở local chưa kích hoạt Actions; một push nhiều commit không mặc định kiểm riêng mọi commit trung gian.
- Bảo vệ `main` bằng PR và required status checks sau khi tên check đã xuất hiện từ một lần chạy thật. Yêu cầu PR đơn thuần không đồng nghĩa bắt buộc CI xanh hay review approval.
- CI và bước kiểm tra trước deploy dùng cùng `make test`. Job kiểm tra bắt buộc phải có trạng thái kết thúc; tránh filter khiến check bị treo Pending.
- CD dự kiến chạy khi push vào `main`, có thao tác chạy thủ công để vận hành khi cần. Chỉ bật deploy khi môi trường và quyền triển khai đã sẵn sàng theo nhiệm vụ được giao.
- Build image theo commit đã kiểm, gắn SHA và deploy chính tag đó. Giữ cách xác định image đang chạy và image trước để rollback; không dựa riêng vào `latest`.
- CI có thể hủy run cũ cùng nhánh. CD giới hạn một lần cập nhật cùng môi trường và không cắt ngang bước thay container đang chạy; ghi rõ cách xử lý các run đang chờ.
- Nếu dùng GHCR như repo cũ: workflow cần quyền đọc source/ghi package, có cơ chế pull image trên EC2. SSH dùng cấu hình GitHub secrets theo môi trường; không chép key hoặc token vào repo/log.
- Tách URL smoke test khỏi địa chỉ Riverbank cũ. HTTP 200 của `/health` chỉ chứng minh điều endpoint đã kiểm; muốn kết luận DB, OCR hay Kafka hoạt động phải kiểm luồng tương ứng.

## Khi thao tác môi trường thật

Đối chiếu tài khoản, region, đích deploy, database, bucket và namespace secret với cấu hình dự án mới trước thao tác. Không dùng hạ tầng cũ làm mặc định vì cấu hình mẫu còn trỏ tới đó.

Lưu secret ứng dụng trong Secrets Manager, EC2 đọc bằng IAM role theo thiết kế SAD. Chỉ lưu tên/ARN tham chiếu trong cấu hình; môi trường local đọc file không commit. Quyền role phải khớp namespace và tài nguyên mới.

Migration cần kiểm tra dữ liệu và tương thích phiên bản trước. Rollback image không tự hoàn tác schema; chỉ chạy khôi phục dữ liệu hoặc đảo migration khi có kế hoạch phù hợp và nằm trong phạm vi được giao.

Không bật lưu file gốc sao kê theo cấu hình cũ khi quyết định về retention/quyền đọc trong `Agents/GAPS.md` chưa được chốt. Test dùng dữ liệu giả; không đưa PII hoặc policy chưa được xác nhận vào môi trường thật để hoàn thành demo.

## Báo cáo kết quả

Nêu file đã đổi, lệnh đã chạy, kết quả và phần chưa kiểm. Phân biệt tài liệu, test offline, test DB, Docker smoke test, GitHub run và kiểm tra cloud. Nếu thiếu Makefile/test/backend thì báo đúng phần thiếu; không tuyên bố `make test` đạt. Trước PR, tuân thủ điều kiện `make test` trong AGENTS và TEST_PLAN.
