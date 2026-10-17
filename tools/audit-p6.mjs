import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { contentRegistry } from '../content/registered.js'
import { getAvailability } from '../src/deck/availability.js'
import { findings } from '../audit/p6-findings.js'
import { EFFECTS, INVESTIGATOR_ABILITIES } from '../src/cards/card-effects.js'

const root = fileURLToPath(new URL('../', import.meta.url))
const reference = path.resolve(root, '../../参考资源/ArkhamHorror-main/backend/arkham-api/library/Arkham')
const hash = value => createHash('sha256').update(value).digest('hex')
export function buildLedger() {
  const source = JSON.parse(readFileSync(path.join(root, 'catalog/sources/en.json'), 'utf8'))
  const tests = readdirSync(path.join(root, 'tests')).filter(f => f.endsWith('.test.mjs')).map(file => ({ file: `tests/${file}`, text: readFileSync(path.join(root, 'tests', file), 'utf8') }))
  const scenarios = contentRegistry.listScenarios('nightOfTheZealot')
  const codes = [...new Set(contentRegistry.listPacks().filter(p => ['core','notz'].includes(p.id)).flatMap(p => p.cards.map(c => c.code)))].sort()
  const rows = codes.map(code => {
    const card = ALL_CARDS[code], original = source[code]
    const aliases = (card.scenarioReferences || []).map(r => r.ruleId)
    const mentions = tests.filter(t => [code, ...aliases].some(key => t.text.includes(`'${key}'`))).map(t => ({ path: t.file, sha256: hash(t.text) }))
    const finding = findings.find(f => f.code === code)
    if (finding && !existsSync(path.join(reference, finding.reference))) throw new Error(`Missing reference: ${finding.reference}`)
    if (finding && !tests.some(t => t.text.includes(finding.test))) throw new Error(`Missing behavioral test: ${finding.test}`)
    const scenarioScopes = scenarios.filter(s => s.locations.some(l => [l.frontCode,l.backCode].includes(code)) ||
      Object.values(s.zones).flat().some(c => c.cardCode === code) || card.scenarioReferences?.some(r => r.scenarioId === s.id))
      .map(s => ({ scenarioId: s.id, recordReads: s.recordReads, recordWrites: s.recordWrites, resolutions: s.resolutionIds }))
    const scenarioRules = (card.scenarioReferences || []).map(ref => {
      const data = contentRegistry.getScenarioData(ref.scenarioId)
      const collection = data[ref.category]
      const rule = Array.isArray(collection) ? collection.find(r => r.id === ref.ruleId) : collection?.[ref.ruleId]
      return { ...ref, rule: rule || null }
    })
    return {
      code, name: card.nameZh || card.name, type: card.type,
      source: { path: 'catalog/sources/en.json', key: code, sha256: hash(JSON.stringify(original || null)) },
      ruleClauses: [original?.text || card.text, original?.back_text || card.backText].filter(Boolean).flatMap(t => t.split('\n')).filter(Boolean),
      runtimeOpen: getAvailability(code).strictAccepted, scenarioScopes,
      runtimeBehavior: { cardEffect: EFFECTS[code] || null, investigatorAbility: INVESTIGATOR_ABILITIES[code] || null, scenarioRules },
      testMentions: mentions,
      verdict: finding ? 'fixed-scoped-regression' : getAvailability(code).strictAccepted ? 'needs-behavior-review' : 'catalog-only-not-enabled',
      finding: finding ? { ...finding, referenceSha256: hash(readFileSync(path.join(reference, finding.reference))) } : null,
      limitation: '测试引用仅供定位；效果键、卡图、白名单和测试中的卡号出现均不证明整张卡规则等价。',
    }
  })
  return { schemaVersion: 1, strictModeRestored: false,
    implementationHashes: Object.fromEntries(['src/engine/engine.js', 'src/engine/resolution.js', 'src/engine/rules-state.js', 'src/engine/effects.js', 'src/cards/card-effects.js', 'src/campaign/campaign.js', 'src/deck/deckbuilding.js', 'src/deck/availability.js', 'web/deck-rules.js', 'tools/p6-playthrough.mjs'].map(file => [file, hash(readFileSync(path.join(root, file)))])),
    policy: '逐卡保留原文条款、精确卡号和可复查证据；修复结论仅覆盖明确断言的行为，其余仍待审计。',
    summary: { cards: rows.length, scopedFixes: findings.length, fullCardEquivalenceClaimed: 0, needsBehaviorReview: rows.filter(r => r.verdict === 'needs-behavior-review').length, catalogOnly: rows.filter(r => r.verdict === 'catalog-only-not-enabled').length },
    rows }
}
export function renderLedger(ledger) {
  return '# P6 Core＋NOTZ 行为差异账本\n\n' +
    `共 ${ledger.summary.cards} 个卡号；${ledger.summary.scopedFixes} 个限定行为修复。严格模式保持关闭；没有将任何整张卡自动标记为规则等价。\n\n` +
    '| 卡号 | 卡名 | 结论 | 行为差异 / 待办 |\n| --- | --- | --- | --- |\n' +
    ledger.rows.map(r => `| ${r.code} | ${r.name.replaceAll('|','/')} | ${r.finding ? '限定行为已修复' : r.runtimeOpen ? '待逐行为审计' : '仅图鉴，未开放'} | ${r.finding ? r.finding.expected : '原文条款、当前行为、范围及测试定位见 JSON；尚不构成完整验收。'} |`).join('\n') + '\n'
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const args = process.argv.slice(2)
    if (args.length !== 1 || !['--write','--check'].includes(args[0])) throw new Error('使用 --write 或 --check')
    const ledger = buildLedger()
    const artifacts = { 'p6-behavior-ledger.json': JSON.stringify(ledger, null, 2) + '\n', 'p6-behavior-ledger.md': renderLedger(ledger) }
    for (const [file, text] of Object.entries(artifacts)) {
      const target = path.join(root, 'audit', file)
      if (args[0] === '--write') writeFileSync(target, text)
      else if (!existsSync(target) || readFileSync(target, 'utf8') !== text) throw new Error(`账本漂移：${file}`)
    }
    console.log(JSON.stringify(ledger.summary))
  } catch (error) { console.error(error.message); process.exitCode = 1 }
}
