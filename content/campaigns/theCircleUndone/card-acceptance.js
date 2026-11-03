// 万象无终（The Circle Undone）逐卡验收备注注册表。
//
// 这是**人工/代理逐卡行为审计的补充说明**，不是验收状态的事实源：逐卡自动测试状态由
// `tools/audit-tcu-all-cards.mjs` 实跑 `TCU <code>` 测试后写进
// `audit/tcu-all-card-acceptance.json` 与 `src/cards/tcu-campaign-acceptance.js`。
// 逐卡「印刷描述 vs 实现」的完整行为审计结论（match/approximation/gap 与逐条证据）在
// `audit/tcu-card-behavior-audit.json`；本文件是它的摘要，供全卡账本的 note/noteStatus 与
// audit/tcu-migration.json 的 remaining 使用。
//
// 键 = 05xxx 卡号（含 34 个关联面 05xxxa/b… 的卡号）；
// 值 = { status: 'verified' | 'simplified', note: string }。
//   · verified   —— 逐卡行为审计为 match（未登记即视为 verified）：已通过审计、登记为已验收；
//   · simplified —— 行为审计发现显式近似或未实现子句（gap），note 写清差异/缺口；这些卡不列入
//                   已验收，仍进 earlyAccess 的 remaining，不宣称规则等价。
//
// 生成：node develop/p10-card-audit-notes.mjs --write（由 audit/tcu-card-behavior-audit.json 派生）。
export const TCU_CARD_ACCEPTANCE_NOTES = {}
