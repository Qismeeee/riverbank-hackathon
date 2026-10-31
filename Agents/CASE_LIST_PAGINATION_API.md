# API spec: phân trang danh sách hồ sơ (FE-02)

Trạng thái: contract bàn giao để backend triển khai. Frontend trên branch `frontend` đã hỗ trợ contract này và response cũ. Tài liệu này không xác nhận backend hoặc môi trường demo đã cập nhật.

## Mục tiêu và phạm vi

Hồ sơ thứ 101 trở đi phải truy cập được. Bộ lọc phải áp dụng trên toàn bộ dữ liệu được cấp quyền trước khi phân trang, không lọc trên 100 hồ sơ đã lấy. Giữ nguyên summary, quyền truy cập và quy trình quyết định tín dụng.

| Endpoint | Quyền | Thay đổi cần triển khai |
|---|---|---|
| `GET /v1/queue` | Underwriter | Thêm `status=DECIDED`, `total`, `has_more`, `counts_by_status` |
| `GET /v1/me/cases` | Seller hiện tại | Thêm `total`, `has_more`; giữ scope seller từ token |
| `GET /v1/studio/eval-metrics` | Underwriter | Giữ contract trả toàn bộ báo cáo; frontend phân trang sau khi tìm kiếm/lọc toàn bộ `cases` |

`DECIDED` chỉ là bộ lọc truy vấn, không thêm vào enum trạng thái lưu trong hồ sơ và không chuyển trạng thái hồ sơ.

## Request

Giữ `Authorization: Bearer <token>` và các đường dẫn hiện tại.

| Query | Kiểu | Mặc định | Quy tắc |
|---|---|---|---|
| `limit` | integer | 50 (giữ backend hiện tại) | `1 <= limit <= 100` |
| `offset` | integer | 0 | `offset >= 0`, không bắt buộc là bội số của `limit` |
| `status` (chỉ queue) | string, optional | Bỏ trống = tất cả hồ sơ mở | Một trạng thái hiện có hoặc bộ lọc `DECIDED` |

Không thêm query `seller_id`/`shop_id` cho `/me/cases`. Principal xác thực quyết định phạm vi truy cập. Count phải dùng cùng phạm vi quyền với items.

### Phạm vi queue và thứ tự

Giữ thứ tự backend hiện tại để frontend cũ/mới và hai repository không phân trang theo hai thứ tự khác nhau:

| `status` | Tập hồ sơ | ORDER BY |
|---|---|---|
| Bỏ trống | `PENDING_REVIEW`, `ESCALATED`, `AWAITING_STATEMENT`, `NO_LOAN_NEEDED` | `created_at ASC, case_id ASC` (FIFO) |
| Một trạng thái mở | Chỉ trạng thái đó | `created_at ASC, case_id ASC` |
| `ACCEPTED` hoặc `REJECTED` | Chỉ trạng thái đó | `created_at DESC, case_id DESC` |
| `DECIDED` | Hợp của `ACCEPTED` và `REJECTED` | `created_at DESC, case_id DESC` trên toàn bộ tập hợp |

`/me/cases` giữ `created_at DESC, case_id DESC` trên mọi trạng thái của seller hiện tại. Timestamp được so sánh như thời điểm UTC, không theo chuỗi ngày địa phương. `case_id` là tie-breaker bắt buộc, cùng quy tắc so sánh ở Memory/PostgreSQL.

Frontend giữ thứ tự server; không đảo thứ tự riêng từng trang. Hồ sơ mới trong queue FIFO có thể nằm ở trang cuối; lọc theo trạng thái phải tìm trên toàn bộ tập dữ liệu. Đổi ưu tiên sang mới nhất trước là thay đổi contract riêng, cần đổi đồng nhất cả Memory/PostgreSQL và các test.

Ví dụ:

```http
GET /v1/queue?status=PENDING_REVIEW&limit=26&offset=100
GET /v1/queue?status=DECIDED&limit=26&offset=25
GET /v1/me/cases?limit=26&offset=50
```

Frontend hiển thị 25 hồ sơ nhưng yêu cầu 26 để có một hàng lookahead khi backend cũ chưa có metadata. Trang sau tăng `offset` thêm 25, không tăng theo limit 26. Các giá trị này là hợp lệ và không được làm tròn ở server.

## Response 200

Giữ nguyên `items`, `limit`, `offset`; thêm các trường dưới đây. Schema `CaseSummary` hiện tại không đổi.

```json
{
  "items": [],
  "limit": 26,
  "offset": 100,
  "total": 100,
  "has_more": false,
  "counts_by_status": {
    "PENDING_REVIEW": 100,
    "ESCALATED": 12,
    "AWAITING_STATEMENT": 7,
    "NO_LOAN_NEEDED": 4,
    "ACCEPTED": 61,
    "REJECTED": 18
  }
}
```

Ví dụ trên là `status=PENDING_REVIEW`, offset nằm ngay sau kết quả cuối. `total` và `counts_by_status` có phạm vi khác nhau theo định nghĩa bên dưới.

| Trường | Kiểu | Ý nghĩa |
|---|---|---|
| `items` | `CaseSummary[]` | Kết quả đã lọc, sắp xếp rồi mới cắt theo limit/offset; tối đa `limit` |
| `limit` | integer | Limit được yêu cầu |
| `offset` | integer | Offset được yêu cầu, không tự clamp |
| `total` | integer >= 0 | Tổng kết quả sau scope quyền và bộ lọc, trước limit/offset |
| `has_more` | boolean | `offset + len(items) < total` |
| `counts_by_status` | object | Bắt buộc ở queue; đủ sáu trạng thái, trạng thái không có hồ sơ ghi 0. Đếm toàn bộ hồ sơ được cấp quyền, không bị limit/offset hoặc status đang chọn giới hạn. Không trả trường này ở `/me/cases` |

Với queue không có `status`, `total` bằng tổng bốn trạng thái mở. Với `DECIDED`, `total = counts_by_status.ACCEPTED + counts_by_status.REJECTED`. Với một trạng thái, `total` bằng count trạng thái đó.

Offset >= total trả 200 với `items=[]`, `has_more=false`, vẫn trả đúng total/counts. Tập rỗng trả `total=0`. Không chuyển thành 404 hoặc tự đưa về trang đầu.

Items, total và counts trong **một response** phải được đọc từ cùng snapshot (một lock Memory, hoặc cùng snapshot transaction/statement PostgreSQL). Frontend không tính số hồ sơ còn lại từ tiền, PD hoặc dữ kiện nghiệp vụ.

## Thực hiện backend

1. Router/schema nhận `DECIDED` riêng ở query; enum trạng thái nghiệp vụ không đổi. Giữ kiểu lỗi xác thực/schema hiện tại.
2. Repository lọc quyền và trạng thái trước `ORDER BY ... LIMIT ... OFFSET ...`. Không lấy 100 rồi lọc trong service. `DECIDED` dùng `status IN ('ACCEPTED','REJECTED')`, không phân trang hai trạng thái rồi ghép.
3. Bổ sung phép đếm cùng scope và snapshot cho Memory/PostgreSQL. Giữ summary an toàn; không đưa run/evidence/PII nội bộ vào danh sách seller.
4. Response model giữ các trường mới, tránh bị FastAPI loại bỏ khi serialize. Cập nhật OpenAPI và test cả hai repository. Đánh giá query plan/index phù hợp dữ liệu thực; không đưa migration hoặc policy ngoài phạm vi vào task này.
5. Không thay đổi workflow, audit, điều khoản, CIC/PD hoặc side effect của các endpoint ghi.

## Lỗi và tương thích

- `limit=0`, `limit=101`, offset âm/không nguyên, status không hợp lệ: 422 theo schema hiện tại. `DECIDED` phải hợp lệ sau update.
- Thiếu/hết hạn token: 401. Sai role/scope: 403 theo auth hiện tại; không trả count ngoài phạm vi được cấp quyền.
- Đường dẫn và ba trường response cũ giữ nguyên. Thêm metadata là thay đổi cộng thêm. Giữ mặc định limit backend hiện tại để client cũ không đổi hành vi.
- Frontend dùng `total`/`counts_by_status` khi có; thiếu metadata thì không giả số lượng trang đang tải là tổng số hồ sơ. Một hàng lookahead quyết định nút Sau, kể cả tổng là bội số đúng của page size.
- Frontend thử `status=DECIDED`. Chỉ khi server cũ trả 422, frontend đọc đủ prefix của hai luồng `ACCEPTED`/`REJECTED` bằng các request tối đa 100, trộn theo thứ tự toàn cục rồi mới cắt trang. Không bỏ qua 401/403/5xx hoặc dùng kết quả thành công một phần. Đường tương thích này tốn thêm request ở trang sâu; backend triển khai union để còn một request mỗi trang.
- Pagination offset không cố định snapshot qua nhiều request. Nếu thêm hồ sơ/quyết định giữa các trang, vị trí có thể dịch chuyển; nút Làm mới lấy lại trang đầu. Không cam kết không lặp/không bỏ sót khi dataset thay đổi đồng thời; cursor/snapshot xuyên trang ngoài phạm vi lần này.

## Acceptance criteria

1. Có 125 hồ sơ mở với timestamp ổn định: duyệt các trang lấy đủ 125 case ID đúng thứ tự, không trùng/thiếu, kể cả hàng 101 và cuối cùng.
2. Một `PENDING_REVIEW` nằm ngoài 100 hồ sơ mở đầu: query có status vẫn trả được hồ sơ đó; total là tổng status trên toàn bộ dữ liệu.
3. Trộn ít nhất 130 ACCEPTED và 130 REJECTED xen kẽ thời gian: `DECIDED` phân trang đúng thứ tự hợp nhất, không bỏ sót khi chuyển trang và khi timestamp trùng.
4. Seller A có >100 hồ sơ và seller B có dữ liệu riêng: items/total của A chỉ gồm A, không lộ hồ sơ/count B; underwriter không dùng endpoint seller để vượt scope.
5. Tập rỗng, trang cuối thiếu hàng, trang cuối đầy đúng limit, offset=total và offset>total đều trả đúng total/has_more. `limit=26,offset=25` được hỗ trợ.
6. Đổi filter/page size đặt offset=0. Response cũ tới muộn không ghi đè filter mới; lỗi tải có thông báo và Thử lại, không hiện nhầm “không có hồ sơ”.
7. Frontend cũ vẫn đọc ba trường cũ; frontend mới hoạt động với response cũ. Test contract mới phải chứng minh `DECIDED` không dùng fallback 422.
8. Studio lọc/tìm trên toàn bộ báo cáo eval trước khi cắt trang; summary của báo cáo không đổi theo trang. Không đưa phân trang vào bảng rule hay biểu đồ traffic vốn không phải danh sách hồ sơ nghiệp vụ.

Backend cần ghi lệnh và số pass/skip/fail sau khi triển khai, gồm kiểm tra Memory và PostgreSQL; test frontend dùng mock không thay thế nghiệm thu backend thật.
