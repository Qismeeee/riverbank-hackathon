# Context sản phẩm Riverbank

Riverbank thẩm định vốn lưu động theo từng lô hàng của seller Shopee. Lịch trả xưởng thường đi trước payout. Hệ thống xác định khoảng thiếu tiền theo tuần, đề xuất số tiền và thời hạn phù hợp, chấm PD, chạy policy, viết tờ trình có bằng chứng để nhân sự ngân hàng quyết định.

## Nguyên lý sản phẩm

Số seller xin không phải số mặc định được đề xuất. Gap là đáy âm của dòng tiền cơ sở. Không cần vay là một kết quả thành công. ESCALATED nghĩa là chuyển người xử lý, không phải từ chối tín dụng.

Riverbank theo mô hình A: LOS với portal ngân hàng. Lõi gồm tiếp nhận, thẩm định, quyết định và bàn giao. Vốn, hợp đồng pháp lý, giải ngân, thu nợ và sổ cái thuộc ngân hàng/core. Mô hình B bàn giao sang LOS khác là phương án tích hợp.

Database mini được người dùng chốt tại [database/riverbank-mini.dbml](../database/riverbank-mini.dbml): một shop/seller record, một application/lô, một quyết định cuối/application. Dùng applications/application_events và UUID, tiền NUMERIC(18,2)/Decimal, tiền trong JSONB là chuỗi decimal. DBML chưa phải migration, các contract còn thiếu được ghi ở DATA/GAPS.

## Bản đồ thành phần

Các đường dẫn dưới đây xác định cách tổ chức code và trách nhiệm để triển khai.

| Đường dẫn từ gốc repo | Trách nhiệm |
|---|---|
| `api/main.py`, `api/config.py` | Khởi tạo API, CORS, cấu hình và secrets |
| `api/routers/` | Auth, underwriting, copilot, studio |
| `api/services/cashflow.py` | Dòng tiền tuần, gap, đề xuất và lịch counter |
| `api/policy/` | PolicyConfig, engine và R01 đến R10 |
| `api/services/underwriting/` | Workflow, repository, evidence, memo và adapter |
| `api/services/guard.py`, `guardrail.py` | Guard đầu vào và đầu ra |
| `api/services/copilot/`, `statements/` | Trích kế hoạch và đọc sao kê |
| `api/services/features.py`, `risk.py`, `api/models/` | Feature dùng chung train/serving và PD |
| `api/services/shopee/`, `api/etl/` | Nguồn seller và pipeline dữ liệu |
| `api/db/`, `infra/` | Schema, migration và triển khai |
| `api/tests/`, `eval/golden/` | Test và nhãn nghiệm thu |
| `policy/`, `knowledge/` | Ngưỡng, rule, fixture, prompt và guardrail |
| Frontend | Seller, lender portal và studio, vị trí package chốt với tech lead |

## Ranh giới tính toán và model

Code tính gap, tiền, kỳ hạn, lịch trích, PD và rule. LLM trích kế hoạch hoặc viết trên evidence đã khóa. Jev xử lý tác vụ phân loại theo phạm vi cho phép. Memo qua validator trước phát hành.

Gap bằng 0 bỏ CIC, PD và toàn bộ rule vay. Quyết định tín dụng luôn do nhân sự ngân hàng thực hiện. Mini tạo run mới cho counter trước quyết định, không sửa run COMPLETED hoặc quyết định cuối. Version ACTIVE/SUPERSEDED sau quyết định chỉ thuộc mở rộng P7.

Dữ liệu mô phỏng phải được gắn nhãn. PD train trên synthetic chỉ minh họa cơ chế, không phải xác suất đã kiểm định bằng khoản vay thật. Latency và chi phí là chỉ tiêu cần đo theo TEST_PLAN.
