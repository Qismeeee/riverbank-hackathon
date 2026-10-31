# Công việc tiếp theo

Kế hoạch triển khai được chia theo dependency và tiêu chí nghiệm thu. Bắt đầu BASE-01 để chuẩn bị môi trường, xây dữ liệu và engine, hoàn thiện workflow/evidence, sau đó nối frontend và mở rộng theo nhu cầu sản phẩm.

| Task | Ưu tiên và phụ thuộc | Kết quả cần giao | Nghiệm thu |
|---|---|---|---|
| BASE-01 chuẩn bị dự án | P0, độc lập | Cấu hình môi trường, dependency và bộ kiểm tra chất lượng | Môi trường tái lập được, DB/model/network mode rõ và kiểm tra chất lượng chạy được. Đã thiết lập nền tảng; xem README và kết quả kiểm tra của task |
| SRC-01 dữ liệu và consent | P1 sau BASE-01 | Contract seller/shop, consent, payout, provenance và adapter demo | Đã thêm lịch sử snapshot và consent trong repository demo một process; chưa kiểm thử thay đổi mới. Còn auth/case scope từ workflow, lưu bền, quyền lịch sử sau thu hồi và contract nguồn thật |
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
