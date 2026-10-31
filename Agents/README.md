# Tài liệu sản phẩm Riverbank

Bộ tài liệu nền tảng xác định nghiệp vụ, yêu cầu phần mềm, kiến trúc và quy trình phát triển Riverbank. Teammate và Codex sử dụng bộ này để hiểu sản phẩm và triển khai theo cùng một thiết kế. Ngôn ngữ làm việc là tiếng Việt.

## Thứ tự đọc

1. [AGENTS.md](AGENTS.md) và [CONTEXT.md](CONTEXT.md): quy ước và bối cảnh sản phẩm.
2. [BRD.md](BRD.md), [BUSINESS.md](BUSINESS.md), [SRS.md](SRS.md): mục tiêu, nghiệp vụ và yêu cầu.
3. [SAD.md](SAD.md), [DATA.md](DATA.md), [API.md](API.md), [schema mini](../database/riverbank-mini.dbml) và [thiết kế auth](../database/README.md): kiến trúc, dữ liệu và tích hợp.
4. [GAPS.md](GAPS.md), [NEXT_STEPS.md](NEXT_STEPS.md) và [tasklist.json](../tasklist.json): quyết định cần chốt, thứ tự triển khai và acceptance cụ thể của task/subtask.
5. [HANDOFF.md](HANDOFF.md), [TEST_PLAN.md](TEST_PLAN.md): prompt làm việc và nghiệm thu.
6. [SOURCES.md](SOURCES.md): tài liệu tham khảo theo chủ đề.

## Vai trò tài liệu

BRD xác định bài toán, giá trị và phạm vi. BUSINESS giải thích luồng và quy tắc. SRS quy định hành vi cần nghiệm thu. SAD mô tả thiết kế kỹ thuật. API và DATA xác định contract giữa các thành phần. Các đường dẫn code/test chỉ ra vị trí tổ chức triển khai, không phải tuyên bố chức năng đã hoàn thành.

Policy ở `../policy/`, prompt và guardrail ở `../knowledge/`. Khi chuyển cho teammate, chia sẻ cả repo cùng thư mục này để có đủ policy, fixture và prompt.

## Hiệu lực

Tuân thủ chỉ dẫn người dùng và các AGENTS.md có hiệu lực. Đổi khẩu vị phải cập nhật policy, tham số, rule và test theo quy trình xác nhận. Các lựa chọn cần chốt được tập trung tại GAPS. Không suy ra quyền thay đổi chính sách từ ví dụ minh họa.

Schema mini là thiết kế đích; các khác biệt còn mở với code/contract cũ được ghi tại CORE-01.24 và GAPS. Giữ API `/v1/cases`; tên bảng đích `applications/application_events/version_no` được ánh xạ ở persistence. Quyền underwriter ở lending platform và ownership seller theo shop là thiết kế hiện hành; helper auth đã tách hai loại quyền nhưng CORE-01.23 còn tích hợp và kiểm thử. Hướng dẫn chia commit, đồng bộ nhánh và nhận task nằm trong [HANDOFF.md](HANDOFF.md).
