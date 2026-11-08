// EOTE 全量扫描：范围提取与审阅包生成（Lead 专用，只写 games/arkhamhorror/docs/edgeOfTheEarth/eote-scan）。
// 用法：node games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/tools/extract-scope.mjs
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, relative, basename, dirname } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..') // games/arkhamhorror/docs/edgeOfTheEarth/eote-scan
const MODS = join(OUT, '..', '..', '..')
const ROOT = MODS
const dirs = { scope: join(OUT, 'scope'), bundles: join(OUT, 'bundles'), chapters: join(OUT, 'chapter-bundles'), tools: join(OUT, 'tools'), screen: join(OUT, 'screen') }
for (const d of Object.values(dirs)) mkdirSync(d, { recursive: true })

const sha256 = text => createHash('sha256').update(text).digest('hex')

const readText = p => readFileSync(p, 'utf8')
const rel = p => relative(MODS, p).split('\\').join('/')

const { ALL_CARDS } = await import(pathToFileURL(join(MODS, 'src/cards/cards-data.js')).href)
const acceptance = JSON.parse(readText(join(MODS, 'audit/eote-all-card-acceptance.json')))
const recByCode = new Map(acceptance.records.map(r => [r.code, r]))

// ---- 索引：条目文件 ----
const entryIndex = new Map()
function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const f = join(dir, e.name)
    if (e.isDirectory()) walk(f, out)
    else if (e.name.endsWith('.js') && /^\d{5}[ab]?\.js$/.test(e.name)) out.push(f)
  }
  return out
}
for (const f of walk(join(MODS, 'src/cards/entries'))) entryIndex.set(basename(f, '.js'), { path: rel(f), kind: 'player' })
for (const f of walk(join(MODS, 'src/cards/encounter-entries'))) entryIndex.set(basename(f, '.js'), { path: rel(f), kind: 'encounter' })

// ---- 索引：测试 ----
const testFiles = readdirSync(join(MODS, 'tests')).filter(f => f.endsWith('.mjs')).map(f => join(MODS, 'tests', f))
const testIndex = {}      // code -> [{file, line, title}]
const testFileText = new Map()
const titleRe = /(?:^|\n)\s*(?:test|it)\(\s*['"`]([^'"`]+)['"`]/g
for (const f of testFiles) {
  const text = readText(f)
  testFileText.set(rel(f), text)
  const titles = []
  let m
  const re = new RegExp(titleRe.source, 'g')
  while ((m = re.exec(text))) titles.push({ title: m[1], line: text.slice(0, m.index).split('\n').length })
  for (const code of new Set(text.match(/\b0\d{4}[ab]?\b/g) || [])) {
    if (!testIndex[code]) testIndex[code] = []
    const hits = titles.filter(t => t.title.includes(code))
    testIndex[code].push({
      file: rel(f), codeMentions: (text.match(new RegExp(`\\b${code}\\b`, 'g')) || []).length,
      titles: hits.map(h => ({ title: h.title, line: h.line })),
    })
  }
}
// 名称命中（英文/中文名出现在测试标题中）
const allNames = []
for (const [code, card] of Object.entries(ALL_CARDS)) {
  if (!/^08\d{3}[ab]?$/.test(code)) continue
  for (const n of [card.nameEn, card.name, card.nameZh]) if (n && n.length > 1) allNames.push([code, n])
}

// ---- 章节映射（按 encounter-entries 目录）----
function groupOfEntryPath(p) {
  const m = /^src\/cards\/encounter-entries\/edgeOfTheEarth\/([^/]+)\//.exec(p || '')
  if (!m) return null
  return { top: m[1] }
}
const CHAPTER_DIRS = ['iceAndDeathPart1', 'iceAndDeathPart2', 'iceAndDeathPart3', 'fatalMirage', 'toTheForbiddenPeaks', 'cityOfTheElderThings', 'theHeartOfMadnessPart1', 'theHeartOfMadnessPart2']
const SHARED_GROUP_LABEL = {
  ice_and_death: 'shared:iceAndDeath', agents_of_the_unknown: 'shared:agentsOfTheUnknown', creatures_in_the_ice: 'shared:creaturesInTheIce',
  deadly_weather: 'shared:deadlyWeather', elder_things: 'shared:elderThings', expedition_team: 'shared:expeditionTeam',
  hazards_of_antarctica: 'shared:hazardsOfAntarctica', left_behind: 'shared:leftBehind', memorials_of_the_lost: 'shared:memorialsOfTheLost',
  miasma: 'shared:miasma', nameless_horrors: 'shared:namelessHorrors', penguins: 'shared:penguins', shoggoths: 'shared:shoggoths',
  silence_and_mystery: 'shared:silenceAndMystery', tekelili: 'shared:tekelili', the_heart_of_madness: 'shared:theHeartOfMadness',
}

// ---- 生成卡片记录 ----
const cards = []
for (const rec of acceptance.records) {
  const code = rec.code
  const card = ALL_CARDS[code] || {}
  const entry = entryIndex.get(code) || null
  const range = Number(code.slice(0, 5))
  let area, chapter = null, group = null, module = null
  if (code <= '08133') {
    area = range <= 8006 ? 'investigators' : 'player'
  } else {
    area = 'campaign'
  }
  if (entry && entry.kind === 'encounter') {
    const g = groupOfEntryPath(entry.path)
    if (g) {
      if (CHAPTER_DIRS.includes(g.top)) { chapter = g.top; module = 'chapter' }
      else { group = SHARED_GROUP_LABEL[g.top] || `shared:${g.top}`; module = 'shared' }
    }
  }
  if (area === 'campaign' && !module) {
    // 无条目文件或聚合入口：按卡号区间兜底
    if (range <= 8548) { chapter = null; group = 'shared:iceAndDeath' }
    else if (range <= 8595) chapter = 'fatalMirage'
    else if (range <= 8620) chapter = 'toTheForbiddenPeaks'
    else if (range <= 8647) chapter = 'cityOfTheElderThings'
    else if (range <= 8658) group = 'shared:theHeartOfMadness'
    else if (range <= 8670) chapter = 'theHeartOfMadnessPart1'
    else if (range <= 8686) chapter = 'theHeartOfMadnessPart2'
    else if (range <= 8713) group = 'shared:other'
    else if (range <= 8722) group = 'shared:expeditionTeam'
    else if (range <= 8729) group = 'shared:tekelili'
    else group = 'shared:memorialsOfTheLost'
  }
  const tests = (testIndex[code] || []).slice()
  const nameHits = []
  for (const [c, n] of allNames) {
    if (c !== code) continue
    for (const [file, text] of testFileText) {
      if (text.includes(n)) nameHits.push({ file, name: n })
    }
  }
  const bundleName = `${code}.md`
  cards.push({
    code, partition: rec.partition, type: rec.type, status: rec.status, reason: rec.reason,
    name: card.name || rec.name, nameEn: card.nameEn || card.name || rec.nameEn, nameZh: card.nameZh || rec.name,
    originalCode: card.originalCode || code, doubleSided: !!card.doubleSided, pack: card.pack,
    klass: card.klass || null, factionName: card.factionName || null, traits: card.traits || [], traitsZh: card.traitsZh || [],
    xp: card.xp ?? null, permanent: !!card.permanent, quantity: card.quantity || 1,
    encounterCode: card.encounterCode || null,
    text: card.text || '', textZh: card.textZh || '', backText: card.backText || '', backTextZh: card.backTextZh || '',
    entryPath: entry?.path || rec.entry?.file || null, entryKind: entry?.kind || null,
    entrySha256: entry ? sha256(readText(join(MODS, entry.path))) : null,
    module, chapter, group, bundle: `games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/bundles/${bundleName}`,
    tests: { files: tests.map(t => t.file), titles: tests.flatMap(t => t.titles.map(x => ({ ...x, file: t.file }))), nameHits: nameHits.slice(0, 6) },
    cardData: card,
  })
}

// ---- 分片（shards）----
const byCode = new Map(cards.map(c => [c.code, c]))
const rangeCodes = (a, b) => cards.filter(c => c.partition === 'eoteCampaign' && c.code >= a && c.code <= b).map(c => c.code)
const firsts = {}
const shards = {
  'inv-auditor': { title: '调查员与专属依赖', codes: cards.filter(c => c.partition === 'eoteInvestigators').map(c => c.code) },
  'player-auditor-a': { title: '玩家卡 M2-1+M2-2', codes: cards.filter(c => c.partition === 'eotePlayer' && c.code >= '08019' && c.code <= '08078').map(c => c.code) },
  'player-auditor-b': { title: '玩家卡 M2-3+M2-4', codes: cards.filter(c => c.partition === 'eotePlayer' && c.code >= '08079').map(c => c.code) },
  'campaign-auditor-a': { title: '战役卡：亡命冰原 I–III + 冰原共享组', codes: [...rangeCodes('08501', '08548')] },
  'campaign-auditor-b': { title: '战役卡：致命幻景（含 28 关联面）', codes: [...rangeCodes('08549', '08595')] },
  'campaign-auditor-c': { title: '战役卡：失落之峰 + 古者之城', codes: [...rangeCodes('08596', '08647')] },
  'campaign-auditor-d': { title: '战役卡：疯狂之心 I–II + 心之共享组 + 其他共享组/纪念碑/远征队/Tekeli-li', codes: [...rangeCodes('08648', '08738')] },
}
// 校验分片并集 = 战役卡全量
const campAll = cards.filter(c => c.partition === 'eoteCampaign').map(c => c.code).sort()
const campShard = Object.entries(shards).filter(([k]) => k.startsWith('campaign')).flatMap(([, s]) => s.codes).sort()
const dupCodes = campShard.filter((c, i) => campShard.indexOf(c) !== i)
const missingCamp = campAll.filter(c => !campShard.includes(c))
const extraCamp = campShard.filter(c => !campAll.includes(c))

// ---- 章节记录 ----
const scopeJson = JSON.parse(readText(join(MODS, 'audit/eote-scope.json')))
const chapters = (scopeJson.chapters || []).map(ch => ({
  id: ch.id, name: ch.name, nameEn: ch.nameEn, referenceCode: ch.referenceCode, part: ch.part,
  encounterCode: ch.encounterCode, ownGroup: ch.ownGroup, gatherSets: ch.gatherSets,
  guideSources: ch.guideSources, guideKeyCounts: ch.guideKeyCounts,
  files: {
    definition: `content/campaigns/edgeOfTheEarth/scenarios/${ch.id}/definition.js`,
    behavior: `content/campaigns/edgeOfTheEarth/scenarios/${ch.id}/behavior.js`,
    chaos: `content/campaigns/edgeOfTheEarth/scenarios/${ch.id}/chaos.js`,
    index: `content/campaigns/edgeOfTheEarth/scenarios/${ch.id}/index.js`,
    layout: `content/campaigns/edgeOfTheEarth/scenarios/${ch.id}/layout.js`,
    texts: `content/campaigns/edgeOfTheEarth/scenarios/${ch.id}/texts.js`,
  },
  tests: readdirSync(join(MODS, 'tests')).filter(f => f.includes('eote-scenario-') && f.includes(ch.id)).map(f => `tests/${f}`),
}))
const campaignFlowFiles = ['flow.js', 'prologue.js', 'interludes.js', 'checkpoints.js', 'epilogue.js', 'records.js', 'chapters.js', 'manifest.js', 'parts.js', 'shared.js', 'shared-encounters.js', 'story-access.js', 'card-data.js', 'keywords.js', 'investigator-data.js']
  .map(f => `content/campaigns/edgeOfTheEarth/${f}`).filter(p => existsSync(join(MODS, p)))

// ---- 统计 ----
const stats = {
  generatedAt: new Date().toISOString(),
  totals: {
    records: cards.length,
    partitions: Object.fromEntries(['eoteInvestigators', 'eotePlayer', 'eoteCampaign'].map(p => [p, cards.filter(c => c.partition === p).length])),
    types: cards.reduce((a, c) => ((a[c.type] = (a[c.type] || 0) + 1), a), {}),
    statuses: cards.reduce((a, c) => ((a[c.status] = (a[c.status] || 0) + 1), a), {}),
    withEntry: cards.filter(c => c.entryPath).length,
    withoutEntry: cards.filter(c => !c.entryPath).map(c => c.code),
    entriesMissingFile: cards.filter(c => c.entryPath && !existsSync(join(MODS, c.entryPath))).map(c => ({ code: c.code, path: c.entryPath })),
    testCovered: cards.filter(c => c.tests.files.length > 0).length,
    testUncovered: cards.filter(c => c.tests.files.length === 0).map(c => c.code),
  },
  shards: Object.fromEntries(Object.entries(shards).map(([k, v]) => [k, { title: v.title, count: v.codes.length }])),
  campaignShardCheck: { dupCodes, missingCamp, extraCamp, mainCards: campAll.length, shardTotal: campShard.length },
  chapters: chapters.map(c => ({ id: c.id, nameEn: c.nameEn, codes: cards.filter(x => x.chapter === c.id).map(x => x.code).length })),
  sharedGroups: cards.filter(c => c.partition === 'eoteCampaign' && c.group).reduce((a, c) => ((a[c.group] = (a[c.group] || 0) + 1), a), {}),
  campaignFlowFiles,
}

writeFileSync(join(dirs.scope, 'cards.json'), JSON.stringify({ generatedAt: stats.generatedAt, cards }, null, 1))
writeFileSync(join(dirs.scope, 'chapters.json'), JSON.stringify({ chapters, campaignFlowFiles }, null, 1))
writeFileSync(join(dirs.scope, 'shards.json'), JSON.stringify(shards, null, 1))
writeFileSync(join(dirs.scope, 'stats.json'), JSON.stringify(stats, null, 1))
writeFileSync(join(dirs.scope, 'tests-index.json'), JSON.stringify(testIndex, null, 1))

// ---- 卡片审阅包 ----
const extraKeys = ['cost', 'clues', 'shroud', 'health', 'damage', 'horror', 'enemyDamage', 'enemyHorror', 'victory', 'doom', 'stage', 'quantity', 'encounterCode', 'subname', 'subnameZh', 'skillWillpower', 'skillIntellect', 'skillCombat', 'skillAgility', 'resourceCost']
for (const c of cards) {
  const entrySrc = c.entryPath && existsSync(join(MODS, c.entryPath)) ? readText(join(MODS, c.entryPath)) : '（无条目文件：no-behavior / 未实现，见 status 与 reason）'
  const extra = {}
  for (const k of extraKeys) if (c.cardData[k] !== undefined && c.cardData[k] !== '') extra[k] = c.cardData[k]
  const lines = []
  lines.push(`# ${c.code} ${c.nameZh || ''} / ${c.nameEn || c.name || ''}`)
  lines.push('')
  lines.push(`- partition: ${c.partition} | type: ${c.type} | status(账本): ${c.status}`)
  lines.push(`- pack: ${c.pack || ''} | klass: ${c.klass || c.factionName || ''} | traits: ${(c.traits || []).join(',')} | xp: ${c.xp} | quantity: ${c.quantity}`)
  if (c.doubleSided) lines.push(`- doubleSided: true | originalCode: ${c.originalCode}`)
  if (c.reason) lines.push(`- 账本 reason: ${c.reason}`)
  lines.push(`- 归属: ${c.chapter ? '章节 ' + c.chapter : c.group || '-'}`)
  lines.push(`- 条目文件: ${c.entryPath || '（无）'}`)
  lines.push('')
  lines.push('## 卡面文本（英文）')
  lines.push('```')
  lines.push(c.text || '（空）')
  lines.push('```')
  lines.push('## 卡面文本（中文）')
  lines.push('```')
  lines.push(c.textZh || '（空）')
  lines.push('```')
  if (c.backText) { lines.push('## 背面（英文）'); lines.push('```'); lines.push(c.backText); lines.push('```') }
  if (c.backTextZh) { lines.push('## 背面（中文）'); lines.push('```'); lines.push(c.backTextZh); lines.push('```') }
  if (Object.keys(extra).length) { lines.push('## 卡面数值字段'); lines.push('```json'); lines.push(JSON.stringify(extra, null, 1)); lines.push('```') }
  lines.push('')
  lines.push('## 条目源码')
  lines.push('```js')
  lines.push(entrySrc)
  lines.push('```')
  lines.push('')
  lines.push('## 相关测试')
  if (!c.tests.files.length) lines.push('（测试未按卡号/名称命中：需人工确认覆盖）')
  for (const t of c.tests.files) {
    const titles = c.tests.titles.filter(x => x.file === t)
    lines.push(`- ${t}` + (titles.length ? '：' + titles.map(x => `L${x.line} ${x.title}`).join('；') : ''))
  }
  if (c.tests.nameHits?.length) lines.push('- 名称命中: ' + c.tests.nameHits.map(h => `${h.file}（${h.name}）`).join('；'))
  writeFileSync(join(dirs.bundles, `${c.code}.md`), lines.join('\n'))
}

// ---- 章节审阅包 ----
const guidePath = (lang, file) => join('..', '..', '..', '参考资源', 'ArkhamHorror-main', 'frontend', 'src', 'locales', lang, 'edgeOfTheEarth', 'scenarios', file)
for (const ch of chapters) {
  const out = []
  out.push(`# 章节 ${ch.id} · ${ch.nameEn} · 参考卡 ${ch.referenceCode}`)
  out.push('')
  out.push('## 文件清单')
  for (const [k, p] of Object.entries(ch.files)) if (existsSync(join(MODS, p))) out.push(`- ${k}: ${p} (${statSync(join(MODS, p)).size}B)`)
  out.push('')
  out.push('## 章节卡号')
  const cc = cards.filter(c => c.chapter === ch.id).map(c => c.code)
  out.push(cc.join(' '))
  out.push('')
  out.push('## 指南来源')
  for (const g of ch.guideSources || []) out.push(`- ${g.lang}: ${g.path} (${g.bytes}B, keys=${ch.guideKeyCounts?.[g.lang]})`)
  out.push('')
  out.push('## 相关测试')
  for (const t of ch.tests) out.push(`- ${t}`)
  for (const f of ch.files && Object.values(ch.files) || []) {
    if (!existsSync(join(MODS, f))) continue
    const base = basename(f)
    if (!['definition.js', 'behavior.js', 'chaos.js'].includes(base)) continue
    out.push('')
    out.push(`## ${f}`)
    out.push('```js')
    out.push(readText(join(MODS, f)))
    out.push('```')
  }
  writeFileSync(join(dirs.chapters, `${ch.id}.md`), out.join('\n'))
}

// ---- 复查清单 ----
const consoleLines = []
consoleLines.push(`cards=${cards.length} partitions=${JSON.stringify(stats.totals.partitions)}`)
consoleLines.push(`withEntry=${stats.totals.withEntry} withoutEntry=${JSON.stringify(stats.totals.withoutEntry)}`)
consoleLines.push(`testUncovered=${JSON.stringify(stats.totals.testUncovered)}`)
consoleLines.push(`campaignShardCheck=${JSON.stringify(stats.campaignShardCheck)}`)
consoleLines.push(`shards=${JSON.stringify(stats.shards)}`)
consoleLines.push(`chapters=${JSON.stringify(stats.chapters)}`)
writeFileSync(join(dirs.scope, 'extract-report.txt'), consoleLines.join('\n'))
console.log(consoleLines.join('\n'))
