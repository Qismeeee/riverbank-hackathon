# Đối chiếu SRS đích và SRS Riverbank

Ngày: 2026-10-31. Đây là đối chiếu yêu cầu tài liệu, không phải báo cáo test hoặc xác nhận code đạt.

## Nguồn và nguyên tắc hợp nhất

- Đích: SRS 1.1 do người dùng đính kèm trong `Pasted text.txt`; SHA-256 `4a523d74e2f56285a386659b652260f7cf0cf767beb64f453440e28c569f3da9`.
- Hiện tại trước hợp nhất: `Agents/SRS.md` tại commit `329e7bf`, bản tóm tắt nhóm FR và các bất biến bổ sung của repo.
- Đối chiếu với BRD, BUSINESS, API, DATA, GAPS, TEST_PLAN, AGENTS và guardrails; ngưỡng lấy từ policy/parameters, không tự sửa policy.
- Đầu ra: [SRS 1.2 hợp nhất](SRS.md), giữ 41 mã FR nghiệp vụ của bản đích và NFR-01–NFR-06, thêm sáu AUTH và hai CONSIST riêng để không đánh lại ID.

## Gap của SRS cũ so với bản đích

| Nhóm | Thiếu hoặc chưa đủ trong SRS cũ | Xử lý trong bản hợp nhất |
|---|---|---|
| Mục đích/phạm vi/thuật ngữ/hệ thống ngoài | Chủ yếu là bảng truy vết, thiếu nội dung độc lập | Khôi phục mục 1–4; bám phạm vi ngân hàng của BRD |
| FR-01–FR-04 | Chưa có từng hành vi và acceptance cụ thể | Tách từng FR, validate Plan, caps, guard và retry |
| FR-05–FR-07 | Chưa đặc tả evidence/consent theo từng FR | Nêu scope, purpose, hiệu lực, source/provenance, hash và audit |
| FR-08–FR-15 | Thiếu công thức/ví dụ, hai mốc âm và lịch trích | Khôi phục công thức và fixture A/B, integer VND khớp tuyệt đối |
| FR-16/FR-16b | Thiếu factors có chiều, điều kiện CIC và acceptance | Bổ sung PD provenance/factors, CIC trước rule phụ thuộc, gap 0 bỏ cả hai |
| FR-17–FR-20 và FR-19b | Không có FR-19b riêng, thiếu acceptance từng rule/loader | Giữ FR-19b/R09, test + người xác nhận cùng hash trước nạp |
| FR-21–FR-23 | Chỉ nêu cùng kỳ/R05, thiếu hành vi chi tiết | Ghi điều kiện R05, parser/OCR/classifier, nguồn thủ công, sai lệch và run mới |
| FR-24–FR-28 | Thiếu thứ tự retry, nội dung seller và điều kiện phát hành | Hai bản, evidence mọi câu có số, attempts/fallback, không phát hành bản lỗi |
| FR-29–FR-34 | Thiếu từng điều kiện quyết định/counter/hết hạn | Ghi actor/gate, counter tính lại, xác minh không bỏ hard fail và run mới |
| FR-35–FR-38 | Chưa rõ nội dung gói, handoff lỗi và before/after audit | Khôi phục gói, retry/lease, giữ quyết định và audit nguyên tử |
| Dữ liệu/trạng thái | Chưa có ma trận dữ liệu và chuyển tiếp độc lập | Bổ sung mục 6–7; handoff tách trạng thái tín dụng |
| NFR và ưu tiên | Có NFR tóm tắt nhưng thiếu bảng nghiệm thu/đo đầy đủ | Giữ sáu NFR, cách đo, phạm vi lõi và ưu tiên theo gate |
| Truy vết | Chỉ nhóm FR → đường dẫn code/test, một số đường dẫn chưa tồn tại | BR/FR → task/TEST-01, trỏ API/DATA/TEST_PLAN, không nhận là đã triển khai |
| Báo cáo code | Bản đích có bảng “đạt” trên commit cũ, khác repo | Thay bằng quan sát tĩnh của repo hiện tại, không kế thừa kết quả test cũ |

## Những điểm cần dung hòa khi dùng bản đích

| Điểm | Khác biệt/rủi ro | Quy tắc hợp nhất và nguồn |
|---|---|---|
| FR-01 tạo case mỗi lần gửi | Câu “hai lần gửi tạo hai hồ sơ” xung đột retry | Tách thao tác mới và retry; cùng key/payload một kết quả theo API/SRS cũ |
| FR-08 sai lệch trong ngưỡng | Repo yêu cầu số khớp tuyệt đối | Integer VND và golden chính xác, không nới tolerance tài chính theo AGENTS/NFR-02 |
| FR-13 âm liên tục | BUSINESS/parameters dùng khoảng âm đầu đến âm cuối | Nêu rõ công thức theo hai mốc; test nhiều khoảng âm, không đếm riêng tổng tuần âm |
| FR-16 luôn có PD | Bản cũ yêu cầu thiếu model/dữ liệu phải chuyển người | Chỉ có số khi đủ dữ liệu; thiếu PD ghi trạng thái thiếu, không PD=0, chặn chấp nhận nếu chưa có quy trình thay thế đã duyệt |
| FR-17 chỉ pass/fail | Rule thiếu dữ liệu không thể mặc định pass | Bổ sung trạng thái thiếu dữ liệu, hard rule thiếu vẫn chặn chấp nhận |
| FR-18 đã duyệt/test | Chưa đủ ràng buộc bằng chứng cùng artifact | Bổ sung hash/version, thẩm quyền/audit, test trước nạp theo AGENTS/POL-01 |
| FR-19b mốc 100 triệu | Chưa chốt chủ thể và phạm vi áp dụng pháp lý | Giữ mốc demo của đích, không khẳng định là luật hiện hành; ngân hàng/pháp chế chốt trước production |
| FR-21 số xin vượt mức sàn | Nội dung FR-21 khác bảng code của chính đích và BUSINESS/R05 | Theo contract repo: max(xin, đề xuất) > hệ số × mức sàn; bằng mốc không yêu cầu; chỉ thiếu R05 mới chờ sao kê |
| FR-26 bản lỗi chuyển người | Dễ hiểu là phát hành memo chưa validate | Lưu bản thảo có nhãn, giới hạn quyền; không phát hành chính thức/seller/LOS; fallback cũng phải validate |
| FR-31/FR-33 ghi nhận xác minh | Verification note có thể bị hiểu là bỏ hard fail | Chỉ ngân hàng quyết định, mọi hard gate còn hiệu lực; note là điều kiện cần, không tạo ngoại lệ |
| FR-32 chạy lại rule | Đích chưa nói đủ PD/version điều khoản | Chạy lại lịch/PD/policy, INSERT version mới, bản cũ SUPERSEDED theo SRS cũ/AGENTS |
| Trạng thái handoff | Đích có HANDOFF_OK/ERROR lẫn trạng thái tín dụng | Quyết định giữ nguyên; handoff.status riêng theo BUSINESS/API |
| Mốc code 23/10/2026 | Các class/model/code “đạt” không có ở snapshot này | Không chép các khẳng định LightGBM/SHAP, Jev gate, InternalLosAdapter hoặc hiệu năng như sự thật hiện tại |
| Phạm vi tùy chọn | Đích xếp sao kê “nếu kịp” | Sao kê vẫn bắt buộc cho case C khi R05 yêu cầu; các bước vận hành tiền/P7 ngoài lõi theo BRD |

## Xác thực, phân quyền và yêu cầu repo phải giữ

Bản đích thiếu một flow auth đầy đủ. SRS 1.2 bổ sung FR-AUTH-01–FR-AUTH-06: OIDC xác thực trên OAuth 2.0 Authorization Code + PKCE S256; access token cho API, kiểm issuer/audience/chữ ký/hiệu lực, không dùng ID token làm API token; quyền DB theo issuer/subject, role underwriter nền tảng và ownership seller. Consent OAuth không thay consent sàn. Login không tự cấp role. Quyền được kiểm lại server và khóa khi ghi quyết định; không gán underwriter vào shop.

Các chuẩn được kiểm tra trực tiếp: [OIDC Core](https://openid.net/specs/openid-connect-core-1_0.html), [RFC 9700](https://www.rfc-editor.org/rfc/rfc9700.html), [RFC 6750](https://www.rfc-editor.org/rfc/rfc6750.html). Auth0/RS256 là lựa chọn hackathon hiện có, không phải yêu cầu đặc thù của OIDC; tenant/session/provisioning vẫn là contract cần chốt.

Bản hợp nhất giữ integer VND, version điều khoản bất biến, PII trước outbound, CSV parser Python, quyền seller/underwriter, không lộ PD/CIC seller, idempotency/concurrency, evidence đúng case/run và audit chỉ thêm. Đây là các bổ sung của repo, không bị mất khi dùng tài liệu đích.

## Phần còn mở và nghiệm thu tiếp

Các quyết định ngoài team vẫn giữ blocker tại GAPS: consent/nguồn thật/retention, policy approval, R09/chủ thể vay, CIC/LOS/biểu phí, lifecycle terms và hiệu lực/tái thẩm định, tenant/session/provisioning và doanh thu ngoài sàn. Bản hợp nhất không phê duyệt policy hoặc tự chọn contract thay ngân hàng.

Cần triển khai và kiểm thử theo tasklist/TEST_PLAN. Lần này chỉ kiểm tra tính đầy đủ ID, liên kết, truy vết và diff tài liệu; không chạy code nghiệp vụ hoặc tuyên bố FR đạt.
