# Thiết kế danh tính và phân quyền Riverbank

Schema thiết kế: [riverbank-mini.dbml](riverbank-mini.dbml). Đây là thiết kế cho CORE-01.02; SQL baseline local cho auth tại CORE-01.19 chưa được nghiệm thu và chưa có tích hợp đăng nhập.

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

`PostgresGrantResolver` trả `roles` từ assignment hợp lệ và `ScopedGrant(seller, Scope(seller_id, shop_id))` từ ownership grant seller, bằng một truy vấn tại thời điểm thực thi; mỗi lần resolve đọc lại DB. Adapter nhận connection factory phía server hoặc dùng cấu hình PostgreSQL môi trường, chưa được nối vào app mặc định và cần tài khoản runtime chỉ đọc cùng kết nối tới DB authoritative. Nó không xác thực token hoặc kiểm consent. `Principal.is_underwriter()` kiểm role nền tảng; `owns_seller_shop()` kiểm ownership chính xác và `permits()` ủy quyền theo role. `auth/me` dùng dependency xác thực chung; helper quyền chưa nối endpoint nghiệp vụ hoặc được kiểm thử, không tự kiểm liên kết resource hay consent. Kiểm quyền khi ghi quyết định vẫn phải khóa và kiểm lại trong cùng transaction, không dựa vào kết quả resolver trước đó.

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

statements = parse_sql(Path("/tmp/riverbank-core-01-02-auth-schema.sql").read_text())
tables = [s.stmt.relation.relname for s in statements if isinstance(s.stmt, CreateStmt)]
foreign_keys = [s for s in statements if isinstance(s.stmt, AlterTableStmt)]
print(
    f"PostgreSQL syntax parsed: {len(statements)} statements, {len(tables)} tables, {len(foreign_keys)} ALTER TABLE statements."
)
print("Tables: " + ", ".join(tables))
```

Kết quả: exit 0, 104 câu lệnh, 14 bảng, 21 câu `ALTER TABLE`. File SQL chỉ dùng kiểm cú pháp, không phải migration để chạy vận hành. `tasklist.json` hợp lệ với `python3 -m json.tool tasklist.json > /dev/null`; `git diff --check` đạt. Không chạy `make test` hoặc kiểm thử backend/tích hợp trong thay đổi thiết kế này; không có số pass/skip/fail kiểm thử nghiệp vụ để báo cáo.

## PostgreSQL local tạm thời (CORE-01.19)

`api/db/migrations/001_auth_baseline.sql` tạo baseline `sellers` và bốn bảng auth theo thiết kế ở trên, bao gồm khóa, partial index và trigger bảo vệ lịch sử. Đây là baseline phát triển, chưa được nghiệm thu trên PostgreSQL; resolver mới chưa được kiểm thử hoặc nối ứng dụng, chưa có provisioning hay transaction ghép thay đổi quyền với audit. Không dùng dữ liệu thật. Tài khoản Compose là chủ DB/superuser chỉ để phát triển, có thể vượt qua các kiểm soát DB; phân quyền runtime/control plane và kiểm chứng append-only vẫn phải hoàn thiện trước vận hành. Bản nháp bảng business đã được áp dụng thủ công vào volume local theo yêu cầu; bảng loan terms và business repository chưa được tạo. Migration business chính thức vẫn phụ thuộc CORE-01.24/VER-01.01.

`api/db/migrations/002_auth_reader_privileges.sql` bổ sung nhóm PostgreSQL `riverbank_auth_reader` NOLOGIN với quyền SELECT ở các cột resolver cần, không cấp quyền sửa dữ liệu hoặc đọc audit. Script giả định baseline nằm trong schema `public`, phải chạy sau 001 bởi migration role đủ quyền, và cố ý lỗi nếu role đã tồn tại; role PostgreSQL dùng chung toàn cluster nên cần kiểm tra va chạm trước khi áp dụng. Script chưa chạy trên volume local và Compose không tự áp dụng 002. Chưa tạo login hoặc gán membership: operator phải thiết kế và kiểm soát tài khoản runtime sau khi kiểm chứng trong môi trường cô lập. Quyền hiệu lực còn phụ thuộc PUBLIC, các role được thừa hưởng, ownership và superuser; SQL này không thu hồi quyền có sẵn hoặc chứng minh isolation. Cần kiểm chúng, bảo vệ schema/search path và xác nhận role runtime không sở hữu bảng trước sử dụng. Control plane, audit transaction và quyền ghi nghiệp vụ chưa được thiết kế hoặc cấp bởi script này.

Để cấu hình Auth0 cho `api.main:app`, operator đặt `AUTH0_ISSUER` (tenant HTTPS kết thúc `/`), `AUTH0_AUDIENCE` (identifier API riêng) và `AUTH0_CLIENT_ID` (SPA client khác audience), cùng `PGHOST`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`. Compose chuyển ba biến Auth0 nếu có; thiếu bất kỳ giá trị nào giữ xác thực chưa cấu hình. Không ghi token hoặc secret vào repo. Verifier hiện chỉ nhận tenant `*.auth0.com`, RS256, claim `azp` đúng client và subject người dùng; yêu cầu operator kiểm chứng subject access token tương ứng subject OIDC trước provision. `/v1/auth/me` không tự tạo identity hoặc quyền. Chưa kiểm thử với tenant thực; cấu hình Compose dùng superuser local, không an toàn làm runtime production. Kiểm thử verifier và resolver ở TEST-01 trước sử dụng dữ liệu thật.

Rollback 002 sau khi ngừng dùng resolver: thu hồi membership reader đã cấp cho login theo inventory, rồi dùng `database/rollback/002_auth_reader_privileges.sql` thu hồi các quyền cột, `USAGE` type/schema được 002 cấp cho `riverbank_auth_reader`; giữ role, dữ liệu và audit. Chỉ xóa role sau khi kiểm tra toàn cluster không còn membership hoặc phụ thuộc khác; không dùng `DROP OWNED` vì có thể tác động quyền/tài sản ngoài migration. Việc rollback và quyền hiệu lực cần kiểm thử tại TEST-01; không tự áp dụng rollback vào DB hiện có.

Từ thư mục gốc, với Docker daemon đang chạy:

```sh
printf 'POSTGRES_PASSWORD=%s\n' 'local-development-password' > .env
docker compose up --build -d
curl -f http://127.0.0.1:8000/health/db
docker compose exec db psql -U riverbank -d riverbank -c '\dt'
docker compose down
```

Thay mật khẩu local tùy ý; `.env` không được commit. API đọc cấu hình kết nối `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`; `/health/db` chỉ chạy `SELECT 1` và trả 503 khi cấu hình thiếu hoặc không kết nối được. Nó không kiểm chứng schema, auth hay persistence. API hiện chưa lưu hồ sơ vào Postgres. DBeaver trên máy host kết nối `127.0.0.1:5433`, database và user `riverbank`, mật khẩu `POSTGRES_PASSWORD` trong `.env`; cổng chỉ mở trên localhost. Có thể dùng `docker compose exec db psql ...`. Dữ liệu trong volume `postgres_data` còn sau `docker compose down`.

Postgres chỉ chạy SQL trong `docker-entrypoint-initdb.d` khi volume dữ liệu mới được khởi tạo. Sửa file SQL không tự cập nhật volume hiện có: cần migration có version, không chạy lại baseline trên DB có dữ liệu. Chỉ với dữ liệu local bỏ được, `docker compose down -v` xóa toàn bộ volume và lần `up` sau tạo lại baseline. Rollback môi trường phát triển là dừng Compose và, sau khi sao lưu dữ liệu cần giữ, xóa volume; không có rollback bảo toàn dữ liệu hoặc migration runner cho môi trường có dữ liệu. Không thực hiện việc này trên DB dùng chung. Cần kiểm chứng SQL, constraint, privilege, rollback và concurrency trong TEST-01 trước khi đánh dấu CORE-01.19 hoàn thành.

Kiểm tra phiên này (macOS): `POSTGRES_PASSWORD=local-check docker compose config --quiet` đạt; `uv run --locked ruff check api/main.py` và `uv run --locked ruff format --check api/main.py` đạt; `python3 -m json.tool tasklist.json` và `git diff --check` đạt. `docker info` thất bại vì Docker daemon không chạy, nên chưa build/chạy container, chưa chạy SQL trên PostgreSQL hoặc kiểm tra kết nối thực. Không chạy `make test` hay bổ sung test nghiệp vụ theo kế hoạch TEST-01.

## Bản nháp các bảng business

`database/drafts/002_business_draft.sql` là bản SQL tham khảo cho chín bảng còn lại trong DBML: consent, applications, assessment runs, evidence, input/generated documents, decisions, handoffs và application events. Bản nháp dựa trên DBML, dùng `bigint` cho các cột tiền VND và tham chiếu baseline auth hiện có; không được Compose tự chạy; đã được áp dụng thủ công vào volume DB local hiện tại theo yêu cầu người dùng. Đây không phải migration được phê duyệt: chưa thống nhất version điều khoản, hợp đồng snapshot/JSON, idempotency và handoff lease; chưa hoàn thiện bảo vệ lịch sử, transaction consent, quyền và workflow. Chỉ dùng DB local cho dữ liệu synthetic; không chạy lại script vào volume đã có bảng và không dùng dữ liệu thật. CORE-01.24 và VER-01.01 phải được chốt trước khi hoàn thiện/chạy migration business. API vẫn chưa có repository PostgreSQL.

Ngày 2026-10-31: theo yêu cầu, chạy `docker compose exec -T db psql -v ON_ERROR_STOP=1 -U riverbank -d riverbank < database/drafts/002_business_draft.sql` thành công, sau đó `docker compose restart db`. `\dt` liệt kê 14 bảng và `/health/db` trả `database: reachable`. Chỉ volume hiện tại có bản nháp: volume mới chỉ tự chạy baseline auth; script draft không phải migration được nghiệm thu.
