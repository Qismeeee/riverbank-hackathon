# Tài liệu sản phẩm Riverbank

Bộ tài liệu nền tảng xác định nghiệp vụ, yêu cầu phần mềm, kiến trúc và quy trình phát triển Riverbank. Teammate và Codex sử dụng bộ này để hiểu sản phẩm và triển khai theo cùng một thiết kế. Ngôn ngữ làm việc là tiếng Việt.

## Thứ tự đọc

1. [AGENTS.md](AGENTS.md) và [CONTEXT.md](CONTEXT.md): quy ước và bối cảnh sản phẩm.
2. [BRD.md](BRD.md), [BUSINESS.md](BUSINESS.md), [SRS.md](SRS.md): mục tiêu, nghiệp vụ và yêu cầu.
3. [SAD.md](SAD.md), [DATA.md](DATA.md), [API.md](API.md): kiến trúc, dữ liệu và tích hợp.
4. [GAPS.md](GAPS.md), [NEXT_STEPS.md](NEXT_STEPS.md): quyết định cần chốt và trình tự triển khai.
5. [HANDOFF.md](HANDOFF.md), [TEST_PLAN.md](TEST_PLAN.md): prompt làm việc và nghiệm thu.
6. [SOURCES.md](SOURCES.md): tài liệu tham khảo theo chủ đề.

## Vai trò tài liệu

BRD xác định bài toán, giá trị và phạm vi. BUSINESS giải thích luồng và quy tắc. SRS quy định hành vi cần nghiệm thu. SAD mô tả thiết kế kỹ thuật. API và DATA xác định contract giữa các thành phần. Các đường dẫn code/test chỉ ra vị trí tổ chức triển khai, không phải tuyên bố chức năng đã hoàn thành.

Policy ở `../policy/`, prompt và guardrail ở `../knowledge/`. Khi chuyển cho teammate, chia sẻ cả repo cùng thư mục này để có đủ policy, fixture và prompt.

Database mini được người dùng chọn tại [database/riverbank-mini.dbml](../database/riverbank-mini.dbml). Đọc DATA để hiểu mapping, kiểu tiền, tính bất biến và phần còn thiếu. DBML chưa phải migration, repo chưa có backend thực thi. Schema mini thay các giả định persistence cũ, version ACTIVE/SUPERSEDED chỉ thuộc mở rộng P7.

## Hiệu lực

Tuân thủ chỉ dẫn người dùng và các AGENTS.md có hiệu lực. Đổi khẩu vị phải cập nhật policy, tham số, rule và test theo quy trình xác nhận. Các lựa chọn cần chốt được tập trung tại GAPS. Không suy ra quyền thay đổi chính sách từ ví dụ minh họa.
