# Tích hợp API và frontend

Contract tích hợp cho seller, lender và studio. Tham khảo [API chi tiết](API.md) và [FE integration](API.md). Router và schema được tổ chức trong `../api/routers/` và `../api/services/underwriting/models.py`.

## Bàn giao Cognito cho BE — 31/10/2026

Hạ tầng Cognito đã dựng và kiểm MFA/discovery/JWKS/trang PKCE login. FastAPI hiện chỉ có `/health` và `/ready`; chưa có JWT dependency, callback frontend hoặc các API nghiệp vụ trong bảng bên dưới. Không coi danh sách contract là endpoint đã triển khai.

```dotenv
COGNITO_ISSUER=https://cognito-idp.ap-southeast-1.amazonaws.com/ap-southeast-1_IwpfqsPbI
COGNITO_CLIENT_ID=6bn75vdg2p0pomc8k0e7gle1ld
ALLOWED_ORIGINS=http://localhost:3000,https://ezxriverbank-hackathon.vercel.app
```

Hai biến Cognito được đọc tập trung qua `api/config.py`; `.env` local và `.env` EC2 đã cập nhật. Client là public client, không dùng client secret. Discovery ở issuer + `/.well-known/openid-configuration`; JWKS ở issuer + `/.well-known/jwks.json`. Login domain: `https://riverbank-hackathon-424016506356.auth.ap-southeast-1.amazoncognito.com`, authorize `/oauth2/authorize`, token `/oauth2/token`. Scopes hiện có `openid email profile`; chưa có resource server/custom scopes nghiệp vụ.

FE thực hiện Authorization Code + PKCE S256, kiểm state và gửi `Authorization: Bearer <access_token>` tới API. Callback đã đăng ký `https://ezxriverbank-hackathon.vercel.app/auth/callback` và `http://localhost:3000/auth/callback`; logout là origin tương ứng không có dấu slash cuối. TOTP MFA bắt buộc. `.env.frontend` local chỉ chứa cấu hình public cho Next.js, không gửi backend `.env` hoặc credential AWS/model/DB cho FE.

BE triển khai dependency lấy current user dùng chung cho router; dependency role riêng cho seller/underwriter, và kiểm quyền hồ sơ tại service/repository. `HTTPBearer`/`OAuth2AuthorizationCodeBearer` chỉ khai báo/lấy token, không tự xác minh JWT. Nếu muốn nút OAuth2 Authorize trong Swagger, cần đăng ký riêng callback `/docs/oauth2-redirect` đúng host; hiện callback Swagger chưa được thêm.

BE xác minh RS256 bằng JWKS từ issuer đã cấu hình, cache và refresh khi key rotation; kiểm issuer, expiration, token_use=access và client_id đúng client ở trên. Access token Cognito dùng client_id để ràng buộc app; không áp kiểm audience của ID token thay cho nó. Chỉ tin cognito:groups sau khi xác minh chữ ký; nhóm có thể thiếu, khi đó từ chối endpoint yêu cầu role. Không tin role/seller_id/shop_id do client tự khai hoặc header X-Role trong production. Dùng sub để tra quan hệ seller/shop và grants trong DB; group underwriter do admin cấp.

Production lấy token từ Cognito, không tự ký JWT qua route demo `/v1/auth/token`. JWT offline không tự biết token đã bị revoke; BE cần chốt cơ chế logout/thu hồi phiên và hiệu lực quyền khi membership thay đổi. Có thể dùng Redis cho denylist/session theo thiết kế sau khi thống nhất, không coi kiểm chữ ký là đã xử lý revocation.

Thiếu token, token sai/hết hạn hoặc ID token dùng thay access token: 401. Token hợp lệ nhưng thiếu role/quyền hồ sơ: 403 theo contract. Giữ health/readiness public cho hạ tầng. Không log access/refresh token hoặc Authorization header. Kiểm tối thiểu wrong issuer/client, bad signature, expired token, ID token, seller truy cập hồ sơ khác, seller gọi route ngân hàng và user không có group. Cần kiểm bằng token thật sau khi FE callback và BE verifier có implementation; chưa có bằng chứng token exchange/login end-to-end trong phiên DevOps.

Tài liệu chính thức: [AWS xác minh JWT](https://docs.aws.amazon.com/cognito/latest/developerguide/amazon-cognito-user-pools-using-tokens-verifying-a-jwt.html), [AWS Code + PKCE](https://docs.aws.amazon.com/cognito/latest/developerguide/using-pkce-in-authorization-code.html).

## API lõi

| Method | Path | Vai trò |
|---|---|---|
| POST | `/v1/auth/token` | Đăng nhập demo ở chế độ token |
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

Prod theo thiết kế dùng Bearer token. Header role chỉ phục vụ mode local phù hợp. Không đặt passcode/signing key trong source FE. Token hết hạn đưa về đăng nhập. Seller đọc seller-view, không dùng chi tiết nội bộ để ẩn dữ liệu bằng CSS.

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
