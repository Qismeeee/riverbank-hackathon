# Knowledge Riverbank

Policy nằm trong `policy/policy.md` và `policy/parameters.yaml`. Fixture tính tay nằm trong `policy/worked-examples.md`. Prompt không được đặt ngưỡng khác tham số.

Prompt trong `prompts/` xác định tác vụ được phép gọi model: trích kế hoạch, seller hỏi lại, memo D09/D10, đề xuất D22 và bóc dòng sao kê. Jev xử lý guard/phân loại/chấm ngữ nghĩa theo contract. Code tính tiền, gap, kỳ hạn, lịch trả, PD và pass/fail rule.

Đọc [guardrails](guardrails.md) và [glossary](glossary.md) trước khi tích hợp model. Mỗi lần đổi prompt phải có prompt_version và kiểm thử liên quan. Không đưa PII chưa che ra ngoài server.
