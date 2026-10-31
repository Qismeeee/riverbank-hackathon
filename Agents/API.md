# Tích hợp API và frontend

Contract tích hợp cho seller, lender và studio. Bảng này là target contract doc-first; chỉ đánh dấu một endpoint đã có khi code và test tương ứng nằm trong repo.

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
| POST | `/v1/cases/{case_id}/statements/upload-jobs` | Validate sơ bộ rồi trả job `202` |
| GET | `/v1/jobs/{job_id}` | Seller của hồ sơ hoặc underwriter xem job |
| GET | `/v1/cases/{case_id}/statements/original` | Tải file gốc theo quyền và retention |
| GET | `/v1/cases/{case_id}/statements/reading` | Tải kết quả đọc/chuẩn hóa |
| POST | `/v1/cases/{case_id}/cic-inquiry` | Underwriter, điều kiện theo service |
| POST | `/v1/cases/{case_id}/decisions` | Underwriter |
| POST | `/v1/cases/{case_id}/handoff` | Underwriter |
| GET | `/v1/studio/policy` | Underwriter |
| GET | `/v1/studio/eval-metrics` | Underwriter |
| GET | `/v1/studio/traffic` | Underwriter, latency/cost/call count đã sanitize |

Các API mở rộng gồm `copilot/ask`, `webhooks/los-status`, `simulate-p7-event`, `restructure-decision`. Chỉ đưa vào luồng frontend sau khi có contract, xác thực và kiểm thử tương ứng.

## Quy ước client

Prod theo thiết kế dùng Bearer token. `subject` phải có trong UserDirectory với đúng role; với seller, subject chính là `seller_id`. Header role chỉ phục vụ mode local phù hợp. Không đặt passcode/signing key trong source FE. Token hết hạn đưa về đăng nhập. Seller đọc seller-view, không dùng chi tiết nội bộ để ẩn dữ liệu bằng CSS.

Tạo hồ sơ và quyết định gửi `Idempotency-Key`. Retry cùng thao tác giữ nguyên key và payload. Thao tác mới tạo key mới. Lệnh thay đổi hồ sơ gửi `expected_version` mới nhất theo schema, riêng tạo case chưa có version. Gặp conflict đọc lại và để người dùng xác nhận trên dữ liệu mới.

## Payload fixture B

```json
{
  "seller_id": "minhchau.shop",
  "shop_id": "minhchau.shop",
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

Upload sao kê dùng multipart với `expected_version`, `period_start`, `period_end`, `file`. FE nên dùng endpoint job cho PDF/ảnh hoặc tài liệu chậm, poll `GET /v1/jobs/{job_id}` đến `SUCCEEDED`/`FAILED`; endpoint đồng bộ vẫn phù hợp cho CSV/Excel nhỏ. Job validate quyền, version, kỳ, size và MIME trước khi xếp hàng. Đối chiếu cùng kỳ, xử lý lỗi parser/OCR/classifier riêng. API nhập tổng thủ công phải ghi nguồn và người nhập.

Khi hồ sơ chỉ thiếu R05, response CIC dùng `source: deferred_until_statement`, `gate: null`; không hiển thị như lỗi CIC. Sau sao kê service mới chạy gate/CIC. Tra thủ công của underwriter phải có reason, actor và audit.

`GET /v1/queue` không có filter chỉ trả hồ sơ chưa quyết định: `PENDING_REVIEW`, `ESCALATED`, `NO_LOAN_NEEDED`, `AWAITING_STATEMENT`. Muốn xem `ACCEPTED` hoặc `REJECTED` phải truyền filter rõ.

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
