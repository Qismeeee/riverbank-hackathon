# Dữ liệu và bằng chứng

## Contract kế hoạch

Plan contract chứa `seller_id`, `shop_id`, `lot_value`, `cash_on_hand`, `supplier_schedule[{week, amount}]`, `sell_weeks`, `requested_amount`, `note`. Các số tiền là integer VND. Tổng lịch trả phải bằng giá trị lô, mốc chi không vượt kỳ bán. Giới hạn input tra `../policy/parameters.yaml` và schema API khi đã triển khai.

## Entity triển khai

| Entity/bảng | Vai trò |
|---|---|
| `sellers`, `seller_shops` | Danh tính và scope shop |
| `seller_consents` | Consent theo seller/shop và mục đích |
| `seller_feature_snapshots` | Snapshot có hash và nguồn payout |
| `cases` | Header/kế hoạch, trạng thái và version khóa ghi |
| `assessment_runs` | Lần thẩm định, input snapshot/hash, engine/policy version, kết quả |
| `evidence` | Bằng chứng theo run và code |
| `generated_documents` | Memo, bản seller, attempt và trạng thái validate |
| `decisions` | Quyết định và điều kiện cuối có người bấm |
| `case_events` | Timeline chỉ thêm |
| `event_outbox` | Event chờ publish, ghi cùng transaction với case event |
| `jobs` | Upload sao kê nền, lease, attempt, result/error và payload tối thiểu |
| `statement_files`/storage metadata | File gốc, hash, MIME, size, storage key và retention |
| `loan_terms_versions` | Tiền, kỳ hạn, lịch trả ACTIVE/SUPERSEDED |

Migration và repository phải hiện thực các entity này theo task triển khai; tài liệu không tuyên bố schema đã tồn tại. Handoff phải giữ contract tương thích LOS. `loan_terms_versions` lưu riêng với `cases.version` và `assessment_runs`.

## Evidence

| Code | Payload |
|---|---|
| E4 | Feature/payout, mức hỗ trợ sàn, nguồn và công bố mô phỏng |
| E5 | Dòng tiền, gap, tiền đề xuất, kỳ hạn và lịch trích |
| E6 | PD và yếu tố giải thích, khi gap dương |
| E6a | CIC, khi gap dương; có thể `deferred_until_statement` trước khi R05 được bổ sung |
| E7 | Kết quả rule |
| E8 | Đối chiếu sao kê nếu đã nộp |

`code` như E5 phân loại bằng chứng, còn `evidence_id` là ID của record cụ thể. Không dùng chuỗi E5 thay UUID trong request mà chưa xem response. Một câu memo gồm `text`, `claims`, `evidence_id`, `template` và semantic frame theo contract. Validator đối chiếu claims với payload, chủ thể, quan hệ, vai trò số, đơn vị, từ cấm và trạng thái.

## Nguồn và chất lượng

Demo/synthetic có payout mô phỏng và phải ghi nhãn. Addlivetag cung cấp dữ liệu công khai về shop/sản phẩm, không cung cấp payout thật. ETL giữ raw trên S3, transform bằng Python, load snapshot Postgres. Không trình bày payout co giãn theo GMV là lịch sử payout quan sát được.

File xuất Kênh Người Bán và client OpenAPI có parser/client trong repo. Khả năng truy cập OpenAPI cần account/ủy quyền phù hợp, cần xác nhận quyền truy cập khi tích hợp. Không crawl shopee.vn.

Risk model train bằng dữ liệu sinh, hiệu chỉnh theo hình dáng shop thật. Nhãn mô phỏng là trích thiếu liên tiếp theo thiết kế generator. FeatureBuilder dùng chung train/serving, không đưa hậu quả trả nợ hay thuộc tính nhạy cảm vào feature. Metric đánh giá phải được lưu cùng model metadata khi triển khai; metric synthetic không chứng minh hiệu quả trên khoản vay thật.

## Messaging và model state

Kafka message không là state store. `riverbank.case-events` dùng key `case_id`, payload có `event_id`, event type, actor, case version, timestamp và dữ liệu tối thiểu đã sanitize. Consumer chịu trách nhiệm deduplicate. Không gửi raw note, statement hay PII lên topic.

ModelGate chỉ lưu key ngắn hạn cho concurrency slot, rate budget và circuit state. Không lưu prompt, response, token hay PII trong Valkey. Traffic record cho Studio chỉ gồm provider/model, task, latency, status, token/cost ước tính và case correlation đã sanitize.

## Dữ liệu nhạy cảm

Không log bản gốc PII hoặc secrets. Phải làm sạch trước LLM/Jev, kiểm seller scope trên cả request và nguồn trả về. Bằng chứng đã dùng không được thay bằng dữ liệu nguồn mới mà mất lịch sử. Chính sách giữ/xóa file ngân hàng cần được chốt riêng trước thêm lưu bản gốc sao kê.
