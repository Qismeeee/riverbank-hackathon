# Knowledge ezXRiverbank

Bộ này là nguồn cho prompt và guardrail của sản phẩm. Trong repo doc-first này, số và rule quy phạm nằm trong `policy/`; khi có implementation, test parity phải buộc code khớp hai file policy.

## Thứ tự hiệu lực

1. `policy/parameters.yaml`, nguồn duy nhất của ngưỡng số.
2. `policy/policy.md`, ý nghĩa rule R01 đến R10 và nhánh trạng thái.
3. `policy/worked-examples.md`, nhãn kiểm thử tính tay.
4. `Agents/SRS.md`, `Agents/BRD.md`, `Agents/BUSINESS.md`.
5. Code và generated rule sau khi được tạo; CI phải từ chối khi lệch policy.
6. Slide. Số trong slide không đè công thức.

Hai số khóa:

- Shop median 70.000.000/tuần, trả 100% tuần 0: đề xuất **90.000.000**, kỳ hạn **8**, trích **11.250.000**/tuần.
- Cọc 50% rồi trả nốt tuần 4, cùng payout: Gap = 0, ngưỡng cảnh báo **20.000.000**/tuần. Không hard-code 45 triệu.

## Policy

| File | Việc |
|---|---|
| `policy/policy.md` | R01 đến R10, thứ tự xử lý, quyết định của người, phần chưa có code |
| `policy/parameters.yaml` | Hệ số, trần, ngưỡng so sánh |
| `policy/worked-examples.md` | FX-A, FX-B, FX-C, FX-E, FX-F, duyệt số khác. FX-D, FX-L chưa có code |

Prompt nào nhắc ngưỡng phải lấy đúng số trong `parameters.yaml`. Generated `rules.py`, parity test và approval artifact là kết quả của task triển khai, không được giả định đã tồn tại.

Runtime allowlist cốt lõi gồm `copilot-extract`, `copilot-qa`, `statement-ocr` và các task Jev đã chốt. Tờ trình D09/D10 do code viết từ mẫu câu và semantic frame, không qua LLM. `monitor-proposal` chỉ dùng khi P7 được triển khai. `policy-explainer` và `data-analyst` là thiết kế tham khảo, không được nạp runtime nếu chưa có quyết định mở rộng allowlist, threat model và test.

## Prompt

Mỗi file trong `knowledge/prompts/` là system prompt đóng sẵn. Gọi model đúng bậc: số và pass/fail không đi qua LLM.

| Prompt | Bậc | Khi nào |
|---|---|---|
| `copilot-extract.md` | LLM nhỏ | Seller chat ngôn ngữ tự nhiên, trước khi tạo hồ sơ |
| `copilot-qa.md` | LLM nhỏ | Seller hỏi lại trên số đã khóa |
| `monitor-proposal.md` | LLM nhỏ | Viết D22 sau khi engine đã tính phương án giãn |
| `statement-ocr.md` | Vision | PDF/ảnh sao kê, chỉ bóc dòng |
| `jev-input-guard.md` | Jev | Sau khi đã che PII |
| `jev-output-guard.md` | Jev | Sau validator số của Python |
| `jev-line-classifier.md` | Jev | Gắn dòng sao kê có phải payout sàn |
| `policy-explainer.md` | LLM nhỏ | Giải thích kết quả rule đã chạy, không chạy lại rule |
| `data-analyst.md` | LLM nhỏ | Câu hỏi đột xuất của người duyệt, chỉ SELECT |
| `jev-eval-judge.md` | Jev | Chấm golden set về ngữ nghĩa, không chấm lại Gap |

Ràng buộc dùng chung: `knowledge/guardrails.md`. Tên trạng thái: `knowledge/glossary.md`. Quy ước khi viết code: `AGENTS.md`.

## Rule cho agent viết code

`AGENTS.md` và `Agents/AGENTS.md` nhắc bất biến khi sửa repo: người quyết định, toán deterministic, policy-as-code, prompt không tính tiền và chữ trên UI seller.
