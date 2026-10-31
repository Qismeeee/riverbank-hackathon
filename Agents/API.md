# Tích hợp API và frontend

Contract tích hợp cho seller, lender và studio. Tham khảo [API chi tiết](API.md) và [FE integration](API.md). Router và schema được tổ chức trong `../api/routers/` và `../api/services/underwriting/models.py`.

## API lõi

| Method | Path | Vai trò |
|---|---|---|
| GET | `/v1/auth/me` | Chủ thể đã xác thực |
| POST | `/v1/copilot/extract-plan` | Seller, trả draft để xác nhận |
| POST | `/v1/cases` | Seller, tạo và thẩm định |
| GET | `/v1/me/cases` | Seller, danh sách của mình |
| GET | `/v1/cases/{case_id}/seller-view` | Seller của hồ sơ |
| GET | `/v1/queue` | Underwriter |
| GET | `/v1/cases/{case_id}` | Underwriter |
| GET | `/v1/cases/{case_id}/evidence/{evidence_id}` | Underwriter |
| POST | `/v1/cases/{case_id}/statements` | Underwriter nhập tổng |
| POST | `/v1/cases/{case_id}/statements/upload` | Seller của hồ sơ hoặc underwriter |
| POST | `/v1/cases/{case_id}/cic-inquiry` | Underwriter, điều kiện theo service |
| POST | `/v1/cases/{case_id}/decisions` | Underwriter |
| POST | `/v1/cases/{case_id}/handoff` | Underwriter |
| GET | `/v1/studio/policy` | Underwriter |
| GET | `/v1/studio/eval-metrics` | Underwriter |

Các API mở rộng gồm `copilot/ask`, `webhooks/los-status`, `simulate-p7-event`, `restructure-decision`. Chỉ đưa vào luồng frontend sau khi có contract, xác thực và kiểm thử tương ứng.

## Quy ước client

Đăng nhập người dùng theo OpenID Connect trên OAuth 2.0, sử dụng Authorization Code với PKCE. Authorization server cung cấp endpoint cấp token; không giả định Riverbank có `POST /v1/auth/token`. Đã chọn Auth0 cho hackathon; cấu hình tenant, client, callback và cách quản lý session còn cần chốt. API là resource server, kiểm access token dành cho API theo contract của issuer (gồm issuer, audience, hiệu lực và chữ ký với JWT hoặc introspection cho opaque token); không dùng ID token thay access token. Token không hợp lệ hoặc không kiểm chứng được phải bị từ chối.

Hackathon chọn Auth0 cho API custom với access token JWT RS256 và một SPA client. Adapter chưa nghiệm thu yêu cầu issuer tenant HTTPS dạng `https://TENANT.REGION.auth0.com/`, API audience riêng và client ID khác audience, cùng claim `azp` khớp client ID; không nhận token machine-to-machine có subject kết thúc `@clients`. Trước khi bật, operator phải kiểm chứng access-token subject ánh xạ đúng OIDC subject dùng khi provision, cấu hình provider/PKCE/session và thiết lập quyền DB. Cấu hình không được lấy từ token hoặc client. Xem [cấu hình local](../database/README.md).

Role seller/underwriter và quyền seller/shop phải được xác định phía server từ danh tính đã xác thực và nguồn quyền đáng tin cậy; không tin role hoặc scope do client tự khai. Consent OAuth cho đăng nhập không thay consent riêng để đọc dữ liệu sàn. Không đặt client secret, signing key hoặc token trong source hay log. Token hết hạn xử lý theo session đã thiết kế, nếu không gia hạn được thì đăng nhập lại. Seller đọc seller-view, không dùng chi tiết nội bộ để ẩn dữ liệu bằng CSS. Cơ chế demo nếu có phải tách biệt và không bật ngoài môi trường local/test.

Thiết kế schema mini dùng DB làm nguồn quyền: `auth_identities` ánh xạ `(issuer, subject)` đã xác minh; `identity_roles` cung cấp role đang có hiệu lực. Seller là người vay, cần thêm ownership grant tại `seller_access_grants`; server tra `shop_id` qua seller record và lọc danh sách seller trước phân trang. Underwriter là nhân sự ngân hàng trên lending platform: role underwriter cấp quyền queue, thẩm định, evidence và quyết định trong nền tảng mini một ngân hàng, không cần sở hữu hoặc được gắn với shop. Kiểm evidence/document thuộc đúng hồ sơ và kiểm quyền trên mọi lệnh ghi; dữ liệu sàn luôn cần consent riêng. Đã có baseline SQL local, verifier Auth0, resolver DB và dependency xác thực cho `auth/me`; chưa áp dụng cho endpoint nghiệp vụ. Các phần mới chưa nghiệm thu. Xem [thiết kế auth](../database/README.md).

Tạo hồ sơ và quyết định gửi `Idempotency-Key`. Retry cùng thao tác giữ nguyên key và payload. Thao tác mới tạo key mới. Lệnh thay đổi hồ sơ gửi `expected_version` mới nhất theo schema, riêng tạo case chưa có version. Gặp conflict đọc lại và để người dùng xác nhận trên dữ liệu mới.

## Đăng nhập và chọn màn hình

Frontend đăng nhập người dùng qua Auth0 Authorization Code + PKCE S256, yêu cầu access token dành cho API audience, rồi gọi `GET /v1/auth/me` với `Authorization: Bearer <access_token>`. Riverbank không nhận mật khẩu và không tự cấp quyền khi đăng nhập. ID token không dùng để gọi API.

Response ví dụ với một tài khoản được cấp cả hai role (dữ liệu minh họa):

```json
{
  "issuer": "https://example.auth0.com/",
  "subject": "auth0|demo-user",
  "roles": ["seller", "underwriter"],
  "scoped_grants": [{"role": "seller", "seller_id": "demo-seller", "shop_id": "demo-shop"}]
}
```

Frontend dùng `seller` cho màn hình người vay và `underwriter` cho màn hình nhân sự ngân hàng; nếu có cả hai, có thể cho người dùng chọn màn hình. Seller chỉ có shop trong `scoped_grants`; underwriter không cần shop grant. Đây là dữ liệu để hiển thị, không thay kiểm quyền server và consent sàn. 401 nghĩa là thiếu/token không hợp lệ; 503 nghĩa là chưa cấu hình hoặc không xác minh được. Identity/role/grant phải được cấp phía server, không lấy từ lựa chọn màn hình. Tenant/subject và provisioning vẫn cần xác nhận; chưa có luồng cấp quyền hoàn chỉnh hoặc xác minh Auth0/DB thật.

Khi chạy frontend ở origin khác, operator đặt `RIVERBANK_CORS_ORIGINS` bằng danh sách origin đầy đủ phân cách dấu phẩy, ví dụ `http://localhost:5173`; mặc định CORS đóng. Không dùng wildcard.

## Payload fixture B

```json
{
  "seller_id": "demo-b",
  "shop_id": "demo-b",
  "lot_value": 200000000,
  "cash_on_hand": 120000000,
  "supplier_schedule": [{"week": 0, "amount": 200000000}],
  "sell_weeks": 6,
  "requested_amount": 150000000,
  "note": ""
}
```

Với nguồn demo và cấu hình fixture phù hợp, kết quả nghiệp vụ là chờ duyệt. FE lấy số hiển thị từ response/evidence, không tính lại gap hoặc đưa đề xuất thành đã được duyệt.

## Quyết định và chứng từ

Decision body gồm `expected_version`, `decision_type`, `reason`, và `verification_note` khi cần. Chỉ `ACCEPT_COUNTER` gửi `final_amount`, `final_tenor_weeks`. Render điều kiện cuối server trả về vì engine có thể giãn kỳ hạn. Sau quyết định đọc version mới trước handoff.

Thiếu PD chuyển người xử lý theo policy. Nếu có quy trình xác minh thủ công thay thế, ngân hàng phải xác nhận quy trình đó trước khi áp dụng. Frontend không tự suy ra quyền chấp nhận từ ghi chú hoặc trạng thái.

Upload sao kê dùng multipart với `expected_version`, `period_start`, `period_end`, `file`. Đối chiếu cùng kỳ, xử lý lỗi đọc/OCR/classifier riêng. API nhập tổng thủ công phải ghi nguồn và người nhập, phân biệt với dữ liệu bóc từ file.

## Lỗi cần xử lý

| Mã/nhóm | Hành vi client |
|---|---|
| 401 | Đăng nhập lại theo nguyên nhân token |
| 403 | Báo quyền/scope, không thử giả role |
| `CASE_VERSION_CONFLICT` | Tải lại hồ sơ và yêu cầu thao tác lại |
| `IDEMPOTENCY_KEY_REUSED` | Không tự đổi key rồi lặp side effect |
| `HARD_POLICY_FAILURE` | Hiện `detail.details` là các rule đang chặn |
| `BLOCKED_INPUT` | Hiển thị lỗi đầu vào, không nói hồ sơ bị từ chối tín dụng |
| 422 schema | `detail` là list, gắn lỗi đúng trường |
| 413/415 | File quá lớn hoặc sai định dạng |
| 429 | Throttle đăng nhập, theo hướng dẫn server |
| 503 | Thiếu cấu hình/phụ thuộc, không giả kết quả thành công |

Lỗi nghiệp vụ thường là `{detail: {code, details}}`, khác 422 schema. Studio đọc policy động từ API, không hard-code rule hoặc trần PD trong client.

## Kế hoạch module endpoint

Các vị trí dưới đây là kế hoạch triển khai, không khẳng định endpoint đã tồn tại. Mỗi handler nằm trong `api/routers/`; `api/main.py` chỉ tạo và cấu hình app, middleware và `include_router`. Schema request/response, dependency xác thực, service nghiệp vụ và adapter/repository được tách module. Không đặt tính toán, policy hoặc truy vấn DB trong router. Hai route hiện có `health/db` và `auth/me` đã chuyển sang router tương ứng; kiểm tra kết nối DB nằm trong service. Schema phản hồi `auth/me` được khai báo tại `api/schemas/auth.py`; đã kiểm thử HTTP/OpenAPI offline cho hai route này; chưa nghiệm thu tích hợp provider hoặc DB thật.

| Module router dự kiến | Endpoint hoặc phạm vi | Task |
|---|---|---|
| `health.py`, `auth.py` | `GET /health/db`, `GET /v1/auth/me` | CORE-01.01, CORE-01.02, CORE-01.25 |
| `copilot.py` | `POST /v1/copilot/extract-plan` | CORE-01.03, CORE-01.25 |
| `cases.py` | `POST /v1/cases`, `GET /v1/me/cases`, seller-view | CORE-01.04–05, CORE-01.25 |
| `underwriting.py` | Queue, case detail, evidence, CIC inquiry, decisions, handoff | CORE-01.06, CORE-01.12, CORE-01.14–15, CORE-01.25 |
| `statements.py` | Nhập tổng và upload sao kê | CORE-01.10–11, CORE-01.25 |
| `studio.py` | Policy và eval metrics | CORE-01.16, CORE-01.25 |

Router chỉ kết nối workflow khi các dependency và gate trong task tương ứng đã đáp ứng; thiếu cấu hình hoặc phụ thuộc phải fail closed. Kiểm thử HTTP, quyền và contract thuộc TEST-01. Route mở rộng `copilot/ask`, tái thẩm định, P7 và webhook LOS có task riêng (QA-01, EXP-01, P7-01, BANK-01); chốt method/path và contract trước khi tạo router hoặc endpoint, không suy ra một API mới từ tên tính năng. Onboarding, hợp đồng, giải ngân và thu nợ thuộc hệ thống ngân hàng theo phạm vi BUSINESS, không tự bổ sung endpoint Riverbank cho các bước đó.

## Schema chuẩn bị tích hợp CORE-01

`api/schemas/core.py` định nghĩa request Plan và response preview cho fixture synthetic cùng envelope lỗi; `api/services/underwriting/core_contract.py` chuyển preview và ánh xạ lỗi idempotency đã có domain type. Đây chưa phải response case cuối, chưa có route nghiệp vụ, input guard, auth/ownership, consent hoặc persistence. Kết quả gap dương của fixture là `INCOMPLETE`, không phải quyết định hoặc kết quả policy. Kiểm thử contract thuộc TEST-01.

## Trạng thái route lõi

Các path lõi trong bảng trên đã được đăng ký trong OpenAPI như placeholder fail closed. Cần bearer access token; role underwriter và seller được kiểm từ server. `POST /v1/cases` yêu cầu Plan, `Idempotency-Key` và kiểm seller/shop theo grant. Sau các kiểm tra khả dụng, mọi route nghiệp vụ trả `503` với `WORKFLOW_UNAVAILABLE`; không tạo case, đọc dữ liệu, xử lý tài liệu hay ra quyết định. Các route còn lại chưa định nghĩa đầy đủ request/response thực; seller-view và upload chưa thể kiểm ownership của case vì repository chưa nối. Không dùng placeholder làm bằng chứng workflow hoạt động. Chỉ thay bằng xử lý thực sau khi đáp ứng gate tương ứng và kiểm thử tại TEST-01.
