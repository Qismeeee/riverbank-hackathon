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

Đăng nhập người dùng theo OpenID Connect trên OAuth 2.0, sử dụng Authorization Code với PKCE. Authorization server cung cấp endpoint cấp token; không giả định Riverbank có `POST /v1/auth/token`. Nhà cung cấp, cấu hình client, callback và cách quản lý session cần được chốt trước khi tích hợp. API là resource server, kiểm access token dành cho API theo contract của issuer (gồm issuer, audience, hiệu lực và chữ ký với JWT hoặc introspection cho opaque token); không dùng ID token thay access token. Token không hợp lệ hoặc không kiểm chứng được phải bị từ chối.

Role seller/underwriter và quyền seller/shop phải được xác định phía server từ danh tính đã xác thực và nguồn quyền đáng tin cậy; không tin role hoặc scope do client tự khai. Consent OAuth cho đăng nhập không thay consent riêng để đọc dữ liệu sàn. Không đặt client secret, signing key hoặc token trong source hay log. Token hết hạn xử lý theo session đã thiết kế, nếu không gia hạn được thì đăng nhập lại. Seller đọc seller-view, không dùng chi tiết nội bộ để ẩn dữ liệu bằng CSS. Cơ chế demo nếu có phải tách biệt và không bật ngoài môi trường local/test.

Thiết kế schema mini dùng DB làm nguồn quyền: `auth_identities` ánh xạ `(issuer, subject)` đã xác minh; `identity_roles` cung cấp role đang có hiệu lực. Seller là người vay, cần thêm ownership grant tại `seller_access_grants`; server tra `shop_id` qua seller record và lọc danh sách seller trước phân trang. Underwriter là nhân sự ngân hàng trên lending platform: role underwriter cấp quyền queue, thẩm định, evidence và quyết định trong nền tảng mini một ngân hàng, không cần sở hữu hoặc được gắn với shop. Kiểm evidence/document thuộc đúng hồ sơ và kiểm quyền trên mọi lệnh ghi; dữ liệu sàn luôn cần consent riêng. Các bảng mới hiện là thiết kế DBML; chưa có resolver DB hoặc migration, helper Python hiện tại cần tách role nền tảng và ownership seller trước khi tích hợp. Xem [thiết kế auth](../database/README.md).

Tạo hồ sơ và quyết định gửi `Idempotency-Key`. Retry cùng thao tác giữ nguyên key và payload. Thao tác mới tạo key mới. Lệnh thay đổi hồ sơ gửi `expected_version` mới nhất theo schema, riêng tạo case chưa có version. Gặp conflict đọc lại và để người dùng xác nhận trên dữ liệu mới.

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
