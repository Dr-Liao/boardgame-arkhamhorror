// 《万象无终》全量逐卡行为审计（2026-10-25 第二轮）结果校验器。
//
//   node develop/check-tcu-reaudit-results.mjs                # 全量校验：31 个批次 / 343 主卡 + 34 关联面
//   node develop/check-tcu-reaudit-results.mjs --file <path>  # 只校验单个批次结果文件（审计 agent 自检用）
//   node develop/check-tcu-reaudit-results.mjs --diff         # 全量校验并打印与 P10 旧结论的判定变化
//
// 校验项：批次号与卡号覆盖、判定枚举、子句状态、证据 file:line 真实存在且行号在文件内、
// match/approximation/gap 与子句状态自洽、非 match 必须有 note。任何错误都非零退出。
// 只读；不写任何文件。
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join, isAbsolute } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('../', import.meta.url)).replace(/[\\/]$/, '')
const WORKSPACE = fileURLToPath(new URL('../../../../', import.meta.url)).replace(/[\\/]$/, '')
const RESULTS_DIR = new URL('../artifacts/tcu-audit/results/', import.meta.url)
// 对比基线：优先用上一轮（results-round6 → round5 → round4 → round3），没有才回退到 P10。
const P10_DIR = existsSync(new URL('../artifacts/tcu-audit/results-round6/', import.meta.url))
  ? new URL('../artifacts/tcu-audit/results-round6/', import.meta.url)
  : existsSync(new URL('../artifacts/tcu-audit/results-round5/', import.meta.url))
    ? new URL('../artifacts/tcu-audit/results-round5/', import.meta.url)
  : existsSync(new URL('../artifacts/tcu-audit/results-round4/', import.meta.url))
    ? new URL('../artifacts/tcu-audit/results-round4/', import.meta.url)
  : existsSync(new URL('../artifacts/tcu-audit/results-round3/', import.meta.url))
    ? new URL('../artifacts/tcu-audit/results-round3/', import.meta.url)
    : existsSync(new URL('../artifacts/tcu-audit/results-round2/', import.meta.url))
      ? new URL('../artifacts/tcu-audit/results-round2/', import.meta.url)
      : new URL('../artifacts/tcu-audit/results-p10/', import.meta.url)
const { ALL_CARDS } = await import(new URL('../src/cards/cards-data.js', import.meta.url))

const VERDICTS = new Set(['match', 'approximation', 'gap', 'not-applicable'])
const CLAUSE_STATUS = new Set(['implemented', 'approximation', 'missing'])

// 关联面 34 条：两批固定卡号（ledger 生成器按主卡继承，但这里要求直接审计）。
const FACE_BATCHES = {
  'faces#1': ['05055b', '05085b', '05166b', '05167b', '05168b', '05169b', '05170b', '05171b',
    '05172b', '05173b', '05174b', '05175b', '05176b', '05178a', '05178b', '05178c', '05178d'],
  'faces#2': ['05178e', '05178f', '05178g', '05178h', '05178i', '05178j', '05178k', '05178l',
    '05217b', '05262b', '05263b', '05264b', '05265b', '05286a', '05286b', '05288a', '05288b'],
}
// 批次号 → 约定输出文件名（旧文件名；新结果沿用，避免与 results-p10 混淆）。
const BATCH_FILES = {
  'campaign:other': 'campaign-other.json',
  'chapter:atDeathsDoorstep': 'chapter-atDeathsDoorstep.json',
  'chapter:beforeTheBlackThrone#1': 'chapter-beforeTheBlackThrone-1.json',
  'chapter:beforeTheBlackThrone#2': 'chapter-beforeTheBlackThrone-2.json',
  'chapter:disappearanceAtTheTwilightEstate': 'chapter-disappearanceAtTheTwilightEstate.json',
  'chapter:forTheGreaterGood#1': 'chapter-forTheGreaterGood-1.json',
  'chapter:forTheGreaterGood#2': 'chapter-forTheGreaterGood-2.json',
  'chapter:inTheClutchesOfChaos#1': 'chapter-inTheClutchesOfChaos-1.json',
  'chapter:inTheClutchesOfChaos#2': 'chapter-inTheClutchesOfChaos-2.json',
  'chapter:theSecretName#1': 'chapter-theSecretName-1.json',
  'chapter:theSecretName#2': 'chapter-theSecretName-2.json',
  'chapter:theWagesOfSin#1': 'chapter-theWagesOfSin-1.json',
  'chapter:theWagesOfSin#2': 'chapter-theWagesOfSin-2.json',
  'chapter:theWitchingHour': 'chapter-theWitchingHour.json',
  'chapter:unionAndDisillusion#1': 'chapter-unionAndDisillusion-1.json',
  'chapter:unionAndDisillusion#2': 'chapter-unionAndDisillusion-2.json',
  'faces#1': 'faces-1.json',
  'faces#2': 'faces-2.json',
  'investigators#1': 'investigators-1.json',
  'investigators#2': 'investigators-2.json',
  'player:m2-1#1': 'player-m2-1-1.json',
  'player:m2-1#2': 'player-m2-1-2.json',
  'player:m2-2#1': 'player-m2-2-1.json',
  'player:m2-2#2': 'player-m2-2-2.json',
  'player:m2-3#1': 'player-m2-3-1.json',
  'player:m2-3#2': 'player-m2-3-2.json',
  'player:m2-4#1': 'player-m2-4-1.json',
  'player:m2-4#2': 'player-m2-4-2.json',
  'shared:encounters#1': 'shared-encounters-1.json',
  'shared:encounters#2': 'shared-encounters-2.json',
  'story-investigators': 'story-investigators.json',
}

const batchesDoc = JSON.parse(readFileSync(new URL('../artifacts/tcu-audit/batches.json', import.meta.url), 'utf8'))
const expected = new Map()
for (const batch of batchesDoc.batches) expected.set(batch.id, batch.codes)
for (const [id, codes] of Object.entries(FACE_BATCHES)) expected.set(id, codes)
const expectedTotal = [...expected.values()].reduce((sum, codes) => sum + codes.length, 0)
if (expected.size !== 31 || expectedTotal !== 377) {
  console.error(`批次表异常：${expected.size} 批 / ${expectedTotal} 条记录（应为 31 / 377）`)
  process.exit(1)
}

const errors = []
const warnings = []
const fail = (where, message) => errors.push(`${where}：${message}`)

const fileTextCache = new Map()
const textOf = path => {
  if (!fileTextCache.has(path)) fileTextCache.set(path, readFileSync(path, 'utf8'))
  return fileTextCache.get(path)
}
const resolveRefPath = ref => {
  const cleaned = String(ref).replace(/^[.][\\/]/, '').replaceAll('\\', '/')
  const candidates = []
  if (isAbsolute(cleaned)) candidates.push(cleaned)
  if (cleaned.startsWith('games/arkhamhorror/')) candidates.push(join(WORKSPACE, cleaned))
  candidates.push(join(ROOT, cleaned), join(WORKSPACE, cleaned))
  return candidates.find(candidate => existsSync(candidate) && statSync(candidate).isFile()) || null
}
// 只把形如 path.ext:123 或 path.ext:123-145 的引用当作源码证据；单行号 allow。
const EVIDENCE_REF = /([A-Za-z0-9_.@-]+(?:[\\/][A-Za-z0-9_.@-]+)*[\\/][A-Za-z0-9_.@-]+\.(?:js|mjs|cjs|json|md|ps1|css|html)):(\d+)(?:-(\d+))?/g
const checkEvidence = (where, evidence) => {
  if (typeof evidence !== 'string' || !evidence.trim()) {
    fail(where, 'evidence 为空')
    return 0
  }
  let count = 0
  for (const match of evidence.matchAll(EVIDENCE_REF)) {
    const [full, ref, startText, endText] = match
    const resolved = resolveRefPath(ref)
    if (!resolved) {
      fail(where, `证据文件不存在：${ref}（原文 ${full}）`)
      continue
    }
    const lineCount = textOf(resolved).split('\n').length
    const start = Number(startText)
    const end = endText ? Number(endText) : start
    if (start < 1 || end < start || start > lineCount || end > lineCount) {
      fail(where, `证据行号越界：${full}（文件共 ${lineCount} 行）`)
      continue
    }
    count += 1
  }
  if (count === 0) fail(where, `证据里没有可解析的 file:line 引用：${evidence.slice(0, 120)}`)
  return count
}

const validateBatch = (filePath, { loose = false } = {}) => {
  const where = String(filePath)
  let doc
  try {
    doc = JSON.parse(readFileSync(filePath, 'utf8'))
  } catch (error) {
    fail(where, `JSON 解析失败：${error.message}`)
    return null
  }
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return fail(where, '顶层必须是对象'), null
  const batchId = doc.batch
  if (!expected.has(batchId)) {
    fail(where, `未知批次号：${JSON.stringify(batchId)}（允许：${[...expected.keys()].join('、')}）`)
    return null
  }
  if (!Array.isArray(doc.cards) || !doc.cards.length) {
    fail(where, `cards 必须是非空数组（批次 ${batchId}）`)
    return null
  }
  const wanted = expected.get(batchId)
  const seen = new Set()
  for (const card of doc.cards) {
    if (!card || typeof card !== 'object') { fail(where, 'cards 里有非对象项'); continue }
    const code = String(card.code || '')
    const cardWhere = `${where} ${batchId}/${code || '(无 code)'}`
    if (!ALL_CARDS[code]) { fail(cardWhere, `cards-data 里没有该卡号`); continue }
    if (seen.has(code)) fail(cardWhere, '同一批次内重复卡号')
    seen.add(code)
    if (!wanted.includes(code)) fail(cardWhere, `不属于批次 ${batchId}（该批应审 ${wanted.length} 张）`)
    if (typeof card.name !== 'string' || !card.name.trim()) fail(cardWhere, '缺少 name')
    else {
      const printed = ALL_CARDS[code]
      const names = [printed.name, printed.nameZh].filter(Boolean).map(String)
      if (names.length && !names.some(name => card.name === name || card.name.includes(name))) {
        warnings.push(`${cardWhere}：name「${card.name}」与印表名称 ${JSON.stringify(names)} 不一致（确认是否写错卡）`)
      }
    }
    if (!VERDICTS.has(card.verdict)) fail(cardWhere, `verdict 非法：${JSON.stringify(card.verdict)}`)
    const clauses = card.clauses
    if (!Array.isArray(clauses) || !clauses.length) {
      fail(cardWhere, 'clauses 必须是非空数组（逐条列印刷子句）')
    } else {
      const statuses = []
      for (const [index, clause] of clauses.entries()) {
        const clauseWhere = `${cardWhere} 子句${index + 1}`
        if (!clause || typeof clause !== 'object') { fail(clauseWhere, '不是对象'); continue }
        if (typeof clause.text !== 'string' || !clause.text.trim()) fail(clauseWhere, '缺少 text')
        if (!CLAUSE_STATUS.has(clause.status)) fail(clauseWhere, `status 非法：${JSON.stringify(clause.status)}`)
        statuses.push(clause.status)
        checkEvidence(clauseWhere, clause.evidence)
      }
      const hasMissing = statuses.includes('missing')
      const hasApprox = statuses.includes('approximation')
      if (card.verdict === 'match') {
        if (hasMissing) fail(cardWhere, 'verdict=match 但有 missing 子句')
        if (hasApprox) fail(cardWhere, 'verdict=match 但有 approximation 子句（应改为 approximation）')
      } else if (card.verdict === 'approximation') {
        if (hasMissing) fail(cardWhere, 'verdict=approximation 但存在 missing 子句（应为 gap）')
        if (!hasApprox) fail(cardWhere, 'verdict=approximation 但没有任何 approximation 子句')
      } else if (card.verdict === 'gap') {
        if (!hasMissing) fail(cardWhere, 'verdict=gap 但没有 missing 子句')
      } else if (card.verdict === 'not-applicable' && !loose) {
        warnings.push(`${cardWhere}：not-applicable 需在 note 说明为何卡面无可执行行为`)
      }
      if (!['match', 'not-applicable'].includes(card.verdict)) {
        if (typeof card.note !== 'string' || card.note.trim().length < 10) {
          fail(cardWhere, '非 match 卡必须写 note（说明差异/缺口）')
        }
      }
    }
  }
  const missingCodes = wanted.filter(code => !seen.has(code))
  const extraCount = seen.size - (wanted.length - missingCodes.length)
  if (missingCodes.length) fail(where, `批次 ${batchId} 缺卡：${missingCodes.join('、')}`)
  if (extraCount > 0) fail(where, `批次 ${batchId} 有 ${extraCount} 张越界卡`)
  const verdictCount = verdict => doc.cards.filter(card => card?.verdict === verdict).length
  return {
    batch: batchId,
    cards: doc.cards.length,
    match: verdictCount('match'),
    approximation: verdictCount('approximation'),
    gap: verdictCount('gap'),
    notApplicable: verdictCount('not-applicable'),
  }
}

const args = process.argv.slice(2)
const modeFileIndex = args.indexOf('--file')
let rows = []
if (modeFileIndex !== -1) {
  const filePath = args[modeFileIndex + 1]
  if (!filePath) { console.error('用法：--file <路径>'); process.exit(1) }
  const row = validateBatch(filePath)
  if (row) rows.push(row)
} else {
  const files = readdirSync(RESULTS_DIR).filter(file => file.endsWith('.json') && !file.startsWith('.')).sort()
  const byBatch = new Map()
  for (const file of files) {
    const filePath = join(fileURLToPath(RESULTS_DIR), file)
    let doc = null
    try { doc = JSON.parse(readFileSync(filePath, 'utf8')) } catch { /* validateBatch 会报 */ }
    if (doc?.batch && BATCH_FILES[doc.batch] && BATCH_FILES[doc.batch] !== file) {
      warnings.push(`${file}：批次 ${doc.batch} 的约定文件名是 ${BATCH_FILES[doc.batch]}（内容按 batch 字段汇总，不影响账本）`)
    }
    if (doc?.batch) {
      if (byBatch.has(doc.batch)) fail(file, `批次 ${doc.batch} 重复出现在多个结果文件`)
      byBatch.set(doc.batch, file)
    }
    const row = validateBatch(filePath)
    if (row) rows.push(row)
  }
  for (const batchId of expected.keys()) {
    if (!byBatch.has(batchId)) fail('全量覆盖', `缺少批次结果：${batchId}（约定文件 ${BATCH_FILES[batchId]}）`)
  }
  const covered = new Set(rows.flatMap(row => {
    const codes = expected.get(row.batch) || []
    return codes
  }))
  if (covered.size !== expectedTotal) fail('全量覆盖', `覆盖 ${covered.size} 条记录（应为 ${expectedTotal}）`)
  // 主卡/关联面数量硬校验
  const allCodes = [...expected.values()].flat()
  const mainCount = allCodes.filter(code => /^05\d{3}$/.test(code)).length
  const faceCount = allCodes.filter(code => /^05\d{3}[a-z]$/.test(code)).length
  if (mainCount !== 343 || faceCount !== 34) fail('全量覆盖', `批次表分账异常：主卡 ${mainCount}/343、关联面 ${faceCount}/34`)
  // 与 P10 旧结论的判定变化（便于 Lead 复核升级项）
  if (args.includes('--diff')) {
    const oldByCode = new Map()
    for (const file of readdirSync(P10_DIR).filter(file => file.endsWith('.json'))) {
      try {
        const doc = JSON.parse(readFileSync(join(fileURLToPath(P10_DIR), file), 'utf8'))
        for (const card of doc.cards || []) oldByCode.set(card.code, card.verdict)
      } catch { /* ignore */ }
    }
    const changes = []
    for (const file of files) {
      let doc = null
      try { doc = JSON.parse(readFileSync(join(fileURLToPath(RESULTS_DIR), file), 'utf8')) } catch { continue }
      for (const card of doc.cards || []) {
        const before = oldByCode.get(card.code) || '(无)'
        if (before !== card.verdict) changes.push(`${card.code} ${before} → ${card.verdict}`)
      }
    }
    console.log(`P10→本轮判定变化 ${changes.length} 条：`)
    for (const change of changes.sort()) console.log(`  ${change}`)
  }
}

const totals = rows.reduce((acc, row) => {
  for (const key of ['cards', 'match', 'approximation', 'gap', 'notApplicable']) acc[key] = (acc[key] || 0) + row[key]
  return acc
}, {})
console.log(JSON.stringify({ batches: rows.length, ...totals }, null, 1))
for (const warning of warnings) console.warn(`WARN ${warning}`)
for (const error of errors) console.error(`ERROR ${error}`)
console.log(errors.length ? `校验失败：${errors.length} 个错误` : '校验通过')
process.exit(errors.length ? 1 : 0)
