// 第三轮交叉复核 JSON 校验器：
//   node develop/check-tcu-crossreview.mjs --file artifacts/tcu-audit/review/<文件>
// 检查：schema、升级卡集合是否与「本轮该 owner 的 match 升级集合」一致（不重不漏）、
//       每项 reason/evidence、evidence 中的 file:line 存在性。
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const fileArg = args.includes('--file') ? args[args.indexOf('--file') + 1] : null
if (!fileArg) { console.error('用法：node develop/check-tcu-crossreview.mjs --file <review.json>'); process.exit(1) }
const filePath = join(ROOT, fileArg)
if (!existsSync(filePath)) { console.error(`文件不存在：${fileArg}`); process.exit(1) }
const doc = JSON.parse(readFileSync(filePath, 'utf8'))
const errors = []
const fail = message => errors.push(message)

// 载入两轮结果，算该 owner 的升级集合（按 review 的 owner 域）。
const load = dir => {
  const map = new Map()
  if (!existsSync(join(ROOT, dir))) return map
  for (const file of readdirSync(join(ROOT, dir)).filter(name => name.endsWith('.json'))) {
    const batch = JSON.parse(readFileSync(join(ROOT, dir, file), 'utf8'))
    for (const card of batch.cards || []) map.set(card.code, { ...card, file })
  }
  return map
}
// 对比基线：优先上一轮归档 results-round4，其次 results-round3。
import { existsSync as fsExists } from 'node:fs'
const BASELINE_DIR = fsExists(join(ROOT, 'artifacts/tcu-audit/results-round6'))
  ? 'artifacts/tcu-audit/results-round6'
  : fsExists(join(ROOT, 'artifacts/tcu-audit/results-round5'))
    ? 'artifacts/tcu-audit/results-round5'
    : fsExists(join(ROOT, 'artifacts/tcu-audit/results-round4'))
      ? 'artifacts/tcu-audit/results-round4' : 'artifacts/tcu-audit/results-round3'
const r2 = load(BASELINE_DIR)
const r3 = load('artifacts/tcu-audit/results')
const rank = { gap: 0, approximation: 1, match: 2 }
const OWNERS = {
  a: ['chapter-disappearanceAtTheTwilightEstate', 'chapter-theWitchingHour', 'chapter-atDeathsDoorstep', 'chapter-beforeTheBlackThrone-1'],
  b: ['chapter-beforeTheBlackThrone-2', 'chapter-theSecretName-1', 'chapter-theSecretName-2'],
  c: ['chapter-forTheGreaterGood-1', 'chapter-forTheGreaterGood-2', 'chapter-theWagesOfSin-1', 'chapter-theWagesOfSin-2'],
  d: ['chapter-unionAndDisillusion-1', 'chapter-unionAndDisillusion-2', 'chapter-inTheClutchesOfChaos-1', 'chapter-inTheClutchesOfChaos-2'],
  e: ['shared-encounters-1', 'shared-encounters-2', 'campaign-other'],
  f: ['player-m2-1-1', 'player-m2-1-2', 'player-m2-2-1', 'player-m2-2-2'],
  g: ['player-m2-3-1', 'player-m2-3-2', 'player-m2-4-1', 'player-m2-4-2', 'faces-2'],
  h: ['investigators-1', 'investigators-2', 'story-investigators', 'faces-1'],
}
const ownerOf = batch => Object.keys(OWNERS).find(key => OWNERS[key].includes(batch.replace(/\.json$/, ''))) || null
if (typeof doc.reviewer !== 'string' || !doc.reviewer) fail('缺少 reviewer')
if (typeof doc.owner !== 'string' || !doc.owner) fail('缺少 owner')
const expected = new Set()
for (const [code, card] of r3) {
  if (ownerOf(card.file) !== doc.owner) continue
  const before = r2.get(code)
  if (!before || rank[card.verdict] > rank[before.verdict]) expected.add(code)
}
const checked = Array.isArray(doc.checked) ? doc.checked : []
if (!checked.length) fail('checked 为空')
const seen = new Set()
for (const item of checked) {
  if (!item || typeof item.code !== 'string') { fail('checked 项缺少 code'); continue }
  if (seen.has(item.code)) fail(`${item.code}：重复`)
  seen.add(item.code)
  if (!['confirm', 'dispute'].includes(item.review)) fail(`${item.code}：review 必须是 confirm/dispute`)
  if (!item.reason || String(item.reason).length < 10) fail(`${item.code}：reason 过短`)
  const evidence = String(item.evidence || '')
  const ref = evidence.match(/([\w./-]+\.(?:js|mjs|json)):(\d+)(?:-(\d+))?/)
  if (!ref) { fail(`${item.code}：evidence 缺少 文件:行号`); continue }
  const path = join(ROOT, ref[1])
  if (!existsSync(path)) { fail(`${item.code}：evidence 文件不存在 ${ref[1]}`); continue }
  const lines = readFileSync(path, 'utf8').split('\n').length
  const start = Number(ref[2]); const end = ref[3] ? Number(ref[3]) : start
  if (start < 1 || start > lines || end > lines || end < start) fail(`${item.code}：evidence 行号越界 ${ref[1]}:${ref[2]}${ref[3] ? `-${ref[3]}` : ''}`)
}
for (const code of expected) if (!seen.has(code)) fail(`缺少待复核卡：${code}`)
const disputed = checked.filter(item => item.review === 'dispute').length
if (doc.summary?.confirmed !== checked.length - disputed || doc.summary?.disputed !== disputed) {
  fail(`summary 与实际不符：应为 confirmed=${checked.length - disputed} disputed=${disputed}`)
}
if (errors.length) {
  console.log(`校验失败（${errors.length} 个错误）：`)
  for (const error of errors.slice(0, 30)) console.log(`  ERROR ${error}`)
  process.exit(1)
}
console.log(`校验通过：${fileArg}（${checked.length} 张；confirm ${checked.length - disputed} / dispute ${disputed}）`)
