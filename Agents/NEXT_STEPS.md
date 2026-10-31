# Công việc tiếp theo

Kế hoạch triển khai được chia theo dependency và tiêu chí nghiệm thu. Bắt đầu BASE-01 để chuẩn bị môi trường, xây dữ liệu và engine, hoàn thiện workflow/evidence, sau đó nối frontend và mở rộng theo nhu cầu sản phẩm.

| Task | Ưu tiên và phụ thuộc | Kết quả cần giao | Nghiệm thu |
|---|---|---|---|
| BASE-01 chuẩn bị dự án | P0, độc lập | Cấu hình môi trường, dependency và bộ kiểm tra chất lượng | Môi trường tái lập được, DB/model/network mode rõ và kiểm tra chất lượng chạy được |
| SRC-01 dữ liệu và consent | P1 sau BASE-01 | Contract seller/shop, consent, payout, provenance và adapter demo | Không consent không đọc dữ liệu, không trộn seller, synthetic có nhãn |
| ENG-01 dòng tiền và rủi ro | P1 sau SRC-01 | CashFlowEngine, FeatureBuilder, PD và CIC adapter có điều kiện | Golden A/B khớp, gap 0 bỏ PD/CIC/rule, thiếu dữ liệu có kết quả rõ |
| CORE-01 workflow và evidence | P1 sau ENG-01, VER-01 và POL-01 | API/auth, trạng thái, memo/validator, sao kê, quyết định và handoff | A/B/C/E/F đạt TEST_PLAN, audit chỉ thêm, người quyết định, số khớp evidence |
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
2. Dùng API.md để xây typed client và auth trước khi nối màn hình.
3. Nối seller tạo case, xem kết quả, sau đó lender evidence và quyết định, cuối cùng handoff/studio.
4. Dùng fixture với dữ liệu nguồn đúng. Hiển thị mock/simulated rõ, không thêm tổng lãi/phí khi server chưa cung cấp.
5. Kiểm A/B/C/E/F, lỗi quyền và conflict. Báo phần nào đã chạy thật, phần nào stub.

## Thực hiện VER-01 và POL-01

Thiết kế schema/repository và đọc skill nghiệp vụ đúng phạm vi. Migration phải có phương án rollback và kiểm tra tính toàn vẹn dữ liệu. Policy approval phải chốt ai có quyền xác nhận và bằng chứng xác nhận, không đặt một boolean mặc định true.

P7 cần một vòng đời điều khoản có thể truy vết. Không thêm nút “giãn nợ” làm ghi đè lịch hiện tại để chạy demo nhanh.
