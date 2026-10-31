# Luồng và quy tắc nghiệp vụ

Nguồn quy phạm: [policy](../policy/policy.md), [tham số](../policy/parameters.yaml) và [fixture tính tay](../policy/worked-examples.md). Contract trạng thái và endpoint nằm trong [SRS.md](SRS.md) và [API.md](API.md).

## Vòng đời nghiệp vụ

| Phase | Nội dung | Phạm vi thiết kế |
|---|---|---|
| P0 | Onboarding, eKYC, CIF, consent | Consent/scope thuộc lõi, onboarding qua ngân hàng |
| P1 | Nhập kế hoạch lô hàng | Form API và Copilot trích kế hoạch |
| P2 | Dòng tiền, PD, CIC, policy, sao kê, memo | Engine và service, CIC qua adapter ngân hàng hoặc mock demo |
| P3 | Ngân hàng kiểm bằng chứng và quyết định | Lender portal và API quyết định có xác thực |
| P4 | Offer, hợp đồng, ký và ủy quyền | Ngoài lõi, cần mẫu và hệ thống ngân hàng |
| P5 | Giải ngân và hạch toán | Core ngân hàng, Riverbank bàn giao qua adapter |
| P6 | Trích payout và đối soát | Riverbank đề xuất lịch, Shopee và core vận hành tiền |
| P7 | Giám sát và đề xuất cơ cấu | Mở rộng có version điều khoản và người duyệt |
| P8 | Tất toán, quá hạn, thu hồi | Ngân hàng/core |

## Luồng thẩm định

Validate kế hoạch và guard đầu vào → consent/scope → snapshot payout → CashFlowEngine. Gap bằng 0 thì dừng nhánh vay, tạo giải thích và ngưỡng cảnh báo. Gap dương thì chấm PD. Nếu R05 mới chỉ thiếu sao kê, hồ sơ vào `AWAITING_STATEMENT` và CIC gate được hoãn với `deferred_until_statement`. Sau khi đối chiếu sao kê, hoặc khi không cần sao kê, hệ thống qua gate CIC, lấy CIC qua adapter, chạy policy và tạo evidence. D09/D10 do code ghép từ evidence và phải qua validator.

`PENDING_REVIEW` không phải đã được vay. `ESCALATED` không phải bị từ chối. Người duyệt phải xử lý lý do, và không thể dùng ghi chú xác minh để ghi đè rule cứng còn fail.

Thiếu PD phải chuyển người. Một quy trình xác minh thủ công thay thế chỉ được áp dụng khi đã được ngân hàng chốt thành policy có xác nhận. Ghi chú xác minh không tự tạo ngoại lệ cho rule cứng.

## Dòng tiền

Payout cơ sở là median toàn bộ lịch sử hợp lệ truyền vào. Tuần 0 không có payout. Số dư cuối tuần bằng số dư đầu tuần cộng payout trừ tiền xưởng. Gap bằng `max(0, -min(số dư cơ sở))`, không phải tổng các số dư âm.

Engine lấy hệ số stress, đệm tiền, làm tròn, đệm tuần và trần kỳ trích từ cấu hình tương ứng. Kỳ hạn ban đầu theo khoảng từ tuần âm đầu đến tuần âm cuối, rồi tăng từng bước đến khi phù hợp trần hoặc đạt giới hạn. Lịch tuần chia tiền nguyên VND, phần dư vào các tuần đầu. Phải dùng lịch engine trả về để giữ tổng khớp tiền gốc.

## Danh mục rule

Các giá trị số phải tra `../policy/parameters.yaml`, không chép bảng này thành config thứ hai. Thứ tự chạy rule là R09, R01, R04, R08, R02, R03, R05, R06, R07, R10.

| Rule | Loại | Nội dung |
|---|---|---|
| R01 | Cứng | Trần số tiền của bộ policy |
| R02 | Cứng | Tuổi shop tối thiểu |
| R03 | Mềm | Tỷ lệ hoàn tối đa |
| R04 | Cứng | Khoảng kỳ hạn |
| R05 | Cứng | Vượt mức hỗ trợ sàn phải có chứng từ đã xác minh |
| R06 | Cứng | Nhóm nợ CIC chấp nhận được |
| R07 | Mềm | Dư nợ hiện tại so với payout xấu tháng |
| R08 | Cứng | Kỳ trích lớn nhất so với trần payout xấu |
| R09 | Cứng | Trần vay điện tử cho cá nhân theo config demo |
| R10 | Cứng | Trần PD theo basis points |

R05 xét `max(requested_amount, amount_proposed)` trong service. Chỉ vượt hẳn mốc mới cần chứng từ, bằng mốc thì không. Đối chiếu cùng kỳ payout, không cộng doanh thu ngoài sàn vào tổng payout sàn.

## Trạng thái và quyết định

| Trạng thái | Ý nghĩa và bước tiếp |
|---|---|
| `NO_LOAN_NEEDED` | Không PD/CIC/rule vay, muốn kế hoạch khác phải tạo hồ sơ mới |
| `AWAITING_STATEMENT` | Chờ chứng từ R05, nộp sao kê rồi thẩm định lại |
| `PENDING_REVIEW` | Chờ ngân hàng quyết định |
| `ESCALATED` | Cần người xử lý, chấp nhận còn phụ thuộc mọi cổng kiểm tra |
| `ACCEPTED` | Người ngân hàng chấp nhận, có thể bấm handoff |
| `REJECTED` | Người ngân hàng từ chối, không có số giải ngân |

`ANALYZING` là trạng thái nội bộ, input bị chặn trả 422 không lưu case. Handoff giữ nguyên quyết định và có `handoff.status` riêng. `ACCEPT_COUNTER` chạy lại lịch trích, PD và policy rồi mới ghi nhận. Kỳ hạn cuối có thể dài hơn số người duyệt nhập.

## Fixture để hiểu sản phẩm

FX-B: lô 200 triệu, vốn 120 triệu, trả hết tuần 0, payout 70 triệu/tuần. Gap 80 triệu, đề xuất 90 triệu, 8 tuần, trích 11,25 triệu/tuần. Đây là kết quả fixture, không phải số được hard-code vào engine.

FX-A: cùng lô và vốn nhưng trả 100 triệu tuần 0 và 100 triệu tuần 4. Gap 0, cảnh báo payout dưới 20 triệu/tuần. Không gọi CIC hoặc PD.

Case C dùng đúng mức hỗ trợ sàn của fixture hoặc seller profile đang chọn; không trộn mức hỗ trợ giữa hai profile. Dữ liệu demo API dùng subject có tên như `minhchau.shop`, không dùng `demo-b`. Case D cần quy trình xác minh thu ngoài sàn. Case L thuộc phạm vi mở rộng Monitor, chỉ kích hoạt version lịch mới sau quyết định của người ngân hàng.
