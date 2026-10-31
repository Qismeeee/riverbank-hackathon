# Thiết kế danh tính và phân quyền Riverbank

Schema thiết kế: [riverbank-mini.dbml](riverbank-mini.dbml). Đây là thiết kế cho CORE-01.02, chưa phải migration PostgreSQL hoặc tích hợp đăng nhập đã chạy.

## Đánh giá và lựa chọn

OpenID Connect trên OAuth 2.0 phù hợp với Riverbank: provider xác thực người dùng; API kiểm access token dành cho Riverbank; database giữ quyền nghiệp vụ hiện hành. Cặp `issuer` và `subject` là khóa danh tính, có phân biệt hoa/thường; không dùng email hoặc mã shop để liên kết tài khoản. `subject` dài tối đa 255 ký tự ASCII theo [OIDC Core, mục 2 và 5.7](https://openid.net/specs/openid-connect-core-1_0.html#ClaimStability).

Client dùng Authorization Code với PKCE S256 theo [OAuth Security BCP](https://datatracker.ietf.org/doc/html/rfc9700#section-2.1.1). Provider, audience, client/callback và session vẫn cần chốt. Nếu access token sử dụng subject khác với ID token, adapter phải có contract ánh xạ được kiểm chứng; không mặc định hai subject giống nhau và không đưa ID token vào API thay access token.

Chọn database làm nguồn quyền ứng dụng để liên kết người vay với shop, xác định nhân sự ngân hàng trên nền tảng cho vay và thu hồi quyền độc lập với thời hạn token. Seller là người cần vay; underwriter là người thẩm định và quyết định trên lending platform, không thuộc shop. Role, shop ID, OAuth scope hay thông tin do client tự khai không tự cấp quyền. Nếu token có OAuth scope theo contract provider, scope đó giới hạn thêm quyền của token, không mở rộng quyền trong database.

## Bảng và quan hệ

| Bảng | Vai trò và ràng buộc |
|---|---|
| `auth_identities` | UUID nội bộ, khóa duy nhất `(issuer, subject)`, mặc định vô hiệu hóa. Danh tính đã xác minh vẫn cần được provision/enable trước khi nhận quyền. |
| `identity_roles` | Gán `seller` hoặc `underwriter`, có thời điểm cấp/hết hạn/thu hồi. Underwriter được đọc queue, thẩm định và quyết định ở cấp nền tảng mini một ngân hàng; seller cần thêm ownership grant. |
| `seller_access_grants` | Chỉ dành cho người vay: gắn một lần cấp role `seller` với seller/shop sở hữu. CHECK và FK tổ hợp chặn gắn role underwriter vào bảng này. |
| `authorization_events` | Audit chỉ thêm cho provision, enable/disable, cấp/thu hồi role và shop; actor là danh tính người hoặc dịch vụ control plane. |

Quan hệ người vay: `auth_identities` → `identity_roles(seller)` → `seller_access_grants` → `sellers`. Quan hệ người thẩm định: `auth_identities` → `identity_roles(underwriter)` → `decisions`; không cần grant shop. Mỗi seller trong mini đại diện đúng một shop; `shop_id` tại API ánh xạ từ `sellers.external_shop_ref` qua lookup server. `seller_id` và `external_shop_ref` bất biến: không đổi shop trên một seller đã có grant/hồ sơ. Nếu sau này một seller có nhiều shop thì cần thêm entity shop và chuyển ownership grant sang khóa shop trước khi mở chức năng đó. Nếu có nhiều ngân hàng/tenant thì phải thêm scope lender trước khi dùng chung dữ liệu.

`decisions.actor_identity_id` tham chiếu danh tính người ngân hàng; `authorization_role_assignment_id` giữ lần cấp role đã dùng. CHECK buộc `actor_role = underwriter`; FK tổ hợp ràng buộc assignment đó thuộc đúng actor và đúng role. Service vẫn phải kiểm identity được enable, assignment còn hiệu lực và các điều kiện nghiệp vụ tại thời điểm quyết định. Giữ nguyên danh tính, assignment và quyết định cũ sau khi thu hồi quyền để audit vẫn truy được issuer/subject.

`application_events` và `authorization_events` dùng `actor_identity_id` cho `HUMAN`, `system_actor_ref` cho `SYSTEM`. CHECK buộc đúng một kiểu actor. Service hệ thống có thể ghi sự kiện điều phối/provision; quyết định tín dụng luôn cần danh tính người ngân hàng đang có quyền.

## Cách kiểm quyền

1. API kiểm access token bằng verifier đã cấu hình: issuer được tin cậy, audience của API, chữ ký hoặc introspection và thời gian hiệu lực theo provider. Không chọn issuer đáng tin hoặc endpoint tải key từ token chưa xác minh.
2. Resolver lấy đúng `(issuer, subject)` đã xác minh và yêu cầu `is_enabled = true`. Chưa được map hoặc bị disable thì không có quyền; không tự đăng ký role hoặc nối tài khoản bằng email.
3. Lấy role assignment còn hiệu lực. Mỗi role/grant hợp lệ khi `granted_at <= now`, `now < expires_at` nếu có và chưa tới `revoked_at` nếu có.
4. Với seller, tra thêm ownership grant của chính assignment seller, đối chiếu seller/shop của application phía server và lọc danh sách trước phân trang/tính tổng. Với underwriter, role đang có hiệu lực cấp quyền trên nền tảng mini một ngân hàng để đọc queue, evidence, thẩm định và quyết định, không tra ownership shop. Evidence/document phải thuộc đúng application trong URL ở cả hai luồng; seller-view luôn che dữ liệu nội bộ.
5. Kiểm consent sàn riêng trước khi đọc nguồn: seller/shop, mục đích, hiệu lực và thu hồi. Grant ứng dụng hoặc consent OAuth không thay `seller_consents`.

Ví dụ: seller sở hữu shop A chỉ xem hồ sơ seller-view của A và không được quyết định. Underwriter được ngân hàng cấp role có thể xem hàng đợi hồ sơ, kiểm bằng chứng và quyết định trong nền tảng mini, dù không sở hữu shop nào. Thu hồi role underwriter chấm dứt quyền này ngay cả khi access token còn hạn.

Resolver dự kiến trả `roles` từ assignment hợp lệ và `ScopedGrant(seller, Scope(seller_id, shop_id))` từ ownership grant seller. Helper `Principal.permits` hiện tại vẫn kiểm grant shop cho cả hai role; cần tách kiểm role nền tảng underwriter và ownership seller khi triển khai adapter/dependency, trước khi mở API. Không cache quyền xuyên request khi chưa có cơ chế vô hiệu hóa bảo đảm thu hồi quyền. Mỗi request đọc lại trạng thái quyền từ nguồn authoritative.

## Provisioning, thu hồi và yêu cầu migration

Provisioning thuộc control plane đáng tin cậy, tách khỏi role seller/underwriter và API người dùng thông thường. Ngân hàng xác minh nhân sự trước cấp role underwriter; ownership shop phải được xác minh trước cấp grant seller. Đăng nhập thành công không tự tạo quyền, bật lại danh tính hoặc mở rộng grant.

Mọi thay đổi danh tính/quyền phải ghi `authorization_events` trong cùng transaction. Giữ bản cấp quyền cũ; thu hồi chỉ được đặt `revoked_at` một lần, không xóa hoặc sửa identity/role/seller của grant. Cấp lại tạo bản mới. Thu hồi/hết hạn role vô hiệu mọi grant con; role mới không tự nhận grant cũ. Disable identity đình chỉ toàn bộ quyền; re-enable là thao tác control plane có audit và phải rà lại các quyền được giữ.

Migration phải hiện thực các yêu cầu chưa được DBML tự thi hành:

- So sánh khóa issuer/subject chính xác với deterministic `C` collation; kiểm định issuer được allowlist và subject hợp lệ ở adapter/provisioning.
- Partial unique index `identity_roles(identity_id, role) WHERE revoked_at IS NULL` và `seller_access_grants(role_assignment_id, seller_id) WHERE revoked_at IS NULL`. Thu hồi bản hết hạn trước khi cấp lại; không dùng `now()` trong predicate index.
- Ràng buộc bất biến, cấm cascade delete và quyền DB chặn update/delete audit. FK và CHECK trong DBML chưa đủ cho append-only hoặc workflow.
- Khi ghi quyết định, kiểm và khóa các row identity → role underwriter theo thứ tự nhất quán trong transaction với application/version. Disable/revoke phải khóa/cập nhật cùng row để tuần tự hóa với quyết định, rồi kiểm lại hiệu lực tại bước ghi; không dùng kết quả quyền đã đọc ở ngoài transaction. Lệnh ghi seller kiểm và khóa thêm ownership grant.
- Validate thời hạn quyền, application và event/target trong service hoặc trigger thích hợp. Các FK tổ hợp kiểm actor/role và role seller của ownership grant; chúng chưa kiểm enable, thời hạn hoặc trạng thái workflow.

Không có bảng password, OAuth client secret hoặc token trong schema này. Session store, refresh token rotation và logout/revocation ở provider được thiết kế sau khi chọn client/session; không suy ra chúng đã được triển khai từ các bảng quyền này.

## Nghiệm thu còn lại

Kiểm cú pháp DBML và xuất SQL chỉ kiểm thiết kế. TEST-01 cần kiểm thử migration/adapter/API: trùng `(issuer, subject)`, cùng subject khác issuer, phân biệt hoa/thường, subject 255 ký tự; danh tính lạ/disable; role và ownership thiếu/hết hạn/thu hồi; seller không xem shop khác hoặc ra quyết định; underwriter không cần shop grant; FK chặn dùng role seller làm actor quyết định; regrant seller không hồi sinh scope cũ; race quyết định với disable/revoke; audit và actor không thể bị client giả; consent sàn độc lập. Chưa có kiểm thử tích hợp hoặc nghiệm thu CORE-01.02.

## Kiểm tra thiết kế ngày 2026-10-31

Trên macOS, Node v24.21.0 và npm 11.19.0, chạy từ `/tmp`:

```sh
npx --yes --package @dbml/cli@11.0.0 dbml2sql '/Users/minhkhoipham/Documents/Sea Competition/database/riverbank-mini.dbml' --postgres -o /tmp/riverbank-core-01-02-auth-schema.sql
```

Kết quả: exit 0, xuất PostgreSQL thành công. Tiếp theo chạy `uv run --no-project --python 3.12 --with pglast python -` từ `/tmp`, truyền đoạn kiểm cú pháp sau:

```python
from pathlib import Path
from pglast import parse_sql
from pglast.ast import CreateStmt, AlterTableStmt
statements = parse_sql(Path('/tmp/riverbank-core-01-02-auth-schema.sql').read_text())
tables = [s.stmt.relation.relname for s in statements if isinstance(s.stmt, CreateStmt)]
foreign_keys = [s for s in statements if isinstance(s.stmt, AlterTableStmt)]
print(f'PostgreSQL syntax parsed: {len(statements)} statements, {len(tables)} tables, {len(foreign_keys)} ALTER TABLE statements.')
print('Tables: ' + ', '.join(tables))
```

Kết quả: exit 0, 104 câu lệnh, 14 bảng, 21 câu `ALTER TABLE`. File SQL chỉ dùng kiểm cú pháp, không phải migration để chạy vận hành. `tasklist.json` hợp lệ với `python3 -m json.tool tasklist.json > /dev/null`; `git diff --check` đạt. Không chạy `make test` hoặc kiểm thử backend/tích hợp trong thay đổi thiết kế này; không có số pass/skip/fail kiểm thử nghiệp vụ để báo cáo.
