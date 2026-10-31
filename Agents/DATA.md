# Dữ liệu và bằng chứng

## Contract kế hoạch

`Plan` trong `../api/services/underwriting/models.py` chứa `seller_id`, `shop_id`, `lot_value`, `cash_on_hand`, `supplier_schedule[{week, amount}]`, `sell_weeks`, `requested_amount`, `note`. Các số tiền là integer VND. Tổng lịch trả phải bằng giá trị lô, mốc chi không vượt kỳ bán. Giới hạn input tra model và `../policy/parameters.yaml`.

## Source layer demo đã triển khai

`api/services/underwriting/sources.py` cung cấp `Scope`, `Consent`, `Payout`, `SourceRecord` và `Snapshot`; snapshot băm nội dung, scope, provenance, mục đích và thời điểm chụp. Reader yêu cầu caller cung cấp scope đã xác thực, kiểm ownership và consent trước khi gọi nguồn, và từ chối response sai scope. Adapter demo chỉ nhận record có nhãn synthetic. Test offline tại `api/tests/test_underwriting_shopee.py`.

`demo_repository.py` lưu consent và lịch sử snapshot synthetic theo case/run trong bộ nhớ của một process. Case phải được đăng ký cùng scope khi khởi tạo repository, không được tự gắn scope khi chụp lần đầu. Cấp, thu hồi và đọc nguồn qua cùng instance được tuần tự hóa; consent hết hạn hoặc bị thu hồi trong lúc đọc không tạo snapshot, và không thể đăng ký lại consent có thời điểm cấp trước lần thu hồi. Lịch sử đã chụp vẫn có thể đọc theo scope sau thu hồi trong demo; quyền lưu và đọc lịch sử sau thu hồi trong sản phẩm cần được chốt. Repository không xác thực actor hay quyền sở hữu case/run: workflow phải cung cấp các giá trị này từ trạng thái server đã xác thực, không lấy trực tiếp từ client.

Demo ghi nhận thời điểm thu hồi ngay cả khi chưa có grant để chặn grant ghi lùi; dấu thu hồi chỉ tồn tại trong process. `ScopedPayoutReader` kiểm tra lại ownership và consent sau khi đọc, nhưng hai lần kiểm tra không tạo transaction hay bảo đảm cùng một grant; không dùng reader độc lập làm bảo đảm chống race khi nối nguồn thật.

Đây không phải lưu bền hoặc transaction phân tán, không dùng cho nguồn thật. Không coi hash là chữ ký xác thực nguồn; việc cấp/thu hồi consent, tính nguyên tử với truy cập nguồn và lưu trữ phải được thiết kế cho tích hợp thực. Kiểm thử bổ sung và nghiệm thu repository demo để ở TEST-01.

## Thiết kế danh tính và quyền cho schema mini

`../database/riverbank-mini.dbml` bổ sung `auth_identities`, `identity_roles`, `seller_access_grants` và `authorization_events`. Database là nguồn quyền ứng dụng, provider OIDC là nguồn xác thực. Danh tính dùng khóa chính UUID và khóa duy nhất `(issuer, subject)` phân biệt hoa/thường; không nối người dùng bằng email. Seller là người vay, có ownership grant theo lần cấp role seller và shop. Underwriter là nhân sự ngân hàng trên lending platform, dùng role ở cấp nền tảng mini một ngân hàng, không có membership hoặc grant shop.

Mini giữ một shop trên mỗi seller: server ánh xạ API `shop_id` từ `sellers.external_shop_ref`, hai định danh seller/shop bất biến. `decisions` tham chiếu danh tính người ngân hàng và assignment role underwriter dùng khi quyết định; CHECK/FK tổ hợp chặn dùng role seller làm actor quyết định hoặc làm membership underwriter trong bảng ownership. Audit phân biệt identity người với service hệ thống. Consent sàn vẫn kiểm riêng. Chi tiết quan hệ, thu hồi, partial index, transaction và giới hạn tại [thiết kế auth database](../database/README.md). Đây là thiết kế, chưa có migration hoặc adapter DB cho quyền.

## Entity đích trong schema mini

Bảng dưới mô tả thiết kế DBML, không phải các bảng PostgreSQL đã được tạo. Các tên `cases`, `case_events`, `seller_shops` và `seller_feature_snapshots` trong tài liệu/contract trước đó không tự tạo thêm bảng song song; CORE-01.24 phải ghi mapping và xử lý các phần còn thiếu trước migration.

| Entity/bảng | Vai trò |
|---|---|
| `auth_identities` | Danh tính OIDC theo issuer/subject |
| `identity_roles` | Role seller hoặc underwriter và vòng đời quyền |
| `seller_access_grants` | Ownership shop chỉ dành cho role seller |
| `authorization_events` | Audit provision/cấp/thu hồi quyền |
| `sellers` | Một shop trên mỗi seller record trong mini |
| `seller_consents` | Consent theo seller/shop và mục đích |
| `applications` | Header/kế hoạch, trạng thái và version_no khóa ghi; API vẫn `/v1/cases` |
| `assessment_runs` | Lần thẩm định, input snapshot/hash, engine/policy version và kết quả; contract lưu snapshot cần chốt trong CORE-01.24 |
| `evidence` | Bằng chứng theo run và code |
| `generated_documents` | Memo, bản seller, attempt và trạng thái validate |
| `application_documents` | Tham chiếu chứng từ đầu vào |
| `decisions` | Quyết định và điều kiện cuối có người bấm |
| `handoffs` | Gói bàn giao và trạng thái retry riêng |
| `application_events` | Timeline chỉ thêm, ánh xạ từ tên case_events cũ |

Schema thiết kế mini hiện có tại `database/riverbank-mini.dbml`. `api/db/migrations/001_underwriting.sql` và `api/db/underwriting.dbml` là vị trí dự kiến, chưa có trong repo. Persistence hiện có ở `api/services/underwriting/repository.py` chỉ là nền in-memory; tên `cases/case_events` trong code chưa được migrate sang `applications/application_events` của mini. Handoff phải giữ contract tương thích LOS. Thiết kế `loan_terms_versions` lưu riêng tiền, kỳ hạn, lịch trả, nguồn thay đổi và trạng thái ACTIVE/SUPERSEDED.

## Evidence

| Code | Payload |
|---|---|
| E4 | Feature/payout, mức hỗ trợ sàn, nguồn và công bố mô phỏng |
| E5 | Dòng tiền, gap, tiền đề xuất, kỳ hạn và lịch trích |
| E6 | PD và yếu tố giải thích, khi gap dương |
| E6a | CIC, khi gap dương |
| E7 | Kết quả rule |
| E8 | Đối chiếu sao kê nếu đã nộp |

`code` như E5 phân loại bằng chứng, còn `evidence_id` là ID của record cụ thể. Không dùng chuỗi E5 thay UUID trong request mà chưa xem response. Một câu memo gồm `text`, `claims`, `evidence_id` và `template` theo contract. Validator đối chiếu claims với payload, số trong chữ, từ cấm và trạng thái.

## Nguồn và chất lượng

Demo/synthetic có payout mô phỏng và phải ghi nhãn. Addlivetag cung cấp dữ liệu công khai về shop/sản phẩm, không cung cấp payout thật. ETL giữ raw trên S3, transform bằng Python, load snapshot Postgres. Không trình bày payout co giãn theo GMV là lịch sử payout quan sát được.

File xuất Kênh Người Bán và client OpenAPI có parser/client trong repo. Khả năng truy cập OpenAPI cần account/ủy quyền phù hợp, cần xác nhận quyền truy cập khi tích hợp. Không crawl shopee.vn.

Risk model train bằng dữ liệu sinh, hiệu chỉnh theo hình dáng shop thật. Nhãn mô phỏng là trích thiếu liên tiếp theo thiết kế generator. FeatureBuilder dùng chung train/serving, không đưa hậu quả trả nợ hay thuộc tính nhạy cảm vào feature. Metric đánh giá được lưu trong [risk model](DATA.md) và `api/models/pd_meta.json`, không chứng minh hiệu quả trên khoản vay thật.

## Dữ liệu nhạy cảm

Không log bản gốc PII hoặc secrets. Phải làm sạch trước LLM/Jev, kiểm seller scope trên cả request và nguồn trả về. Bằng chứng đã dùng không được thay bằng dữ liệu nguồn mới mà mất lịch sử. Chính sách giữ/xóa file ngân hàng cần được chốt riêng trước thêm lưu bản gốc sao kê.
