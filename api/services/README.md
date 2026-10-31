# Service layout

Các service được cung cấp đã được chuyển từ `api/services/services/` lên trực tiếp `api/services/`. Import nội bộ `services.*` đã đổi thành `api.services.*`. Các thư mục `copilot/`, `shopee/`, `statements/` và `underwriting/` giữ cấu trúc tương đối; không còn thư mục `services` lồng bên trong.

Bộ nguồn này có contract khác với nền đang được auth, schema và kiểm thử dùng. Để giữ code có sẵn, 17 file nền trước đó được chuyển vào `foundation/`: cashflow, features, risk và underwriting synthetic/memory/evidence. Caller hiện tại nhập rõ `api.services.foundation.*`; `health.py` giữ nguyên vị trí. Đây là bước sắp xếp source, chưa nối các service mới vào HTTP hoặc phê duyệt policy.

| Vị trí | Trách nhiệm hiện tại |
|---|---|
| `cashflow.py`, `features.py`, `risk.py` | Bộ engine/feature/risk được cung cấp |
| `underwriting/` | Bộ workflow/models/repository được cung cấp |
| `copilot/`, `statements/`, `shopee/` | Bộ xử lý tương ứng được cung cấp |
| `foundation/` | Nền trước đó được bảo toàn, đang dùng cho auth scope, DTO fixture và kiểm thử |
| `health.py` | Kiểm tra kết nối DB của route health hiện tại |

Source mới vẫn tham chiếu các module ứng dụng chưa có hoặc chưa tương thích trong repo (`config`, `db.pool`, `policy`, `jev`, `llm`, `prompts`, `kv`, `logs`, `messaging`), các asset/model/data và dependency bổ sung. Việc chuyển thư mục không tạo các thành phần này hoặc chứng minh workflow đáp ứng SRS. Các route nghiệp vụ tiếp tục fail closed; kiểm gate policy, consent, quyền và version điều khoản trước khi tích hợp.

Kiểm tra lần chuyển ngày 2026-10-31: `uv run --locked pytest` trên macOS/Python 3.12.16 đạt 49 passed, 0 skipped, 0 failed; chỉ kiểm nền hiện có. Parse cú pháp toàn bộ 69 file service đạt và không còn import top-level `services.*`. Ruff check/format của foundation cùng caller hiện có đạt. Ruff toàn bộ service nhập mới còn 45 lỗi lint; chưa sửa nghiệp vụ hoặc nạp thêm dependency trong bước chuyển này.
