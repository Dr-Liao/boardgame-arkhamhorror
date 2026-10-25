// 把交叉复核（artifacts/tcu-audit/review/*.json）的 dispute 结论应用到
// artifacts/tcu-audit/results/*.json，供 Lead 汇总前统一修正。
//
//   node develop/apply-tcu-review-corrections.mjs --write   # 写回结果文件（先备份到 .work/results-backup/）
//   node develop/apply-tcu-review-corrections.mjs           # 只打印将要应用的修正（dry-run）
//
// 规则：
//  - review=dispute 且 recommendedVerdict 与 claimedVerdict 不同 → 改卡 verdict，
//    追加一条「交叉复核发现的偏差」子句（missing/approximation）并把复核理由写进 note；
//  - review=dispute 但 verdict 不变（子句状态/未登记缺陷）→ 由 MANUAL_CLAUSE_FIXES 补齐；
//  - review=confirm → 不动。
// 只读 review/ 与 results/，只写 results/；不碰源码。
import { readFileSync, readdirSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('../', import.meta.url)).replace(/[\\/]$/, '')
const RESULTS = join(ROOT, 'artifacts/tcu-audit/results')
const REVIEW = join(ROOT, 'artifacts/tcu-audit/review')
const BACKUP = join(ROOT, 'artifacts/tcu-audit/.work/results-backup')
const write = process.argv.includes('--write')
const RANK = { gap: 0, approximation: 1, match: 2 }
const TRUNC = text => String(text || '').slice(0, 400)

// 已在复核里指出、但 verdict 不变的子句级修正（人工从 review 报告整理）。
// verdict 不变的 note 补充（人工从 review 报告整理；只补审计结论说明，不改 verdict）。
const MANUAL_NOTE_FIXES = [
  {
    code: '05080', note: '交叉复核（reaudit-c）：复核认为幽灵面线索随「替换幽灵版本」保留（05068 背面：原地点标记视为位于新地点），原「印刷线索未生效」的降级理由不成立；但同章 act 1b 揭示路径会经 revealLocation 按 maxClues 重算线索（另案 05068，behavior.js:300-315 + locations.js:227-252），两种口径不一致。按严格口径保留 approximation 待幕卡口径统一。',
  },
  {
    code: '05084', note: '交叉复核（reaudit-c）：复核认为幽灵面线索随「替换幽灵版本」保留，原降级理由不成立；但 act 1b 揭示重算线索的口径未统一（另案 05068），按严格口径保留 approximation 待复核。',
  },
  {
    code: '05081', note: '交叉复核修正（reaudit-c）：真实偏差是闹鬼 choice 未按可用性过滤——无支援时仍列出「弃掉一个支援」，选中会到空 options 的 requestChoice 抛错（definition.js:44-48、haunted.js:335-348、resolution.js:37-40）；原「印刷线索值」理由不成立。',
  },
  {
    code: '05083', note: '交叉复核修正（reaudit-c）：降级主因是闹鬼直接伤害只对带生命值的支援结算，缺调查员自身 1 点直接伤害（definition.js:51-52 → haunted.js:261-266；参考 BalconySpectral.hs:24-29 先对调查员 directDamage 再对 assets）；原「印刷线索值」理由不成立。',
  },
  {
    code: '05130', note: '交叉复核修正（reaudit-c）：真实后果是选中「弃支援」而无支援时会因空 options 的 requestChoice 抛错（非静默躲过恐惧）；机制描述按复核修正。',
  },
  {
    code: '05131', note: '交叉复核修正（reaudit-c）：真实后果是 0 线索时选「放线索」会 spendClues 抛错（非凭空得线索）；机制描述按复核修正。',
  },
  {
    code: '05284', note: '交叉复核补充（reaudit-c）：①[cultist] 侧效顺序与卡面/参考相反（实现先放裂口再继续揭示，第二个 skull 会多算裂口，behavior.js:931-938）；②tablet/elder_thing 不可达——本章无 chaosBagExtra 且 Witching Hour 序章 addChaosToken 未传 permanent（behavior.js:246-248、tcu-chaos.js:82-88、chaos-bag.js:5-27），修复建议 intro 改 permanent=true 或本章补 chaosBagExtra。',
  },
]

// 已在复核里指出、但 verdict 不变的子句级修正（人工从 review 报告整理）。
const MANUAL_CLAUSE_FIXES = [
  {
    code: '05262', reviewer: 'reaudit-b',
    clauseHint: '盟友槽', status: 'approximation',
    note: '交叉复核：本场冒险不占盟友槽只覆盖了实例 slots 与 slotUsage；allySlotsOk（src/engine/assets.js:192-206）仍按 cardDef 的 Ally/unique 统计，控制 05262 后再打盟友仍占槽，clause 降为 approximation。',
    evidence: 'src/engine/assets.js:192-206 allySlotsOk 读 cardDef slots；content/campaigns/theCircleUndone/scenarios/unionAndDisillusion/behavior.js:159-163 只覆盖实例 slots',
  },
  {
    code: '05263', reviewer: 'reaudit-b',
    clauseHint: '盟友槽', status: 'approximation',
    note: '交叉复核：与 05262 同构——「不占盟友槽」只覆盖实例 slots/slotUsage；allySlotsOk（src/engine/assets.js:192-206）仍按 cardDef slots 统计，控制 05263 后再打盟友仍占槽，clause 降为 approximation。',
    evidence: 'src/engine/assets.js:192-206 allySlotsOk 读 cardDef slots；content/campaigns/theCircleUndone/scenarios/unionAndDisillusion/behavior.js:159-163 只覆盖实例 slots',
  },
  {
    code: '05264', reviewer: 'reaudit-b', append: true,
    clauseText: '交叉复核发现：佩妮/瓦伦蒂诺 person 代码写反（definition.js 05264=佩妮 应为 05049、05265=瓦伦蒂诺 应为 05048），命运记录与放一边过滤串位',
    status: 'approximation',
    note: '交叉复核：content/campaigns/theCircleUndone/scenarios/unionAndDisillusion/definition.js:61 把佩妮的 person 写成 05048（05048 是瓦伦蒂诺，05049 才是佩妮），resolveFate/放一边过滤会把两人命运记录串位。',
    evidence: 'content/campaigns/theCircleUndone/scenarios/unionAndDisillusion/definition.js:61；content/campaigns/theCircleUndone/scenarios/atDeathsDoorstep/behavior.js:48-51；src/cards/cards-data.js:222411,222475',
  },
  {
    code: '05265', reviewer: 'reaudit-b', append: true,
    clauseText: '交叉复核发现：瓦伦蒂诺/佩妮 person 代码写反（definition.js 05265=瓦伦蒂诺 应为 05048、05264=佩妮 应为 05049），命运记录与放一边过滤串位',
    status: 'approximation',
    note: '交叉复核：content/campaigns/theCircleUndone/scenarios/unionAndDisillusion/definition.js:62 把瓦伦蒂诺的 person 写成 05049（05049 是佩妮，05048 才是瓦伦蒂诺），resolveFate/放一边过滤会把两人命运记录串位。',
    evidence: 'content/campaigns/theCircleUndone/scenarios/unionAndDisillusion/definition.js:62；content/campaigns/theCircleUndone/scenarios/atDeathsDoorstep/behavior.js:48-51；src/cards/cards-data.js:222411,222475',
  },
]

const loadResults = () => {
  const map = new Map()
  const docs = new Map()
  for (const file of readdirSync(RESULTS).filter(name => name.endsWith('.json') && !name.startsWith('.'))) {
    const path = join(RESULTS, file)
    const doc = JSON.parse(readFileSync(path, 'utf8'))
    docs.set(file, doc)
    for (const card of doc.cards) map.set(card.code, { file, path, doc, card })
  }
  return { map, docs }
}

// Lead 裁决：复核 dispute 但按规则/口径不改判（写入裁决说明，不降级）。
const SKIP_DISPUTES = {
  '05024': '卡面「使用(3补给)」的 Uses 关键词在规则书中有「uses 用尽即弃置」的通用规则（Uses 条目），条目声明 discardWhenEmpty 是通用规则的实现，不是卡面之外的新增效果；05024 行为与规则一致，维持 match。',
}
// Lead 裁决：复核 confirm 但明确登记「按严格口径可降级」的已知偏差 → 按严格口径改判 approximation。
const MANUAL_VERDICT_FIXES = [
  { code: '05023', reviewer: 'reaudit-g', evidence: 'src/engine/setup.js:275 开局自动放置吞掉 [reaction]；setup.js:660-661 早于 scenarioStarts；塔罗槽上限未校验' },
  { code: '05027', reviewer: 'reaudit-g', evidence: 'src/engine/setup.js:275 开局自动放置吞掉 [reaction]；塔罗槽上限未校验' },
  { code: '05031', reviewer: 'reaudit-g', evidence: 'src/engine/setup.js:275 开局自动放置吞掉 [reaction]；塔罗槽上限未校验' },
  { code: '05035', reviewer: 'reaudit-g', evidence: 'src/engine/setup.js:275 开局自动放置吞掉 [reaction]；塔罗槽上限未校验' },
  { code: '05039', reviewer: 'reaudit-g', evidence: 'src/engine/setup.js:275 开局自动放置吞掉 [reaction]；塔罗槽上限未校验' },
  { code: '05151', reviewer: 'reaudit-g', evidence: 'src/cards/entries/05151.js:24-27 无敌人时仅 api.info 后 return（横置费用已付）；src/engine/encounter.js:382-384 反应窗口不预选目标，实测无敌人时仍提供反应' },
  { code: '05153', reviewer: 'reaudit-g', evidence: 'src/cards/entries/05153.js:34 用 api.moveCard 进手而非 api.drawCards 抽牌通道；src/cards/entries/05153.js:38-42 只有弱点分支走真实抽牌，主抽取缺抽牌触发' },
]

const changes = []
const { map: results, docs: resultDocs } = loadResults()
const reviewFiles = existsSync(REVIEW)
  ? readdirSync(REVIEW).filter(name => name.endsWith('.json') && !name.startsWith('.')).sort()
  : []
for (const file of reviewFiles) {
  const review = JSON.parse(readFileSync(join(REVIEW, file), 'utf8'))
  for (const item of review.items || []) {
    if (item.review !== 'dispute') continue
    const target = results.get(item.code)
    if (!target) throw new Error(`复核卡号不在结果里：${item.code}（${file}）`)
    const claimed = item.claimedVerdict
    const recommended = item.recommendedVerdict
    if (!recommended || recommended === claimed) continue
    if (RANK[recommended] >= RANK[claimed]) {
      changes.push({ code: item.code, type: 'skip-upgrade', from: claimed, to: recommended, reason: item.reason })
      continue
    }
    if (target.card.verdict === recommended) {
      // 审计结果已经比复核意见更严（复核读到的是中间快照）：无需修正。
      changes.push({ code: item.code, type: 'noop', current: target.card.verdict, reason: item.reason })
      continue
    }
    if (target.card.verdict !== claimed) {
      // 当前结果与复核声称的结论不一致：不自动改，交 Lead 人工判断。
      changes.push({ code: item.code, type: 'skip-mismatch', current: target.card.verdict, claimed, to: recommended, reason: item.reason })
      continue
    }
    if (SKIP_DISPUTES[item.code]) {
      changes.push({ code: item.code, type: 'skip-adjudicated', reason: SKIP_DISPUTES[item.code] })
      continue
    }
    changes.push({
      code: item.code, type: 'verdict', from: target.card.verdict, to: recommended,
      reviewer: review.reviewer || file, reason: item.reason, evidence: item.evidence,
    })
  }
}
// Lead 裁决的「confirm 但按严格口径降级」：note 原因取复核文件里该卡的 reason。
const reviewItems = new Map()
for (const file of reviewFiles) {
  const review = JSON.parse(readFileSync(join(REVIEW, file), 'utf8'))
  for (const item of review.items || []) reviewItems.set(item.code, { ...item, reviewer: review.reviewer })
}
for (const fix of MANUAL_VERDICT_FIXES) {
  const item = reviewItems.get(fix.code) || {}
  changes.push({
    ...fix, type: 'verdict', from: results.get(fix.code)?.card.verdict, to: 'approximation',
    reason: `按严格口径采纳复核存疑：${item.reason || '复核记录的已知偏差'}`,
  })
}
for (const fix of MANUAL_CLAUSE_FIXES) changes.push({ ...fix, type: 'clause' })
for (const fix of MANUAL_NOTE_FIXES) changes.push({ ...fix, type: 'note' })

// ---------------------------------------------------------------- 应用
const seenVerdict = new Set()
if (write) {
  mkdirSync(BACKUP, { recursive: true })
  for (const file of readdirSync(RESULTS).filter(name => name.endsWith('.json') && !name.startsWith('.'))) {
    copyFileSync(join(RESULTS, file), join(BACKUP, file))
  }
}
for (const change of changes) {
  if (change.type === 'skip-upgrade') continue
  const target = results.get(change.code)
  const { card } = target
  if (change.type === 'verdict') {
    if (seenVerdict.has(change.code)) continue
    seenVerdict.add(change.code)
    if (card.verdict === change.to) {
      console.log(`verdict ${change.code} 已是 ${change.to}（幂等跳过）`)
      continue
    }
    const before = { file: target.file, card: JSON.parse(JSON.stringify(card)) }
    if (write) copyFileSync(target.path, join(BACKUP, target.file))
    card.verdict = change.to
    card.clauses = card.clauses || []
    card.clauses.push({
      text: `交叉复核发现的偏差（${change.reviewer}）：${TRUNC(change.reason).slice(0, 160)}`,
      status: change.to === 'gap' ? 'missing' : 'approximation',
      evidence: TRUNC(change.evidence || change.reason),
    })
    const prefix = String(card.note || '').trim()
    card.note = [prefix, `交叉复核（${change.reviewer}）：${TRUNC(change.reason)}`].filter(Boolean).join(' ').slice(0, 1800)
    console.log(`verdict ${change.code} ${change.from} → ${change.to}（${before.file}）`)
  } else if (change.type === 'clause') {
    const { card } = target
    let touched = false
    if (change.clauseHint) {
      const clause = (card.clauses || []).find(item => String(item.text || '').includes(change.clauseHint))
      if (clause) { clause.status = change.status; touched = true }
    }
    if (change.append) {
      card.clauses = card.clauses || []
      if (!card.clauses.some(item => item.text === change.clauseText)) {
        card.clauses.push({
          text: change.clauseText,
          status: change.status,
          evidence: TRUNC(change.evidence),
        })
      }
      touched = true
    }
    if (!touched) throw new Error(`clause 修正未命中：${change.code}（hint=${change.clauseHint}）`)
    const prefix = String(card.note || '').trim()
    if (!prefix.includes(String(change.note).slice(0, 24))) {
      card.note = [prefix, change.note].filter(Boolean).join(' ').slice(0, 1800)
    }
    console.log(`clause  ${change.code} ← ${change.reviewer}（${change.status}）`)
  } else if (change.type === 'note') {
    const prefix = String(card.note || '').trim()
    if (!prefix.includes(String(change.note).slice(0, 24))) {
      card.note = [prefix, change.note].filter(Boolean).join(' ').slice(0, 1800)
    }
    console.log(`note    ${change.code}（复核说明补充）`)
  }
}

if (write) {
  const touchedFiles = new Set(changes.filter(change => ['verdict', 'clause', 'note'].includes(change.type)).map(change => results.get(change.code).file))
  for (const file of touchedFiles) {
    const path = join(RESULTS, file)
    writeFileSync(path, `${JSON.stringify(resultDocs.get(file), null, 1)}\n`)
  }
  console.log(`已写回 ${touchedFiles.size} 个结果文件（备份在 ${BACKUP}）`)
} else {
  console.log('dry-run：加 --write 才会写回结果文件')
}
console.log(JSON.stringify({ changes: changes.length, verdict: changes.filter(change => change.type === 'verdict').length, clause: changes.filter(change => change.type === 'clause').length, skipped: changes.filter(change => change.type === 'skip-upgrade').length }))
