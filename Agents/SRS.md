# SRS — Riverbank

| Thuộc tính | Giá trị |
|---|---|
| Sản phẩm | Riverbank |
| Loại tài liệu | Software Requirements Specification |
| Phiên bản | 1.2 — bản hợp nhất yêu cầu đích |
| Ngày đối chiếu | 2026-10-31 |
| Trạng thái | Đặc tả hợp nhất cho triển khai; không phải xác nhận nghiệm thu hoặc phê duyệt policy |
| Nguồn đích | SRS 1.1 do người dùng đính kèm; giữ các mã FR-01–FR-38, FR-16b, FR-19b, FR-31b |
| Đối chiếu | [BRD](BRD.md), [BUSINESS](BUSINESS.md), [AGENTS](../AGENTS.md), [API](API.md), [DATA](DATA.md), [GAPS](GAPS.md) |
| Thiết kế kỹ thuật | [SAD](SAD.md); lựa chọn model, thư viện và số agent không quyết định yêu cầu nghiệp vụ |

Bản này thay SRS tóm tắt trước đây bằng yêu cầu chi tiết từ bản đính kèm, giữ các bất biến của repo và bổ sung xác thực/phân quyền OAuth 2.0 và OpenID Connect (OIDC). Các thay đổi so với hai nguồn được ghi trong [phân tích gap](SRS_GAP_ANALYSIS.md). Các số demo là ví dụ nghiệm thu theo tham số, không phải policy sản xuất hoặc kết luận pháp lý.

Mỗi yêu cầu dùng chữ **phải** và có tiêu chí nghiệm thu quan sát được. Đường dẫn implementation/test trong tài liệu là truy vết kế hoạch; bảng đạt của commit lịch sử trong bản đính kèm không chứng minh repo hiện tại đã đạt. Trạng thái triển khai xem mục 11 và [tasklist](../tasklist.json).

## 1. Mục đích

Riverbank phải tiếp nhận kế hoạch một lô hàng, xác định thiếu vốn theo dòng tiền, tạo hồ sơ có bằng chứng, ghi nhận quyết định của người ngân hàng và bàn giao gói hồ sơ cho LOS. Không tạo nhu cầu vay giả khi gap bằng 0. Mọi số tiền, lịch, PD và kết quả rule do code tính; LLM chỉ trích dữ kiện hoặc diễn đạt từ evidence đã khóa.

## 2. Phạm vi hệ thống

Lõi gồm input guard, consent/scope, dữ liệu payout, cashflow, PD, CIC qua adapter ngân hàng, policy, sao kê có điều kiện, memo và bản seller, queue, quyết định/counter, lịch sử điều khoản, audit và handoff. Đăng nhập theo OIDC trên OAuth 2.0 và phân quyền server áp dụng cho toàn bộ API nghiệp vụ.

Theo BRD, P0 eKYC/CIF, P4 hợp đồng/khế ước/ủy nhiệm chi, P5 giải ngân/hạch toán, P6 vận hành trích tiền, P8 phân nhóm nợ/thu hồi thuộc ngân hàng và hệ thống ngoài. Consent đọc nguồn trong P0 vẫn thuộc lõi Riverbank. Không có lệnh vận hành tiền từ Riverbank sang core. P7 giám sát/cơ cấu, hỏi lại và doanh thu ngoài sàn có task/contract riêng, không tự mở rộng phạm vi lõi hoặc viết hợp đồng bằng LLM.

## 3. Thuật ngữ

| Từ | Nghĩa |
|---|---|
| Gap | `max(0, -min(số dư cuối tuần cơ sở))`, không phải tổng các tuần âm |
| Kịch bản cơ sở/xấu | Payout lịch sử theo quy tắc đã chốt và payout sau stress |
| Evidence | Payload hoặc tham chiếu bất biến có mã/hash, đúng case/run/scope và provenance |
| Mức sàn hỗ trợ | Số nguồn cung cấp, được dùng cùng hệ số R05 của policy để xác định khi nào cần chứng từ |
| Rule cứng/mềm | Fail hoặc thiếu dữ liệu ở rule cứng chặn chấp nhận; rule mềm có thể tạo cảnh báo |
| Case/application | Hồ sơ API `/v1/cases`, ánh xạ persistence sang `applications` |
| Assessment run | Một lần thẩm định trên snapshot, model và policy xác định; không ghi đè run trước |
| Case version | Khóa cập nhật `version` API ↔ `version_no` DB; khác version điều khoản |
| Terms version | Bộ tiền/kỳ hạn/lịch, INSERT bản mới và SUPERSEDED bản trước khi thay đổi |
| OIDC / OAuth 2.0 | Lớp xác thực danh tính / khung ủy quyền cấp access token; role/ownership ứng dụng kiểm server |
| Seller / underwriter | Người vay có ownership shop / nhân sự ngân hàng có role nền tảng mini một ngân hàng |
| Consent sàn | Cho phép riêng theo seller/shop, purpose và thời gian; khác consent đăng nhập |
| Gói hồ sơ | Quyết định, điều khoản áp dụng, memo, evidence, cashflow, rule/risk và provenance |

## 4. Hệ thống ngoài

| Hệ thống | Riverbank cần | Ranh giới |
|---|---|---|
| OpenID Provider/Authorization Server | OIDC Authorization Code + PKCE S256, access token dành API | Không nhận mật khẩu hay tự cấp quyền ngân hàng khi login |
| Nguồn seller/sàn | Payout và dữ liệu shop được phép, đúng scope/consent | Chỉ đọc; nguồn thật/retention phải được chốt, synthetic ghi nhãn |
| Ngân hàng/policy | Bộ policy, thẩm quyền phê duyệt, biểu phí nếu có | Không tự đặt policy hoặc lãi/phí |
| CIC qua ngân hàng | Kết quả scoped, còn hiệu lực và evidence | Không kết nối trực tiếp; không tra khi gap 0 |
| LOS ngân hàng | Contract nhận gói, xác nhận/mã tham chiếu | Không sinh hợp đồng hoặc thực hiện giải ngân |
| Core banking | Không gọi trong phạm vi lõi | Ngân hàng thực hiện tiền và thu nợ |
| Người thẩm định | Identity và role underwriter đã được cấp có thẩm quyền | Không dùng system actor thay người quyết định tín dụng |

## 5. Yêu cầu chức năng

### 5.1 Tiếp nhận

**FR-01.** Hệ thống phải tạo hồ sơ có định danh duy nhất cho mỗi thao tác gửi kế hoạch mới, sau xác thực, kiểm ownership và input guard. Hai thao tác mới dùng Idempotency-Key khác nhau có thể tạo hai hồ sơ; retry cùng key và payload phải trả cùng kết quả, không tạo hồ sơ thứ hai.

Nghiệm thu: Hai thao tác hợp lệ khác key tạo hai định danh; retry cùng key/body chỉ có một hồ sơ và event tạo; cùng key khác body bị chặn bằng IDEMPOTENCY_KEY_REUSED.

Bám BR-01.

**FR-02.** Hồ sơ phải lưu định danh seller/shop và kế hoạch gồm giá trị lô, vốn đang có, lịch trả xưởng theo tuần, số tuần bán hết, số tiền xin vay. Tiền phải là integer VND; tổng lịch trả bằng giá trị lô, tuần không âm và nằm trong kỳ bán. Nếu giao diện nhận tỷ lệ, code phải chuyển sang số tiền và kiểm tổng trước xác nhận.

Nghiệm thu: Thiếu hoặc sai trường bắt buộc, tiền lẻ/boolean/số âm, tổng lịch lệch hoặc tuần ngoài kỳ bị lỗi đúng trường, không vào thẩm định.

Bám BR-01.

**FR-03.** Trước khi bất kỳ bước thẩm định hoặc model nào đọc chữ tự do, hệ thống phải chặn hoặc làm sạch SĐT, CCCD/số định danh, số tài khoản, lệnh bỏ policy/ép duyệt và thuộc tính nhạy cảm theo guardrail. Phải che PII tại server trước mọi outbound, kể cả classifier/guard. Đường tạo case và Copilot có contract riêng; lỗi guard phải fail closed và không log raw PII.

Nghiệm thu: Ghi chú ép duyệt bị chặn hoặc làm sạch theo đường vào; dữ liệu gốc không tới outbound/tờ trình, không đổi rule hoặc số, không lưu case bị chặn; lỗi phụ thuộc không cho input đi tiếp.

Bám BR-02, BL-08.

**FR-04.** Hệ thống phải từ chối số tiền xin vay hoặc số tuần vượt caps được cấu hình hợp lệ phía server trước thẩm định; đồng thời giới hạn kích thước request, số dòng lịch và độ dài ghi chú. Caps không được lấy từ client hoặc tự suy ra từ prompt.

Nghiệm thu: Giá trị bằng cap hợp lệ nếu các kiểm tra khác đạt; vượt cap trả lỗi schema theo API và không gọi nguồn/model/engine. Giới hạn tài nguyên áp mã lỗi tương ứng.

Bám BR-02.

### 5.2 Dữ liệu sàn

**FR-05.** Hệ thống phải đọc dữ liệu đúng seller/shop của hồ sơ, gồm payout theo tuần trong lịch sử cấu hình; phải kiểm ownership hoặc quyền nền tảng phù hợp và consent trước đọc. Nguồn phải được kiểm scope, kiểu tiền, lịch sử trùng/thiếu và provenance trước dùng; fixture phải gắn nhãn synthetic.

Nghiệm thu: Hồ sơ A không nhận dữ liệu B; nguồn trả sai scope hoặc lịch sử không đủ bị chặn, không trở thành snapshot hợp lệ; không gọi nguồn nếu thiếu consent.

Bám BR-03.

**FR-06.** Mỗi bảng dữ liệu hoặc kết quả dùng cho kết luận phải có mã bằng chứng, liên kết đúng hồ sơ, assessment run, scope và provenance; payload hoặc tham chiếu bất biến phải có hash kiểm tra khi đọc. Hash kiểm tính toàn vẹn, không thay việc xác minh nguồn hoặc consent.

Nghiệm thu: Mở mã trên memo thấy đúng bảng nguồn/run; đổi payload, hash hoặc ghép evidence từ hồ sơ/run khác bị từ chối, lịch sử không bị thay khi nguồn cập nhật.

Bám BR-17.

**FR-07.** Hệ thống phải dừng trước đọc nguồn khi consent đúng seller/shop, purpose và thời hạn chưa có, hết hạn hoặc đã thu hồi. OAuth consent đăng nhập không thay consent dữ liệu sàn. Grant/thu hồi/cấp lại phải có actor, thời gian server, bằng chứng và audit; xử lý thu hồi đồng thời với đọc theo contract được ngân hàng/pháp chế chốt.

Nghiệm thu: Không consent không đọc nguồn hoặc tạo tờ trình; thu hồi/hết hạn chặn lần đọc mới; retry/cấp lại không xóa lịch sử. Quyền đọc snapshot lịch sử và retention phải có quyết định riêng trước tích hợp.

Bám BR-03.

### 5.3 Dòng tiền và gap

Phần tính phải cho cùng một đầu vào thì cùng một kết quả. Người vận hành không sửa số dư bằng cách sửa câu chữ.

**FR-08.** Hệ thống phải dựng lịch chi xưởng và thu payout theo tuần cho kịch bản cơ sở và xấu. Payout cơ sở dùng median toàn bộ lịch sử hợp lệ theo BUSINESS; stress theo tham số được phép, tuần 0 không nhận payout. Tiền và quy tắc làm tròn phải được tính bằng code, tái lập chính xác integer VND.

Nghiệm thu: Fixture A gap 0; fixture B trả hết tuần 0 có gap 80.000.000 VND, các bảng tuần và quy tắc làm tròn khớp tuyệt đối với golden cấu hình tương ứng.

Bám BR-04, BR-05, BL-01.

**FR-09.** Số dư cuối một tuần phải bằng số dư đầu tuần cộng payout tuần đó trừ khoản chi tuần đó. Số dư đầu tuần sau bằng số dư cuối tuần trước.

Nghiệm thu: cộng tay bảng xuất ra khớp công thức trên từng tuần.

Bám BR-05.

**FR-10.** Gap phải bằng giá trị tuyệt đối của số dư âm sâu nhất trên kịch bản cơ sở. Không có số dư âm thì gap phải bằng 0.

Nghiệm thu: đổi tuần âm sâu nhất thì gap đổi theo đúng tuần đó, không theo tổng các tuần âm.

Bám BR-06.

**FR-11.** Khi gap = 0, hệ thống phải dừng trước PD, CIC và toàn bộ rule vay R01–R10, ghi NO_LOAN_NEEDED, tạo lý do cùng ngưỡng payout cảnh báo từ engine; không có đề xuất vay hoặc quyết định cấp vay.

Nghiệm thu: Fixture A không gọi model PD/CIC/policy, không trả số vay/PD/CIC; bản seller giải thích dòng tiền và ngưỡng cảnh báo 20.000.000 VND/tuần theo fixture.

Bám BR-06, BR-07.

**FR-12.** Khi gap > 0, số đề xuất phải bằng min(làm tròn lên theo bước cấu hình của gap × hệ số đệm, phần nguyên của gap × trần đệm). Số seller xin không thay kết quả engine; không dùng LLM tính hoặc sửa số.

Nghiệm thu: Fixture xin 150 triệu, gap 80 triệu, đệm 1,1, trần 1,15 và bước 5 triệu cho đề xuất 90 triệu, không phải 150 triệu; trường hợp chạm trần và phần dư VND cũng khớp tuyệt đối.

Bám BR-08, BL-02.

**FR-13.** Kỳ hạn cơ sở phải lấy khoảng tuần tính cả hai đầu từ tuần âm đầu đến tuần âm cuối, cộng tuần đệm theo BUSINESS và tham số. Phải ghi rõ hai mốc để không nhầm với tổng số tuần âm rời rạc; kỳ hạn cuối còn chịu FR-14 và trần cấu hình.

Nghiệm thu: Fixture B âm tuần 0 và 1, đệm 2 cho kỳ hạn cơ sở 4 tuần; fixture có nhiều khoảng âm phải dùng quy ước từ mốc đầu đến mốc cuối một cách tái lập.

Bám BR-09, BL-03.

**FR-14.** Nếu kỳ trích lớn nhất vượt phần nguyên của tỷ lệ trần × payout xấu, code phải tăng kỳ hạn theo bước cấu hình và tính lại đến khi đạt hoặc chạm trần kỳ hạn. Lịch chia integer VND phải có tổng bằng số gốc, phần dư phân vào các tuần đầu. Chạm trần vẫn vượt phải ghi không đạt, không coi là phương án hợp lệ.

Nghiệm thu: Fixture B: 90 triệu/4 tuần vượt 12,25 triệu; tăng 6 rồi 8 tuần cho 11,25 triệu/tuần. Trường hợp không đạt trần hoặc tiền không chia hết vẫn bảo toàn tổng, không tự chấp nhận.

Bám BR-10, BL-04.

**FR-15.** Đầu ra dòng tiền phải gồm payout cơ sở/xấu, gap, tuần âm đầu/cuối, kỳ hạn cơ sở và kỳ hạn cuối, số đề xuất, lịch trích, trần trích/kết quả đạt, ngưỡng cảnh báo khi không vay, và hai bảng tuần. Các kết quả phải có mã bằng chứng; không áp dụng trường vay cho gap 0.

Nghiệm thu: Tất cả số mở lại được qua evidence cùng run, tổng lịch khớp gốc; không có giá trị áp dụng thì ghi null/không áp dụng có lý do, không tự điền số.

Bám BR-05, BR-17.

### 5.4 Rủi ro và chính sách

**FR-16.** Khi gap > 0 và đủ dữ liệu/model hợp lệ, hệ thống phải ghi PD trong [0, 1] hoặc pd_bps nguyên trong [0, 10000] với chuyển đổi chính xác, model/version và ít nhất một yếu tố giải thích có chiều tăng/giảm. Feature dùng chung train/serving và không chứa thuộc tính nhạy cảm. Thiếu dữ liệu/model hoặc inference lỗi phải chuyển người, không giả PD bằng 0.

Nghiệm thu: Dữ liệu hợp lệ có PD và yếu tố; thiếu PD ghi trạng thái thiếu, ESCALATED và chặn chấp nhận khi chưa có quy trình thay thế được ngân hàng phê duyệt. Synthetic chỉ minh họa, không nhận là PD đã kiểm định bằng khoản vay thật.

Bám BR-11.

**FR-16b.** Khi gap > 0, hệ thống phải yêu cầu CIC qua adapter ngân hàng theo consent/scope và gate đã chốt trước khi đánh giá rule phụ thuộc CIC; kết quả có evidence, thời điểm và provenance. Gap 0 không yêu cầu CIC. Không có kết quả hợp lệ thì rule phụ thuộc ghi thiếu dữ liệu và chuyển người; không mặc định CIC tốt hoặc tạo kết quả.

Nghiệm thu: Fixture A không gọi CIC; fixture B dùng CIC synthetic có nhãn và evidence trước kết quả rule. Lỗi, thiếu consent, sai scope hoặc kết quả không còn hiệu lực chặn chấp nhận. Tra lại chỉ dành underwriter và không vượt gate gap/consent.

Bám BR-21.

**FR-17.** Hệ thống phải chạy các rule đang bật của đúng artifact policy hiệu lực và lưu mã rule, loại cứng/mềm, pass/fail hoặc thiếu dữ liệu, evidence và policy version/hash. Mỗi lần thay rule phải tạo bộ mới đã qua FR-18; thứ tự đánh giá và ngưỡng theo policy.

Nghiệm thu: Sau tắt rule trong bộ mới đã duyệt, run mới không có kết quả rule đó nhưng run cũ giữ nguyên; thiếu dữ liệu không trở thành pass.

Bám BR-12.

**FR-18.** Runtime phải từ chối nạp policy chưa có test đạt và xác nhận hợp lệ của người có thẩm quyền trên cùng version/hash. Artifact gồm policy văn bản, tham số, rule, bằng chứng test và phê duyệt; thay nội dung phải test/xác nhận lại. Test candidate thực hiện cô lập trước phê duyệt, không chờ TEST-01.

Nghiệm thu: Thiếu hoặc sai hash, test fail, thiếu phê duyệt hoặc phê duyệt không hợp lệ đều không nạp; không có approval=true mặc định hay phê duyệt từ client. Audit lưu người xác nhận, thời gian và artifact.

Bám BR-12.

**FR-19.** Nếu một rule đánh dấu là rule cứng bị fail, trạng thái hồ sơ phải là chuyển người. Không được tạo đề xuất duyệt thẳng.

Nghiệm thu: Hard fail bất kỳ chuyển ESCALATED và chặn mọi chấp nhận khi chưa được xử lý bằng dữ liệu/policy hợp lệ; không tự REJECTED.

Bám BR-13, BL-05.

**FR-19b.** Policy phải có rule cứng R09 về trần cho vay điện tử cho chủ thể áp dụng theo BL-09, giá trị trong cấu hình. Bản đích dùng 100.000.000 VND làm mặc định demo; phạm vi chủ thể, cách tính dư nợ và điều kiện áp dụng thực phải được ngân hàng/pháp chế chốt. Không coi mốc demo là kết luận pháp lý hoặc tự áp cho mọi chủ thể.

Nghiệm thu: Fixture cá nhân xin 300 triệu fail R09 theo cấu hình demo và ESCALATED dù mức sàn hỗ trợ; boundary/cách tính được test trên artifact đã chốt. Thiếu quyết định phạm vi áp dụng phải fail closed ở phần phụ thuộc.

Bám BL-09.

**FR-20.** Văn bản giải thích không được đổi pass thành fail hoặc ngược lại so với kết quả FR-17.

Nghiệm thu: sửa câu trong tờ trình không làm đổi bản ghi kết quả rule.

Bám BR-12.

### 5.5 Sao kê

**FR-21.** Hệ thống chỉ được yêu cầu sao kê theo R05 của policy hiệu lực: max(số xin, số đề xuất) > doc_required_multiple × mức sàn và chưa có chứng từ tương ứng được xác minh. Hiểu điều kiện yêu cầu mới là vượt hẳn ngưỡng; bằng ngưỡng không yêu cầu mới. Chỉ thiếu chứng từ R05 thì AWAITING_STATEMENT; hard fail khác hoặc thiếu dữ liệu rủi ro phải chuyển người.

Nghiệm thu: Với fixture B phù hợp, không yêu cầu sao kê; mốc bằng/vượt ngưỡng cho hai nhánh đúng. Hệ số 2,5 chỉ là giá trị demo hiện có, không hard-code trong UI/prompt.

Bám BR-14.

**FR-22.** Khi nhận sao kê, hệ thống phải kiểm role/ownership, kỳ đối chiếu, kích thước/định dạng và provenance. CSV qua parser Python; PDF chữ qua parser; scan/ảnh OCR có điều kiện; classifier chỉ phân loại, Python cộng integer VND. Phải đối chiếu tiền sàn với payout sàn cùng kỳ; sai lệch vượt ngưỡng chuyển người. Nhập tổng thủ công lưu actor/nguồn riêng; thẩm định lại tạo run/evidence mới.

Nghiệm thu: Có bảng cùng kỳ, tổng và sai lệch tính bằng code; lỗi đọc/OCR/classifier hoặc thiếu dữ liệu không được đánh dấu đã xác minh. Không lưu file gốc trước khi retention/quyền được chốt; khớp payout sàn không tự chứng minh thu ngoài sàn.

Bám BR-15, BL-06.

**FR-23.** Bảng đối chiếu và tờ trình không được chứa kết luận gian lận. Từ ngữ cho phép là không khớp và cần xác minh.

Nghiệm thu: rà soát văn bản case lệch, không có từ gian lận.

Bám BR-15.

### 5.6 Tờ trình

**FR-24.** Hệ thống phải tạo hai văn bản từ cùng bộ kết quả: tờ trình cho người thẩm định, và bản giải thích cho seller.

Nghiệm thu: Hai văn bản cùng case/run/evidence, giữ version/attempt; seller chỉ đọc bản dành seller.

Bám BR-16.

**FR-25.** Mỗi câu trong tờ trình có chứa số phải gắn một mã bằng chứng. Số trong câu phải khớp số của bằng chứng đó.

Nghiệm thu: bỏ mã của một câu có số thì văn bản không được chuyển cho người thẩm định. Câu có số lệch bằng chứng cũng không được chuyển.

Bám BR-17, BL-07.

**FR-26.** Nếu memo không đạt FR-25, hệ thống phải thử lại trong giới hạn memo.max_attempts; mặc định demo là 3 lần tổng cộng, tức lần đầu và tối đa hai lần sửa/đường lui. Mọi fallback/template phải qua cùng validator. Hết lần vẫn lỗi phải ESCALATED; bản lỗi chỉ được lưu như bản thảo chưa đạt để underwriter kiểm tra đúng quyền, không được phát hành như memo chính thức hoặc gửi seller/LOS.

Nghiệm thu: Sai số dù 1 đồng, thiếu evidence/hash sai đều chặn phát hành; hết lượt lưu attempt/lỗi đã che PII và trạng thái chưa đạt. Bản fallback hợp lệ mới được phát hành; không thay policy/số để làm validator pass.

Bám BL-07.

**FR-27.** Bản seller phải nêu có đề xuất vay hay không; nếu có thì số tiền, kỳ hạn và lịch trích do code tính, thể hiện đây là đề xuất chờ ngân hàng quyết định. Lãi, phí và tổng phải trả chỉ có khi biểu phí ngân hàng đã được cung cấp và phép tính được xác định; nếu chưa có phải ghi chưa có dữ liệu. Seller không được nhận PD/CIC nội bộ.

Nghiệm thu: Hai bản khớp số từ cùng evidence; seller-view không chứa PD/CIC hoặc số lãi/phí tự suy ra, quyền được lọc phía server.

Bám BR-16.

**FR-28.** Khi không đề xuất vay, bản cho seller phải nói rõ lý do theo dòng tiền và ngưỡng payout cảnh báo.

Nghiệm thu: Case A ghi lý do theo cashflow và ngưỡng engine; không khuyến nghị khoản vay khi gap 0.

Bám BR-07.

### 5.7 Quyết định của người thẩm định

**FR-29.** Hệ thống phải đưa kết quả thẩm định vào trạng thái NO_LOAN_NEEDED, AWAITING_STATEMENT, PENDING_REVIEW hoặc ESCALATED theo các gate. Underwriter phải xem được queue có trạng thái/lý do và evidence; PENDING_REVIEW chỉ là chờ quyết định, ESCALATED là chuyển người xử lý.

Nghiệm thu: Gap 0 về NO_LOAN_NEEDED; chỉ thiếu R05 về AWAITING_STATEMENT; hard fail/thiếu PD hoặc CIC về ESCALATED; đủ gate mới PENDING_REVIEW, không tự ACCEPTED/REJECTED.

Bám BR-18.

**FR-30.** Người dùng có quyền thẩm định phải xem được tờ trình và mở được từng bằng chứng.

Nghiệm thu: Underwriter mở đúng memo/evidence của case; evidence thuộc case khác bị chặn, seller không đọc đường nội bộ.

Bám BR-18.

**FR-31.** Chỉ người ngân hàng có identity enabled và assignment underwriter nền tảng còn hiệu lực được ghi ACCEPT_PROPOSAL, ACCEPT_COUNTER hoặc REJECT theo trạng thái/gate. Phải lưu identity, assignment đã dùng, tên hiển thị người quyết định, lý do, thời gian server và audit; kiểm/khóa quyền trong cùng transaction với quyết định/version/event.

Nghiệm thu: Seller, identity hệ thống, identity disable hoặc role thiếu/hết hạn/thu hồi không quyết định; underwriter không cần shop grant. Lỗi giữa transaction không để lại quyết định nửa chừng, retry idempotent và version cũ conflict.

Bám BR-18.

**FR-31b.** Quyết định chấp nhận chỉ hiệu lực trong số ngày cấu hình, mặc định demo 14 ngày. Quá hạn phải chặn handoff và yêu cầu tái thẩm định từ FR-05 với dữ liệu mới, consent/CIC còn hiệu lực; giữ lịch sử, tạo run mới và cần quyết định mới của ngân hàng.

Nghiệm thu: Quyết định hết hạn không bàn giao; tái thẩm định không hồi sinh quyết định cũ hoặc ghi đè evidence. Thời điểm bắt đầu tính hạn và trigger/API/job tái thẩm định phải được chốt trước triển khai phần đó.

Bám BL-10.

**FR-32.** Khi underwriter chọn số tiền/kỳ hạn khác, code phải tính lại lịch theo FR-14, chấm lại PD và chạy lại toàn bộ rule đang hiệu lực trên bộ số mới. Chỉ ghi chấp nhận khi không còn hard fail hoặc hard rule thiếu dữ liệu; trả số/lịch cuối từ engine vì kỳ hạn có thể được kéo dài. Thay điều khoản phải INSERT version mới, bản trước SUPERSEDED và audit chỉ thêm.

Nghiệm thu: Nâng số vượt R01 bị chặn kèm mã rule; lịch/PD/policy dùng cùng bộ số mới; tổng lịch đúng gốc, lịch cũ bất biến, conflict/rollback không tạo hai ACTIVE.

Bám BR-18, BR-10, BR-12.

**FR-33.** Hồ sơ ESCALATED không được nhận chấp nhận đề xuất gốc khi chưa có ghi nhận xác minh của underwriter. Verification note là điều kiện cần, không tự bỏ hard fail, PD/CIC thiếu hoặc thay policy; ngoại lệ xác minh thủ công chỉ áp dụng khi ngân hàng đã phê duyệt thành policy và thẩm định lại hợp lệ.

Nghiệm thu: Thiếu verification note bị chặn; có note nhưng hard rule còn fail/thiếu vẫn không chấp nhận. Không có quyết định tín dụng tự động.

Bám BR-13, BR-15.

**FR-34.** Hồ sơ không đề xuất vay không được chuyển sang quyết định cho vay nếu người dùng không tạo một hồ sơ mới và chạy lại từ FR-02.

Nghiệm thu: Mọi lệnh chấp nhận/counter trên NO_LOAN_NEEDED bị chặn; tạo kế hoạch mới phải qua lại auth, guard, consent và toàn bộ thẩm định.

Bám BR-06.

### 5.8 Bàn giao cho LOS ngân hàng

Đây là ranh giới với phần ngân hàng kế thừa. Không có yêu cầu sinh hợp đồng, khế ước hay ủy nhiệm chi.

**FR-35.** Sau quyết định của ngân hàng, hệ thống phải đóng gói case/seller, quyết định, điều khoản chốt nếu chấp nhận, tờ trình hợp lệ, evidence, kết quả rule/rủi ro, policy/model version, người quyết định và thời gian. Gói phải tham chiếu đúng run và terms version đã quyết định.

Nghiệm thu: Gói từ chối không có số giải ngân; gói chấp nhận khớp số/lịch FR-31/FR-32, hash và evidence. Memo chưa đạt hoặc quyết định hết hạn không được bàn giao như hợp lệ.

Bám BR-19.

**FR-36.** Hệ thống phải xuất gói qua adapter/contract LOS được chốt, lưu trạng thái gửi và mã tham chiếu LOS nếu có; có idempotency, lease và retry theo contract. Handoff là trạng thái riêng, không thay hoặc xóa quyết định tín dụng.

Nghiệm thu: LOS lỗi giữ nguyên quyết định, đánh dấu FAILED; retry/concurrent send không tạo bàn giao trùng; SUCCEEDED chỉ sau phản hồi xác nhận hợp lệ, mock gắn nhãn synthetic.

Bám BR-19.

**FR-37.** Hệ thống không được gửi lệnh giải ngân, lệnh hạch toán, hoặc lệnh trích nợ sang core.

Nghiệm thu: rà soát giao diện trong phạm vi bản này, không có lệnh tạo khoản vay trên core.

Bám phạm vi mục 2.

### 5.9 Nhật ký

**FR-38.** Mỗi lần đổi trạng thái phải ghi event chỉ thêm gồm trạng thái trước/sau, actor, thời gian server, mã evidence và liên kết case/run/version. Actor có thể là người hoặc bước hệ thống có tên; riêng quyết định tín dụng phải là người ngân hàng. Ghi nghiệp vụ và audit liên quan phải nguyên tử.

Nghiệm thu: Mở case thấy đủ lịch sử từ tạo đến bàn giao và thẩm định lại; người dùng/runtime thông thường không sửa/xóa audit; ghi lỗi rollback cả nghiệp vụ lẫn event liên quan.

Bám BR-20.

### 5.10 Xác thực và phân quyền OAuth 2.0 / OpenID Connect

Các yêu cầu AUTH bổ sung cho mọi FR; không đánh lại mã FR nghiệp vụ.

**FR-AUTH-01.** Client phải đăng nhập bằng OIDC Authorization Code trên OAuth 2.0 với PKCE S256 và scope `openid`. Callback phải đúng đăng ký; client phải kiểm soát liên kết phiên/yêu cầu, kiểm `state` và `nonce` theo flow OIDC được cấu hình. Không dùng implicit flow hoặc luồng nhận mật khẩu tại Riverbank.

Nghiệm thu: callback sai, state/nonce hoặc code verifier sai bị chặn; đăng nhập thành công chỉ xác lập danh tính, không tự tạo role/ownership. Session, refresh và logout phải có contract giữa backend/frontend/provider trước khi bật.

**FR-AUTH-02.** API phải nhận access token dành Riverbank API qua `Authorization: Bearer` trên HTTPS; không dùng ID token làm access token. Verifier phải kiểm issuer/audience/thời hạn và chữ ký/thuật toán/key discovery tin cậy với JWT hoặc active/introspection theo contract opaque; issuer/key URL tin cậy không lấy từ token chưa xác minh.

Nghiệm thu: token thiếu/sai/hết hạn, ID token, sai issuer/audience/chữ ký bị 401; khi không cấu hình hoặc không kiểm chứng được trả 503 và không cấp identity/quyền. Khóa xoay, timeout và provider lỗi không làm fail open; token/secrets không vào response/log.

**FR-AUTH-03.** Danh tính ứng dụng phải ánh xạ bằng cặp `(issuer, subject)` đã xác minh, giữ phân biệt hoa/thường theo contract; không nối tài khoản bằng email. Server phải resolve identity enabled, role còn hiệu lực và ownership seller từ DB authoritative mỗi request; không tin role/scope/identity do client hoặc lựa chọn màn hình cung cấp.

Nghiệm thu: cùng subject khác issuer không nhập chung; identity lạ/disable, role/grant hết hạn hoặc thu hồi không có quyền tương ứng; lỗi DB không thành công. Cấp lại role không hồi sinh ownership cũ.

**FR-AUTH-04.** Seller chỉ được tạo/đọc/thao tác hồ sơ trong ownership seller/shop được server xác minh và chỉ nhận bản seller. Underwriter có assignment nền tảng còn hiệu lực được xem queue, thẩm định, evidence và quyết định trong mini một ngân hàng mà không cần membership/grant shop. Cả hai role vẫn phải tuân consent khi đọc nguồn.

Nghiệm thu: seller A không đọc/ghi case B hoặc đường nội bộ; seller không quyết định. Underwriter không có shop grant vẫn thẩm định được. Evidence/document phải được kiểm thuộc đúng application; không thể ghép ID resource khác để vượt quyền. Một identity có cả hai role vẫn chịu quyền theo từng endpoint.

**FR-AUTH-05.** Chỉ thẩm quyền đã được ngân hàng chốt mới provision/enable/disable identity và cấp/thu hồi role/ownership, có reason/actor/audit trong transaction. Seller/underwriter không tự có quyền quản trị. Quyết định phải khóa và kiểm quyền cùng transaction để tuần tự hóa với disable/revoke.

Nghiệm thu: login và claim client không tự cấp quyền; race revoke/disable với quyết định có kết quả nhất quán theo thứ tự transaction, không ghi quyết định sau khi quyền đã mất. Regrant INSERT mới và audit không bị xóa.

**FR-AUTH-06.** Hệ thống phải bảo vệ token/secrets và session theo contract provider; không commit credentials, dùng token trong URL hoặc log raw token/PII. Quyền dữ liệu sàn cần consent riêng theo FR-07, không suy từ OAuth scopes/consent đăng nhập.

Nghiệm thu: token hết hạn được refresh theo contract hoặc yêu cầu login lại, không tiếp tục gọi API như hợp lệ; logout xử lý local/provider session theo thiết kế đã chốt và không được coi là thu hồi consent sàn. Test chứng minh login thành công nhưng thiếu consent vẫn không đọc nguồn.

Tham chiếu chuẩn: [OpenID Connect Core 1.0](https://openid.net/specs/openid-connect-core-1_0.html), [OAuth 2.0 Security BCP — RFC 9700](https://www.rfc-editor.org/rfc/rfc9700.html), [Bearer Token Usage — RFC 6750](https://www.rfc-editor.org/rfc/rfc6750.html). Hackathon đã chọn Auth0/JWT RS256; issuer, audience, client/callback, subject/azp, session và thẩm quyền provisioning vẫn phải kiểm chứng theo [API](API.md), không coi đặc tả này là cấu hình tenant đã hoàn tất.

### 5.11 Nhất quán và giao diện

**FR-CONSIST-01.** Lệnh tạo/ghi phải kiểm auth/scope trước side effect, thực hiện idempotency theo phạm vi server đã chốt và expected_version khi sửa. Retry cùng key/payload không lặp side effect; khác payload trả IDEMPOTENCY_KEY_REUSED; version cũ trả CASE_VERSION_CONFLICT và không ghi đè.

Nghiệm thu: request đồng thời hoặc lỗi giữa transaction không tạo hai case/decision/terms/handoff cho cùng thao tác; retry không xóa audit hoặc làm mất quyết định. Client phải tải lại khi conflict, không tự đổi key để che lỗi.

**FR-CONSIST-02.** API phải giữ method/path đã chốt trong [API.md](API.md), router tách schema/service/repository và chuẩn lỗi. Không bật workflow thành công khi auth, consent, persistence, adapter hoặc policy chưa đáp ứng; các placeholder 503 chỉ thể hiện chưa khả dụng.

Nghiệm thu: 401/403/422/413/415/429/503 và lỗi nghiệp vụ đúng contract; không có dữ liệu giả thành công hoặc thông báo đã chấp nhận. Giữ `/v1/cases` dù DB dùng `applications`; không tự thêm endpoint cho contract còn mở.

## 6. Dữ liệu tối thiểu của hồ sơ

| Nhóm | Trường tối thiểu và ràng buộc |
|---|---|
| Identity/quyền | Issuer/subject, identity ID, enabled, role assignment và ownership seller; không lưu password/token trong nghiệp vụ |
| Hồ sơ | Case/application ID, seller/shop, trạng thái, version ghi, actor và thời điểm server |
| Kế hoạch | Giá trị lô, vốn có, lịch chi theo tuần, tuần bán, số xin; integer VND và tổng lịch đúng |
| Consent/snapshot | Purpose, grant/version, hiệu lực/thu hồi, bằng chứng consent, provenance, nhãn synthetic, thời điểm capture và hash; đúng case/run/scope |
| Dòng tiền | Payout cơ sở/xấu, gap, hai mốc âm, kỳ hạn cơ sở/cuối, đề xuất, lịch và trần trích/kết quả, bảng tuần, cảnh báo |
| Rủi ro | PD hoặc trạng thái thiếu/lỗi, factors có chiều, model/version, provenance và evidence |
| Policy | Artifact version/hash/hiệu lực, evidence test/phê duyệt, mã/kết quả từng rule và evidence |
| CIC | Evidence, nhóm nợ/dư nợ theo contract, thời điểm/hiệu lực và nguồn; không tồn tại khi gap 0 |
| Sao kê | Kỳ, nguồn/actor, trạng thái xử lý/validation, tổng nguyên VND, bảng đối chiếu và E8; quyền/retention file theo quyết định riêng |
| Văn bản | Hai bản, claims/evidence, attempt, validation, version/run và trạng thái phát hành |
| Quyết định/điều khoản | Loại/lý do, identity và assignment underwriter, tên hiển thị, thời gian, hiệu lực, terms version/tiền/kỳ hạn/lịch, ACTIVE/SUPERSEDED |
| Bàn giao | Quyết định/run/terms tham chiếu, hash gói, key/lease, trạng thái, attempt và mã LOS |
| Nhật ký | Before/after, actor, thời gian, evidence, run/version; chỉ thêm |

Evidence và lịch sử đã dùng phải bất biến; sửa dữ liệu nguồn không làm đổi hồ sơ cũ. Tái thẩm định tạo run/snapshot/evidence mới. Tiền integer VND trong JSON/model/DB; không dùng decimal strings hoặc âm thầm làm tròn tiền lẻ. PD theo đơn vị đã nêu ở FR-16. Schema/migration chính thức còn phải qua CORE-01.24 và VER-01.01; DBML hoặc SQL draft không chứng minh persistence đã chạy đúng.

## 7. Trạng thái và chuyển tiếp

| Mã | Ý nghĩa | Chuyển tiếp được phép theo gate |
|---|---|---|
| DRAFT | Nháp trước gửi | Input đạt mới vào ANALYZING; không mặc định phải lưu draft server |
| BLOCKED_INPUT | Kết quả chặn đầu vào | Trả lỗi theo contract, không tạo case hợp lệ hoặc tiếp tục thẩm định |
| ANALYZING | Đang thẩm định, có thể thể hiện bằng event nội bộ | NO_LOAN_NEEDED / AWAITING_STATEMENT / PENDING_REVIEW / ESCALATED |
| NO_LOAN_NEEDED | Không vay | Giải thích; kế hoạch khác phải tạo hồ sơ mới, không chấp nhận cấp vay trên case này |
| AWAITING_STATEMENT | Chờ chứng từ R05 | Tiếp nhận hợp lệ → VERIFYING/thẩm định lại trên run mới |
| VERIFYING | Đối chiếu chứng từ, có thể thể hiện bằng event nội bộ | PENDING_REVIEW hoặc ESCALATED theo kết quả/gate |
| PENDING_REVIEW | Đợi quyết định ngân hàng | ACCEPTED hoặc REJECTED bởi underwriter; counter phải tính/chấm lại |
| ESCALATED | Cần người xử lý, không có nghĩa bị từ chối | Giữ trạng thái khi còn blocker; sau xác minh/tái thẩm định đủ gate mới có thể chấp nhận; người ngân hàng có thể từ chối |
| ACCEPTED | Ngân hàng chấp nhận | Handoff nếu còn hiệu lực; hết hạn chặn và yêu cầu tái thẩm định/quyết định mới |
| REJECTED | Ngân hàng từ chối | Handoff gói từ chối, không có số giải ngân |

Không có chuyển tự động `ANALYZING → ACCEPTED/REJECTED`. `verification_note` không bỏ qua hard fail. Quyết định giữ nguyên khi gửi LOS; trạng thái riêng `handoff.status` thể hiện chưa gửi/đang xử lý/thành công/lỗi theo contract được chốt, với SUCCEEDED/FAILED cho kết quả. Tên HANDOFF_OK/HANDOFF_ERROR trong bản đính kèm là tên hiển thị kết quả bàn giao, không ghi đè quyết định hồ sơ. INCOMPLETE trong service synthetic là trạng thái nội bộ chưa tích hợp, không được dùng như một quyết định nghiệp vụ.

Contract persistence cần xác định trạng thái nào lưu tại hồ sơ và trạng thái nào là event; phải giữ đủ lịch sử quan sát được. Các trạng thái Offer_Sent, Contract_Signed, Disbursed và vận hành sau giải ngân thuộc hệ thống ngân hàng ngoài lõi.

## 8. Yêu cầu phi chức năng

| Mã | Yêu cầu | Mức với bộ demo |
|---|---|---|
| NFR-01 | Một hồ sơ từ lúc gửi hợp lệ đến lúc vào hàng đợi hoặc trạng thái không đề xuất vay phải xong trong giới hạn thời gian đã chốt | Dưới 90 giây trên bộ demo |
| NFR-02 | Cùng đầu vào và cùng bộ rule, kết quả gap, số tiền, kỳ hạn và kết quả rule phải giống nhau giữa hai lần chạy | Khớp tuyệt đối trên phần tính |
| NFR-03 | Tỷ lệ câu có số trong tờ trình đã phát hành có mã bằng chứng hợp lệ | 100% trên bộ demo |
| NFR-04 | Thuộc tính nhạy cảm không có trong dữ liệu đưa vào chấm rủi ro và không có trong tờ trình | Rà soát bộ demo |
| NFR-05 | Nhật ký trạng thái không bị sửa hoặc xóa bởi người dùng thường | Chặn sửa/xóa cả ở API và quyền DB của người dùng/runtime thông thường |
| NFR-06 | Chi phí xử lý một hồ sơ demo nằm trong trần team đã chốt | Dưới 0,10 USD trên bộ demo nếu có phát sinh chi phí model |

NFR-01 và NFR-06 là mục tiêu bản demo trong tài liệu kiến trúc, chưa phải cam kết vận hành thật.

Nghiệm thu phải ghi timestamp, môi trường, fixture/workload, model/provider/version, timeout/retry/fallback, số lần gọi và đơn vị chi phí. Báo cáo offline tách online, không suy SLA từ pytest; chưa đo thì ghi chưa đo. NFR-02 yêu cầu cố định đầu vào, snapshot, cấu hình, model và policy version tương ứng. NFR-03 không cho phép sai lệch dù 1 VND. Các yêu cầu auth, consent, idempotency, quyền trên nested resource và concurrency ở mục 5 là điều kiện bắt buộc khi mở API.

## 9. Thứ tự triển khai và điều kiện nghiệm thu

| Nhóm | Yêu cầu và gate |
|---|---|
| Nền trước mở flow | AUTH, guard, consent/scope, schema/persistence/idempotency; quyết định bên ngoài giữ blocker |
| Lõi thẩm định | FR-01–FR-20, gồm FR-16b và FR-19b; gap 0 không chờ nạp policy vay để chạy nhánh không vay, nhưng cấu hình tính và các gate nguồn/quyền vẫn hợp lệ |
| Hồ sơ và người quyết định | FR-24–FR-34, gồm FR-31b; version điều khoản, audit và quyền ngân hàng |
| Chứng từ có điều kiện | FR-21–FR-23 bắt buộc khi R05 yêu cầu; không coi case C hoàn tất nếu còn placeholder |
| Ranh giới LOS | FR-35–FR-38; demo có thể mock có nhãn, tích hợp thực cần contract ngân hàng |
| Nghiệm thu | A/B/C/E/F, auth/quyền, consent/race, idempotency/conflict, memo, counter/version, expiry/handoff theo TEST_PLAN |
| Ngoài lõi | Contract pháp lý, giải ngân, thu nợ, re-score sau giải ngân; P7 chỉ theo task mở rộng riêng |

Policy candidate phải test đạt và được người có thẩm quyền xác nhận **trước khi nạp runtime**; TEST-01 chỉ bổ sung/regression cho gate này. Mỗi task lớn dùng phiên Codex mới theo AGENTS. Thiếu acceptance/test bắt buộc giữ in_progress; `make test` đạt là điều kiện trước sẵn sàng PR, không thay kiểm thử tích hợp/online còn thiếu.

## 10. Truy vết yêu cầu

BRD repo hiện nhóm BR theo phạm vi; giữ các mã BR/BL từ bản đích để truy vết, không tự khẳng định BRD hiện chứa mô tả chi tiết từng BL. Các ngưỡng/ý nghĩa cụ thể phải đối chiếu BUSINESS, policy và GAPS.

| BRD / nền bảo mật | SRS | Task triển khai / nghiệm thu |
|---|---|---|
| BR-01, BR-02 | FR-01–FR-04 | CORE-01.03/.04/.26; TEST-01.04/.10 |
| BR-03 | FR-05, FR-07 | SRC-01; CORE-01.08; TEST-01.03/.10 |
| BR-04, BR-05 | FR-08, FR-09, FR-15 | ENG-01; CORE-01.08; TEST-01.01 |
| BR-06, BR-07 | FR-10, FR-11, FR-28, FR-34 | ENG-01; CORE-01.08/.09/.28; TEST-01.01/.05 |
| BR-08–BR-10 | FR-12–FR-14, FR-32 | ENG-01; CORE-01.14; VER-01; TEST-01.01/.05 |
| BR-11 | FR-16 | ENG-01; TEST-01.01 |
| BR-12, BR-13 và BL-09 | FR-17–FR-20, FR-19b, FR-33 | POL-01; CORE-01.09/.14; TEST-01.02/.05 |
| BR-14, BR-15 | FR-21–FR-23, FR-33 | CORE-01.10/.11/.27; DATA-01; TEST-01.04/.10 |
| BR-16, BR-17 | FR-06, FR-24–FR-27 | CORE-01.13/.28; TEST-01.04/.10 |
| BR-18 và BL-10 | FR-29–FR-31, FR-31b | CORE-01.06/.14; EXP-01; TEST-01.03/.05 |
| BR-19 | FR-35–FR-37 | CORE-01.15; BANK-01; TEST-01.05 |
| BR-20 | FR-38 | CORE-01.07/.29; VER-01; TEST-01.03/.05/.09/.10 |
| BR-21 | FR-16b | ENG-01; CORE-01.12; BANK-01; TEST-01.01/.03 |
| Bảo mật theo AGENTS/SRS hiện có | FR-AUTH-01–FR-AUTH-06 | CORE-01.02/.18–.23; FE-01.02; TEST-01.03/.09 |
| Nhất quán theo SRS hiện có | FR-CONSIST-01, FR-CONSIST-02 | CORE-01.04/.07/.17/.24/.25/.29; TEST-01.03/.10 |
| NFR-01–NFR-06 | Đo latency/cost, deterministic, evidence, dữ liệu và audit | OBS-01; TEST-01; guard/memo/persistence tương ứng |

Endpoint chi tiết ở [API.md](API.md), contract dữ liệu ở [DATA.md](DATA.md), kiểm thử ở [TEST_PLAN.md](TEST_PLAN.md). Các đường dẫn code/test dự kiến không phải bằng chứng file đã tồn tại hoặc yêu cầu đã đạt.

## 11. Trạng thái triển khai và cách xác nhận

Đối chiếu tĩnh trên nhánh hiện tại ngày 2026-10-31, nền commit `329e7bf`; không chạy kiểm thử nghiệp vụ trong lần hợp nhất SRS này. Bảng code đạt ngày 23/10/2026 trên commit `68588f2` trong tài liệu đính kèm là báo cáo lịch sử ngoài snapshot hiện tại và không được kế thừa làm kết quả nghiệm thu.

| Nhóm | Quan sát ở repo hiện tại | Giới hạn |
|---|---|---|
| API/auth | Có auth/me, health/db, verifier/resolver và role dependencies | Tenant/provisioning và DB/provider tích hợp chưa nghiệm thu |
| Route nghiệp vụ | Đã đăng ký path SRS, yêu cầu auth/role; POST case có Plan và kiểm seller/shop | Handler nghiệp vụ trả 503 WORKFLOW_UNAVAILABLE, không có flow API hoàn chỉnh |
| Engine và fixture | Có CashFlowEngine, assessment sơ bộ/synthetic và feature/PD/CIC interfaces | Chưa nối workflow/policy, model PD mặc định chưa cấu hình; thiếu factors và một số trường đầu ra đích |
| Nguồn/evidence | Có consent/snapshot synthetic, hash và helper E5 | Chưa xác minh nguồn thật, persistence/run/workflow chưa tích hợp |
| DB | Có baseline auth, reader privileges và business SQL draft | Business draft chưa phải migration được nghiệm thu; chưa có repository PostgreSQL business hoặc terms version hoàn chỉnh |
| Guard/policy/sao kê/memo/decision/handoff | Có task/prompt hoặc placeholder | Chưa đạt yêu cầu nghiệp vụ; phải thực hiện các task/gate liên quan |
| NFR | Có kế hoạch kiểm thử/đo | Không dùng báo cáo lịch sử hoặc thời gian offline làm bằng chứng online |

Nghiệm thu mới phải ghi commit, lệnh, môi trường, pass/skip/fail và blocker thực tế. Khả dụng HTTP/OpenAPI hoặc SQL có cú pháp hợp lệ không chứng minh đạt FR.

## 12. Quyết định mở và tài liệu liên quan

Các quyết định chưa có thẩm quyền xác nhận tiếp tục ở [GAPS.md](GAPS.md): chủ thể vay và R09, hạn mức, biểu phí, policy approval, CIC/LOS, consent/nguồn/retention, version điều khoản, hiệu lực/tái thẩm định, provider/session/provisioning và case D. Không tự mở API hoặc đặt giá trị sản xuất để che blocker.

Bản hợp nhất này đặc tả đích, không sửa policy/runtime. Mâu thuẫn cần quyết định mới phải cập nhật BRD/BUSINESS/SRS/API/DATA và policy/test tương ứng. Xem [phân tích gap](SRS_GAP_ANALYSIS.md) để biết yêu cầu được khôi phục, yêu cầu giữ lại và các khác biệt đã dung hòa.
