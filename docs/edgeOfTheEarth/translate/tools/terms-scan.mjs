#!/usr/bin/env node
// terms-scan.mjs — 《地球边缘》(EOTE / 08 号段) 跨内容术语、专名、简繁用字、标点风格只读扫描器。
//
// 用法（在 Mod 根 games/arkhamhorror/ 下执行）：
//   node docs/edgeOfTheEarth/translate/tools/terms-scan.mjs            # 打印摘要
//   node docs/edgeOfTheEarth/translate/tools/terms-scan.mjs --json     # 打印完整 JSON
//   node docs/edgeOfTheEarth/translate/tools/terms-scan.mjs --write    # 写 terms/scan-report.json
//
// 设计约束：
//   · 只读：不写 games/arkhamhorror/{src,content,web,...} 任何既有文件；仅 --write 写本 area 产物。
//   · 不 spawn 子进程；直接 node 运行。
//   · 所有样本 location 由「在原始文件行里定位该条目的中文片段」得到，定位失败的行号不输出
//     （脚本会统计 unlocated 数量，保证不编造行号）。
//   · 参考资源（上游 ArkhamDB 简中/繁中卡面、参考工程 zh locale）只读用于对照，不计入观察语料层。
//
// 语料层（layer）：
//   cards   = src/cards/cards-data.js 的 08xxxx 中文字段
//   story   = content/campaigns/edgeOfTheEarth/story-text.js 中文正文（章节 sections + campaign + localeKeys）
//   guides  = web/scenario-guides/{8 份 EOTE}.json 的 locales.zh
//   rules   = web/eote-rules.js 的 23 条规则条目（标题 + 正文段落）
//   modules = 战役模块常量：keywords.js / records.js / shared-encounters.js / parts.js

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath, pathToFileURL } from 'node:url'

// ---------------------------------------------------------------------------
// 0. 路径与运行参数
// ---------------------------------------------------------------------------

const HERE = path.dirname(fileURLToPath(import.meta.url))
const MOD_ROOT = path.resolve(HERE, '../../../..') // tools -> translate -> edgeOfTheEarth -> docs -> Mod 根
const HALL_ROOT = path.resolve(MOD_ROOT, '../..')
const REF_ROOT = process.env.TERMS_REF_ROOT
  ? path.resolve(process.env.TERMS_REF_ROOT)
  : path.join(HALL_ROOT, '参考资源', 'ArkhamHorror-main')
const OUT_DIR = path.resolve(HERE, '../terms')

const ARG_LIST = process.argv.slice(2)
const ARGS = new Set(ARG_LIST)
const WRITE = ARGS.has('--write')
const JSON_ONLY = ARGS.has('--json')
const argValue = prefix => {
  const hit = ARG_LIST.find(a => a.startsWith(`${prefix}=`))
  return hit ? hit.slice(prefix.length + 1) : null
}
const QUERY = {
  term: argValue('--term'),
  contains: argValue('--contains'),
  names: ARGS.has('--names'),
  chars: ARGS.has('--chars'),
  punct: ARGS.has('--punct'),
  icons: ARGS.has('--icons'),
  keywords: ARGS.has('--keywords'),
  upstreamDiff: ARGS.has('--diff'),
  unlocated: ARGS.has('--unlocated'),
  english: ARGS.has('--english'),
  markers: ARGS.has('--markers'),
  leak: ARGS.has('--leak'),
  docs: ARGS.has('--docs'),
}
const HAS_QUERY = Object.values(QUERY).some(Boolean)

const modPath = rel => path.join(MOD_ROOT, rel)
const refPath = rel => path.join(REF_ROOT, rel)

const GUIDE_FILES = [
  'iceAndDeathPart1', 'iceAndDeathPart2', 'iceAndDeathPart3', 'fatalMirage',
  'toTheForbiddenPeaks', 'cityOfTheElderThings',
  'theHeartOfMadnessPart1', 'theHeartOfMadnessPart2',
].map(id => ({ id, rel: `web/scenario-guides/${id}.json` }))

const FILES = {
  cards: 'src/cards/cards-data.js',
  story: 'content/campaigns/edgeOfTheEarth/story-text.js',
  keywords: 'content/campaigns/edgeOfTheEarth/keywords.js',
  records: 'content/campaigns/edgeOfTheEarth/records.js',
  sharedEncounters: 'content/campaigns/edgeOfTheEarth/shared-encounters.js',
  parts: 'content/campaigns/edgeOfTheEarth/parts.js',
  rules: 'web/eote-rules.js',
}
const REF_FILES = {
  cardsZhCn: 'frontend/public/cards_zh-cn.json',
  cardsZhTw: 'frontend/public/cards_zh.json',
  cardsEn: 'frontend/public/cards_en.json',
  zhLabel: 'frontend/src/locales/zh/label.json',
  zhCards: 'frontend/src/locales/zh/cards.json',
  zhEoteBase: 'frontend/src/locales/zh/edgeOfTheEarth/base.json',
}
const ZH_EOTE_SCENARIO_FILES = [
  'iceAndDeath', 'fatalMirage', 'toTheForbiddenPeaks',
  'cityOfTheElderThings', 'theHeartOfMadness',
].map(name => `frontend/src/locales/zh/edgeOfTheEarth/scenarios/${name}.json`)

// ---------------------------------------------------------------------------
// 1. 通用工具
// ---------------------------------------------------------------------------

const CJK_RE = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/
const CJK_RUN_RE = /[\u4e00-\u9fff]{4,}/g
const normText = t => String(t ?? '').replace(/\r\n/g, '\n').trim()

const warnings = []
const warn = msg => { if (!warnings.includes(msg)) warnings.push(msg) }

function readText (abs) {
  return fs.readFileSync(abs, 'utf8')
}
function readJson (abs) {
  return JSON.parse(readText(abs))
}
function sha256 (abs) {
  return crypto.createHash('sha256').update(fs.readFileSync(abs)).digest('hex')
}
function rel (abs) {
  return path.relative(MOD_ROOT, abs).split(path.sep).join('/')
}

const inputRegistry = []
function registerInput (abs) {
  if (!fs.existsSync(abs)) { warn(`缺少输入：${abs}`); return }
  inputRegistry.push({ path: rel(abs), bytes: fs.statSync(abs).size, sha256: sha256(abs) })
}
function registerRef (abs) {
  if (!fs.existsSync(abs)) { warn(`缺少参考输入：${abs}`); return }
  inputRegistry.push({ path: `参考资源/ArkhamHorror-main/${path.relative(REF_ROOT, abs).split(path.sep).join('/')}`, bytes: fs.statSync(abs).size, sha256: sha256(abs) })
}

// 文件行缓存：样本 location 定位用。
const lineCache = new Map()
function linesOf (abs) {
  if (!lineCache.has(abs)) lineCache.set(abs, readText(abs).split('\n'))
  return lineCache.get(abs)
}
const locateCache = new Map()
/**
 * 在文件中定位一段中文文本所在行（1-based）。失败返回 0（不编造行号）。
 * 匹配策略：取文本中最长的若干连续汉字段做 needle，逐行 includes。
 */
function locateLine (abs, text) {
  const cacheKey = `${abs}\u0000${text}`
  if (locateCache.has(cacheKey)) return locateCache.get(cacheKey)
  const lines = linesOf(abs)
  const runs = String(text).match(/[\u4e00-\u9fff]+/g) || []
  const needles = []
  for (const run of runs) {
    if (run.length >= 6) needles.push(run.slice(0, 12))
    if (run.length >= 10) needles.push(run.slice(-12))
  }
  for (const run of runs) if (run.length >= 2 && needles.length < 6) needles.push(run.slice(0, 12))
  needles.sort((a, b) => b.length - a.length)
  for (const needle of needles) {
    const hit = lines.findIndex(line => line.includes(needle))
    if (hit >= 0) { const ln = hit + 1; locateCache.set(cacheKey, ln); return ln }
  }
  locateCache.set(cacheKey, 0)
  return 0
}
function locationOf (abs, text) {
  const ln = locateLine(abs, text)
  return ln ? `${rel(abs)}:${ln}` : `${rel(abs)}:(line-not-indexed)`
}

const countRe = (text, re) => {
  const g = re.global ? re : new RegExp(re.source, re.flags + 'g')
  g.lastIndex = 0
  let n = 0
  let m
  while ((m = g.exec(text)) !== null) { n++; if (m.index === g.lastIndex) g.lastIndex++ }
  return n
}
const snippetOf = (text, index, len) => {
  const start = Math.max(0, index - 14)
  const end = Math.min(text.length, index + len + 22)
  return text.slice(start, end).replace(/\n/g, '⏎')
}

// ---------------------------------------------------------------------------
// 2. 语料层（docs）：{ layer, file(绝对), pointer, text, line }
// ---------------------------------------------------------------------------

const docs = []
const docStats = {}
function bumpLayer (layer) {
  docStats[layer] ||= { docs: 0, chars: 0, cjkChars: 0, empty: 0 }
}
function addDoc (layer, absFile, pointer, rawText, opts = {}) {
  bumpLayer(layer)
  const text = normText(rawText)
  if (!text) { docStats[layer].empty++; return }
  // 只收中文语料：纯英文/纯符号条目（漏翻回退）由 story/guides 审计负责，不计入术语语料。
  if (!CJK_RE.test(text)) {
    docStats[layer].nonZh = (docStats[layer].nonZh || 0) + 1
    return
  }
  const doc = { layer, file: absFile, pointer, text }
  if (opts.line) doc.line = opts.line
  docs.push(doc)
  docStats[layer].docs++
  docStats[layer].chars += text.length
  docStats[layer].cjkChars += (text.match(/[\u4e00-\u9fff]/g) || []).length
  return doc
}
function finalizeDocLines () {
  const unlocatedDocs = []
  for (const doc of docs) {
    if (doc.line) continue
    doc.line = locateLine(doc.file, doc.text)
    if (!doc.line) unlocatedDocs.push(doc)
  }
  return unlocatedDocs
}
const docLocation = doc => doc.line ? `${rel(doc.file)}:${doc.line}` : `${rel(doc.file)}:(line-not-indexed)`

const SKIP_STORY_KEYS = new Set([
  'id', 'kind', 'status', 'sectionCount', 'chinese', 'chineseGaps', 'sources', 'part',
  'partMapping', 'referenceCode', 'stepId', 'guideId', 'titleEn', 'nameEn', 'path',
  'missing', 'untranslated', 'enSourceHashes', 'zhSourceHashes', 'meta', 'note',
  'generator', 'generatedFrom', 'files', 'sourceKind', 'officialChinese',
])
function isGapNode (node) {
  if (!node || typeof node !== 'object') return false
  const status = String(node.status || node.missing || '')
  return status === 'missing' || status === 'untranslated'
}
function walkStoryNode (node, absFile, pointer) {
  if (node == null) return
  if (typeof node === 'string') { addDoc('story', absFile, pointer, node); return }
  if (Array.isArray(node)) {
    node.forEach((item, i) => walkStoryNode(item, absFile, `${pointer}[${i}]`))
    return
  }
  if (typeof node !== 'object') return
  if (isGapNode(node)) return
  for (const [key, child] of Object.entries(node)) {
    if (SKIP_STORY_KEYS.has(key)) continue
    if (key === 'entries' && Array.isArray(child)) {
      child.forEach((entry, i) => {
        if (!entry || typeof entry !== 'object') return
        if (isGapNode(entry)) return
        const value = entry.body ?? entry.text ?? ''
        if (entry.key) {
          // 记录标签 / 伙伴名 / 物资名 / 卡牌标签：只取中文值（status 为 missing/untranslated 的英文回退跳过）
          const status = String(entry.status || '')
          if (status === 'missing' || status === 'untranslated') return
          addDoc('story', absFile, `${pointer}.${entry.key}`, value)
        } else {
          walkStoryNode(entry, absFile, `${pointer}.entries[${i}]`)
        }
      })
      continue
    }
    if (typeof child === 'string' || (child && typeof child === 'object')) {
      walkStoryNode(child, absFile, `${pointer}.${key}`)
    }
  }
}

function loadCardsCorpus () {
  const abs = modPath(FILES.cards)
  registerInput(abs)
  const raw = readText(abs)
  const lines = raw.split('\n')
  const fieldLines = {} // code -> field -> line
  let curCode = null
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const codeMatch = /^\s*"code":\s*"([0-9]{5}[a-z]?)"/.exec(line)
    if (codeMatch) { curCode = codeMatch[1]; fieldLines[curCode] = fieldLines[curCode] || {}; continue }
    if (!curCode || !curCode.startsWith('08')) continue
    const fieldMatch = /^\s*"([A-Za-z0-9_]+)":/.exec(line)
    if (fieldMatch && !fieldLines[curCode][fieldMatch[1]]) fieldLines[curCode][fieldMatch[1]] = i + 1
  }
  return { raw, lines, fieldLines, ALL: null }
}

const CARD_ZH_FIELDS = [
  ['nameZh', 1], ['subnameZh', 1], ['textZh', 1], ['backTextZh', 1],
  ['flavorZh', 1], ['backFlavorZh', 1], ['customizationTextZh', 1], ['customizationChangeZh', 1],
  ['traitsZh', 1],
]

const cardsMod = await import(pathToFileURL(modPath(FILES.cards)).href)
const ALL_CARDS = cardsMod.ALL_CARDS
const codes08 = Object.keys(ALL_CARDS).filter(code => /^08/.test(code)).sort()
const cardsCorpus = loadCardsCorpus()

function textOfCards (card) {
  const parts = []
  for (const key of ['textZh', 'backTextZh']) if (card[key]) parts.push(card[key])
  return parts.join('\n')
}
function joinTraits (traitsZh) {
  if (!traitsZh) return ''
  return Array.isArray(traitsZh) ? traitsZh.join('、') : String(traitsZh)
}

for (const code of codes08) {
  const card = ALL_CARDS[code]
  const add = (field, value) => addDoc('cards', modPath(FILES.cards), `cards.${code}.${field}`, value, { line: cardsCorpus.fieldLines[code]?.[field] })
  add('nameZh', card.nameZh)
  add('subnameZh', card.subnameZh)
  add('traitsZh', joinTraits(card.traitsZh))
  if (card.textZh) addDoc('cards', modPath(FILES.cards), `cards.${code}.textZh`, card.textZh, { line: cardsCorpus.fieldLines[code]?.textZh })
  if (card.backTextZh) addDoc('cards', modPath(FILES.cards), `cards.${code}.backTextZh`, card.backTextZh, { line: cardsCorpus.fieldLines[code]?.backTextZh })
  add('flavorZh', card.flavorZh)
  add('backFlavorZh', card.backFlavorZh)
  add('customizationTextZh', card.customizationTextZh)
  add('customizationChangeZh', card.customizationChangeZh)
}

// --- story-text ---
const storyMod = await import(pathToFileURL(modPath(FILES.story)).href)
const STORY = storyMod.EOTE_STORY_TEXT
const storyAbs = modPath(FILES.story)
registerInput(storyAbs)
for (const [chapterId, chapter] of Object.entries(STORY.chapters || {})) {
  addDoc('story', storyAbs, `chapters.${chapterId}.title`, chapter.title)
  addDoc('story', storyAbs, `chapters.${chapterId}.heading`, chapter.heading)
  walkStoryNode(chapter.sections, storyAbs, `chapters.${chapterId}.sections`)
}
for (const [groupKey, group] of Object.entries(STORY.campaign || {})) {
  // campaign.checkpoints / campaign.interludes 与扁平的 checkpoint1–3 / interlude1–3 内容重复，跳过嵌套副本；
  // 章节的 intro/setup/resolutions 与 chapters.sections 重复，也只在 sections 里统计。
  if (groupKey === 'checkpoints' || groupKey === 'interludes') continue
  walkStoryNode(group, storyAbs, `campaign.${groupKey}`)
}
// localeKeys 是 chapters/campaign 的扁平键副本（用于运行时键查找），正文重复，术语统计不重复计入；
// 其缺译状态由 story/findings 的 localeKeys 审计单独核对。

// --- guides ---
for (const guide of GUIDE_FILES) {
  const abs = modPath(guide.rel)
  registerInput(abs)
  const json = readJson(abs)
  const zh = json.locales?.zh
  if (!zh) { warn(`guide ${guide.id} 无 locales.zh`); continue }
  const walk = (node, pointer) => {
    if (node == null) return
    if (typeof node === 'string') { addDoc('guides', abs, pointer, node); return }
    if (Array.isArray(node)) { node.forEach((item, i) => walk(item, `${pointer}[${i}]`)); return }
    if (typeof node !== 'object') return
    const gap = node.missing || node.untranslated
    if (gap) return
    if (typeof node.text === 'string') addDoc('guides', abs, `${pointer}.text`, node.text)
    if (typeof node.title === 'string') addDoc('guides', abs, `${pointer}.title`, node.title)
    if (typeof node.body === 'string') addDoc('guides', abs, `${pointer}.body`, node.body)
    for (const [key, child] of Object.entries(node)) {
      if (key === 'text' || key === 'title' || key === 'body') continue
      if (typeof child === 'object') walk(child, `${pointer}.${key}`)
    }
  }
  walk(zh, `locales.zh`)
}

// --- rules (web/eote-rules.js) ---
const rulesAbs = modPath(FILES.rules)
registerInput(rulesAbs)
const rulesMod = await import(pathToFileURL(rulesAbs).href)
const EOTE_RULES = rulesMod.EOTE_RULES || []
for (const entry of EOTE_RULES) {
  addDoc('rules', rulesAbs, `rules.${entry.id}.title`, entry.title)
  const body = Array.isArray(entry.body) ? entry.body : (entry.body ? [entry.body] : [])
  body.forEach((para, i) => addDoc('rules', rulesAbs, `rules.${entry.id}.body[${i}]`, para))
}

// ---------------------------------------------------------------------------
// 3. 战役模块（modules 层 + 结构化名称对照）
// ---------------------------------------------------------------------------

const kwMod = await import(pathToFileURL(modPath(FILES.keywords)).href)
const recMod = await import(pathToFileURL(modPath(FILES.records)).href)
const sharedMod = await import(pathToFileURL(modPath(FILES.sharedEncounters)).href)
const partsMod = await import(pathToFileURL(modPath(FILES.parts)).href)

for (const abs of [FILES.keywords, FILES.records, FILES.sharedEncounters, FILES.parts].map(modPath)) registerInput(abs)

const EOTE_KEYWORDS = kwMod.EOTE_KEYWORDS || []
for (const kw of EOTE_KEYWORDS) addDoc('modules', modPath(FILES.keywords), `keywords.${kw.id}.zh`, kw.zh)

const moduleNames = {
  partners: [], // {code, name, src}
  supplies: [],
  camps: [],
  scenarios: [],
}
for (const partner of recMod.PARTNERS || []) {
  addDoc('modules', modPath(FILES.records), `records.PARTNERS.${partner.code}.name`, partner.name)
  moduleNames.partners.push({ code: partner.code, en: partner.nameEn, zh: partner.name, src: `${FILES.records}#PARTNERS.${partner.code}` })
}
for (const supply of recMod.SUPPLIES || []) {
  addDoc('modules', modPath(FILES.records), `records.SUPPLIES.${supply.code}.label`, supply.label)
  moduleNames.supplies.push({ code: supply.code, key: supply.key, zh: supply.label, src: `${FILES.records}#SUPPLIES.${supply.code}` })
}
for (const [key, spec] of Object.entries(recMod.CAMP_SHELTER || {})) {
  addDoc('modules', modPath(FILES.records), `records.CAMP_SHELTER.${key}.label`, spec.label)
  moduleNames.camps.push({ key, code: spec.code, en: spec.labelEn, zh: spec.label, shelter: spec.shelter, src: `${FILES.records}#CAMP_SHELTER.${key}` })
}
for (const [code, label] of Object.entries(sharedMod.SUPPLY_LABELS || {})) {
  addDoc('modules', modPath(FILES.sharedEncounters), `sharedEncounters.SUPPLY_LABELS.${code}`, label)
}
for (const unit of partsMod.EOTE_SCENARIO_UNITS || []) {
  addDoc('modules', modPath(FILES.parts), `parts.EOTE_SCENARIO_UNITS.${unit.id}.name`, unit.name)
  moduleNames.scenarios.push({ id: unit.id, en: unit.nameEn, zh: unit.name, src: `${FILES.parts}#EOTE_SCENARIO_UNITS.${unit.id}` })
}
for (const pair of partsMod.EOTE_CHAPTER_PAIRS || []) {
  addDoc('modules', modPath(FILES.parts), `parts.EOTE_CHAPTER_PAIRS.${pair.chapter}.name`, pair.name)
}

const unlocatedDocList = finalizeDocLines()

// ---------------------------------------------------------------------------
// 4. 参考语料（不计入观察层，用于推荐译法与上游差异核对）
// ---------------------------------------------------------------------------

registerRef(refPath(REF_FILES.cardsZhCn))
registerRef(refPath(REF_FILES.cardsZhTw))
registerRef(refPath(REF_FILES.cardsEn))
registerRef(refPath(REF_FILES.zhLabel))
registerRef(refPath(REF_FILES.zhCards))
registerRef(refPath(REF_FILES.zhEoteBase))
ZH_EOTE_SCENARIO_FILES.forEach(f => registerRef(refPath(f)))

const refZhCn = readJson(refPath(REF_FILES.cardsZhCn))
const refZhTw = readJson(refPath(REF_FILES.cardsZhTw))
const refEn = readJson(refPath(REF_FILES.cardsEn))
const refZhCn08 = new Map(refZhCn.filter(c => /^08/.test(String(c.code))).map(c => [String(c.code), c]))
const refEn08 = new Map(refEn.filter(c => /^08/.test(String(c.code))).map(c => [String(c.code), c]))
const refLabel = readJson(refPath(REF_FILES.zhLabel))
const refCardsLocale = readJson(refPath(REF_FILES.zhCards))
const refZhEote = {
  base: readJson(refPath(REF_FILES.zhEoteBase)),
  scenarios: Object.fromEntries(ZH_EOTE_SCENARIO_FILES.map(f => [path.basename(f, '.json'), readJson(refPath(f))])),
}
function flattenObj (obj, prefix = '') {
  const out = []
  if (obj == null) return out
  if (Array.isArray(obj)) { obj.forEach((v, i) => out.push(...flattenObj(v, `${prefix}[${i}]`))); return out }
  if (typeof obj === 'object') { for (const [k, v] of Object.entries(obj)) out.push(...flattenObj(v, prefix ? `${prefix}.${k}` : k)); return out }
  out.push([prefix, String(obj)])
  return out
}
const refLabelFlat = flattenObj(refLabel)
const refCardsLabelFlat = flattenObj(refCardsLocale.label || {})
const refLabelMap = new Map(refLabelFlat)
const refCardsLabelMap = new Map(refCardsLabelFlat)

// ---------------------------------------------------------------------------
// 5. 术语矩阵
// ---------------------------------------------------------------------------

const T = (zh, re, status) => ({ zh, re: re || new RegExp(escapeRe(zh)), status })
function escapeRe (s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }

// variants: status = preferred | variant | error | note
const TERMS = [
  {
    id: 'doom', en: 'doom (token)', recommended: '毁灭标记', authority: 'upstream-zh-cn / 参考工程 label.placeDoom',
    variants: [T('毁灭标记', /毁灭标记/, 'preferred'), T('末日标记', /末日标记/, 'error'), T('厄运标记', /厄运标记/, 'error'), T('毁灭标记（doom）', /毁灭标记[（(]doom[）)]/i, 'error')],
  },
  {
    id: 'clue', en: 'clue', recommended: '线索', authority: 'upstream-zh-cn',
    variants: [T('线索', null, 'preferred'), T('线索标记', /线索标记/, 'error'), T('提示标记', /提示标记/, 'error')],
  },
  {
    id: 'horror', en: 'horror', recommended: '恐惧', authority: 'upstream-zh-cn（规则值）；恐怖仅可用于形容词/风格',
    variants: [T('恐惧', /恐惧/, 'preferred'), T('恐怖', /恐怖/, 'note')],
  },
  {
    id: 'damage', en: 'damage', recommended: '伤害', authority: 'upstream-zh-cn（「损伤」在上游是特性 Injury 的译名，不是 damage）',
    variants: [T('伤害', /伤害/, 'preferred')],
  },
  {
    id: 'asset', en: 'asset', recommended: '支援', authority: 'upstream-zh-cn（资产仅见 1 处上游 UI 文本）',
    variants: [T('支援', /支援/, 'preferred'), T('资产', /资产/, 'error')],
  },
  {
    id: 'event', en: 'event (card)', recommended: '事件', authority: 'upstream-zh-cn',
    variants: [T('事件', /事件/, 'preferred')],
  },
  {
    id: 'skill', en: 'skill (card/test)', recommended: '技能', authority: 'upstream-zh-cn（「技巧」是特性 Trick 的译名，不是 skill）',
    variants: [T('技能', /技能/, 'preferred')],
  },
  {
    id: 'treachery', en: 'treachery', recommended: '诡计', authority: 'upstream-zh-cn（「阴谋」仅作叙事用词，不是卡牌类型）',
    variants: [T('诡计', /诡计/, 'preferred'), T('阴谋', /阴谋/, 'note')],
  },
  {
    id: 'enemy', en: 'enemy', recommended: '敌人', authority: 'upstream-zh-cn（「敌军」只出现在固定流程名「敌军阶段」，与仓库 UI/规则书一致，不是 enemy 的替换译法）',
    variants: [T('敌人', /敌人/, 'preferred'), T('敌军阶段', /敌军阶段/, 'variant'), T('敌军', /敌军(?!阶段)/, 'error'), T('仇敌', /仇敌/, 'error')],
  },
  {
    id: 'location', en: 'location', recommended: '地点', authority: 'upstream-zh-cn',
    variants: [T('地点', /地点/, 'preferred'), T('场所', /场所/, 'error'), T('位置', /位置/, 'variant')],
  },
  {
    id: 'agenda', en: 'agenda', recommended: '密谋', authority: 'upstream-zh-cn',
    variants: [T('密谋', /密谋/, 'preferred'), T('议程', /议程/, 'error'), T('议程卡', /议程卡/, 'error')],
  },
  {
    id: 'act', en: 'act', recommended: '幕', authority: 'upstream-zh-cn',
    variants: [T('幕', /(?<!序|帷)幕(?!间|后|布|僚)/, 'preferred')],
  },
  {
    id: 'resolution', en: 'resolution (ending)', recommended: '结局', authority: 'upstream-zh-cn / guides.locales.zh.resolutions',
    variants: [T('结局', /结局/, 'preferred'), T('结果', /结果/, 'note'), T('结算', /结算/, 'note')],
  },
  {
    id: 'scenario', en: 'scenario', recommended: '规则文本「场景」；正式关卡术语「剧本」；叙事「冒险」（按语境分用，同一层内不混用）', authority: 'upstream-zh-cn：场景 41 / 剧本 47 / 冒险 18（08 段）',
    variants: [T('剧本', /剧本/, 'preferred'), T('场景', /场景/, 'variant'), T('冒险', /冒险/, 'note'), T('章节', /章节/, 'variant')],
  },
  {
    id: 'campaign', en: 'campaign', recommended: '战役', authority: 'upstream-zh-cn',
    variants: [T('战役', /战役/, 'preferred')],
  },
  {
    id: 'campaign-log', en: 'campaign log', recommended: '剧本日志', authority: 'upstream-zh-cn 卡面 33 次全部「剧本日志」；rules 层 12 次「战役日志」为规则书自造口径',
    variants: [T('剧本日志', /剧本日志/, 'preferred'), T('战役日志', /战役日志/, 'variant'), T('探险日志', /探险日志/, 'variant')],
  },
  {
    id: 'shelter', en: 'shelter (value)', recommended: '庇护值（数值）；叙事中「庇护所/避难所」指物理藏身处，不混用', authority: 'upstream-zh-cn（08 段 6 次「庇护值」；卡面地点另写作「庇护N」）',
    variants: [T('庇护值', /庇护值/, 'preferred'), T('庇护', /庇护(?!值|所)/, 'variant'), T('庇护所', /庇护所/, 'note'), T('避难所', /避难所/, 'note')],
  },
  {
    id: 'supplies', en: 'supplies', recommended: '按语境：卡面使用次数「补给」；战役资源「物资」；「已回收的补给品」为固定记录名', authority: 'upstream-zh-cn：物资 1 / 补给品 63 / 补给 275（08 段）',
    variants: [T('物资', /物资/, 'preferred'), T('补给品', /补给品/, 'variant'), T('补给', /补给(?!品)/, 'variant'), T('供应品', /供应品/, 'error')],
  },
  {
    id: 'partner', en: 'partner', recommended: '伙伴（关键词/规则文本）；叙事可用同伴，但同一段内不混用', authority: 'upstream-zh-cn：伙伴 20 / 同伴 6（08 段，同伴多用于叙事）',
    variants: [T('伙伴', /伙伴/, 'preferred'), T('同伴', /同伴/, 'note'), T('队友', /队友/, 'note')],
  },
  {
    id: 'expedition', en: 'expedition', recommended: '探险', authority: 'upstream-zh-cn',
    variants: [T('探险', /探险/, 'preferred'), T('远征', /远征/, 'error'), T('考察', /考察/, 'error')],
  },
  {
    id: 'frost', en: 'frost token', recommended: '寒霜标记', authority: 'web/eote-rules.js / keywords.js',
    variants: [T('寒霜标记', /寒霜标记/, 'preferred'), T('寒霜', /寒霜(?!标记)/, 'note'), T('霜冻', /霜冻/, 'error'), T('冰霜', /冰霜/, 'error')],
  },
  {
    id: 'key', en: 'key', recommended: '钥匙', authority: 'upstream-zh-cn',
    variants: [T('钥匙', /钥匙/, 'preferred'), T('锁匙', /锁匙/, 'error')],
  },
  {
    id: 'seal', en: 'seal', recommended: '封印', authority: 'upstream-zh-cn',
    variants: [T('封印', /封印/, 'preferred')],
  },
  {
    id: 'seal-token', en: 'seal token / seal symbol', recommended: '封印标记', authority: 'keywords.js / web/eote-rules.js',
    variants: [T('封印标记', /封印标记/, 'preferred'), T('封印符号', /封印符号/, 'variant')],
  },
  {
    id: 'token', en: 'token', recommended: '标记', authority: 'upstream-zh-cn',
    variants: [T('标记', /标记/, 'preferred'), T('指示物', /指示物/, 'error'), T('token', /\btoken\b/i, 'error')],
  },
  {
    id: 'investigator', en: 'investigator', recommended: '调查员', authority: 'upstream-zh-cn',
    variants: [T('调查员', /调查员/, 'preferred'), T('调查者', /调查者/, 'error')],
  },
  {
    id: 'weakness', en: 'weakness', recommended: '弱点', authority: 'upstream-zh-cn',
    variants: [T('弱点', /弱点/, 'preferred')],
  },
  {
    id: 'deck', en: 'deck / deck pile', recommended: '牌库（调查员牌库，卡面口径）；牌组（构筑界面用语，story/rules 层使用）；弃牌堆（discard pile）', authority: 'upstream-zh-cn：牌库 206 / 牌组 0 / 牌堆 6（08 段）',
    variants: [T('牌库', /牌库/, 'preferred'), T('牌组', /牌组/, 'variant'), T('牌堆', /(?<!弃)牌堆/, 'note'), T('弃牌堆', /弃牌堆/, 'note')],
  },
  {
    id: 'discard', en: 'discard pile', recommended: '弃牌堆', authority: 'upstream-zh-cn',
    variants: [T('弃牌堆', /弃牌堆/, 'preferred'), T('弃牌区', /弃牌区/, 'error'), T('弃牌堆区', /弃牌堆区/, 'error')],
  },
  {
    id: 'encounter-set', en: 'encounter set', recommended: '遭遇组', authority: 'upstream-zh-cn',
    variants: [T('遭遇组', /遭遇组/, 'preferred'), T('遭遇集', /遭遇集/, 'error'), T('遭遇组牌库', /遭遇组牌库/, 'error')],
  },
  {
    id: 'hunter', en: 'Hunter', recommended: '猎手', authority: 'upstream-zh-cn / keywords.js',
    variants: [T('猎手', /猎手/, 'preferred'), T('猎人', /猎人/, 'error')],
  },
  {
    id: 'aloof', en: 'Aloof', recommended: '冷漠', authority: 'upstream-zh-cn / keywords.js',
    variants: [T('冷漠', /冷漠/, 'preferred'), T('孤僻', /孤僻/, 'error'), T('冷淡', /冷淡/, 'error')],
  },
  {
    id: 'massive', en: 'Massive', recommended: '庞大', authority: 'upstream-zh-cn（Massive 对齐行 18/19「庞大。」；全库 庞大 94 / 巨大 26，后者多用于专名）',
    variants: [T('庞大', /庞大/, 'preferred'), T('巨大', /巨大(?!坡道)/, 'note')],
  },
  {
    id: 'retaliate', en: 'Retaliate', recommended: '反击', authority: 'upstream-zh-cn（08 段 11 次，无「报复」）',
    variants: [T('反击', /反击/, 'preferred'), T('报复', /报复/, 'error')],
  },
  {
    id: 'alert', en: 'Alert', recommended: '警戒', authority: 'upstream-zh-cn / keywords.js（「警惕」仅作叙事形容词）',
    variants: [T('警戒', /警戒/, 'preferred'), T('警觉', /警觉/, 'note'), T('警惕', /警惕/, 'note')],
  },
  {
    id: 'surge', en: 'Surge', recommended: '涌动', authority: 'upstream-zh-cn（08 段 8 次；「汹涌」仅作叙事形容词）',
    variants: [T('涌动', /涌动/, 'preferred'), T('涌现', /涌现/, 'note'), T('汹涌', /汹涌/, 'note')],
  },
  {
    id: 'peril', en: 'Peril', recommended: '险境', authority: 'upstream-zh-cn（08 段 5 次；全部卡面对齐行 56/56「险境」）',
    variants: [T('险境', /险境/, 'preferred'), T('险恶', /险恶/, 'note'), T('危险', /危险/, 'note')],
  },
  {
    id: 'revelation', en: 'Revelation', recommended: '显现', authority: 'upstream-zh-cn（08 段 52 次）',
    variants: [T('显现', /显现/, 'preferred'), T('显形', /显形/, 'note'), T('揭示', /揭示/, 'note')],
  },
  {
    id: 'parley', en: 'Parley', recommended: '谈判', authority: 'upstream-zh-cn / keywords.js',
    variants: [T('谈判', /谈判/, 'preferred'), T('交涉', /交涉/, 'error')],
  },
  {
    id: 'patrol', en: 'Patrol', recommended: '巡逻', authority: 'upstream-zh-cn',
    variants: [T('巡逻', /巡逻/, 'preferred'), T('巡守', /巡守/, 'error')],
  },
  {
    id: 'victory', en: 'Victory (keyword)', recommended: '胜利点（Victory X 关键词）；注意「胜利区」是 victory display，不同概念', authority: 'keywords.js；上游 08 段无印刷 Victory 关键词实例（39 次「胜利区」属 victory display）',
    variants: [T('胜利点', /胜利点/, 'preferred'), T('胜利区', /胜利区/, 'note'), T('胜利', /胜利(?!点|区)/, 'note')],
  },
  {
    id: 'elite', en: 'Elite', recommended: '精英', authority: 'upstream-zh-cn / keywords.js',
    variants: [T('精英', /精英/, 'preferred'), T('精锐', /精锐/, 'error')],
  },
  {
    id: 'hidden', en: 'Hidden', recommended: '隐藏', authority: 'upstream-zh-cn / keywords.js',
    variants: [T('隐藏', /隐藏/, 'preferred'), T('隐蔽', /隐蔽/, 'variant')],
  },
  {
    id: 'mirage', en: 'Mirage', recommended: '幻景', authority: 'upstream-zh-cn（致命幻景；「蜃景」仅作叙事描述）',
    variants: [T('幻景', /幻景/, 'preferred'), T('蜃景', /蜃景/, 'note'), T('海市蜃楼', /海市蜃楼/, 'note')],
  },
  {
    id: 'resolute', en: 'Resolute', recommended: '坚毅', authority: 'upstream-zh-cn / keywords.js（「坚决」仅作叙事形容词）',
    variants: [T('坚毅', /坚毅/, 'preferred'), T('坚决', /坚决/, 'note')],
  },
  {
    id: 'level', en: 'Level (altitude)', recommended: '高度（地点层级）；卡牌等级用「等级」，两者不同', authority: 'upstream-zh-cn 08596「高度」/ keywords.js「高度等级」；关键词扫描的 Level 模式会误命中牌库构建的「level 0」，属规则模式过宽',
    variants: [T('高度', /高度/, 'preferred'), T('层级', /层级/, 'variant'), T('等级', /等级/, 'note')],
  },
  {
    id: 'titanic', en: 'Titanic', recommended: '巨大坡道（卡面 08682–08685 专名）；规则书「泰坦坡道」需统一；trait 译名「巨型」待核', authority: 'upstream-zh-cn 卡名「巨大坡道」；web/eote-rules.js「泰坦坡道（巨型）」；keywords.js titanic=巨型',
    variants: [T('巨大坡道', /巨大坡道/, 'preferred'), T('泰坦坡道', /泰坦坡道/, 'variant'), T('巨型', /巨型/, 'note'), T('巨大', /巨大(?!坡道)/, 'note')],
  },
  {
    id: 'hazard', en: 'Hazard', recommended: '危险', authority: 'keywords.js hazard=危险；注意与 Peril 险境区分',
    variants: [T('危险', /危险/, 'preferred'), T('危害', /危害/, 'error')],
  },
  {
    id: 'eidolon', en: 'Eidolon', recommended: '幻灵', authority: 'upstream-zh-cn / keywords.js（「幻影」是敌人卡名 Phantasm/Unsealed Phantasm 的用字，不是 Eidolon）',
    variants: [T('幻灵', /幻灵/, 'preferred'), T('幻影', /幻影/, 'note')],
  },
  {
    id: 'ancient-one', en: 'Ancient One', recommended: '古神', authority: 'upstream-zh-cn / keywords.js',
    variants: [T('古神', /古神/, 'preferred'), T('上古者', /上古者/, 'error'), T('远古者', /远古者/, 'error')],
  },
  {
    id: 'possessed', en: 'Possessed', recommended: '附身', authority: 'upstream-zh-cn / keywords.js',
    variants: [T('附身', /附身/, 'preferred'), T('附体', /附体/, 'error')],
  },
  {
    id: 'broken', en: 'Broken', recommended: '破功', authority: 'upstream-zh-cn（08011b–08014b traitsZh）',
    variants: [T('破功', /破功/, 'preferred'), T('已破', /已破/, 'variant'), T('破坏', /破坏/, 'error')],
  },
  {
    id: 'unbroken', en: 'Unbroken', recommended: '运功', authority: 'upstream-zh-cn（08011a–08014a traitsZh）',
    variants: [T('运功', /运功/, 'preferred'), T('未破', /未破/, 'variant')],
  },
  {
    id: 'uncharted', en: 'Uncharted', recommended: '未勘之地', authority: 'story/guides（08 卡面无此词）',
    variants: [T('未勘之地', /未勘之地/, 'preferred'), T('未知之地', /未知之地/, 'error'), T('未探索之地', /未探索之地/, 'error')],
  },
  {
    id: 'chaos-token', en: 'chaos token', recommended: '混乱标记', authority: 'upstream-zh-cn / 规则书',
    variants: [T('混乱标记', /混乱标记/, 'preferred'), T('混沌标记', /混沌标记/, 'error'), T('混乱符号', /混乱符号/, 'variant')],
  },
  {
    id: 'chaos-bag', en: 'chaos bag', recommended: '混乱袋', authority: 'upstream-zh-cn',
    variants: [T('混乱袋', /混乱袋/, 'preferred'), T('混沌袋', /混沌袋/, 'error')],
  },
  {
    id: 'camp', en: 'camp', recommended: '营地', authority: 'upstream-zh-cn',
    variants: [T('营地', /营地/, 'preferred')],
  },
  {
    id: 'objective', en: 'Objective', recommended: '目标', authority: 'keywords.js / rulebook',
    variants: [T('目标', /目标/, 'preferred')],
  },
  {
    id: 'resign', en: 'Resign', recommended: '撤退', authority: 'keywords.js / rulebook',
    variants: [T('撤退', /撤退/, 'preferred'), T('退出', /退出/, 'variant')],
  },
  {
    id: 'expedition-trait', en: 'Expedition (trait)', recommended: '探险', authority: 'upstream-zh-cn',
    variants: [T('探险', /探险/, 'preferred')],
  },
  {
    id: 'tekelili', en: 'Tekeli-li', recommended: '忒咳哩-哩（卡名 08723–08729，无感叹号）', authority: 'upstream-zh-cn 08723–08729 卡名「忒咳哩-哩」；keywords.js 与规则书写「忒咳哩-哩！」，多出感叹号',
    variants: [
      T('忒咳哩-哩！', /忒咳哩-哩[！!]/, 'variant'),
      T('忒咳哩-哩', /忒咳哩-哩(?![！!])/, 'preferred'),
      T('忒克力力', /忒克力力/, 'error'),
      T('泰克利利', /泰克利利/, 'error'),
    ],
  },
  {
    id: 'ancient-things', en: 'Elder Things', recommended: '古老者', authority: 'upstream-zh-cn（Elder Things trait/名称）',
    variants: [T('古老者', /古老者/, 'preferred'), T('远古者', /远古者/, 'error'), T('上古者', /上古者/, 'error')],
  },
  {
    id: 'shoggoth', en: 'Shoggoth', recommended: '修格斯', authority: 'upstream-zh-cn',
    variants: [T('修格斯', /修格斯/, 'preferred'), T('索格斯', /索格斯/, 'error'), T('修格司', /修格司/, 'error')],
  },
  {
    id: 'nameless-madness', en: 'Nameless Madness', recommended: '无名疯狂', authority: 'upstream-zh-cn 08679 卡名「无名疯狂」；规则书（rules 层）用「无名狂魔」，需统一',
    variants: [T('无名疯狂', /无名疯狂/, 'preferred'), T('无名狂魔', /无名狂魔/, 'error')],
  },
  {
    id: 'miasma', en: 'miasma', recommended: '瘴气', authority: 'upstream-zh-cn',
    variants: [T('瘴气', /瘴气/, 'preferred'), T('毒瘴', /毒瘴/, 'error')],
  },
  {
    id: 'expedition-team', en: 'expedition team', recommended: '探险队', authority: 'upstream-zh-cn / rulebook',
    variants: [T('探险队', /探险队/, 'preferred'), T('考察队', /考察队/, 'error'), T('远征队', /远征队/, 'error')],
  },
  {
    id: 'recovered-supplies', en: 'Supplies Recovered', recommended: '已回收的补给品', authority: 'story 记录标签 / rulebook',
    variants: [
      T('已回收的补给品', /已回收的补给品/, 'preferred'),
      T('已回收的物资', /已回收的物资/, 'variant'),
      T('回收的补给品', /(?<!已)回收的补给品/, 'variant'),
    ],
  },
  {
    id: 'interlude', en: 'interlude', recommended: '幕间', authority: 'upstream-zh-cn / parts',
    variants: [T('幕间', /幕间/, 'preferred'), T('间幕', /间幕/, 'error')],
  },
  {
    id: 'checkpoint', en: 'checkpoint', recommended: '检查点', authority: 'upstream-zh-cn / parts',
    variants: [T('检查点', /检查点/, 'preferred')],
  },
  {
    id: 'victory-display', en: 'victory display', recommended: '胜利区', authority: 'upstream-zh-cn（08 段 39 次；与 Victory 关键词「胜利点」不同概念）',
    variants: [T('胜利区', /胜利区/, 'preferred'), T('胜利堆', /胜利堆/, 'error'), T('胜利展示区', /胜利展示区/, 'error')],
  },
  {
    id: 'enemy-phase', en: 'enemy phase', recommended: '敌军阶段', authority: '仓库 UI/规则书口径（web/locales/zh-CN*.js、web/rulebook-data.js）；上游卡面 132 次一致',
    variants: [T('敌军阶段', /敌军阶段/, 'preferred'), T('敌人阶段', /敌人阶段/, 'error')],
  },
  {
    id: 'trauma', en: 'trauma', recommended: '创伤', authority: 'upstream-zh-cn（08125/08627 等）',
    variants: [T('创伤', /创伤/, 'preferred'), T('心理创伤', /心理创伤/, 'note')],
  },
]

const LAYERS = ['cards', 'story', 'guides', 'rules', 'modules']

function scanTerms () {
  const results = []
  for (const term of TERMS) {
    const variants = term.variants.map(v => ({ ...v, count: 0, byLayer: Object.fromEntries(LAYERS.map(l => [l, 0])), samples: [] }))
    for (const doc of docs) {
      for (const variant of variants) {
        const g = variant.re.global ? variant.re : new RegExp(variant.re.source, variant.re.flags + 'g')
        g.lastIndex = 0
        let m
        while ((m = g.exec(doc.text)) !== null) {
          variant.count++
          variant.byLayer[doc.layer]++
          const layerSamples = variant.samples.filter(s => s.layer === doc.layer).length
          if (variant.samples.length < 9 && layerSamples < 3) {
            variant.samples.push({
              layer: doc.layer,
              location: docLocation(doc),
              pointer: doc.pointer,
              evidence: snippetOf(doc.text, m.index, m[0].length),
            })
          }
          if (m.index === g.lastIndex) g.lastIndex++
        }
      }
    }
    results.push({
      id: term.id,
      en: term.en,
      recommended: term.recommended,
      authority: term.authority,
      variants: variants.map(({ re, ...rest }) => rest),
    })
  }
  return results
}

// ---------------------------------------------------------------------------
// 6. 专名一致性
// ---------------------------------------------------------------------------

const compact = s => String(s).replace(/[·・•\s“”"'《》]/g, '')

function nameGroupRows (group) {
  return group.items.map(item => {
    const rows = {
      key: item.code || item.key,
      en: item.en,
      zh: item.zh,
      extra: item.extra || null,
      aliases: [],
    }
    const names = [...new Set([item.zh, ...(item.aliases || [])].filter(Boolean))]
    for (const name of names) {
      const entry = { zh: name, byLayer: Object.fromEntries(LAYERS.map(l => [l, 0])), count: 0, samples: [] }
      for (const doc of docs) {
        const n = countRe(doc.text, new RegExp(escapeRe(name)))
        if (!n) continue
        entry.count += n
        entry.byLayer[doc.layer] += n
        if (entry.samples.length < 5 && entry.samples.filter(s => s.layer === doc.layer).length < 1) {
          const idx = doc.text.indexOf(name)
          entry.samples.push({ layer: doc.layer, location: docLocation(doc), pointer: doc.pointer, evidence: snippetOf(doc.text, idx, name.length) })
        }
      }
      rows.aliases.push({
        alias: name,
        status: name === item.zh ? 'canonical' : (item.aliasStatus?.[name] || 'variant'),
        ...entry,
      })
    }
    if (item.en) {
      const enEntry = { zh: item.en, byLayer: Object.fromEntries(LAYERS.map(l => [l, 0])), count: 0, samples: [] }
      for (const doc of docs) {
        const n = countRe(doc.text, new RegExp(`\\b${escapeRe(item.en)}\\b`, 'i'))
        if (!n) continue
        enEntry.count += n
        enEntry.byLayer[doc.layer] += n
        if (enEntry.samples.length < 4) enEntry.samples.push({ layer: doc.layer, location: docLocation(doc), pointer: doc.pointer, evidence: snippetOf(doc.text, doc.text.toLowerCase().indexOf(item.en.toLowerCase()), item.en.length) })
      }
      rows.englishInZh = enEntry
    }
    rows.layersWithName = LAYERS.filter(l => rows.aliases[0].byLayer[l] > 0)
    return rows
  })
}

const cardZhName = code => ALL_CARDS[code]?.nameZh || ''
const cardEnName = code => ALL_CARDS[code]?.name || ''

// 5 位 EOTE 调查员（卡面规范名）；aliases 为叙事/规则书中常见的短名或**需排查的异写候选**。
const investigatorAliasTable = {
  '08001': { short: ['丹妮拉'], candidates: ['雷耶斯', '丹妮拉·雷耶斯'] },
  '08004': { short: ['诺曼'], candidates: ['威瑟斯', '韦瑟斯', '诺曼·威瑟斯'] },
  '08007': { short: ['蒙特雷'], candidates: ['杰克', '蒙特雷·杰克'] },
  '08010': { short: ['陈丽丽', '丽丽'], candidates: ['陈莉莉'] },
  '08016': { short: ['鲍勃'], candidates: ['詹金斯', '简金斯', '鲍勃·简金斯'] },
}
const investigators = ['08001', '08004', '08007', '08010', '08016'].map(code => {
  const t = investigatorAliasTable[code]
  return {
    code,
    en: cardEnName(code),
    zh: cardZhName(code),
    aliases: [...t.short, ...t.candidates],
    aliasStatus: Object.fromEntries([
      ...t.short.map(a => [a, 'short-form']),
      ...t.candidates.map(a => [a, 'variant-candidate']),
    ]),
  }
})

// 9 位伙伴：卡面规范名；短名（姓氏/名）用于叙事层核对；candidates 为需排查的异写。
const partnerAliasTable = {
  '08714': { short: ['威廉·戴尔', '戴尔教授', '戴尔'], candidates: ['维尔·戴尔', '戴尔教授（威廉）'] },
  '08715': { short: ['丹佛斯'], candidates: ['丹弗斯', '丹福斯'] },
  '08716': { short: ['伊里亚', '阿什瓦克'], candidates: ['伊利亚', '伊利亚·阿什瓦克', '阿什瓦克先生'] },
  '08717': { short: ['玛拉', '辛哈医生', '辛哈'], candidates: ['马拉·辛哈', '马拉', '辛哈博士'] },
  '08718': { short: ['艾弗里', '克莱普尔'], candidates: ['艾佛里', '艾佛里·克莱普尔', '克莱普尔先生'] },
  '08719': { short: ['曲奇', '弗雷德里克斯'], candidates: ['詹姆斯·曲奇·弗雷德里克斯', '佛雷德里克斯', '弗雷德里克'] },
  '08720': { short: ['艾米', '肯斯勒博士', '肯斯勒'], candidates: ['康斯勒', '肯斯勒博士（艾米）', '艾米·康斯勒'] },
  '08721': { short: ['罗尔德', '埃尔斯沃思'], candidates: ['罗纳德·埃尔斯沃思', '罗纳德', '埃尔斯沃斯'] },
  '08722': { short: ['高田', '弘子', '高田弘子'], candidates: ['高田广子', '高田博子'] },
}
const partnerModuleByCode = Object.fromEntries((recMod.PARTNERS || []).map(p => [p.code, p]))
const partners = ['08714', '08715', '08716', '08717', '08718', '08719', '08720', '08721', '08722'].map(code => {
  const t = partnerAliasTable[code]
  const p = partnerModuleByCode[code] || {}
  return {
    code,
    en: cardEnName(code),
    zh: cardZhName(code),
    moduleZh: p.name,
    aliases: [...t.short, ...t.candidates],
    aliasStatus: Object.fromEntries([
      ...t.short.map(a => [a, 'short-form']),
      ...t.candidates.map(a => [a, 'variant-candidate']),
    ]),
  }
})

const memorials = (sharedMod.MEMORIAL_CODES || []).map(code => ({ code, en: cardEnName(code), zh: cardZhName(code) }))
const supplies = [
  { code: '08614', aliases: [] },
  { code: '08615', aliases: ['木制雪橇', '木雪橇', '雪橇'] },
  { code: '08616', aliases: [] },
  { code: '08617', aliases: [] },
  { code: '08618', aliases: [] },
  { code: '08619', aliases: [] },
  { code: '08620', aliases: ['备件'] },
].map(s => ({
  ...s,
  en: cardEnName(s.code),
  zh: cardZhName(s.code),
  moduleZh: (recMod.SUPPLIES || []).find(x => x.code === s.code)?.label,
  sharedZh: sharedMod.SUPPLY_LABELS?.[s.code],
  aliasStatus: Object.fromEntries(s.aliases.map(a => [a, 'variant'])),
}))
const camps = Object.entries(recMod.CAMP_SHELTER || {}).map(([key, spec]) => ({
  key,
  code: spec.code,
  en: spec.labelEn,
  zh: cardZhName(spec.code),
  moduleZh: spec.label,
  aliases: [spec.label].filter(label => label && compact(label) !== compact(cardZhName(spec.code))),
  aliasStatus: { [spec.label]: 'variant' },
}))
const chapters = [
  { code: '08501', aliases: [] },
  { code: '08549', aliases: ['致命幻象'] },
  { code: '08596', aliases: ['失落之巅', '失落山峰'] },
  { code: '08621', aliases: ['远古者之城'] },
  { code: '08648', aliases: [] },
].map(c => ({
  ...c,
  en: cardEnName(c.code),
  zh: cardZhName(c.code),
  aliases: c.aliases,
  aliasStatus: Object.fromEntries(c.aliases.map(a => [a, 'variant-candidate'])),
}))
const majorEnemies = [
  { code: '08679', aliases: ['无名狂魔', '无名者'] },
  { code: '08522', aliases: ['星之恐惧', '星辰恐怖', '星之惊骇'] },
  { code: '08609', aliases: ['拘束的古老者', '缠绕古老者'] },
  { code: '08642', aliases: ['善良的古老者', '和善的古老者'] },
  { code: '08710', aliases: ['被遗忘的修格斯', '遗忘修格斯'] },
  { code: '08711', aliases: ['暴怒的修格斯', '狂暴修格斯'] },
  { code: '08515', aliases: ['疾走谬物', '疾行谬误', '疾行谬物敌人'] },
  { code: '08708', aliases: ['巨大白化企鹅', '白化企鹅'] },
  { code: '08689', aliases: ['疯狂的显现', '疯狂实体'] },
].map(e => ({ ...e, en: cardEnName(e.code), zh: cardZhName(e.code), aliasStatus: Object.fromEntries(e.aliases.map(a => [a, 'variant-candidate'])) }))
const majorLocations = [
  { code: '08649', aliases: ['伊库阿之门', '伊夸之门（Y\'quaa）'] },
  { code: '08682', aliases: ['泰坦坡道', '巨型坡道'] },
  { code: '08674', aliases: ['迷雾塔', '雾之塔', '迷雾之塔'] },
  { code: '08630', aliases: ['隐藏隧道', '隐秘通道'] },
  { code: '08556', aliases: ['回忆囚笼'] },
  { code: '08652', aliases: ['科斯图书馆', '寇斯图书馆'] },
  { code: '08638', aliases: ['独眼尖顶', '塞克洛普尖顶'] },
  { code: '08558', aliases: ['西奥多西亚号甲板', '费奥多西亚号甲板'] },
].map(e => ({ ...e, en: cardEnName(e.code), zh: cardZhName(e.code), aliasStatus: Object.fromEntries(e.aliases.map(a => [a, 'variant-candidate'])) }))
const miscNames = [
  { code: '08738', en: 'Anyu', zh: cardZhName('08738'), aliases: ['安尤', '阿纽'], aliasStatus: { 安尤: 'variant-candidate', 阿纽: 'variant-candidate' } },
].map(e => ({ ...e }))

function scanProperNouns () {
  const groups = {}
  groups.investigators = nameGroupRows({ items: investigators })
  groups.partners = nameGroupRows({ items: partners })
  groups.supplies = nameGroupRows({ items: supplies })
  groups.camps = nameGroupRows({ items: camps })
  groups.chapters = nameGroupRows({ items: chapters })
  groups.memorials = nameGroupRows({ items: memorials })
  groups.majorEnemies = nameGroupRows({ items: majorEnemies })
  groups.majorLocations = nameGroupRows({ items: majorLocations })
  groups.miscNames = nameGroupRows({ items: miscNames })

  // (a) 卡面 vs 模块常量逐项差异
  const diffs = []
  for (const p of partners) {
    if (p.cardZh && p.moduleZh && compact(p.zh) !== compact(p.moduleZh)) diffs.push({ kind: 'partner', key: p.code, card: p.zh, module: p.moduleZh, moduleSrc: `${FILES.records}#PARTNERS.${p.code}` })
  }
  for (const s of supplies) {
    if (s.moduleZh && compact(s.zh) !== compact(s.moduleZh)) diffs.push({ kind: 'supply', key: s.code, card: s.zh, records: s.moduleZh, recordsSrc: `${FILES.records}#SUPPLIES.${s.code}` })
    if (s.sharedZh && s.moduleZh && s.sharedZh !== s.moduleZh) diffs.push({ kind: 'supply', key: s.code, records: s.moduleZh, shared: s.sharedZh, sharedSrc: `${FILES.sharedEncounters}#SUPPLY_LABELS.${s.code}` })
    if (s.sharedZh && compact(s.zh) !== compact(s.sharedZh)) diffs.push({ kind: 'supply', key: s.code, card: s.zh, shared: s.sharedZh, sharedSrc: `${FILES.sharedEncounters}#SUPPLY_LABELS.${s.code}` })
  }
  for (const c of camps) {
    if (compact(c.zh) !== compact(c.moduleZh)) diffs.push({ kind: 'camp', key: c.code, card: c.zh, module: c.moduleZh, moduleSrc: `${FILES.records}#CAMP_SHELTER.${c.key}` })
  }
  for (const ch of chapters) {
    for (const unit of (partsMod.EOTE_SCENARIO_UNITS || [])) {
      if (unit.cardCode !== ch.code) continue
      if (!unit.name.includes(ch.zh)) diffs.push({ kind: 'chapter', key: unit.id, card: ch.zh, module: unit.name, moduleSrc: `${FILES.parts}#EOTE_SCENARIO_UNITS.${unit.id}` })
    }
  }

  // (b) story-text 记录标签里的营地名（"Camp - 水晶洞穴 (8)"）与卡面对照
  const storyCampDiffs = []
  const recordLabels = STORY.campaign?.records?.recordLabels?.entries || []
  for (const entry of recordLabels) {
    const m = /^Camp\s*-\s*(.+?)\s*\((\d+)\)$/.exec(String(entry.body || ''))
    if (!m) continue
    const [, zhName] = m
    const recordKey = String(entry.key || '').replace(/^key\./, '')
    const schemaKey = recordKey.startsWith('camp_') ? 'camp' + recordKey.slice(5) : recordKey
    const spec = recMod.CAMP_SHELTER?.[schemaKey]
    const canonical = spec ? cardZhName(spec.code) : ''
    storyCampDiffs.push({
      key: recordKey,
      storyLabel: String(entry.body),
      storyNameZh: zhName,
      cardZh: canonical,
      code: spec?.code,
      match: canonical ? compact(zhName) === compact(canonical) : null,
      status: entry.status,
      shelter: spec?.shelter,
    })
  }

  // (c) 伙伴名在 story-text 记录层是否缺中文（English fallback）
  const storyPartnerNameRows = (STORY.campaign?.records?.partnerNames?.entries || []).map(entry => ({
    code: String(entry.key || '').replace(/^partnerNames\./, ''),
    status: entry.status,
    body: entry.body,
    hasChinese: CJK_RE.test(String(entry.body || '')),
  }))

  // (d) 规则书（rules 层）对各专名的实际用词（判断跨层不一致）
  const rulesDocs = docs.filter(doc => doc.layer === 'rules')
  const rulebookUsage = []
  const probeGroups = [
    ...supplies.map(s => ({ group: 'supply', key: s.code, canonical: s.zh, aliases: s.aliases })),
    ...camps.map(c => ({ group: 'camp', key: c.code, canonical: c.zh, aliases: c.aliases })),
    ...majorLocations.map(l => ({ group: 'location', key: l.code, canonical: l.zh, aliases: l.aliases })),
    ...majorEnemies.map(e => ({ group: 'enemy', key: e.code, canonical: e.zh, aliases: e.aliases })),
  ]
  for (const probe of probeGroups) {
    const forms = [probe.canonical, ...probe.aliases]
    const hits = []
    for (const form of forms) {
      const n = rulesDocs.reduce((sum, doc) => sum + countRe(doc.text, new RegExp(escapeRe(form))), 0)
      if (n > 0) hits.push({ form, count: n })
    }
    if (hits.length) rulebookUsage.push({ ...probe, hits })
  }

  return { groups, diffs, storyCampDiffs, storyPartnerNameRows, rulebookUsage }
}

// ---------------------------------------------------------------------------
// 7. 简繁与异体字
// ---------------------------------------------------------------------------

// Traditional -> Simplified 常用对照（只列本语料实际相关 + 常见繁体字，供计数）
const TRADITIONAL_MAP = {
  著: '着', 於: '于', 與: '与', 裡: '里', 裏: '里', 祕: '秘', 牠: '它', 祂: '他', 獃: '呆',
  來: '来', 個: '个', 說: '说', 這: '这', 麼: '么', 麽: '么', 時: '时', 會: '会', 對: '对',
  過: '过', 還: '还', 開: '开', 關: '关', 們: '们', 發: '发', 現: '现', 體: '体', 靈: '灵',
  鬥: '斗', 將: '将', 軍: '军', 該: '该', 讓: '让', 從: '从', 無: '无', 數: '数', 點: '点',
  線: '线', 標: '标', 記: '记', 號: '号', 滅: '灭', 險: '险', 惡: '恶', 環: '环', 節: '节',
  態: '态', 樣: '样', 幾: '几', 頭: '头', 長: '长', 門: '门', 間: '间', 應: '应', 認: '认',
  識: '识', 語: '语', 讀: '读', 寫: '写', 書: '书', 畫: '画', 電: '电', 腦: '脑', 業: '业',
  處: '处', 術: '术', 戰: '战', 爭: '争', 夢: '梦', 實: '实', 際: '际', 豐: '丰', 產: '产',
  團: '团', 隊: '队', 員: '员', 動: '动', 務: '务', 勝: '胜', 敗: '败', 殺: '杀', 壞: '坏',
  麗: '丽', 亞: '亚', 爾: '尔', 貝: '贝', 爾: '尔', 蘭: '兰', 羅: '罗', 馬: '马', 鳥: '鸟',
  魚: '鱼', 龍: '龙', 龜: '龟', 齒: '齿', 齡: '龄', 黨: '党', 齊: '齐', 億: '亿', 償: '偿',
  僅: '仅', 僕: '仆', 價: '价', 儀: '仪', 優: '优', 儲: '储', 兒: '儿', 內: '内', 冊: '册',
  準: '准', 劃: '划', 嚇: '吓', 嚴: '严', 喪: '丧', 單: '单', 嗎: '吗', 啟: '启', 嘗: '尝',
  嘆: '叹', 嚇: '吓', 嗎: '吗', 噸: '吨', 囑: '嘱', 壇: '坛', 壓: '压', 壯: '壮', 壽: '寿',
  夠: '够', 夢: '梦', 夾: '夹', 奪: '夺', 奮: '奋', 妝: '妆', 婦: '妇', 媽: '妈', 嬰: '婴',
  孫: '孙', 寧: '宁', 寬: '宽', 賓: '宾', 層: '层', 島: '岛', 嶺: '岭', 峽: '峡', 崗: '岗',
  幣: '币', 帥: '帅', 師: '师', 帳: '帐', 帶: '带', 幫: '帮', 廣: '广', 廳: '厅', 張: '张',
  強: '强', 彈: '弹', 歸: '归', 當: '当', 療: '疗', 瘋: '疯', 皚: '皑', 監: '监', 盤: '盘',
  眾: '众', 睜: '睁', 礎: '础', 禮: '礼', 禍: '祸', 稅: '税', 穩: '稳', 窮: '穷', 竊: '窃',
  筆: '笔', 築: '筑', 簡: '简', 籃: '篮', 籌: '筹', 籠: '笼', 糧: '粮', 紀: '纪', 約: '约',
  紅: '红', 級: '级', 紙: '纸', 紛: '纷', 絕: '绝', 統: '统', 絲: '丝', 經: '经', 綠: '绿',
  維: '维', 綱: '纲', 網: '网', 緊: '紧', 緒: '绪', 練: '练', 組: '组', 細: '细', 終: '终',
  結: '结', 給: '给', 絡: '络', 統: '统', 繼續: '继续', 繼: '继', 續: '续', 纖: '纤',
  罷: '罢', 聞: '闻', 聯: '联', 聲: '声', 聽: '听', 肅: '肃', 脅: '胁', 腦: '脑', 腫: '肿',
  臟: '脏', 艦: '舰', 藝: '艺', 節: '节', 蘇: '苏', 處: '处', 號: '号', 蟲: '虫', 蠟: '蜡',
  衝: '冲', 裝: '装', 製: '制', 複: '复', 覆: '覆', 見: '见', 觀: '观', 規: '规', 覺: '觉',
  覽: '览', 觸: '触', 計: '计', 訂: '订', 記: '记', 許: '许', 討: '讨', 訓: '训', 訊: '讯',
  託: '托', 設: '设', 訪: '访', 評: '评', 詞: '词', 試: '试', 詩: '诗', 話: '话', 詳: '详',
  誇: '夸', 誌: '志', 認: '认', 誓: '誓', 誕: '诞', 誘: '诱', 說: '说', 請: '请', 諸: '诸',
  課: '课', 誰: '谁', 調: '调', 談: '谈', 諜: '谍', 諾: '诺', 謀: '谋', 講: '讲', 謝: '谢',
  證: '证', 識: '识', 譜: '谱', 警: '警', 譯: '译', 護: '护', 變: '变', 讓: '让', 讚: '赞',
  豐: '丰', 貝: '贝', 負: '负', 財: '财', 責: '责', 貴: '贵', 買: '买', 貸: '贷', 費: '费',
  貼: '贴', 資: '资', 賈: '贾', 賊: '贼', 賓: '宾', 賜: '赐', 質: '质', 賬: '账', 賭: '赌',
  購: '购', 賽: '赛', 贈: '赠', 贊: '赞', 趕: '赶', 趨: '趋', 跡: '迹', 踐: '践', 蹤: '踪',
  車: '车', 軌: '轨', 軍: '军', 軟: '软', 較: '较', 載: '载', 輔: '辅', 輕: '轻', 輛: '辆',
  輪: '轮', 輸: '输', 轉: '转', 辦: '办', 辭: '辞', 農: '农', 邊: '边', 邏: '逻', 郵: '邮',
  鄉: '乡', 鄰: '邻', 醫: '医', 釋: '释', 鐘: '钟', 鋼: '钢', 錄: '录', 錯: '错', 鍵: '键',
  鎖: '锁', 鏡: '镜', 鐵: '铁', 鑄: '铸', 鑑: '鉴', 長: '长', 門: '门', 閉: '闭', 開: '开',
  閏: '闰', 閑: '闲', 間: '间', 關: '关', 閣: '阁', 閱: '阅', 闆: '板', 闊: '阔', 陣: '阵',
  陰: '阴', 陽: '阳', 陳: '陈', 陸: '陆', 隊: '队', 階: '阶', 隨: '随', 險: '险', 隱: '隐',
  雖: '虽', 雙: '双', 雜: '杂', 雞: '鸡', 離: '离', 難: '难', 雲: '云', 電: '电', 霧: '雾',
  靈: '灵', 靜: '静', 非: '非', 靠: '靠', 面: '面', 鞋: '鞋', 頁: '页', 頂: '顶', 項: '项',
  順: '顺', 須: '须', 預: '预', 領: '领', 頭: '头', 頸: '颈', 頻: '频', 顆: '颗', 題: '题',
  顏: '颜', 願: '愿', 類: '类', 顯: '显', 風: '风', 飛: '飞', 飯: '饭', 飲: '饮', 飾: '饰',
  馬: '马', 駕: '驾', 騎: '骑', 驅: '驱', 驗: '验', 骨: '骨', 髮: '发', 鬧: '闹', 魯: '鲁',
  鮮: '鲜', 鳳: '凤', 黃: '黄', 黑: '黑', 齒: '齿', 龍: '龙',
}
// 只保留「繁体字 → 简体字」且两字形不同的键，避免简体常用字误报。
const TRAD_ONLY = Object.fromEntries(Object.entries(TRADITIONAL_MAP).filter(([t, s]) => t !== s))
// 常见异体/混用对（两侧都可能是本语料中出现的写法）
const VARIANT_PAIRS = [
  ['祕', '秘'], ['牠', '它'], ['佔', '占'], ['瞭', '了'], ['麽', '么'], ['裡', '里'], ['著', '着'],
  ['啟', '启'], ['週', '周'], ['誌', '志'], ['獃', '呆'], ['祂', '他'], ['於', '于'], ['與', '与'],
]

function scanCharacters () {
  const trad = {}
  for (const ch of Object.keys(TRAD_ONLY)) {
    trad[ch] = {
      simplified: TRAD_ONLY[ch],
      count: 0,
      byLayer: Object.fromEntries(LAYERS.map(l => [l, 0])),
      samples: [],
    }
  }
  const variantPairs = VARIANT_PAIRS.map(([a, b]) => ({ trad: a, simp: b, tradCount: 0, simpCount: 0, byLayer: Object.fromEntries(LAYERS.map(l => [l, { trad: 0, simp: 0 }])), samples: [] }))
  const otherRare = {} // 非映射表命中的罕用/异体字候选（按 Unicode 区段粗筛）
  for (const doc of docs) {
    for (const ch of doc.text) {
      if (trad[ch]) {
        trad[ch].count++
        trad[ch].byLayer[doc.layer]++
        if (trad[ch].samples.length < 6 && trad[ch].samples.filter(s => s.layer === doc.layer).length < 2) {
          const idx = doc.text.indexOf(ch)
          trad[ch].samples.push({ layer: doc.layer, location: docLocation(doc), evidence: snippetOf(doc.text, idx, 1) })
        }
      }
    }
    for (const pair of variantPairs) {
      for (const [which, ch] of [['trad', pair.trad], ['simp', pair.simp]]) {
        const n = countRe(doc.text, new RegExp(escapeRe(ch)))
        if (!n) continue
        pair[`${which}Count`] += n
        pair.byLayer[doc.layer][which] += n
        if (pair.samples.length < 6 && pair.samples.filter(s => s.layer === doc.layer && s.which === which).length < 1) {
          pair.samples.push({ which, layer: doc.layer, location: docLocation(doc), evidence: snippetOf(doc.text, doc.text.indexOf(ch), 1) })
        }
      }
    }
  }
  const rows = Object.entries(trad).filter(([, v]) => v.count > 0).sort((a, b) => b[1].count - a[1].count)
  return {
    total: rows.reduce((n, [, v]) => n + v.count, 0),
    characters: Object.fromEntries(rows),
    ranking: rows.map(([ch, v]) => ({ char: ch, simplified: v.simplified, count: v.count, byLayer: v.byLayer })),
    variantPairs: variantPairs.filter(p => p.tradCount || p.simpCount),
    otherRare,
  }
}

// ---------------------------------------------------------------------------
// 8. 标点与数字风格
// ---------------------------------------------------------------------------

// 参考工程 locale 把 {frost} 之类的插值误写成 {'{'}frost{'}'}；下面用字符码构造，避免源码里的引号干扰。
const ESC_BRACE_START = '{' + String.fromCharCode(39) + '{' + String.fromCharCode(39) + '}'
const ESC_BRACE_LEAK_RE = new RegExp(escapeRe(ESC_BRACE_START) + '[^{}]{0,40}' + escapeRe('{' + String.fromCharCode(39) + '}' + String.fromCharCode(39) + '}'), 'g')

const PUNCT_METRICS = [
  ['halfwidth-comma', /[,]/g, 'ASCII 逗号'],
  ['halfwidth-period', /\./g, 'ASCII 句号'],
  ['halfwidth-colon', /[:]/g, 'ASCII 冒号'],
  ['halfwidth-semicolon', /[;]/g, 'ASCII 分号'],
  ['halfwidth-question', /[?]/g, 'ASCII 问号'],
  ['halfwidth-exclaim', /[!]/g, 'ASCII 感叹号'],
  ['halfwidth-paren', /[()]/g, 'ASCII 括号'],
  ['fullwidth-comma', /，/g, '全角逗号'],
  ['fullwidth-period', /。/g, '全角句号'],
  ['fullwidth-colon', /：/g, '全角冒号'],
  ['fullwidth-semicolon', /；/g, '全角分号'],
  ['fullwidth-question', /？/g, '全角问号'],
  ['fullwidth-exclaim', /！/g, '全角感叹号'],
  ['fullwidth-paren', /[（）]/g, '全角括号'],
  ['dup-period', /。\.|\.。|。。|\.\./g, '重复句号/英文句点混排'],
  ['dup-comma', /，,|,，|，，/g, '重复逗号'],
  ['dup-colon', /：[：]|：:|::/g, '重复冒号'],
  ['dup-question', /？？|\?\?/g, '重复问号'],
  ['dup-exclaim', /！！|!!/g, '重复感叹号'],
  ['cjk-then-ascii-punct', /[\u4e00-\u9fff][,.;:!?()]/g, '汉字后接 ASCII 标点'],
  ['ascii-punct-then-cjk', /[,.;:!?()][\u4e00-\u9fff]/g, 'ASCII 标点后接汉字'],
  ['space-cjk-latin', /[\u4e00-\u9fff] [A-Za-z0-9]|[A-Za-z0-9] [\u4e00-\u9fff]/g, '中英文之间留空格'],
  ['no-space-cjk-latin', /[\u4e00-\u9fff][A-Za-z0-9]|[A-Za-z0-9][\u4e00-\u9fff]/g, '中英文之间无空格'],
  ['bullet-dot', /•/g, '项目符号 •'],
  ['bullet-middot', /·/g, '中点 ·'],
  ['bullet-hyphen-line', /(?:^|\n)\s*-\s/g, '行首连字符列表'],
  ['quote-double-cn', /[“”]/g, '中文弯引号 “”'],
  ['quote-corner', /[「」『』]/g, '直角引号 「」『』'],
  ['quote-ascii', /["]/g, 'ASCII 双引号'],
  ['book-title', /《[^》]{1,20}》/g, '书名号《》'],
  ['roman-with-space', /第\s+[IVX]+\s+部分|第\s*[IVX]+\s+部分/g, '罗马数字章节号'],
  ['roman-no-space', /第[IVX]+部分/g, '罗马数字章节号（无空格）'],
  ['ellipsis-cn', /…/g, '中文省略号 …'],
  ['ellipsis-ascii', /\.\.\./g, 'ASCII 省略号 ...'],
  ['fullwidth-digit', /[０-９]/g, '全角数字'],
  ['fullwidth-latin', /[Ａ-Ｚａ-ｚ]/g, '全角拉丁字母'],
  ['ascii-digit', /[0-9]/g, '半角数字'],
  ['html-tag', /<\/?[a-zA-Z][^>]*>/g, 'HTML 标签残留'],
  ['placeholder-brace', /\{[a-zA-Z_]+\}/g, '占位符 {name}'],
  ['escaped-brace-leak', ESC_BRACE_LEAK_RE, '转义大括号泄漏 {\'{\'}frost{\'}\'}'],
  ['sheltervalue-placeholder', /\[shelterValue\]/g, '未译占位符 [shelterValue]'],
  ['square-placeholder', /\[[a-zA-Z][a-zA-Z0-9_]*\]/g, '方括号占位符 [name]'],
  ['locale-ref-leak', /@:[a-zA-Z][\w.]*/g, 'locale 交叉引用泄漏 @:path'],
  ['icon-bracket', /\[[a-z_]+\]/g, '图标 token [xxx]'],
]

function scanPunctuation () {
  const rows = {}
  for (const [id, re, label] of PUNCT_METRICS) {
    rows[id] = { label, total: 0, byLayer: Object.fromEntries(LAYERS.map(l => [l, 0])), samples: [] }
  }
  for (const doc of docs) {
    for (const [id, re, label] of PUNCT_METRICS) {
      const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g')
      g.lastIndex = 0
      let m
      while ((m = g.exec(doc.text)) !== null) {
        rows[id].total++
        rows[id].byLayer[doc.layer]++
        if (rows[id].samples.length < 6 && rows[id].samples.filter(s => s.layer === doc.layer).length < 2) {
          rows[id].samples.push({ layer: doc.layer, location: docLocation(doc), evidence: snippetOf(doc.text, m.index, m[0].length) })
        }
        if (m.index === g.lastIndex) g.lastIndex++
      }
    }
  }
  // 每层字符数用于归一化
  const per1k = {}
  for (const [id, row] of Object.entries(rows)) {
    per1k[id] = {}
    for (const layer of LAYERS) {
      const chars = docStats[layer]?.cjkChars || 0
      per1k[id][layer] = chars ? Math.round((row.byLayer[layer] / chars) * 10000) / 10 : 0
    }
  }
  return { rows, per1kCjkChars: per1k }
}

// ---------------------------------------------------------------------------
// 9. 图标 token 与关键词/特性一致性
// ---------------------------------------------------------------------------

const ICON_TOKENS = ['willpower', 'intellect', 'combat', 'agility', 'wild', 'skull', 'cultist', 'tablet', 'elder_thing', 'auto_fail', 'elder_sign', 'frost', 'seal_a', 'seal_b', 'seal_c', 'seal_d', 'seal_e', 'reaction', 'action', 'free', 'fast', 'per_investigator', 'guardian', 'survivor', 'seeker', 'mystic', 'rogue', 'neutral']
const SKILL_WORDS = ['意志', '意志力', '智力', '战斗', '敏捷', '力量', '知识', '速度']

function scanIcons () {
  const tokenRows = Object.fromEntries(ICON_TOKENS.map(t => [t, { total: 0, byLayer: Object.fromEntries(LAYERS.map(l => [l, 0])), samples: [] }]))
  const unknownTokens = {}
  for (const doc of docs) {
    for (const token of ICON_TOKENS) {
      const n = countRe(doc.text, new RegExp(`\\[${token}\\]`))
      if (!n) continue
      tokenRows[token].total += n
      tokenRows[token].byLayer[doc.layer] += n
      if (tokenRows[token].samples.length < 5 && tokenRows[token].samples.filter(s => s.layer === doc.layer).length < 2) {
        tokenRows[token].samples.push({ layer: doc.layer, location: docLocation(doc), evidence: snippetOf(doc.text, doc.text.indexOf(`[${token}]`), token.length + 2) })
      }
    }
    const g = /\[([a-z_]+)\]/g
    let m
    while ((m = g.exec(doc.text)) !== null) {
      if (!ICON_TOKENS.includes(m[1])) {
        unknownTokens[m[1]] ||= { total: 0, byLayer: Object.fromEntries(LAYERS.map(l => [l, 0])), samples: [] }
        unknownTokens[m[1]].total++
        unknownTokens[m[1]].byLayer[doc.layer]++
        if (unknownTokens[m[1]].samples.length < 4) unknownTokens[m[1]].samples.push({ layer: doc.layer, location: docLocation(doc), evidence: snippetOf(doc.text, m.index, m[0].length) })
      }
      if (m.index === g.lastIndex) g.lastIndex++
    }
  }
  const skillWords = {}
  for (const word of SKILL_WORDS) {
    skillWords[word] = { total: 0, byLayer: Object.fromEntries(LAYERS.map(l => [l, 0])), samples: [] }
    for (const doc of docs) {
      const n = countRe(doc.text, new RegExp(escapeRe(word)))
      if (!n) continue
      skillWords[word].total += n
      skillWords[word].byLayer[doc.layer] += n
      if (skillWords[word].samples.length < 4 && skillWords[word].samples.filter(s => s.layer === doc.layer).length < 1) {
        skillWords[word].samples.push({ layer: doc.layer, location: docLocation(doc), evidence: snippetOf(doc.text, doc.text.indexOf(word), word.length) })
      }
    }
  }
  return { tokens: tokenRows, unknownTokens, skillWords }
}

const KEYWORD_SYNONYMS = {
  hunter: ['猎手', '猎人'],
  aloof: ['冷漠', '孤僻', '冷淡'],
  massive: ['巨大', '庞大'],
  retaliate: ['反击', '报复'],
  alert: ['警戒', '警觉', '警惕'],
  surge: ['涌动', '涌现', '汹涌'],
  peril: ['险境', '险恶'],
  hidden: ['隐藏', '隐蔽'],
  victory: ['胜利点', '胜利'],
  revelation: ['显现', '显形'],
  parley: ['谈判', '交涉'],
  fast: ['快速', '迅速', '快捷'],
  elite: ['精英', '精锐'],
  prey: ['猎物', '猎物目标'],
  spawn: ['生成', '出生'],
  patrol: ['巡逻', '巡守'],
}

const KEYWORD_NOTES = {
  victory: 'EN 模式命中 39 次均为 victory display「胜利区」，本循环 08 段没有印刷 Victory X 关键词实例；关键词名「胜利点」不构成卡面冲突，但规则书/数据应注明两者不同。',
  hidden: 'EN 模式 \bHidden\b 命中 7 张均为地点名 Hidden Tunnel「隐秘隧道」；本循环 08 段无印刷 Hidden 关键词实例。',
  level: 'EN 模式 \bLevel\b 会把牌库构建的 "level 0-5"（卡牌等级）与地点高度 Level 混在一起；译名冲突属规则模式过宽，不是翻译错误。',
  shelter: '卡面地点正文把庇护值印作「庇护N」（无「值」），剧情/规则书用「庇护值」；keywords.js 取「庇护值」合理，卡面写法需 cards 审计裁定。',
  supplies: '卡面 assets 的 supplies token 译「补给」（使用(N 补给)），战役资源 Supplies 译「物资」，Supplies Recovered 译「补给品」；keywords.js 单取「物资」只覆盖战役义。',
  fast: '卡面 EN [fast] 图标在 zh 卡面被系统性替换成 [free]（本循环 58 处 / 53 卡），而仓库渲染器 free=「免费触发」、fast=「快速」是两个不同标签，属跨层图标问题。',
  tekelili: '卡名 08723–08729 为「忒咳哩-哩」（无感叹号），keywords.js 与规则书写「忒咳哩-哩！」多出感叹号。',
  frost: 'token 类：卡面用 [frost] 图标，中文名「寒霜标记」只用于规则书，不要求卡面正文含中文名。',
  sealTokens: 'token 类：卡面用 [seal_a]–[seal_e] 图标，中文名「封印标记」只用于规则书。',
}

function scanKeywordConsistency () {
  const rows = []
  for (const kw of EOTE_KEYWORDS) {
    const synonyms = KEYWORD_SYNONYMS[kw.id] || [kw.zh]
    const row = {
      id: kw.id,
      kind: kw.kind,
      zh: kw.zh,
      ruleId: kw.ruleId,
      note: KEYWORD_NOTES[kw.id] || '',
      cardCodes: kw.cardCodes || [],
      enMatched: [], // EN 卡面命中关键词但 ZH 卡面不含 keywords.js 译名
      enMatchedOk: 0,
      zhOnly: [], // ZH 卡面含译名但 EN 未命中（反向抽查）
      synonymHits: [], // EN 命中时 ZH 卡面实际使用的同义写法
      notInCards: false,
      tokenNote: null,
    }
    if (kw.kind === 'token') row.tokenNote = 'token 类关键词（frost/sealTokens）以 [frost]/[seal_x] 图标出现，译名用于规则书，不要求卡面正文含中文名'
    const patterns = (kw.patterns || []).map(p => new RegExp(p, 'i'))
    for (const code of codes08) {
      const card = ALL_CARDS[code]
      const enText = [card.name || '', card.text || '', card.backText || '', (card.traits || []).map(t => `[[${t}]]`).join(' ')].join('\n')
      const zhText = [card.nameZh || '', card.textZh || '', card.backTextZh || '', (card.traitsZh || []).map(t => `[[${t}]]`).join(' ')].join('\n')
      const enHit = patterns.some(re => re.test(enText))
      const zhHit = zhText.includes(kw.zh)
      const usedSynonyms = synonyms.filter(s => s !== kw.zh && zhText.includes(s))
      if (enHit && zhHit) row.enMatchedOk++
      else if (enHit && !zhHit) {
        row.enMatched.push({ code, nameZh: card.nameZh })
        if (usedSynonyms.length) row.synonymHits.push({ code, nameZh: card.nameZh, used: usedSynonyms })
      } else if (!enHit && zhHit) row.zhOnly.push({ code, nameZh: card.nameZh })
    }
    // 为前 3 张不一致卡补充 EN/ZH 对齐证据（定位首条命中行）
    row.mismatchEvidence = row.enMatched.slice(0, 3).map(({ code, nameZh }) => {
      const card = ALL_CARDS[code]
      const enLines = [card.text, card.backText].filter(Boolean).join('\n').split('\n')
      const zhLines = [card.textZh, card.backTextZh].filter(Boolean).join('\n').split('\n')
      const patterns = (kw.patterns || []).map(p => new RegExp(p, 'i'))
      const enIdx = enLines.findIndex(line => patterns.some(re => re.test(line)))
      const zhIdx = enIdx >= 0 && enIdx < zhLines.length ? enIdx : -1
      return {
        code,
        nameZh,
        enLine: enIdx >= 0 ? enLines[enIdx] : '(backText/name/traits 命中)',
        zhLine: zhIdx >= 0 ? zhLines[zhIdx] : '(行号不可对齐，见卡面全文)',
        zhFull: String(card.textZh || '').slice(0, 200),
      }
    })
    row.notInCards = row.enMatchedOk === 0 && row.enMatched.length === 0
    rows.push(row)
  }
  // 特性值分布（08 段 traitsZh token 计数）
  const traitCounts = {}
  for (const code of codes08) {
    for (const trait of ALL_CARDS[code].traitsZh || []) {
      traitCounts[trait] ||= { count: 0, codes: [] }
      traitCounts[trait].count++
      if (traitCounts[trait].codes.length < 8) traitCounts[trait].codes.push(code)
    }
  }
  // EN traits 与 ZH traits 对齐核对：同一 [[Trait]] 的中译分布
  const traitPairs = {}
  for (const code of codes08) {
    const card = ALL_CARDS[code]
    const en = card.traits || []
    const zh = card.traitsZh || []
    en.forEach((trait, i) => {
      const zhTrait = zh[i] || ''
      traitPairs[trait] ||= {}
      traitPairs[trait][zhTrait] = (traitPairs[trait][zhTrait] || 0) + 1
    })
  }
  return {
    keywords: rows,
    traitCounts: Object.fromEntries(Object.entries(traitCounts).sort((a, b) => b[1].count - a[1].count)),
    traitPairs,
  }
}

// ---------------------------------------------------------------------------
// 10. 上游对照（cards-data 08 字段 vs cards_zh-cn.json；术语推荐依据）
// ---------------------------------------------------------------------------

function compareWithUpstream () {
  const diffs = []
  const fields = [['nameZh', 'name'], ['subnameZh', 'subname'], ['textZh', 'text'], ['flavorZh', 'flavor'], ['traitsZh', 'traits']]
  // 归一：去 HTML 标签/全角引号差异/空白差异，仅保留真实文本差异。
  const normalize = value => normText(value)
    .replace(/<\/?(?:b|i|u|em|strong|span|div|br)\s*\/?>/gi, '')
    .replace(/[“”"]/g, '"')
    .replace(/[‘’']/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
  let same = 0
  let missingUpstream = 0
  for (const code of codes08) {
    const card = ALL_CARDS[code]
    const up = refZhCn08.get(code)
    if (!up) { missingUpstream++; continue }
    for (const [zhField, upField] of fields) {
      let a = card[zhField]
      let b = up[upField]
      if (Array.isArray(a)) a = a.join('、')
      if (Array.isArray(b)) b = b.join('、')
      a = normalize(a); b = normalize(b)
      if (!a && !b) { same++; continue }
      if (a === b) { same++; continue }
      diffs.push({ code, field: zhField, upstreamField: upField, repo: a.slice(0, 160), upstream: b.slice(0, 160) })
    }
  }
  return { comparedFields: codes08.length * fields.length, same, diffCount: diffs.length, missingUpstream, diffs: diffs.slice(0, 300) }
}

// 上游 / 参考工程术语口径（用于 glossary 的 authority 列）
function referenceTerminology () {
  const probe = [
    ['doom', /doom/i], ['clue', /clue/i], ['horror', /horror/i], ['damage', /damage/i],
    ['asset', /asset/i], ['event', /event/i], ['skill', /skill/i], ['treachery', /treachery/i],
    ['enemy', /enemy/i], ['location', /location/i], ['agenda', /agenda/i], ['act', /^act$/i],
    ['shelter', /shelter/i], ['supplies', /supplies/i], ['partner', /partner/i], ['frost', /frost/i],
    ['key', /key/i], ['seal', /seal/i], ['token', /token/i], ['weakness', /weakness/i],
    ['deck', /deck/i], ['discard', /discard/i], ['encounter', /encounter/i], ['resolution', /resolution/i],
    ['scenario', /scenario/i], ['campaign', /campaign/i], ['investigator', /investigator/i],
  ]
  const out = []
  for (const [term, re] of probe) {
    const labelHits = refLabelFlat.filter(([k, v]) => re.test(k) || re.test(v)).slice(0, 8)
    out.push({ term, labelHits })
  }
  return out
}

// ---------------------------------------------------------------------------
// 10.5 卡面图标 token 对照（EN 卡面 vs ZH 卡面）
// ---------------------------------------------------------------------------

const KNOWN_TOKEN_RE = /\[([a-z][a-z0-9_]*)\]/g
function tokensOf (text) {
  const out = []
  const g = new RegExp(KNOWN_TOKEN_RE.source, 'g')
  let m
  while ((m = g.exec(String(text || ''))) !== null) out.push(m[1])
  return out
}
function scanCardTokens () {
  const pairs = {} // "enToken>zhToken" -> {count, cards:[], samples:[]}
  const perCard = []
  let tokenSwapCards = 0
  for (const code of codes08) {
    const card = ALL_CARDS[code]
    const enTokens = tokensOf([card.text, card.backText].join('\n'))
    const zhTokens = tokensOf([card.textZh, card.backTextZh].join('\n'))
    const enSet = new Set(enTokens)
    const zhSet = new Set(zhTokens)
    const onlyEn = [...enSet].filter(t => !zhSet.has(t))
    const onlyZh = [...zhSet].filter(t => !enSet.has(t))
    if (!onlyEn.length && !onlyZh.length) continue
    tokenSwapCards++
    // 一对一配对（同数量时按位置配对；否则按字母顺序配对）
    const pairsForCard = []
    if (onlyEn.length && onlyZh.length) {
      const list = [...onlyEn].sort().map((en, i) => [en, [...onlyZh].sort()[i]])
      // 优先按出现顺序配对，能识别 [fast]→[free]
      for (let i = 0; i < Math.min(onlyEn.length, onlyZh.length); i++) {
        pairsForCard.push([enTokens.filter(t => t === onlyEn[i]).length >= 0 ? onlyEn[i] : onlyEn[i], onlyZh[i]])
      }
    } else if (onlyEn.length) {
      for (const en of onlyEn) pairsForCard.push([en, '(缺失)'])
    } else {
      for (const zh of onlyZh) pairsForCard.push(['(缺失)', zh])
    }
    for (const [en, zh] of pairsForCard) {
      const key = `${en}>${zh}`
      pairs[key] ||= { enToken: en, zhToken: zh, count: 0, cards: [], samples: [] }
      pairs[key].count++
      if (pairs[key].cards.length < 10) pairs[key].cards.push(code)
      if (pairs[key].samples.length < 3) pairs[key].samples.push({ code, nameZh: card.nameZh, enSnippet: snippetOf(String(card.text || ''), String(card.text || '').indexOf(`[${en}]`), en.length + 2), zhSnippet: snippetOf(String(card.textZh || ''), String(card.textZh || '').indexOf(`[${zh}]`), zh.length + 2) })
    }
    perCard.push({ code, nameZh: card.nameZh, onlyEn, onlyZh })
  }
  // 聚合图标 token 在 EN/ZH 卡面的总出现次数
  let enTotal = {}
  let zhTotal = {}
  for (const code of codes08) {
    const card = ALL_CARDS[code]
    for (const t of tokensOf([card.text, card.backText].join('\n'))) enTotal[t] = (enTotal[t] || 0) + 1
    for (const t of tokensOf([card.textZh, card.backTextZh].join('\n'))) zhTotal[t] = (zhTotal[t] || 0) + 1
  }
  return { pairs: Object.values(pairs).sort((a, b) => b.count - a.count), tokenSwapCards, perCardSample: perCard.slice(0, 40), enTotal, zhTotal }
}

// ---------------------------------------------------------------------------
// 10.6 中译语料中的英文残留 / 内部标记泄漏
// ---------------------------------------------------------------------------

const ALLOWED_LATIN_RE = /^(H\.P\.|FAQ|v\d+(?:\.\d+)*|hp|xp|HP|XP)$/i
function scanEnglish () {
  const rows = { byLayer: Object.fromEntries(LAYERS.map(l => [l, 0])), topWords: {}, samples: [] }
  for (const doc of docs) {
    // 去掉允许的图标/占位符/特性记号后再找英文单词
    const stripped = doc.text
      .replace(/\[[a-z][a-z0-9_]*\]/g, ' ')
      .replace(/\[\[[^\]]+\]\]/g, ' ')
      .replace(/\{[a-zA-Z_]+\}/g, ' ')
    const g = /[A-Za-z][A-Za-z'’-]{2,}/g
    let m
    let layerCount = 0
    while ((m = g.exec(stripped)) !== null) {
      const word = m[0]
      if (ALLOWED_LATIN_RE.test(word)) continue
      rows.byLayer[doc.layer]++
      rows.topWords[word] = (rows.topWords[word] || 0) + 1
      layerCount++
      if (rows.samples.length < 40 && rows.samples.filter(s => s.layer === doc.layer).length < 8) {
        rows.samples.push({ layer: doc.layer, location: docLocation(doc), pointer: doc.pointer, word, evidence: snippetOf(doc.text, m.index, word.length) })
      }
    }
    if (layerCount) rows[`${doc.layer}DocsWithEnglish`] = (rows[`${doc.layer}DocsWithEnglish`] || 0) + 1
  }
  rows.topWords = Object.fromEntries(Object.entries(rows.topWords).sort((a, b) => b[1] - a[1]).slice(0, 120))
  return rows
}

const MARKER_PATTERNS = [
  ['missing-marker', /(?:^|[\s"'(（])(missing)(?:[\s"'）),]|$)/g],
  ['untranslated-marker', /(?:^|[\s"'(（])(untranslated)(?:[\s"'）),]|$)/g],
  ['chinese-pending', /中文待补/g],
  ['todo', /\bTODO\b/g],
  ['needs-review', /NEEDS[ -]?REVIEW/g],
  ['replacement-char', /\uFFFD/g],
  ['escaped-brace-leak', ESC_BRACE_LEAK_RE],
  ['locale-ref-leak', /@:[a-zA-Z][\w.]*/g],
  ['question-placeholder', /\?{2,}/g],
  ['sheltervalue-placeholder', /\[shelterValue\]/g],
]
function scanMarkers () {
  const rows = {}
  for (const [id, re] of MARKER_PATTERNS) rows[id] = { total: 0, byLayer: Object.fromEntries(LAYERS.map(l => [l, 0])), samples: [] }
  for (const doc of docs) {
    for (const [id, re] of MARKER_PATTERNS) {
      const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g')
      g.lastIndex = 0
      let m
      while ((m = g.exec(doc.text)) !== null) {
        rows[id].total++
        rows[id].byLayer[doc.layer]++
        if (rows[id].samples.length < 6) rows[id].samples.push({ layer: doc.layer, location: docLocation(doc), pointer: doc.pointer, evidence: snippetOf(doc.text, m.index, m[0].length) })
        if (m.index === g.lastIndex) g.lastIndex++
      }
    }
  }
  return rows
}

// ---------------------------------------------------------------------------
// 11. 执行与输出
// ---------------------------------------------------------------------------

const termResults = scanTerms()
const properNounResults = scanProperNouns()
const characterResults = scanCharacters()
const punctuationResults = scanPunctuation()
const iconResults = scanIcons()
const cardTokenResults = scanCardTokens()
const keywordResults = scanKeywordConsistency()
const englishResults = scanEnglish()
const markerResults = scanMarkers()
const upstreamResults = compareWithUpstream()
const refTerms = referenceTerminology()

const report = {
  area: 'terms',
  auditor: 'terms-audit',
  generatedAt: new Date().toISOString().slice(0, 10),
  modRoot: path.relative(HALL_ROOT, MOD_ROOT).split(path.sep).join('/'),
  refRoot: `参考资源/${path.basename(REF_ROOT)}`,
  method: '只读脚本遍历 5 个中译语料层（cards/story/guides/rules/modules），按术语变体正则统计并用 CJK 片段回定位原文行；参考资源仅作推荐译法与上游差异对照。',
  inputs: inputRegistry,
  layers: LAYERS.map(layer => ({ layer, ...docStats[layer] })),
  docsTotal: docs.length,
  unlocatedDocs: unlocatedDocList.length,
  unlocatedSamples: unlocatedDocList.slice(0, 60).map(doc => ({ layer: doc.layer, file: rel(doc.file), pointer: doc.pointer, textStart: doc.text.slice(0, 40) })),
  warnings,
  terms: termResults,
  properNouns: properNounResults,
  characters: {
    traditionalTotal: characterResults.total,
    ranking: characterResults.ranking,
    characters: characterResults.characters,
    variantPairs: characterResults.variantPairs,
  },
  punctuation: punctuationResults,
  icons: { ...iconResults, cardTokens: cardTokenResults },
  keywords: keywordResults,
  english: englishResults,
  markers: markerResults,
  upstream: upstreamResults,
  referenceTerminology: refTerms,
}

// ---- 查询模式（--term=xxx / --names / --chars / --punct / --icons / --keywords / --diff / --unlocated / --english / --markers）----
if (HAS_QUERY) {
  const print = obj => console.log(JSON.stringify(obj, null, 1))
  if (QUERY.contains) {
    const hits = docs.filter(doc => doc.text.includes(QUERY.contains))
    print({ needle: QUERY.contains, count: hits.length, byLayer: hits.reduce((a, h) => { a[h.layer] = (a[h.layer] || 0) + 1; return a }, {}), hits: hits.map(doc => ({ layer: doc.layer, location: docLocation(doc), pointer: doc.pointer, evidence: snippetOf(doc.text, doc.text.indexOf(QUERY.contains), QUERY.contains.length) })) })
  }
  if (QUERY.leak) {
    const hits = docs.filter(doc => doc.text.includes(ESC_BRACE_START))
    print({ needle: 'escaped-brace', count: hits.length, byLayer: hits.reduce((a, h) => { a[h.layer] = (a[h.layer] || 0) + 1; return a }, {}), hits: hits.map(doc => ({ layer: doc.layer, location: docLocation(doc), pointer: doc.pointer, evidence: snippetOf(doc.text, doc.text.indexOf(ESC_BRACE_START), 12) })) })
  }
  if (QUERY.docs) {
    const map = {}
    for (const doc of docs) {
      const key = `${doc.layer}:${doc.pointer.split('.').slice(0, 2).join('.')}`
      map[key] = (map[key] || 0) + 1
    }
    print(map)
  }
  if (QUERY.term) {
    const term = report.terms.find(t => t.id === QUERY.term)
    if (!term) { console.log(`未知术语 id: ${QUERY.term}；可用：` + report.terms.map(t => t.id).join(', ')) } else print(term)
  }
  if (QUERY.names) print(report.properNouns)
  if (QUERY.chars) print({ traditionalTotal: report.characters.traditionalTotal, ranking: report.characters.ranking, characters: report.characters.characters, variantPairs: report.characters.variantPairs })
  if (QUERY.punct) print(report.punctuation)
  if (QUERY.icons) print(report.icons)
  if (QUERY.keywords) print(report.keywords)
  if (QUERY.upstreamDiff) print({ properDiffs: report.properNouns.diffs, storyCampDiffs: report.properNouns.storyCampDiffs, upstream: report.upstream })
  if (QUERY.unlocated) print({ count: report.unlocatedDocs, samples: report.unlocatedSamples })
  if (QUERY.english) print(report.english)
  if (QUERY.markers) print(report.markers)
} else if (JSON_ONLY) {
  console.log(JSON.stringify(report, null, 2))
} else {
  printSummary(report)
}

if (WRITE) {
  const payload = JSON.stringify(report, null, 2) + '\n'
  const outFile = path.join(OUT_DIR, 'scan-report.json')
  try {
    fs.mkdirSync(OUT_DIR, { recursive: true })
    fs.writeFileSync(outFile, payload, 'utf8')
    console.error(`\n[terms-scan] 已写入 ${rel(outFile)}`)
  } catch (error) {
    // DSH 沙箱下 node 可能无法写 workspace（EPERM）；回退到系统临时目录，便于人工转存。
    const tmpFile = path.join(os.tmpdir(), 'eote-terms-scan-report.json')
    try {
      fs.writeFileSync(tmpFile, payload, 'utf8')
      console.error(`\n[terms-scan] workspace 写入被拒（${error.code}），已回退写入临时目录：${tmpFile}`)
      console.error('[terms-scan] 在非沙箱环境重跑 --write 可得到 report 位于 ' + rel(outFile))
    } catch (fallbackError) {
      console.error(`\n[terms-scan] 写盘失败：${fallbackError.message}`)
    }
  }
}

function printSummary (r) {
  const out = []
  out.push(`== terms-scan @ ${r.generatedAt}  (Mod: ${r.modRoot})`)
  out.push('语料层：' + r.layers.map(l => `${l.layer}=${l.docs}条/${l.cjkChars}汉字`).join('  '))
  out.push(`docs=${r.docsTotal}  unlocated=${r.unlocatedDocs}  warnings=${r.warnings.length}`)
  out.push('')
  out.push('-- 术语变体（count>0 全部列出；P=推荐 V=变体 E=错误 N=注意）')
  for (const term of r.terms) {
    const active = term.variants.filter(v => v.count > 0)
    if (!active.length) { out.push(`  ${term.id} (${term.en}) → ${term.recommended}: 无命中`); continue }
    out.push(`  ${term.id} (${term.en}) → ${term.recommended}`)
    for (const v of active) {
      const badge = v.status === 'preferred' ? 'P' : v.status === 'error' ? 'E' : v.status === 'variant' ? 'V' : 'N'
      out.push(`    [${badge}] ${v.zh}: ${v.count}  (` + LAYERS.filter(l => v.byLayer[l]).map(l => `${l}=${v.byLayer[l]}`).join(',') + ')')
    }
  }
  out.push('')
  out.push('-- 专名对照差异（卡面 vs 模块常量）')
  for (const d of r.properNouns.diffs) out.push('  ' + JSON.stringify(d))
  out.push('-- story 记录标签营地名 vs 卡面')
  for (const d of r.properNouns.storyCampDiffs) if (d.match === false) out.push('  ' + JSON.stringify(d))
  out.push('-- story 伙伴名记录层语言')
  out.push('  ' + r.properNouns.storyPartnerNameRows.map(x => `${x.code}:${x.status}/${x.hasChinese ? 'zh' : 'EN'}`).join('  '))
  out.push('-- 规则书用词与卡面不一致的专名')
  for (const u of r.properNouns.rulebookUsage) if (u.hits.some(h => h.form !== u.canonical)) out.push('  ' + JSON.stringify(u))
  out.push('')
  out.push('-- 简繁/异体：繁体字命中 Top 30')
  for (const row of r.characters.ranking.slice(0, 30)) out.push(`  ${row.char}→${row.simplified}: ${row.count}  (${LAYERS.filter(l => row.byLayer[l]).map(l => `${l}=${row.byLayer[l]}`).join(',')})`)
  out.push(`  合计繁体字命中：${r.characters.traditionalTotal}`)
  out.push('  异体对：' + r.characters.variantPairs.map(p => `${p.trad}/${p.simp}:${p.tradCount}/${p.simpCount}`).join('  '))
  out.push('')
  out.push('-- 标点/数字（每层计数；仅列合计>0）')
  for (const [id, row] of Object.entries(r.punctuation.rows)) {
    if (!row.total) continue
    out.push(`  ${id} (${row.label}): total=${row.total}  ` + LAYERS.map(l => `${l}=${row.byLayer[l]}`).join(' '))
  }
  out.push('')
  out.push('-- 关键词与卡面不一致（EN 命中但 ZH 卡面不含 keywords.js 译名）')
  for (const kw of r.keywords.keywords) {
    if (kw.enMatched.length) out.push(`  ${kw.id}(${kw.zh}): ${kw.enMatched.length} 张 → ` + kw.enMatched.slice(0, 8).map(x => `${x.code}/${x.nameZh}`).join(', ') + (kw.synonymHits.length ? `  [实际写法: ${[...new Set(kw.synonymHits.flatMap(x => x.used))].join('/')}]` : ''))
  }
  out.push('')
  out.push('-- 卡面 EN→ZH 图标 token 不一致 Top')
  for (const pair of r.icons.cardTokens.pairs.slice(0, 15)) out.push(`  [${pair.enToken}]→[${pair.zhToken}]: ${pair.count} 张 (${pair.cards.slice(0, 6).join(',')})`)
  out.push(`  token 不一致卡数：${r.icons.cardTokens.tokenSwapCards}`)
  out.push('')
  out.push('-- 特性值分布（08 段 traitsZh）')
  out.push('  ' + Object.entries(r.keywords.traitCounts).slice(0, 40).map(([k, v]) => `${k}:${v.count}`).join('  '))
  out.push('-- EN trait→ZH trait 多译分布（>1 种写法的）')
  for (const [en, map] of Object.entries(r.keywords.traitPairs)) {
    const entries = Object.entries(map)
    if (entries.length > 1) out.push(`  ${en}: ` + entries.map(([zh, n]) => `${zh}:${n}`).join(' '))
  }
  out.push('')
  out.push('-- 中译层英文残留（去 token 后）')
  out.push('  ' + LAYERS.map(l => `${l}=${r.english.byLayer[l]}词/${r.english[`${l}DocsWithEnglish`] || 0}条`).join('  '))
  out.push('  top: ' + Object.entries(r.english.topWords).slice(0, 25).map(([w, n]) => `${w}:${n}`).join('  '))
  out.push('')
  out.push('-- 内部标记泄漏')
  out.push('  ' + Object.entries(r.markers).filter(([, v]) => v.total).map(([k, v]) => `${k}:${v.total}`).join('  ') || '  无')
  out.push('')
  out.push('-- 上游对照：比较字段 ' + r.upstream.comparedFields + '，一致 ' + r.upstream.same + '，差异 ' + r.upstream.diffCount)
  out.push('-- 图标 token 总数：' + Object.entries(r.icons.tokens).filter(([, v]) => v.total).map(([k, v]) => `${k}:${v.total}`).join('  '))
  const unknown = Object.entries(r.icons.unknownTokens)
  if (unknown.length) out.push('-- 未知方括号 token：' + unknown.map(([k, v]) => `${k}:${v.total}`).join('  '))
  out.push('')
  out.push('复现：node docs/edgeOfTheEarth/translate/tools/terms-scan.mjs --write')
  console.log(out.join('\n'))
}
