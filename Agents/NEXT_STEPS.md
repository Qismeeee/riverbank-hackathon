# Công việc tiếp theo

Kế hoạch triển khai được chia theo dependency và tiêu chí nghiệm thu. Bắt đầu BASE-01 để chuẩn bị môi trường, xây dữ liệu và engine, hoàn thiện workflow/evidence, sau đó nối frontend và mở rộng theo nhu cầu sản phẩm.

| Task | Ưu tiên và phụ thuộc | Kết quả cần giao | Nghiệm thu |
|---|---|---|---|
| BASE-01 chuẩn bị dự án | P0, độc lập | Cấu hình môi trường, dependency và bộ kiểm tra chất lượng | Môi trường tái lập được, DB/model/network mode rõ và kiểm tra chất lượng chạy được |
| SRC-01 dữ liệu và consent | P1 sau BASE-01 | Contract seller/shop, consent, payout, provenance và adapter demo | Không consent không đọc dữ liệu, không trộn seller, synthetic có nhãn |
| ENG-01 dòng tiền và rủi ro | P1 sau SRC-01 | CashFlowEngine, FeatureBuilder, PD và CIC adapter có điều kiện | Golden A/B khớp, gap 0 bỏ PD/CIC/rule, thiếu dữ liệu có kết quả rõ |
| CORE-01 workflow và evidence | P1 sau ENG-01, VER-01 và POL-01 | API/auth, trạng thái, code memo/validator, sao kê, quyết định và handoff | A/B/C/E/F đạt TEST_PLAN, audit chỉ thêm, người quyết định, số và semantic frame khớp evidence |
| AUTH-01 named users | P1 sau BASE-01 | UserDirectory, token/me và actor display name | Subject phải có trong directory, role khớp, seller_id không thể mạo danh |
| JOB-01 upload sao kê nền | P1 sau CORE-01 | Job API, worker, lease/retry và original/reading download | SKIP LOCKED không nhận trùng, retry 5xx, dừng 4xx, E8 gắn job_id |
| EVT-01 case event outbox | P1 sau CORE-01 | Outbox cùng transaction, relay Kafka và consumer contract | Kafka down không hỏng underwriting, at-least-once, consumer deduplicate theo event_id |
| GATE-01 model gateway | P1 sau BASE-01 | Shared concurrency/rate/circuit gate, MemoryKV/Valkey | Mọi external model call qua gate, LightGBM không qua, store lỗi fail open có log |
| FE-01 frontend lõi | P1 sau CORE-01 và AUTH-01 | Source seller form/list/view, lender queue/detail/evidence/decision/handoff, studio | A/B/C/E/F qua UI, role đúng, idempotency và version conflict đúng, không tự tính tiền |
| VER-01 version điều khoản | P1 sau BASE-01 | Thiết kế/migration/repository cho version mới và SUPERSEDED | Counter thêm bản mới, lịch sử cũ không đổi, rollback/concurrency đúng, không nhầm cases.version |
| POL-01 xác nhận policy | P1 sau BASE-01 | Quy trình artifact policy/test/xác nhận, loader fail closed | Chặn bộ chưa xác nhận, hash lệch hoặc test không đạt, có audit người xác nhận |
| DOC-01 duy trì tài liệu | P1 sau BASE-01 | Cập nhật tài liệu theo các quyết định nghiệp vụ và contract | BRD/SRS/SAD/API thống nhất, các FR có tiêu chí nghiệm thu và test truy vết |
| QA-01 seller hỏi lại | P2 sau CORE-01 | Route copilot/ask, prompt và validator trên evidence mới nhất | Đúng seller, PII trước outbound, số không đổi, không đọc PD/CIC nội bộ cho seller |
| EXP-01 tái thẩm định hết hạn | P2 sau VER-01 | Luồng yêu cầu/tái thẩm định dữ liệu mới và audit | Hết hạn không bàn giao, run mới giữ evidence cũ, CIC/consent theo hiệu lực đã chốt |
| DATA-01 case D | P2, cần nghiệp vụ chốt | Phân biệt payout sàn và phần thu ngoài sàn | Khớp phần sàn không tự xác nhận phần ngoài sàn, routing có fixture mới |
| OBS-01 latency và cost | P2 sau CORE-01 và GATE-01 | Meter theo case/model/retry, Studio traffic | Đo riêng offline và online, mục tiêu SRS có bằng chứng, không log PII/prompt |
| P7-01 Monitor | P3 sau VER-01, policy/BL-11 đã chốt | Tính phương án bằng code, D22 có evidence, người duyệt version mới | Không đổi lịch ACTIVE trước duyệt, không tự cơ cấu, retry/idempotency đúng |
| BANK-01 adapter thật | Sau contract ngân hàng | CIC/LOS adapter với sandbox và auth phù hợp | Scope/consent/retry đúng, không dùng mock làm bằng chứng tích hợp thật |

## Thực hiện FE-01

1. Xác định package frontend và thiết kế màn hình seller, lender, studio theo BRD/SRS.
2. Dùng API.md để xây typed client và auth trước khi nối màn hình.
3. Nối seller tạo case, xem kết quả, sau đó lender evidence và quyết định, cuối cùng handoff/studio.
4. Dùng fixture với dữ liệu nguồn đúng. Hiển thị mock/simulated rõ, không thêm tổng lãi/phí khi server chưa cung cấp.
5. Kiểm A/B/C/E/F, lỗi quyền và conflict. Báo phần nào đã chạy thật, phần nào stub.

## Thực hiện VER-01 và POL-01

Thiết kế schema/repository và đọc skill nghiệp vụ đúng phạm vi. Migration phải có phương án rollback và kiểm tra tính toàn vẹn dữ liệu. Policy approval phải chốt ai có quyền xác nhận và bằng chứng xác nhận, không đặt một boolean mặc định true.

P7 cần một vòng đời điều khoản có thể truy vết. Không thêm nút “giãn nợ” làm ghi đè lịch hiện tại để chạy demo nhanh.
