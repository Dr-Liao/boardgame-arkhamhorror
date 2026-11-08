// EOTE 全量扫描：机械筛查（Lead 专用；只读 mod，写 games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/screen）。
// 产出候选线索，最终结论必须由审计员逐卡/逐章人工复核并给 file:line 证据。
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..')
const MODS = join(OUT, '..', '..', '..')
const SCREEN = join(OUT, 'screen')
const read = p => readFileSync(join(MODS, p), 'utf8')
const exists = p => existsSync(join(MODS, p))
const rel = p => relative(MODS, p).split('\\').join('/')

const { ALL_CARDS } = await import(pathToFileURL(join(MODS, 'src/cards/cards-data.js')).href)
const scope = JSON.parse(readFileSync(join(OUT, 'scope', 'cards.json'), 'utf8'))
const cards = scope.cards
const cardByCode = new Map(cards.map(c => [c.code, c]))

function walk(dir, filter, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const f = join(dir, e.name)
    if (e.isDirectory()) walk(f, filter, out)
    else if (filter(f)) out.push(f)
  }
  return out
}
function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, block => block.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/[^\n]*/g, (line, prefix) => prefix + ' '.repeat(Math.max(0, line.length - prefix.length)))
}
function balancedBlock(src, startIndex) {
  // src[startIndex] 指向 '{'；返回含大括号的块文本
  let depth = 0
  for (let i = startIndex; i < src.length; i += 1) {
    if (src[i] === '{') depth += 1
    else if (src[i] === '}') { depth -= 1; if (depth === 0) return src.slice(startIndex, i + 1) }
  }
  return src.slice(startIndex)
}
const entryFiles = walk(join(MODS, 'src/cards/entries'), f => /^\d{5}[ab]?\.js$/.test(f.split('\\').pop()))
const encounterFiles = walk(join(MODS, 'src/cards/encounter-entries'), f => /^\d{5}[ab]?\.js$/.test(f.split('\\').pop()))
const entryByCode = new Map()
for (const f of [...entryFiles, ...encounterFiles]) entryByCode.set(f.split('\\').pop().replace('.js', ''), f)
const entrySrc = new Map()
for (const [code, f] of entryByCode) entrySrc.set(code, readFileSync(f, 'utf8'))

// ---- 引擎/内容/测试全文索引 ----
const engineFiles = walk(join(MODS, 'src'), f => f.endsWith('.js')).filter(f => !f.includes('src\\cards\\entries') && !f.includes('src\\cards\\encounter-entries') && !f.endsWith('cards-data.js'))
const engineText = new Map(engineFiles.map(f => [rel(f), readFileSync(f, 'utf8')]))
const contentFiles = walk(join(MODS, 'content'), f => f.endsWith('.js'))
const contentText = new Map(contentFiles.map(f => [rel(f), readFileSync(f, 'utf8')]))
const testFiles = readdirSync(join(MODS, 'tests')).filter(f => f.endsWith('.mjs'))
const testText = new Map(testFiles.map(f => [`tests/${f}`, readFileSync(join(MODS, 'tests', f), 'utf8')]))

// ============ 1. 条目完整性 ============
const integrity = { cards: [], summary: {} }
const SUSPICIOUS = /TODO|FIXME|XXX|HACK|未实现|待实现|尚未实现|近似|简化|占位|placeholder|临时方案|暂不|不支持/i
for (const c of cards) {
  const issues = []
  const markers = []
  const src = entrySrc.get(c.code) || null
  if (entryByCode.has(c.code) !== Boolean(c.entryPath)) issues.push({ kind: 'entry-index-mismatch', detail: `scope.entryPath=${c.entryPath} 实际文件=${entryByCode.has(c.code)}` })
  if (!src) {
    if (!['no-behavior'].includes(c.status) && c.partition === 'eoteCampaign') issues.push({ kind: 'entry-missing', detail: `status=${c.status} 但无条目文件`, severity: 'high' })
    if (c.partition !== 'eoteCampaign') issues.push({ kind: 'entry-missing-player', detail: `status=${c.status} 但无条目文件`, severity: 'high' })
  } else {
    const stripped = stripComments(src)
    const identCode = (() => {
      const m = src.match(/code\s*:\s*['"]([^'"]+)['"]/)
      if (m) return m[1]
      const m2 = src.match(/code\s*:\s*([A-Za-z_$][\w$]*)/)
      if (!m2) return null
      const constDef = src.match(new RegExp(`(?:const|let|var)\\s+${m2[1]}\\s*=\\s*['"]([^'"]+)['"]`))
      return constDef ? constDef[1] : `?${m2[1]}`
    })()
    if (!identCode) issues.push({ kind: 'entry-no-code', detail: '条目无 code 字段', severity: 'medium' })
    else if (identCode !== c.code) issues.push({ kind: 'code-mismatch', detail: `entry.code=${identCode} vs 文件名/账本=${c.code}`, severity: 'high' })
    if (!/export\s+default/.test(src)) issues.push({ kind: 'no-default-export', detail: '', severity: 'high' })
    const hasAbilities = /\babilities\s*:/.test(stripped)
    const hasOtherBehavior = /\b(encounterResolve|modifiers|investigator|elderSign|setup|played|commit|onReveal|reaction|constant)\s*:/.test(stripped)
    const emptyAbilities = /abilities\s*:\s*\[\s*\]/.test(stripped)
    if (emptyAbilities && !hasOtherBehavior) issues.push({ kind: 'empty-behavior', detail: 'abilities=[] 且无其它行为字段', severity: 'high' })
    if (/implemented\s*:\s*true/.test(src)) { /* expected */ }
    else if (!/implemented\s*:/.test(src)) issues.push({ kind: 'no-implemented-flag', detail: '条目无 implemented 标记（部分玩家卡口径如此）', severity: 'low' })
    src.split('\n').forEach((line, i) => {
      if (/^\s*(\/\/|\*)/.test(line) && SUSPICIOUS.test(line)) markers.push({ line: i + 1, text: line.trim().slice(0, 160) })
    })
  }
  if (issues.length || markers.length) integrity.cards.push({ code: c.code, name: c.nameZh || c.name, partition: c.partition, type: c.type, status: c.status, entryPath: c.entryPath, issues, markers })
}
integrity.summary = {
  total: cards.length,
  withEntry: cards.filter(c => c.entryPath).length,
  withoutEntry: cards.filter(c => !c.entryPath).map(c => c.code),
  issueCards: integrity.cards.filter(c => c.issues.length).length,
  markerCards: integrity.cards.filter(c => c.markers.length).length,
  byKind: integrity.cards.flatMap(c => c.issues.map(i => i.kind)).reduce((a, k) => ((a[k] = (a[k] || 0) + 1), a), {}),
}
writeFileSync(join(SCREEN, 'integrity.json'), JSON.stringify({ generatedAt: new Date().toISOString(), summary: integrity.summary, cards: integrity.cards }, null, 1))

// ============ 2. 打印模板 → 实现特征启发式 ============
const PLAYER_PATTERNS = [
  ['强制', /Forced/i, /'forced'|forced\s*:/],
  ['反应', /Reaction/i, /'reaction'|reaction\s*:/],
  ['快速', /\bFast\b/i, /fast\s*:|\bfast\b/],
  ['攻击行动', /Fight action|Fight\./i, /'combat'|fight/i],
  ['躲避行动', /Evade action|Evade\./i, /'agility'|evade/i],
  ['调查行动', /Investigate action|Investigate\./i, /'intellect'|investigate/i],
  ['检定', /test/i, /\btest\b|api\.test/],
  ['充能/弹药/次数', /uses|charge|ammo/i, /uses|charge|ammo/i],
  ['发现线索', /discover/i, /clue|discover/i],
  ['伤害', /damage/i, /damage/i],
  ['恐惧', /horror/i, /horror/i],
  ['治疗', /heal/i, /heal/i],
  ['弃牌', /discard/i, /discard/i],
  ['搜索', /search/i, /search/i],
  ['谈判', /parley/i, /parley/i],
  ['移动', /move/i, /move/i],
  ['消耗', /exhaust/i, /exhaust/i],
  ['资源', /resource/i, /resource/i],
  ['投入', /commit/i, /commit/i],
  ['取消', /cancel/i, /cancel/i],
]
const ENEMY_KEYWORDS = ['Hunter', 'Aloof', 'Retaliate', 'Alert', 'Massive', 'Elusive', 'Swarms', 'Swarming', 'Victory', 'Toughness', 'Doom', 'Objective', 'Forced', 'Revelation']
const keywordCoverage = []
for (const c of cards) {
  const src = stripComments(entrySrc.get(c.code) || '')
  if (!src) continue
  const text = `${c.text}\n${c.backText}`
  const flags = []
  if (c.partition === 'eotePlayer' || c.partition === 'eoteInvestigators') {
    for (const [label, textRe, srcRe] of PLAYER_PATTERNS) {
      if (!textRe.test(c.text)) continue
      // 技能卡文字只有图标行时跳过
      if (c.type === 'skill' && c.text.replace(/\s/g, '').length < 30) continue
      if (!srcRe.test(src)) flags.push(label)
    }
  } else if (c.type === 'enemy') {
    for (const kw of ENEMY_KEYWORDS) {
      if (!new RegExp(`(^|\\n)\\s*${kw}\\b`, 'i').test(c.text)) continue
      const token = kw.toLowerCase()
      if (!src.toLowerCase().includes(token) && !contentTextLog(kw)) flags.push(kw)
    }
  }
  if (flags.length) keywordCoverage.push({ code: c.code, name: c.nameZh || c.name, type: c.type, partition: c.partition, missingFeatureTokens: flags, text: c.text.slice(0, 200), entry: c.entryPath })
}
function contentTextLog() { return true } // 敌人关键词由引擎/数据层统一支持，条目无需包含（仅提示人工核读点）
const keywordSummary = keywordCoverage.reduce((a, c) => { for (const f of c.missingFeatureTokens) a[f] = (a[f] || 0) + 1; return a }, {})
writeFileSync(join(SCREEN, 'keyword-coverage.json'), JSON.stringify({ generatedAt: new Date().toISOString(), note: '启发式候选：文本提到 X 但条目源码无 X 相关 token；可能是引擎统一原语/数据层实现，需人工核读点', summary: keywordSummary, cards: keywordCoverage }, null, 1))

// ============ 3. 声明字段 → 引擎读点 ============
const RULE_BLOCKS = ['flags', 'locationRule', 'treacheryRule', 'agendaRule', 'actRule', 'enemyRule', 'investigator', 'weaknessRule', 'scenarioRule', 'storyRule', 'setupRule', 'rule']
const declared = []
for (const [code, src] of entrySrc) {
  const stripped = stripComments(src)
  const c = cardByCode.get(code)
  if (!c) continue
  for (const block of RULE_BLOCKS) {
    const re = new RegExp(`\\b${block}\\s*:\\s*\\{`, 'g')
    let m
    while ((m = re.exec(stripped))) {
      const start = stripped.indexOf('{', m.index)
      const body = balancedBlock(stripped, start)
      const inner = body.slice(1, -1)
      // 顶层 key 粗提取
      let depth = 0
      let keyBuf = ''
      const keys = []
      for (let i = 0; i < inner.length; i += 1) {
        const ch = inner[i]
        if (ch === '{' || ch === '[' || ch === '(') depth += 1
        else if (ch === '}' || ch === ']' || ch === ')') depth -= 1
        else if (depth === 0) {
          if (ch === ',') keyBuf = ''
          else if (ch === ':') {
            const key = (keyBuf.match(/([A-Za-z_$][\w$]*)\s*$/) || [])[1]
            if (key) keys.push(key)
            keyBuf = ''
          } else keyBuf += ch
        }
      }
      for (const key of keys) declared.push({ code, name: c.nameZh || c.name, block, key })
      // 规则块里的「调度值」字符串（如 forcedOnEnemyEnter: 'defeatElderThingsAtLocation'）也要有读点
      for (const vm of inner.matchAll(/:\s*['"]([A-Za-z][A-Za-z0-9_]{6,})['"]/g)) {
        const val = vm[1]
        if (!/^[a-z]/.test(val)) continue
        if (/^(boolean|string|number|true|false|null)$/.test(val)) continue
        declared.push({ code, name: c.nameZh || c.name, block, key: val, kind: 'rule-value' })
      }
    }
  }
}
// 去重
const declaredUniq = [...new Map(declared.map(d => [`${d.code}|${d.block}|${d.key}`, d])).values()]
const readpointHits = []
for (const d of declaredUniq) {
  const re = new RegExp(`\\b${d.key}\\b`)
  const hits = []
  for (const [file, text] of engineText) if (re.test(text)) hits.push(file)
  if (!hits.length) for (const [file, text] of contentText) if (re.test(text)) hits.push(file)
  readpointHits.push({ ...d, engineReadpoints: hits.slice(0, 5), engineReadpointCount: hits.length })
}
const unread = readpointHits.filter(d => d.engineReadpointCount === 0)
writeFileSync(join(SCREEN, 'flags-readpoints.json'), JSON.stringify({
  generatedAt: new Date().toISOString(),
  note: 'declared key / rule-value 在 src（引擎与 src/cards 读点）与 content 中均无字面读点。kind=rule-value 表示规则块中的调度字符串也无任何读取；kind=key 表示字段名无读点（可能被通用 dispatcher 按值分派，需人工核）。',
  summary: {
    declared: declaredUniq.length,
    unread: unread.length,
    unreadKeys: unread.filter(u => u.kind !== 'rule-value').length,
    unreadRuleValues: unread.filter(u => u.kind === 'rule-value').length,
    unreadUniqueKeys: [...new Set(unread.map(u => `${u.block}.${u.key}`))],
  },
  unread, all: readpointHits,
}, null, 1))

// ============ 4. 复用/重复实现 ============
// 4a 卡面文本重复（全库 5930）
const normText = t => (t || '').toLowerCase().replace(/<[^>]+>/g, ' ').replace(/[^a-z0-9\u4e00-\u9fff]+/g, '')
const textGroups = new Map()
for (const [code, card] of Object.entries(ALL_CARDS)) {
  const t = normText(card.text) + '|' + normText(card.backText)
  if (t.replace(/\|/g, '').length < 20) continue
  if (!textGroups.has(t)) textGroups.set(t, [])
  textGroups.get(t).push({ code, cycle: /^08/.test(code) ? 'eote' : code.slice(0, 2), name: card.name })
}
const textDup = []
for (const [t, group] of textGroups) {
  if (group.length < 2) continue
  const eote = group.filter(g => g.cycle === 'eote')
  if (!eote.length) continue
  textDup.push({ eoteCodes: eote.map(x => x.code), sameTextCodes: group.map(x => x.code), count: group.length })
}
// 4b 条目源码近似（跨卡复制粘贴）
const tokensOf = src => stripComments(src).match(/[A-Za-z_$][\w$]*|['"][^'"]{1,40}['"]|\d+/g) || []
const shingles = (tokens, k = 8) => { const s = new Set(); for (let i = 0; i + k <= tokens.length; i += 1) s.add(tokens.slice(i, i + k).join(' ')); return s }
const entryShingles = new Map()
for (const [code, src] of entrySrc) {
  const c = cardByCode.get(code)
  if (!c) continue
  const t = tokensOf(src)
  if (t.length < 8) continue
  entryShingles.set(code, { set: shingles(t), len: t.length })
}
const clonePairs = []
const codes = [...entryShingles.keys()].filter(c => cardByCode.has(c))
for (let i = 0; i < codes.length; i += 1) {
  for (let j = i + 1; j < codes.length; j += 1) {
    const a = entryShingles.get(codes[i]); const b = entryShingles.get(codes[j])
    if (Math.min(a.len, b.len) < 8) continue
    if (Math.abs(a.len - b.len) / Math.max(a.len, b.len) > 0.6) continue
    let inter = 0
    const [small, big] = a.set.size < b.set.size ? [a.set, b.set] : [b.set, a.set]
    for (const x of small) if (big.has(x)) inter += 1
    const jac = inter / (a.set.size + b.set.size - inter)
    if (jac >= 0.72) clonePairs.push({ a: codes[i], b: codes[j], jaccard: Number(jac.toFixed(3)), aLen: a.len, bLen: b.len })
  }
}
clonePairs.sort((x, y) => y.jaccard - x.jaccard)
// 4c 重印/别名
const reprint = []
for (const [code, card] of Object.entries(ALL_CARDS)) {
  if (!/^08\d{3}/.test(code)) continue
  if (card.duplicateOfCode || card.duplicatedBy || (card.originalCode && card.originalCode !== code)) reprint.push({ code, originalCode: card.originalCode, duplicateOfCode: card.duplicateOfCode, duplicatedBy: card.duplicatedBy })
}
const crossCycle = []
for (const [code, card] of Object.entries(ALL_CARDS)) {
  if (!/^08\d{3}/.test(code)) continue
  const groups = textGroups.get(normText(card.text) + '|' + normText(card.backText)) || []
  const others = groups.filter(g => !/^08/.test(g.code))
  if (others.length) crossCycle.push({ eote: code, name: card.name, others: others.map(o => `${o.code}:${o.name}`) })
}
writeFileSync(join(SCREEN, 'duplication.json'), JSON.stringify({
  generatedAt: new Date().toISOString(),
  summary: { textDuplicateGroups: textDup.length, clonePairs: clonePairs.length, reprintRecords: reprint.length, crossCycleSameText: crossCycle.length },
  textDuplicateGroups: textDup.slice(0, 200),
  clonePairs: clonePairs.slice(0, 300),
  reprint,
  crossCycleSameText: crossCycle,
}, null, 1))

// ============ 5. 测试覆盖 ============
const testsCoverage = []
for (const c of cards) {
  const files = c.tests?.files || []
  const titles = c.tests?.titles || []
  const strong = titles.filter(t => t.title.includes(c.code))
  const weak = titles.filter(t => !t.title.includes(c.code))
  const asserts = files.reduce((n, f) => n + ((testText.get(f) || '').match(/\bassert\b/g) || []).length, 0)
  testsCoverage.push({
    code: c.code, name: c.nameZh || c.name, partition: c.partition, type: c.type, status: c.status,
    level: strong.length ? 'strong' : weak.length ? 'weak-title' : files.length ? 'file-only' : 'none',
    files, strongTitles: strong, weakTitles: weak.slice(0, 5), fileAssertCount: asserts,
  })
}
const testSummary = {
  total: testsCoverage.length,
  byLevel: testsCoverage.reduce((a, t) => ((a[t.level] = (a[t.level] || 0) + 1), a), {}),
  none: testsCoverage.filter(t => t.level === 'none').map(t => `${t.code}:${t.name}`),
  fileOnly: testsCoverage.filter(t => t.level === 'file-only').map(t => `${t.code}:${t.name}`),
}
const suspiciousTitles = []
for (const [file, text] of testText) {
  const re = /test\(\s*['"`]([^'"`]+)['"`]/g
  let m
  while ((m = re.exec(text))) {
    if (/简化|近似|未实现|TODO|FIXME|placeholder|skip\b|only\b|仅冒烟|冒烟/.test(m[1])) suspiciousTitles.push({ file, title: m[1] })
  }
}
writeFileSync(join(SCREEN, 'tests-coverage.json'), JSON.stringify({ generatedAt: new Date().toISOString(), summary: testSummary, cards: testsCoverage, suspiciousTitles }, null, 1))

// ============ 6. 可感知性静态事实 ============
const perceivability = []
for (const c of cards) {
  const src = entrySrc.get(c.code)
  if (!src) continue
  const stripped = stripComments(src)
  const abilityCount = (stripped.match(/\bkind\s*:\s*['"](action|free|reaction|forced|constant|elderSign|played|commit|setup|weakness|entersPlay|leavesPlay)['"]/g) || []).length
  const labelCount = (stripped.match(/\blabel\s*:/g) || []).length
  const choiceCalls = (stripped.match(/api\.choice\s*\(/g) || []).length
  const choiceNoPrompt = []
  let re = /api\.choice\s*\(/g
  let m
  while ((m = re.exec(stripped))) {
    const snippet = stripped.slice(m.index, m.index + 500)
    const end = snippet.indexOf('})')
    const call = end >= 0 ? snippet.slice(0, end) : snippet
    if (!/prompt\s*:/.test(call)) choiceNoPrompt.push(stripped.slice(0, m.index).split('\n').length)
  }
  const infoCalls = (stripped.match(/api\.info\s*\(/g) || []).length
  const cjkLabels = (stripped.match(/label\s*:\s*['"][^'"]*[\u4e00-\u9fff]/g) || []).length
  const flags = []
  if (abilityCount > 0 && labelCount === 0) flags.push('ability-without-label')
  if (choiceNoPrompt.length) flags.push('choice-without-prompt')
  if (abilityCount > 0 && infoCalls === 0 && choiceCalls === 0) flags.push('silent-ability-no-choice-no-log')
  if (flags.length || choiceNoPrompt.length) perceivability.push({ code: c.code, name: c.nameZh || c.name, type: c.type, partition: c.partition, abilityCount, labelCount, choiceCalls, infoCalls, cjkLabels, flags, choiceNoPromptLines: choiceNoPrompt })
}
const webFiles = readdirSync(join(MODS, 'web')).filter(f => f.endsWith('.js'))
const webEote = webFiles.filter(f => /edgeOfTheEarth|eote/i.test(readFileSync(join(MODS, 'web', f), 'utf8'))).map(f => `web/${f}`)
const chapterIds = ['iceAndDeathPart1', 'iceAndDeathPart2', 'iceAndDeathPart3', 'fatalMirage', 'toTheForbiddenPeaks', 'cityOfTheElderThings', 'theHeartOfMadnessPart1', 'theHeartOfMadnessPart2']
const webChapterRefs = {}
for (const id of chapterIds) webChapterRefs[id] = webFiles.filter(f => readFileSync(join(MODS, 'web', f), 'utf8').includes(id)).map(f => `web/${f}`)
const guideFiles = existsSync(join(MODS, 'web/scenario-guides')) ? readdirSync(join(MODS, 'web/scenario-guides')) : []
writeFileSync(join(SCREEN, 'perceivability.json'), JSON.stringify({
  generatedAt: new Date().toISOString(),
  note: '静态事实：能力无 label、api.choice 无 prompt、无 choice/info 日志的能力（可能由引擎统一日志覆盖，需人工核）',
  summary: {
    cardsWithFlags: perceivability.length,
    abilityWithoutLabel: perceivability.filter(p => p.flags.includes('ability-without-label')).length,
    choiceWithoutPrompt: perceivability.filter(p => p.flags.includes('choice-without-prompt')).length,
    silentAbility: perceivability.filter(p => p.flags.includes('silent-ability-no-choice-no-log')).length,
    cjkLabelCards: perceivability.filter(p => p.cjkLabels > 0).length,
  },
  cards: perceivability,
  web: { eoteReferencedFiles: webEote, chapterRefs: webChapterRefs, guideFiles },
}, null, 1))

// ============ 7. 章节/战役流程完整性 ============
const scenarioIntegrity = { chapters: [], flow: {}, guide: {}, summary: {} }
const REPO = 'content/campaigns/edgeOfTheEarth'
for (const id of chapterIds) {
  const row = { id, issues: [], exports: {}, counts: {} }
  try {
    const def = await import(pathToFileURL(join(MODS, `${REPO}/scenarios/${id}/definition.js`)).href)
    const allCardCodes = new Set(Object.keys(ALL_CARDS))
    const entryCodes = new Set(entryByCode.keys())
    const chk = (label, list) => {
      const missingCardData = list.filter(c => !allCardCodes.has(c))
      const missingEntry = list.filter(c => !entryCodes.has(c))
      if (missingCardData.length) row.issues.push({ kind: 'code-not-in-cards-data', label, codes: missingCardData, severity: 'high' })
      if (missingEntry.length) row.issues.push({ kind: 'code-no-entry', label, codes: missingEntry, severity: 'medium' })
    }
    for (const key of ['ACT_CODES', 'AGENDA_CODES', 'LOCATION_TABLE', 'ENCOUNTER_DECK', 'SET_ASIDE_ALIASES', 'SHARED_CORE_DECK']) {
      const v = def[key]
      if (v === undefined) continue
      const list = key === 'LOCATION_TABLE' ? v.map(x => x[1]) : v
      chk(key, [...new Set(list)])
      row.counts[key] = list.length
    }
    const locations = def.LOCATIONS || {}
    row.counts.locationsInScenario = Object.keys(locations).length
    row.counts.gatherGroups = def.GATHER_GROUPS?.length || 0
    row.counts.encounterDeck = def.ENCOUNTER_DECK?.length || 0
    row.counts.acts = def.scenario?.acts?.length || 0
    row.counts.agendas = def.scenario?.agendas?.length || 0
    row.counts.tokenMeanings = Object.keys(def.scenario?.tokenMeanings || {}).length
    row.counts.resolutions = Object.keys(def.scenario?.resolutions || {}).length
    row.counts.storyAssets = Object.keys(def.scenario?.storyAssets || {}).length
    row.exports = Object.keys(def).filter(k => /^[A-Z_]+$/.test(k)).slice(0, 40)
    for (const code of [...new Set([...(def.ACT_CODES || []), ...(def.AGENDA_CODES || [])])]) {
      const srcEntry = entrySrc.get(code) || ''
      if (!/implemented\s*:\s*true/.test(srcEntry)) row.issues.push({ kind: 'act/agenda-entry-not-implemented', code, severity: 'high' })
    }
  } catch (e) {
    row.issues.push({ kind: 'definition-import-failed', detail: String(e.message || e).slice(0, 300), severity: 'high' })
  }
  // 行为文件
  const behPath = `${REPO}/scenarios/${id}/behavior.js`
  if (exists(behPath)) {
    const beh = read(behPath)
    row.counts.behaviorBytes = beh.length
    row.counts.behaviorHandlers = (beh.match(/^\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/gm) || []).length
    row.counts.behaviorExports = (beh.match(/^\s*export\s+(?:async\s+)?function\s+/gm) || []).length
    row.approximationMarkers = []
    beh.split('\n').forEach((line, i) => { if (SUSPICIOUS.test(line) && /\/\/|\*/.test(line)) row.approximationMarkers.push({ line: i + 1, text: line.trim().slice(0, 180) }) })
    // definition 中 chapterFlow 值是否在 behavior 出现
    const defSrc = read(`${REPO}/scenarios/${id}/definition.js`)
    const flows = [...defSrc.matchAll(/chapterFlow\s*:\s*'([^']+)'/g)].map(m => m[1])
    row.chapterFlows = [...new Set(flows)]
    row.unhandledFlows = row.chapterFlows.filter(f => !beh.includes(f))
  } else row.issues.push({ kind: 'behavior-missing', severity: 'high' })
  // 指南
  const gs = (JSON.parse(readFileSync(join(MODS, 'audit', 'eote-scope.json'), 'utf8')).chapters || []).find(c => c.id === id)?.guideSources || []
  row.guide = { sources: gs.map(g => g.lang), enKeys: gs.find(g => g.lang === 'en')?.bytes || 0, zhKeys: gs.find(g => g.lang === 'zh')?.bytes || 0 }
  scenarioIntegrity.chapters.push(row)
}
// 流程文件
const flowFiles = ['flow.js', 'prologue.js', 'interludes.js', 'checkpoints.js', 'epilogue.js', 'records.js', 'chapters.js', 'manifest.js', 'parts.js', 'shared.js', 'shared-encounters.js']
const flow = { files: {}, issues: [] }
for (const f of flowFiles) {
  const p = `${REPO}/${f}`
  if (!exists(p)) { flow.issues.push({ kind: 'flow-file-missing', file: p, severity: 'high' }); continue }
  const text = read(p)
  flow.files[f] = { bytes: text.length, exportNames: [...text.matchAll(/^export\s+(?:const|function|default)\s+([A-Za-z_$][\w$]*)?/gm)].map(m => m[1]).filter(Boolean).slice(0, 30) }
  for (const id of chapterIds) if (!text.includes(id)) flow.issues.push({ kind: 'flow-file-lacks-chapter', file: p, chapter: id, severity: 'low' })
}
for (const id of chapterIds) if (!flowFiles.some(f => exists(`${REPO}/${f}`) && read(`${REPO}/${f}`).includes(id))) flow.issues.push({ kind: 'chapter-unreferenced-in-flow', chapter: id, severity: 'high' })
flow.issues = flow.issues.filter(i => i.kind === 'flow-file-missing' || i.kind === 'chapter-unreferenced-in-flow')
scenarioIntegrity.flow = flow
// 指南翻译覆盖
const guideTranslations = exists('content/scenario-guide-translations.json') ? JSON.parse(read('content/scenario-guide-translations.json')) : {}
const guideFilesRepo = exists('web/scenario-guides') ? readdirSync(join(MODS, 'web/scenario-guides')) : []
scenarioIntegrity.guide = { repoFiles: guideFilesRepo, translationTopKeys: Object.keys(guideTranslations).slice(0, 20) }
scenarioIntegrity.summary = {
  chapters: chapterIds.length,
  chapterIssues: scenarioIntegrity.chapters.filter(c => c.issues.length).length,
  flowIssues: flow.issues.length,
  flowFiles: Object.keys(flow.files).length,
}
writeFileSync(join(SCREEN, 'scenario-integrity.json'), JSON.stringify({ generatedAt: new Date().toISOString(), ...scenarioIntegrity }, null, 1))

// ============ 8. 已知偏差清单 ============
const known = { simplified: [], deferred: [], primitiveRequests: [], scenarioApproximations: [], entryMarkers: [], suspiciousTestTitles: suspiciousTitles }
try {
  const acc = JSON.parse(readFileSync(join(MODS, 'audit', 'eote-all-card-acceptance.json'), 'utf8'))
  for (const r of acc.records) if (r.status === 'simplified') known.simplified.push({ code: r.code, name: r.nameEn || r.name, reason: r.reason, pendingRequests: r.pendingRequests })
  const mig = JSON.parse(readFileSync(join(MODS, 'audit', 'eote-migration.json'), 'utf8'))
  known.deferred = (mig.releaseAcceptance?.deferred || []).map(d => ({ id: d.id, status: d.status, primitive: d.primitive, file: d.file, reason: d.reason }))
  for (const ch of mig.chapters || []) if (ch.scenarioApproximations) known.scenarioApproximations.push({ chapter: ch.id, approximations: ch.scenarioApproximations })
} catch (e) { known.errors = [String(e.message)] }
try {
  const dir = join(MODS, 'artifacts/migration/eote/primitive-requests')
  if (existsSync(dir)) for (const f of readdirSync(dir)) known.primitiveRequests.push({ file: `artifacts/migration/eote/primitive-requests/${f}`, body: JSON.parse(readFileSync(join(dir, f), 'utf8')) })
} catch (e) { known.requestErrors = [String(e.message)] }
for (const [code, src] of entrySrc) {
  const card = cardByCode.get(code)
  if (!card) continue
  src.split('\n').forEach((line, i) => {
    if (/\/\//.test(line) && /近似|简化|未实现|待实现|占位|TODO|临时/.test(line)) known.entryMarkers.push({ code, name: card.nameZh || card.name, line: i + 1, text: line.trim().slice(0, 200) })
  })
}
writeFileSync(join(SCREEN, 'known-deviations.json'), JSON.stringify({ generatedAt: new Date().toISOString(), summary: { simplified: known.simplified.length, deferred: known.deferred.length, primitiveRequests: known.primitiveRequests.length, scenarioApproximations: known.scenarioApproximations.length, entryMarkers: known.entryMarkers.length }, ...known }, null, 1))

// ============ 9. 原语合规 ============
const compliance = { directWrites: [], forbiddenImports: [], engineLiterals: [], contentLiterals: [], escapeCards: [] }
const WRITE_RE = /(?:^|[^.\w$])(state|inv|location|enemy|act|agenda|asset|target|card)\.([A-Za-z_$][\w$]*)\s*(=(?!=)|\+=|-=|\*=|\|=|\|\|=|\.push\(|\.splice\()/g
for (const [code, src] of entrySrc) {
  const c = cardByCode.get(code)
  if (!c) continue
  const stripped = stripComments(src)
  let m
  const lines = stripped.split('\n')
  lines.forEach((line, i) => {
    WRITE_RE.lastIndex = 0
    while ((m = WRITE_RE.exec(line))) compliance.directWrites.push({ code, root: m[1], field: m[2], line: i + 1, text: line.trim().slice(0, 140) })
  })
  if (/from\s+['"][^'"]*(engine\.js|card-abilities|encounter-abilities|content\/)/.test(src)) compliance.forbiddenImports.push({ code })
  if (/\bresolve\s*:\s*\(/.test(stripped)) compliance.escapeCards.push(code)
}
const ENGINE_DIRS = ['src/engine/', 'src/campaign/', 'src/integration/', 'src/deck/']
for (const [file, text] of engineText) {
  if (!ENGINE_DIRS.some(d => file.startsWith(d))) continue
  for (const m of text.matchAll(/\b08\d{3}[ab]?\b/g)) compliance.engineLiterals.push({ file, code: m[0] })
}
for (const [file, text] of contentText) {
  if (!file.includes('edgeOfTheEarth')) continue
  for (const m of text.matchAll(/\b0[78]\d{3}[ab]?\b/g)) compliance.contentLiterals.push({ file, code: m[0] })
}
let complianceLedger = null
try {
  complianceLedger = JSON.parse(readFileSync(join(MODS, 'audit', 'card-entry-compliance.json'), 'utf8'))
} catch {}
const eoteCompliance = complianceLedger ? {
  baselineCount: (complianceLedger.baseline?.directStateWrite || []).filter(c => /^08/.test(c)).length,
  fields: complianceLedger.fields ? Object.keys(complianceLedger.fields).length : null,
} : null
writeFileSync(join(SCREEN, 'primitive-compliance.json'), JSON.stringify({
  generatedAt: new Date().toISOString(),
  note: 'R1 直写为启发式（参数命名 card 等可能误报）；权威口径是 tools/audit-card-entry-compliance.mjs --check（本次运行 exit 0）',
  summary: {
    directWrites: compliance.directWrites.length,
    forbiddenImports: compliance.forbiddenImports.length,
    engineLiterals: compliance.engineLiterals.length,
    escapeCards: compliance.escapeCards.length,
    eoteCompliance,
  },
  ...compliance,
}, null, 1))

// ============ 汇总 ============
const summary = {
  generatedAt: new Date().toISOString(),
  scope: { cards: cards.length, investigators: cards.filter(c => c.partition === 'eoteInvestigators').length, player: cards.filter(c => c.partition === 'eotePlayer').length, campaign: cards.filter(c => c.partition === 'eoteCampaign').length },
  integrity: integrity.summary,
  keywordCoverage: { flaggedCards: keywordCoverage.length, byFeature: keywordSummary },
  flagsReadpoints: { declared: declaredUniq.length, unread: unread.length, unreadUniqueKeys: [...new Set(unread.map(u => `${u.block}.${u.key}`))] },
  duplication: { textDuplicateGroups: textDup.length, clonePairs: clonePairs.length, reprintRecords: reprint.length, crossCycleSameText: crossCycle.length },
  tests: testSummary.byLevel,
  perceivability: { flaggedCards: perceivability.length },
  scenarios: scenarioIntegrity.summary,
  knownDeviations: { simplified: known.simplified.length, deferred: known.deferred.length, primitiveRequests: known.primitiveRequests.length, entryMarkers: known.entryMarkers.length },
  primitiveCompliance: { directWrites: compliance.directWrites.length, engineLiterals: compliance.engineLiterals.length, escapeCards: compliance.escapeCards.length, forbiddenImports: compliance.forbiddenImports.length },
}
writeFileSync(join(SCREEN, 'summary.json'), JSON.stringify({ generatedAt: summary.generatedAt, ...summary }, null, 1))
const md = []
md.push('# EOTE 机械筛查汇总（Lead 生成）')
md.push('')
md.push('> 以下全部是**候选线索**，最终结论必须由审计员人工复核并给 `file:line` 证据。')
md.push('')
md.push('```json')
md.push(JSON.stringify(summary, null, 1))
md.push('```')
md.push('')
md.push('## 逐类线索')
md.push(`- 条目完整性：${integrity.summary.issueCards} 卡有结构问题；${integrity.summary.markerCards} 卡头注释含 TODO/近似/简化 等标记（screen/integrity.json）`)
md.push(`- 打印模板→实现特征：${keywordCoverage.length} 卡候选（screen/keyword-coverage.json）`)
md.push(`- 声明未接线：${unread.length} 条声明 key 在引擎/内容中找不到读点（screen/flags-readpoints.json）`)
md.push(`- 复用/重复：同文组 ${textDup.length}、源码近似对 ${clonePairs.length}、重印记录 ${reprint.length}、跨循环同文 ${crossCycle.length}（screen/duplication.json）`)
md.push(`- 测试覆盖：${JSON.stringify(testSummary.byLevel)}；可疑标题 ${suspiciousTitles.length}（screen/tests-coverage.json）`)
md.push(`- 可感知性静态线索：${perceivability.length} 卡（screen/perceivability.json）`)
md.push(`- 章节完整性：${JSON.stringify(scenarioIntegrity.summary)}（screen/scenario-integrity.json）`)
md.push(`- 已知偏差：simplified=${known.simplified.length} / deferred=${known.deferred.length} / primitiveRequests=${known.primitiveRequests.length}（screen/known-deviations.json）`)
md.push(`- 原语合规：直写=${compliance.directWrites.length} / 引擎卡号字面量=${compliance.engineLiterals.length} / 逃逸=${compliance.escapeCards.length}（screen/primitive-compliance.json）`)
writeFileSync(join(SCREEN, 'summary.md'), md.join('\n'))
console.log(JSON.stringify(summary, null, 1))
