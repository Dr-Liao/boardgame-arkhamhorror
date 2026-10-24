// P10：把逐卡行为审计的非 match 结论写进 content/campaigns/theCircleUndone/card-acceptance.js
// 的 TCU_CARD_ACCEPTANCE_NOTES（status='simplified' + note），供 audit-tcu-all-cards 账本记录逐卡备注。
//   node develop/p10-card-audit-notes.mjs --write
// 只写备注注册表；不修改 behavior/scenario 层。
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('../', import.meta.url)).replace(/[\\/]$/, '')
const ledger = JSON.parse(readFileSync(new URL('../audit/tcu-card-behavior-audit.json', import.meta.url), 'utf8'))
const VERDICT_LABEL = { approximation: '显式近似（行为等价但非逐条实现）', gap: '未实现子句（gap）' }
const notes = {}
for (const entry of ledger.entries.sort((left, right) => left.code.localeCompare(right.code))) {
  if (entry.verdict === 'match' || entry.verdict === 'not-applicable') continue
  const missing = (entry.clauses || [])
    .filter(clause => clause.status === 'missing' || clause.status === 'approximation')
    .map(clause => `${clause.text}${clause.status === 'missing' ? '（未实现）' : '（近似）'}`)
    .slice(0, 6)
  const detail = [String(entry.note || '').trim(), missing.length ? `子句：${missing.join('；')}` : '']
    .filter(Boolean).join(' ')
  notes[entry.code] = {
    status: 'simplified',
    note: `P10 逐卡行为审计·${VERDICT_LABEL[entry.verdict]}：${detail || '见 audit/tcu-card-behavior-audit.json'}`.slice(0, 900),
  }
}
const body = `// 万象无终（The Circle Undone）逐卡验收备注注册表。
//
// 这是**人工/AI 逐卡行为审计的补充说明**，不是验收状态的事实源：逐卡自动测试状态由
// \`tools/audit-tcu-all-cards.mjs\` 实跑 \`TCU <code>\` 测试后写进
// \`audit/tcu-all-card-acceptance.json\` 与 \`src/cards/tcu-campaign-acceptance.js\`。
// 逐卡「印刷描述 vs 实现」的完整行为审计结论（match/approximation/gap 与逐条证据）在
// \`audit/tcu-card-behavior-audit.json\`；本文件是它的摘要，供全卡账本的 note/noteStatus 与
// audit/tcu-migration.json 的 remaining 使用。
//
// 键 = 05xxx 卡号（含 34 个关联面 05xxxa/b… 的卡号）；
// 值 = { status: 'verified' | 'simplified', note: string }。
//   · verified   —— 逐卡行为审计为 match（未登记即视为 verified）；
//   · simplified —— 行为审计发现显式近似或未实现子句（gap），note 写清差异/缺口；这些卡仍进
//                   earlyAccess 的 remaining，不宣称规则等价。
//
// 生成：node develop/p10-card-audit-notes.mjs --write（由 audit/tcu-card-behavior-audit.json 派生）。
export const TCU_CARD_ACCEPTANCE_NOTES = ${JSON.stringify(notes, null, 2)}
`
const target = new URL('../content/campaigns/theCircleUndone/card-acceptance.js', import.meta.url)
const json = body
if (process.argv.includes('--write')) writeFileSync(target, json)
else if (readFileSync(target, 'utf8') !== json) throw new Error('card-acceptance.js 与行为审计账本不一致：重新 --write')
console.log(`notes: ${Object.keys(notes).length} 张（approximation+gap）`)
const counts = {}
for (const entry of ledger.entries) counts[entry.verdict] = (counts[entry.verdict] || 0) + 1
console.log(JSON.stringify(counts))
