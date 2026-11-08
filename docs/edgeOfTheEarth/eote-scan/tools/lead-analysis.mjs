// Lead 的 D2 浏览器账本核验 + D4/D5 复用候选分析。
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
const MODS = 'G:/boardgame-hall-ai/games/arkhamhorror'
const SCAN = 'G:/boardgame-hall-ai/games/arkhamhorror/docs/edgeOfTheEarth/eote-scan'
const read = p => readFileSync(join(MODS, p), 'utf8')
const out = {}

// ---------- 1) 浏览器账本证据核验 ----------
const browserLedgers = ['eote-interactions-browser', 'eote-investigators-browser', 'eote-player-browser', 'eote-scenarios-browser', 'eote-release-browser', 'eote-browser-acceptance']
const browser = {}
for (const f of browserLedgers) {
  const p = `audit/${f}.json`
  if (!existsSync(join(MODS, p))) { browser[f] = { missing: true }; continue }
  const j = JSON.parse(read(p))
  const json = JSON.stringify(j)
  const paths = [...new Set((json.match(/"([^"]*(?:artifacts|screenshots|test-results|\.png|\.webp)[^"]*)"/g) || []).map(s => s.slice(1, -1)).filter(s => /\.(png|webp|jpg)$/i.test(s)))]
  const existsCount = paths.filter(x => existsSync(join(MODS, x)) || existsSync(join('G:/boardgame-hall-ai', x)) || existsSync(join(MODS, '../../../', x))).length
  const testSpecs = [...new Set((json.match(/("[^"]*\.browser\.mjs")/g) || []).map(s => s.slice(1, -1)))]
  browser[f] = {
    keys: Object.keys(j), bytes: json.length,
    status: j.status || j.gate?.status || null,
    screenshotPaths: paths.length, screenshotPathsExisting: existsCount,
    testSpecsMentioned: testSpecs,
    booleansTrue: (json.match(/:\s*true/g) || []).length, booleansFalse: (json.match(/:\s*false/g) || []).length,
    sample: json.slice(0, 400),
  }
}
out.browser = browser

// ---------- 2) 动态 label/prompt 语言核验 ----------
const entryFiles = []
function walk(dir, outArr = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const f = join(dir, e.name)
    if (e.isDirectory()) walk(f, outArr)
    else if (/^\d{5}[ab]?\.js$/.test(e.name)) outArr.push(f)
  }
  return outArr
}
const eoteEntries = [...walk(join(MODS, 'src/cards/entries')), ...walk(join(MODS, 'src/cards/encounter-entries/edgeOfTheEarth'))]
const cjk = /[\u4e00-\u9fff]/
const labelStats = { totalFiles: eoteEntries.length, filesWithCjkLabel: 0, filesWithLabel: 0, filesWithPrompt: 0, filesWithCjkPrompt: 0, samples: [] }
for (const f of eoteEntries) {
  const src = readFileSync(f, 'utf8').replace(/^\/\/.*$/gm, '')
  const labels = [...src.matchAll(/label\s*:\s*['"`]([^'"`]+)['"`]/g)].map(m => m[1])
  const prompts = [...src.matchAll(/prompt\s*:\s*['"`]([^'"`]+)['"`]/g)].map(m => m[1])
  if (labels.length) labelStats.filesWithLabel += 1
  if (labels.some(l => cjk.test(l))) labelStats.filesWithCjkLabel += 1
  if (prompts.length) labelStats.filesWithPrompt += 1
  if (prompts.some(l => cjk.test(l))) labelStats.filesWithCjkPrompt += 1
  if (labelStats.samples.length < 8 && labels.some(l => cjk.test(l))) {
    const line = src.split('\n').findIndex(l => /label\s*:/.test(l)) + 1
    labelStats.samples.push({ file: f.replace(MODS + '/', ''), line, label: labels.find(l => cjk.test(l))?.slice(0, 80) })
  }
}
// en locale 是否有这些 label 的翻译键（粗查：把 label 文本作为字典值搜索）
const enLocaleText = readdirSync(join(MODS, 'web/locales')).filter(f => f.startsWith('en.')).map(f => read(`web/locales/${f}`)).join('\n')
labelStats.enLocaleCoversAnyCjkLabelText = labelStats.samples.filter(s => enLocaleText.includes(s.label)).length
out.labels = labelStats

// ---------- 3) 复用候选分类 ----------
const dup = JSON.parse(readFileSync(join(SCAN, 'screen/duplication.json'), 'utf8'))
const scope = JSON.parse(readFileSync(join(SCAN, 'scope/cards.json'), 'utf8'))
const cardByCode = new Map(scope.cards.map(c => [c.code, c]))
const groupOf = code => { const c = cardByCode.get(code); return c ? (c.chapter || c.group || c.partition) : '?' }
out.duplication = {
  textDuplicateGroups: dup.textDuplicateGroups.map(g => ({ ...g, groups: g.eoteCodes.map(c => `${c}:${groupOf(c)}`) })),
  clonePairsByGroup: (() => {
    const rows = dup.clonePairs.map(p => ({ ...p, aGroup: groupOf(p.a), bGroup: groupOf(p.b) }))
    const same = rows.filter(r => r.aGroup === r.bGroup)
    const cross = rows.filter(r => r.aGroup !== r.bGroup)
    return { sameGroup: same.slice(0, 80), crossGroup: cross.slice(0, 80), sameCount: same.length, crossCount: cross.length }
  })(),
  reprint: dup.reprint,
  crossCycleSameText: dup.crossCycleSameText,
}

// ---------- 4) engine 卡号字面量上下文 ----------
const pc = JSON.parse(readFileSync(join(SCAN, 'screen/primitive-compliance.json'), 'utf8'))
const litContext = {}
for (const item of pc.engineLiterals) {
  if (!litContext[item.file]) litContext[item.file] = { count: 0, contexts: [] }
  litContext[item.file].count += 1
  if (litContext[item.file].contexts.length < 6) {
    const text = read(item.file)
    const idx = text.indexOf(item.code)
    const line = text.slice(0, idx).split('\n').length
    const lineText = text.split('\n')[line - 1].trim().slice(0, 180)
    litContext[item.file].contexts.push({ code: item.code, line, lineText })
  }
}
out.engineLiterals = litContext

// ---------- 5) escape 对照 ----------
const plan = JSON.parse(read('audit/eote-primitive-plan.json'))
const resolveCards = []
for (const f of eoteEntries) {
  const src = readFileSync(f, 'utf8')
  if (/\bresolve\s*:/.test(src)) resolveCards.push(f.split(/[\\/]/).pop().replace('.js', ''))
}
out.escape = { planEscape: plan.escape || [], escapeCount: (plan.escape || []).length, resolveCards: resolveCards.length, planCounts: plan.counts }

// ---------- 6) primitive catalog 测试/读点 ----------
const catalog = JSON.parse(read('audit/eote-primitive-catalog.json'))
out.catalog = {
  keys: Object.keys(catalog),
  primitives: (catalog.primitives || []).length,
  sample: JSON.stringify(catalog.primitives || catalog).slice(0, 800),
}
import { writeFileSync } from 'node:fs'
writeFileSync(join(SCAN, 'ledger', 'lead-analysis.json'), JSON.stringify(out, null, 1))
console.log(JSON.stringify({
  browser: Object.fromEntries(Object.entries(out.browser).map(([k, v]) => [k, { status: v.status, screenshots: v.screenshotPaths, existing: v.screenshotPathsExisting, specs: v.testSpecsMentioned.length }])),
  labels: { ...labelStats, samples: labelStats.samples.length },
  dup: { textGroups: out.duplication.textDuplicateGroups.length, cloneSame: out.duplication.clonePairsByGroup.sameCount, cloneCross: out.duplication.clonePairsByGroup.crossCount },
  engineLiterals: Object.fromEntries(Object.entries(out.engineLiterals).map(([f, v]) => [f, v.count])),
  escape: { plan: out.escape.escapeCount, resolveCards: out.escape.resolveCards },
  catalog: { keys: out.catalog.keys, primitives: out.catalog.primitives },
}, null, 1))
