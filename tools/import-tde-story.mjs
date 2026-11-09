#!/usr/bin/env node
// 《食梦者》剧情自译生成器（P8-T / M3-C）。
//
// 口径（路线图 §8.5 / docs/tde-story.md / D2）：
//   · 中文剧情是**自译补齐**，不是官方中文：生成物必须带
//     `sourceKind: 'self-translated'` 与 `officialChinese: false`；
//   · 底本是锁定的 en locale（参考资源/.../locales/en/theDreamEaters/** 9 文件）；
//     生成器只从 `content/campaigns/theDreamEaters/story-source/batch-*.json` 读**自译正文**，
//     运行时不读参考资源；工具在 build 期读 en 源做覆盖校验与来源锁；
//   · 14 个翻译批 + 批 00（术语表）见 BATCHES；8 章各一批（06–13），
//     base 剧情分 01（序章/结构）、02–04（幕间 I/II/III）、05（16 段尾声）、14（附加规则）；
//   · 生成物：`content/campaigns/theDreamEaters/story-text.js` + `audit/tde-story-acceptance.json`；
//     `--check` 逐字节复算二者，并校验覆盖/标记/占位符/图标/英文残留；
//   · 每批可单测：`--check-batch batch-07`（worker 在交活前必须过）。
//
// 用法：
//   node tools/import-tde-story.mjs --extract         # 生成 worker 输入（artifacts/.../p8t）
//   node tools/import-tde-story.mjs --write           # 校验全部批次并写 story-text.js + 账本
//   node tools/import-tde-story.mjs --check           # 复算并逐字节比对（门禁）
//   node tools/import-tde-story.mjs --check-batch 07  # 单批校验（worker 用）
import { existsSync } from 'node:fs'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

import { ALL_CARDS } from '../src/cards/cards-data.js'
import { RECORD_LABELS } from '../content/campaigns/theDreamEaters/record-labels.js'
import { chapters } from '../content/campaigns/theDreamEaters/shared.js'
import {
  TDE_CHAPTER_TITLES, TDE_CONCEPT_TERMS, TDE_FORBIDDEN_VARIANTS, TDE_ICON_TOKENS,
  TDE_INVESTIGATOR_TITLES, TDE_KEYWORD_TERMS, TDE_PART_TITLES, TDE_STORY_TERMS_META,
} from '../content/campaigns/theDreamEaters/story-terms.js'

const ROOT = fileURLToPath(new URL('../', import.meta.url))
const EN_ROOT = path.join(ROOT, '../../参考资源/ArkhamHorror-main/frontend/src/locales/en/theDreamEaters')
const SOURCE_DIR = path.join(ROOT, 'content/campaigns/theDreamEaters/story-source')
const STORY_TEXT = path.join(ROOT, 'content/campaigns/theDreamEaters/story-text.js')
const LEDGER = path.join(ROOT, 'audit/tde-story-acceptance.json')
const WORK_DIR = path.join(ROOT, 'artifacts/migration/tde/p8t')
const GENERATED_BY = 'tools/import-tde-story.mjs'

export const SCENARIO_IDS = Object.freeze([
  'beyondTheGatesOfSleep', 'wakingNightmare', 'theSearchForKadath', 'aThousandShapesOfHorror',
  'darkSideOfTheMoon', 'pointOfNoReturn', 'whereTheGodsDwell', 'weaverOfTheCosmos',
])
export const EN_FILES = Object.freeze(['base.json', ...SCENARIO_IDS.map(id => `scenarios/${id}.json`)])

// 逐章翻译批次：06–13。用 scenario 文件名定位（= 章节 id）。
const CHAPTER_BATCHES = Object.freeze([
  ['06', 'beyondTheGatesOfSleep', '梦境门外（A1）'],
  ['07', 'wakingNightmare', '清醒噩梦（B1）'],
  ['08', 'theSearchForKadath', '寻觅卡达斯（A2）'],
  ['09', 'aThousandShapesOfHorror', '万千骇形（B2）'],
  ['10', 'darkSideOfTheMoon', '月之暗面（A3）'],
  ['11', 'pointOfNoReturn', '无归之地（B3）'],
  ['12', 'whereTheGodsDwell', '神居之所（A4）'],
  ['13', 'weaverOfTheCosmos', '编织宇宙（B4）'],
])

// base.json 的叙事批次（批 00 是术语表，无正文文件）。
const BASE_BATCHES = Object.freeze([
  {
    id: '01', title: '序章与战役结构', worker: 'w-p8t-base1',
    flavorText: ['prologueOpening', 'prologue', 'campaignStructure'],
    question: '*',
  },
  {
    id: '02', title: '幕间 I：黑猫', worker: 'w-p8t-base1',
    flavorText: [
      'theBlackCat', 'theBlackCat1', 'theBlackCat2', 'theBlackCat3', 'youAreOnYourOwn',
      'theBlackCatSharedKnowledgeOfTheDreamlands', 'theBlackCatDeliveredNewsOfYourPlight',
      'theBlackCatWarnedTheOthers', 'okayFineHaveItYourWayThen',
    ],
    label: [
      'theBlackCat2NewsOfYourPlight', 'theBlackCat2KnowledgeOfDreamlands',
      'theBlackCat2WarnTheOthers', 'theBlackCat2DontTrust', 'blackCatWandersOff',
    ],
  },
  {
    id: '03', title: '幕间 II：入梦者', worker: 'w-p8t-base2',
    flavorText: [
      'theOneironauts1', 'wheresBlondie', 'youAskedForIt', 'youDidNotAskForIt', 'theOneironauts2',
      'atLeastOneNotCaptured', 'allCaptured', 'searchingForTheTruth', 'nowWhereWasI',
      'theBlackCatRequestedAidFromTheOthers', 'warnedTheOthersStory', 'sharedTheKnowledgeStory',
    ],
    label: ['youDidNotAskForItRequestAid', 'youDidNotAskForItKnowledgeOfUnderworld', 'youDidNotAskForItWarnTheOthers', 'blackCatBoundsOff'],
  },
  {
    id: '04', title: '幕间 III：伟大的存在', worker: 'w-p8t-base2',
    flavorText: [
      'theGreatOnes1', 'theGreatOnes1GrowWeaker', 'theGreatOnes1Searching', 'theGreatOnes1YouAskedForIt',
      'theGreatOnes1Part2', 'theGreatOnes2', 'theGreatOnes2TheSilverKey', 'theGreatOnes2Searching',
      'theGreatOnes2Part2', 'theGreatOnes2Nyarlathotep', 'theGreatOnes2AtlachNacha',
    ],
    label: ['theGreatOnes1SpokeOfNyarlathotep', 'theGreatOnes1SpokeOfAtlachNacha'],
  },
  {
    id: '05', title: '16 段尾声矩阵', worker: 'w-p8t-base3',
    flavorText: ['epilogueMatrix', ...Array.from({ length: 16 }, (_, index) => `epilogue${index + 1}`), 'brokeTheLawOfUlthar'],
  },
  {
    id: '14', title: '关键词/附加规则/界面杂项与终审', worker: 'w-p8t-base3',
    additionalRules: '*',
  },
])

export const BATCHES = Object.freeze([
  { id: '00', title: '术语表与来源锁（Lead）', worker: 'lead', kind: 'glossary' },
  ...BASE_BATCHES.map(batch => ({ ...batch, kind: 'base', file: 'base.json' })),
  ...CHAPTER_BATCHES.map(([id, scenarioId, title]) => ({
    id, title: `章节：${title}`, kind: 'scenario', file: `scenarios/${scenarioId}.json`, scenarioId,
    worker: `w-p8t-${scenarioId}`,
  })),
])
export const BATCH_FILES = Object.freeze(BATCHES.filter(batch => batch.kind !== 'glossary').map(batch => batch.id))
// 批次 → 翻译批次文件名（story-source/batch-<id>.json）
export const batchFileName = id => `batch-${id}.json`
const BATCH_BY_ID = new Map(BATCHES.map(batch => [batch.id, batch]))

// ---------------------------------------------------------------------------
// 基础工具：遍历 / 清洗 / 路径
// ---------------------------------------------------------------------------
export function walkLeaves(value, prefix = '', out = []) {
  if (Array.isArray(value)) {
    value.forEach((child, index) => walkLeaves(child, `${prefix}[${index}]`, out))
    return out
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) walkLeaves(child, prefix ? `${prefix}.${key}` : key, out)
    return out
  }
  if (typeof value === 'string') out.push([prefix, value])
  return out
}

const ICON_PLACEHOLDERS = Object.freeze({
  tablet: '[tablet]', elderThing: '[elder_thing]', skull: '[skull]', fast: '[fast]',
  cultist: '[cultist]', elderSign: '[elder_sign]', autoFail: '[auto_fail]', frost: '[frost]',
})

const HTML_ENTITIES = Object.freeze({
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'",
  '&rsquo;': '’', '&lsquo;': '‘', '&ldquo;': '“', '&rdquo;': '”',
  '&mdash;': '—', '&ndash;': '–', '&nbsp;': ' ', '&hellip;': '…', '&aacute;': 'á',
})

/** HTML → 纯文本（与 P8 的 text-en 清洗口径一致，另外保留 [icon]/段落/项目符号）。 */
export function cleanText(raw) {
  let text = String(raw)
  // 表格/图片/样式元素：剧情里只有 epilogueMatrix 的矩阵表与 gatherSets 的组图标，属 UI 数据，不进入正文。
  text = text.replace(/<table[\s\S]*?<\/table>/gi, '')
  text = text.replace(/<img[^>]*>/gi, '')
  text = text.replace(/<br\s*\/?>/gi, '\n')
  text = text.replace(/<\/p>/gi, '\n\n')
  text = text.replace(/<p[^>]*>/gi, '')
  text = text.replace(/<li[^>]*>/gi, '\n• ')
  text = text.replace(/<\/li>/gi, '\n')
  text = text.replace(/<\/(ul|ol)>/gi, '\n')
  text = text.replace(/<(ul|ol)[^>]*>/gi, '\n')
  text = text.replace(/<[^>]+>/g, '')
  text = text.replace(/&#(\d+);/g, (match, code) => String.fromCodePoint(Number(code)))
  text = text.replace(/&[a-z#0-9]+;/gi, match => HTML_ENTITIES[match] ?? match)
  text = text.replace(/\{setImgPath\}[^'"\s<)]*/g, '')
  // 上游 locale 对少数占位符做了 i18n 转义（{'{'}elderThing{'}'}），先还原成 {elderThing} 再转图标。
  text = text.replaceAll("{'{'}elderThing{'}'}", '{elderThing}')
  text = text.replaceAll("{'{'}tablet{'}'}", '{tablet}')
  text = text.replaceAll("{'{'}fast{'}'}", '{fast}')
  for (const [name, token] of Object.entries(ICON_PLACEHOLDERS)) {
    text = text.replaceAll(`{${name}}`, token)
  }
  text = text.replace(/\*\*([^*]+)\*\*/g, '$1')
  text = text.replace(/\*([^*\n]+)\*/g, '$1')
  text = text.replace(/(^|[\s("'“‘>])_([^_\n]+)_(?=$|[\s.,;:!?)\]}"”’])/g, '$1$2')
  text = text.split('\n').map(line => line.replace(/[ \t]+/g, ' ').trim()).join('\n')
  text = text.replace(/\n{3,}/g, '\n\n').trim()
  return text
}

export const paragraphsOf = text => String(text).split(/\n{2,}/).map(part => part.trim()).filter(Boolean)

const getPath = (object, dotted) => {
  let cursor = object
  const tokens = String(dotted).match(/[^.[\]]+|\[\d+\]/g) || []
  for (const raw of tokens) {
    const index = raw.startsWith('[') ? Number(raw.slice(1, -1)) : raw
    if (cursor == null) return undefined
    cursor = cursor[index]
  }
  return cursor
}

const setPath = (object, dotted, value) => {
  const tokens = String(dotted).match(/[^.[\]]+|\[\d+\]/g) || []
  let cursor = object
  tokens.forEach((raw, position) => {
    const key = raw.startsWith('[') ? Number(raw.slice(1, -1)) : raw
    if (position === tokens.length - 1) { cursor[key] = value; return }
    if (cursor[key] == null) cursor[key] = String(tokens[position + 1]).startsWith('[') ? [] : {}
    cursor = cursor[key]
  })
}

const sha256 = value => createHash('sha256').update(value).digest('hex')

// ---------------------------------------------------------------------------
// en 源载入 + 可翻译条目（跳过 UI 数据与引用）
// ---------------------------------------------------------------------------
const SCENARIO_EXCLUDED = Object.freeze([
  { prefix: 'tokens', reason: '混乱标记效果已由各章 chaos.js 的 tokenMeanings 中文化（引擎只读那份），不重复翻译' },
  { prefix: 'tooltips', reason: '地点/卡面 tooltip 属行为层数据（章节 flags/behavior 已有中文），不进入剧情正文' },
])

export async function loadEnSources() {
  const en = {}
  for (const file of EN_FILES) {
    const raw = await readFile(path.join(EN_ROOT, file), 'utf8')
    en[file] = { raw, json: JSON.parse(raw), sha256: sha256(raw) }
  }
  return en
}

const isExcludedScenarioPath = dotted => SCENARIO_EXCLUDED.some(entry => dotted === entry.prefix || dotted.startsWith(`${entry.prefix}.`) || dotted.startsWith(`${entry.prefix}[`))

/** 全部可翻译条目：Map<key, {file, path, en, clean, paragraphs}>，key = `<file>#<dotted>`。 */
export function collectTranslatable(en) {
  const entries = new Map()
  const excluded = []
  const add = (file, dotted, raw) => {
    const clean = cleanText(raw)
    if (!clean) { excluded.push({ key: `${file}#${dotted}`, reason: '清洗后为空（纯图片/占位）' }); return }
    entries.set(`${file}#${dotted}`, { file, path: dotted, key: `${file}#${dotted}`, en: raw, clean, paragraphs: paragraphsOf(clean) })
  }
  const base = en['base.json'].json
  const auto = autoTexts()
  for (const [dotted, raw] of walkLeaves(base)) {
    if (/^specialRules\[\d+\]\.(title|body)$/.test(dotted)) continue // 由 additionalRules 派生
    if (dotted === 'key' || dotted.startsWith('key.')) continue // 55 记录标签自动复用 RECORD_LABELS
    // 章节标题/线名复用 shared.js 中文名，不进入翻译批次。
    if (dotted.startsWith('label.') && dotted.slice('label.'.length) in auto.labels) continue
    add('base.json', dotted, raw)
  }
  for (const scenarioId of SCENARIO_IDS) {
    const file = `scenarios/${scenarioId}.json`
    for (const [dotted, raw] of walkLeaves(en[file].json)) {
      if (String(raw).startsWith('@:')) { excluded.push({ key: `${file}#${dotted}`, reason: 'locale 引用（由目标键派生）' }); continue }
      if (isExcludedScenarioPath(dotted)) { excluded.push({ key: `${file}#${dotted}`, reason: SCENARIO_EXCLUDED.find(entry => dotted === entry.prefix || dotted.startsWith(`${entry.prefix}.`) || dotted.startsWith(`${entry.prefix}[`)).reason }); continue }
      add(file, dotted, raw)
    }
  }
  return { entries, excluded }
}

/** 批次 → 该批必须翻译的 key 列表（顺序稳定）。 */
export function batchKeys(batch, translatable) {
  const keys = []
  if (batch.kind === 'scenario') {
    for (const key of translatable.keys()) if (key.startsWith(`${batch.file}#`)) keys.push(key)
    return keys
  }
  const base = translatable
  if (batch.flavorText) {
    const selectors = batch.flavorText
    for (const key of base.keys()) {
      const match = key.match(/^base\.json#flavorText\.([^.]+)\.(title|body)$/)
      if (!match) continue
      if (selectors === '*' || selectors.includes(match[1])) keys.push(key)
    }
  }
  if (batch.label) {
    const selectors = batch.label
    for (const key of base.keys()) {
      const match = key.match(/^base\.json#label\.([^.]+)$/)
      if (!match) continue
      if (selectors === '*' || selectors.includes(match[1])) keys.push(key)
    }
  }
  if (batch.question) {
    for (const key of base.keys()) if (/^base\.json#question\.[^.]+$/.test(key)) keys.push(key)
  }
  if (batch.additionalRules) {
    for (const key of base.keys()) if (key.startsWith('base.json#additionalRulesAndClarifications.')) keys.push(key)
  }
  return keys
}

export function batchSpecification() {
  return BATCHES.map(batch => ({
    ...batch,
    file: batch.kind === 'scenario' ? batch.file : batch.kind === 'base' ? 'base.json' : null,
    output: batch.kind === 'glossary' ? null : `content/campaigns/theDreamEaters/story-source/${batchFileName(batch.id)}`,
  }))
}

// ---------------------------------------------------------------------------
// 自动复用的中文文本（不是自译正文，来自已中文化的游戏数据）
// ---------------------------------------------------------------------------
const chapterById = new Map(chapters.map(chapter => [chapter.id, chapter]))
const partZh = Object.fromEntries(TDE_PART_TITLES.map(entry => [entry.en, entry.zh]))

export function autoTexts() {
  const labels = {}
  for (const chapter of chapters) labels[chapter.id] = chapter.name
  labels.theDreamQuest = partZh['The Dream-Quest']
  labels.theWebOfDreams = partZh['The Web of Dreams']
  return {
    labels,
    recordLabels: { ...RECORD_LABELS },
    keywords: TDE_KEYWORD_TERMS,
    chapterTitles: TDE_CHAPTER_TITLES,
    investigatorTitles: TDE_INVESTIGATOR_TITLES,
    concepts: TDE_CONCEPT_TERMS,
  }
}

// ---------------------------------------------------------------------------
// 批文件读写 + 校验
// ---------------------------------------------------------------------------
export const batchFilePath = id => path.join(SOURCE_DIR, batchFileName(id))

const allowedLatin = new Set(['XP'])

function iconTokensIn(text) {
  const counts = {}
  for (const name of TDE_ICON_TOKENS) {
    const count = (String(text).match(new RegExp(`\\[${name}\\]`, 'g')) || []).length
    if (count) counts[name] = count
  }
  return counts
}

const keywordMatchers = TDE_KEYWORD_TERMS.map(entry => ({
  zh: entry.zh,
  en: new RegExp(`\\b${entry.en}\\b`, 'i'),
  word: entry.en,
}))

/** 单条译文校验（返回问题数组；空 = 通过）。 */
export function validateEntry(key, source, value) {
  const problems = []
  const where = `[${key}]`
  if (typeof value !== 'string' || !value.trim()) return [`${where} 译文为空`]
  const zh = value.trim()
  if (zh !== value) problems.push(`${where} 首尾有空白`)
  if (zh.includes('<') && /<[a-zA-Z/]/.test(zh)) problems.push(`${where} 含 HTML 标签`)
  if (zh.includes('{')) problems.push(`${where} 残留 {占位符}（应译成中文或换成 [icon]）`)
  // 图标记号 [elder_thing] 自带下划线：先剥图标再查强调标记残留。
  if (/[*_]/.test(zh.replace(/\[[a-z_]+\]/g, ''))) problems.push(`${where} 含 * 或 _（UI 不解析强调标记，改用「」或去掉）`)
  const zhParagraphs = paragraphsOf(zh)
  const enParagraphs = source.paragraphs
  if (zhParagraphs.length !== enParagraphs.length) {
    problems.push(`${where} 段落数 ${zhParagraphs.length} ≠ 英文 ${enParagraphs.length}（必须逐段对应，不得合并/拆分）`)
  }
  enParagraphs.forEach((paragraph, index) => {
    const isBullet = paragraph.startsWith('• ')
    const zhParagraph = zhParagraphs[index] || ''
    if (isBullet && !zhParagraph.startsWith('• ')) problems.push(`${where} 第 ${index + 1} 段是项目符号，译文需以「• 」开头`)
    if (!isBullet && zhParagraph.startsWith('• ')) problems.push(`${where} 第 ${index + 1} 段不是项目符号，译文不要加「• 」`)
  })
  const enIcons = iconTokensIn(source.clean)
  const zhIcons = iconTokensIn(zh)
  for (const name of TDE_ICON_TOKENS) {
    if ((enIcons[name] || 0) !== (zhIcons[name] || 0)) {
      problems.push(`${where} 图标标记 [${name}] 数量 ${zhIcons[name] || 0} ≠ 英文 ${enIcons[name] || 0}`)
    }
  }
  // 英文残留：去掉 [icon] / [[trait]] / 数字编号后不应再有 4+ 字母英文单词。
  const stripped = zh.replace(/\[\[[^\]]+\]\]/g, '').replace(/\[[a-z_]+\]/g, '')
  for (const match of stripped.matchAll(/[A-Za-z]{4,}/g)) {
    if (!allowedLatin.has(match[0])) problems.push(`${where} 残留英文 «${match[0]}»（专名/术语都应译成中文；XP 例外）`)
  }
  const enLength = source.clean.length
  const ratio = enLength >= 20 ? zh.length / enLength : 1
  if (enLength >= 20 && (ratio < 0.08 || ratio > 1.05)) problems.push(`${where} 长度比 ${ratio.toFixed(2)} 异常（英文 ${enLength} / 中文 ${zh.length}）`)
  if (enLength >= 40 && zh === source.clean) problems.push(`${where} 与英文原文完全相同（未翻译）`)
  for (const rule of TDE_FORBIDDEN_VARIANTS) {
    const regex = new RegExp(rule.pattern)
    if (regex.test(zh)) problems.push(`${where} 术语不一致：命中「${rule.pattern}」，应改为「${rule.correct}」（${rule.reason}）`)
  }
  for (const matcher of keywordMatchers) {
    if (matcher.en.test(source.clean) && !zh.includes(matcher.zh)) {
      problems.push(`${where} 英文出现关键词 ${matcher.word}，译文必须含「${matcher.zh}」`)
    }
  }
  return problems
}

export async function readBatchFile(id) {
  const file = batchFilePath(id)
  if (!existsSync(file)) return { id, file: batchFileName(id), exists: false, problems: [`缺少批次文件 ${batchFileName(id)}`] }
  let data
  try {
    data = JSON.parse(await readFile(file, 'utf8'))
  } catch (error) {
    return { id, file: batchFileName(id), exists: true, problems: [`JSON 解析失败：${error.message}`] }
  }
  const problems = []
  if (data.schemaVersion !== 1) problems.push('schemaVersion 必须为 1')
  if (data.batch !== id) problems.push(`batch 字段 ${JSON.stringify(data.batch)} ≠ ${id}`)
  if (!data.entries || typeof data.entries !== 'object' || Array.isArray(data.entries)) problems.push('entries 必须是对象')
  return { id, file: batchFileName(id), exists: true, data, problems }
}

/** 校验一批（结构 + 覆盖 + 逐条译文）。 */
export async function validateBatch(id, en, translatable) {
  const batch = BATCH_BY_ID.get(id)
  if (!batch || batch.kind === 'glossary') return { id, ok: false, problems: [`未知批次 ${id}`], missing: [], extra: [] }
  const expectedKeys = batchKeys(batch, translatable)
  const expected = new Map(expectedKeys.map(key => [key, translatable.get(key)]))
  const read = await readBatchFile(id)
  const problems = [...read.problems]
  if (!read.data) return { id, ok: false, problems, missing: expectedKeys, extra: [], expectedKeys }
  const entries = read.data.entries
  const missing = expectedKeys.filter(key => !(key in entries))
  const extra = Object.keys(entries).filter(key => !expected.has(key))
  for (const key of missing) problems.push(`缺少 key：${key}`)
  for (const key of extra) problems.push(`多余 key（不属于本批）：${key}`)
  for (const key of expectedKeys) {
    if (!(key in entries)) continue
    problems.push(...validateEntry(key, expected.get(key), entries[key]))
  }
  if (problems.length === 0) {
    if (read.data.translator && typeof read.data.translator !== 'string') problems.push('translator 必须是字符串')
  }
  return {
    id, ok: problems.length === 0, problems, missing, extra, expectedKeys,
    translator: read.data.translator || null,
    keys: expectedKeys.length,
    enChars: expectedKeys.reduce((sum, key) => sum + expected.get(key).clean.length, 0),
    zhChars: expectedKeys.reduce((sum, key) => sum + String(entries[key] || '').trim().length, 0),
  }
}

export async function validateAllBatches(en) {
  const { entries: translatable, excluded } = collectTranslatable(en)
  const results = []
  for (const id of BATCH_FILES) results.push(await validateBatch(id, en, translatable))
  return { translatable, excluded, results }
}

// ---------------------------------------------------------------------------
// 组装 story-text
// ---------------------------------------------------------------------------
function fillAuto(mirror, en, auto) {
  // 记录标签：RECORD_LABELS（与游戏内 UI 一致，不自造译名）。
  for (const [key, value] of Object.entries(auto.recordLabels)) setPath(mirror, `key.${key}`, value)
  // 章节标题 / 线名：来自 content 已公开的中文名。
  for (const [key, value] of Object.entries(auto.labels)) setPath(mirror, `label.${key}`, value)
  // specialRules 的 @: 引用从 additionalRules 派生。
  const base = en['base.json'].json
  mirror.specialRules = (base.specialRules || []).map(item => {
    const resolve = raw => {
      const text = String(raw)
      if (!text.startsWith('@:theDreamEaters.')) return text
      const target = text.slice('@:theDreamEaters.'.length)
      const resolved = getPath(mirror, target)
      return typeof resolved === 'string' ? resolved : text
    }
    return {
      title: resolve(item.title),
      body: resolve(item.body),
      source: item.title,
    }
  })
}

function buildProphecy(base) {
  const flavor = base.flavorText || {}
  const pick = key => ({
    title: getPath(flavor, `${key}.title`) || key,
    paragraphs: paragraphsOf(getPath(flavor, `${key}.body`) || ''),
  })
  return {
    opening: pick('prologueOpening'),
    prologue: pick('prologue'),
    structure: pick('campaignStructure'),
  }
}

const INTERLUDE_GROUPS = Object.freeze([
  ['interlude1', '幕间 I：黑猫', ['theBlackCat', 'theBlackCat1', 'theBlackCat2', 'theBlackCat3', 'youAreOnYourOwn', 'theBlackCatSharedKnowledgeOfTheDreamlands', 'theBlackCatDeliveredNewsOfYourPlight', 'theBlackCatWarnedTheOthers', 'okayFineHaveItYourWayThen']],
  ['interlude2', '幕间 II：入梦者', ['theOneironauts1', 'wheresBlondie', 'youAskedForIt', 'youDidNotAskForIt', 'theOneironauts2', 'atLeastOneNotCaptured', 'allCaptured', 'searchingForTheTruth', 'nowWhereWasI', 'theBlackCatRequestedAidFromTheOthers', 'warnedTheOthersStory', 'sharedTheKnowledgeStory']],
  ['interlude3', '幕间 III：伟大的存在', ['theGreatOnes1', 'theGreatOnes1GrowWeaker', 'theGreatOnes1Searching', 'theGreatOnes1YouAskedForIt', 'theGreatOnes1Part2', 'theGreatOnes2', 'theGreatOnes2TheSilverKey', 'theGreatOnes2Searching', 'theGreatOnes2Part2', 'theGreatOnes2Nyarlathotep', 'theGreatOnes2AtlachNacha']],
])

function buildInterludes(base) {
  const flavor = base.flavorText || {}
  const interludes = {}
  for (const [groupId, title, keys] of INTERLUDE_GROUPS) {
    interludes[groupId] = {
      title,
      sections: keys.map(key => ({
        key: `theDreamEaters.flavorText.${key}`,
        title: getPath(flavor, `${key}.title`) || key,
        paragraphs: paragraphsOf(getPath(flavor, `${key}.body`) || ''),
      })),
    }
  }
  return interludes
}

function buildEpilogue(base) {
  const flavor = base.flavorText || {}
  const matrix = flavor.epilogueMatrix || {}
  const cells = Array.from({ length: 16 }, (_, index) => {
    const key = `epilogue${index + 1}`
    return {
      id: index + 1,
      key: `theDreamEaters.flavorText.${key}`,
      title: getPath(flavor, `${key}.title`) || key,
      paragraphs: paragraphsOf(getPath(flavor, `${key}.body`) || ''),
    }
  })
  return {
    matrix: { title: matrix.title || '尾声', paragraphs: paragraphsOf(matrix.body || '') },
    cells,
    special: {
      brokeTheLawOfUlthar: {
        key: 'theDreamEaters.flavorText.brokeTheLawOfUlthar',
        title: getPath(flavor, 'brokeTheLawOfUlthar.title') || 'brokeTheLawOfUlthar',
        paragraphs: paragraphsOf(getPath(flavor, 'brokeTheLawOfUlthar.body') || ''),
      },
    },
  }
}

const NARRATION_PATTERN = /^(intro|intro\d+|flavorText(\.|$)|grandDesign\d+|theSpiderQueen\d+|regionSetup|closeWatch|theEyeOfChaos|theDoomThatCameBefore|remembered|tooltips|thePath|dreamSelection|dreams(\.|$)|besetByMonsters|privateRoom|waresOfBaharna|dreamlandsEclipse|heading$)/

function buildChapters(scrolls) {
  const result = {}
  const RESOLUTION_LABEL = /^(?:结局|尾声|无结局)\s*\d*\s*[:：]\s*/
  const stripResolutionLabels = mirror => {
    const resolutions = mirror?.resolutions
    if (!resolutions || typeof resolutions !== 'object') return
    for (const value of Object.values(resolutions)) {
      if (!value || typeof value !== 'object') continue
      if (typeof value.body === 'string') value.body = value.body.replace(RESOLUTION_LABEL, '').trim()
      if (typeof value.text === 'string') value.text = value.text.replace(RESOLUTION_LABEL, '').trim()
    }
  }
  for (const chapter of chapters) {
    const mirror = scrolls[chapter.id] || {}
    // 结局正文段首「结局 N：」由 UI 标题层承载，正文不重复（story-0009）。
    stripResolutionLabels(mirror)
    const narration = []
    for (const key of Object.keys(mirror)) {
      if (!NARRATION_PATTERN.test(key)) continue
      const value = mirror[key]
      if (typeof value === 'string') {
        narration.push({ key, title: null, paragraphs: paragraphsOf(value) })
      } else if (value && typeof value === 'object') {
        if (Array.isArray(value)) {
          value.forEach((item, index) => {
            if (item && typeof item === 'object') narration.push({ key: `${key}[${index}]`, title: item.title || null, paragraphs: paragraphsOf(item.body || item.text || '') })
          })
        } else if (typeof value.body === 'string' || typeof value.text === 'string') {
          narration.push({ key, title: value.title || null, paragraphs: paragraphsOf(value.body || value.text || '') })
        } else {
          for (const [subKey, subValue] of Object.entries(value)) {
            if (!subValue || typeof subValue !== 'object') continue
            narration.push({ key: `${key}.${subKey}`, title: subValue.title || null, paragraphs: paragraphsOf(subValue.body || subValue.text || '') })
          }
        }
      }
    }
    // 章节 intro：优先用 intro/intro1..；没有 intro 键的章（如 A1 用 dreamSelection 开场）
    // 取 dreamSelection，再退到最长的叙事段（不能用标题行，也不写摘要）。
    const introFromKeys = ['intro', 'intro1', 'intro2', 'intro3', 'intro4']
      .map(key => (typeof mirror[key] === 'string' ? mirror[key] : null))
      .find(text => text && text.length > 40)
    const dreamSelection = narration.find(entry => entry.key === 'dreamSelection')
    const longestNarration = [...narration].sort((a, b) => b.paragraphs.join('').length - a.paragraphs.join('').length)[0]
    const introCandidate = introFromKeys
      || (dreamSelection ? dreamSelection.paragraphs.join('\n\n') : '')
      || (longestNarration ? longestNarration.paragraphs.join('\n\n') : '')
    const setupValue = mirror.setup
    const setup = typeof setupValue === 'string'
      ? setupValue
      : setupValue && typeof setupValue === 'object'
        ? Object.values(setupValue).filter(value => typeof value === 'string').join('\n\n')
        : ''
    result[chapter.id] = {
      status: 'translated',
      title: chapter.name,
      heading: mirror.heading || chapter.name,
      intro: introCandidate,
      setup,
      resolutions: mirror.resolutions || {},
      sections: mirror,
      narration,
    }
  }
  return result
}

const asLocaleKeys = (base, scenarios) => {
  const byKey = {}
  const flavor = base.flavorText || {}
  // 尾声正文段首「尾声 N：」由 UI 标题层承载，正文不重复（story-0009）。
  const EPILOGUE_LABEL = /^(?:结局|尾声)\s*\d*\s*[:：]\s*/
  for (const [key, value] of Object.entries(flavor)) {
    const body = value.body || value.text || ''
    byKey[`theDreamEaters.flavorText.${key}`] = {
      title: value.title || key,
      body: /^epilogue\d+$/i.test(key) && typeof body === 'string' ? body.replace(EPILOGUE_LABEL, '').trim() : body,
    }
  }
  for (const [key, value] of Object.entries(base.label || {})) byKey[`theDreamEaters.label.${key}`] = value
  for (const [key, value] of Object.entries(base.question || {})) byKey[`theDreamEaters.question.${key}`] = value
  for (const [key, value] of Object.entries(base.key || {})) byKey[`theDreamEaters.key.${key}`] = value
  for (const [key, value] of Object.entries(base.additionalRulesAndClarifications || {})) {
    byKey[`theDreamEaters.additionalRulesAndClarifications.${key}`] = value
  }
  return byKey
}

export async function assemble() {
  const en = await loadEnSources()
  const { translatable, excluded, results } = await validateAllBatches(en)
  const problems = results.flatMap(result => result.problems)
  const missingBatches = results.filter(result => !result.ok).map(result => result.id)
  // 覆盖闭环：所有可翻译 key 必须恰好分到一个批次（防止新增 en 键悄悄漏译）。
  const batchKeysAll = new Set()
  for (const batch of BATCHES) {
    if (batch.kind === 'glossary') continue
    for (const key of batchKeys(batch, translatable)) batchKeysAll.add(key)
  }
  const uncoveredKeys = [...translatable.keys()].filter(key => !batchKeysAll.has(key))
  const orphanKeys = [...batchKeysAll].filter(key => !translatable.has(key))
  if (uncoveredKeys.length) problems.push(`未分配到任何批次的可翻译 key：${uncoveredKeys.slice(0, 20).join(', ')}`)
  if (orphanKeys.length) problems.push(`批次声明但不可翻译的 key：${orphanKeys.slice(0, 20).join(', ')}`)
  const auto = autoTexts()
  // 自译正文：从批次文件合并。
  const mirrored = { base: {}, scenarios: {} }
  for (const id of BATCH_FILES) {
    const read = await readBatchFile(id)
    const batch = BATCH_BY_ID.get(id)
    const entries = read.data?.entries || {}
    for (const [key, value] of Object.entries(entries)) {
      const [file, dotted] = key.split('#')
      const target = file === 'base.json' ? mirrored.base : (mirrored.scenarios[batch.scenarioId] ||= {})
      setPath(target, dotted, String(value).trim())
    }
  }
  fillAuto(mirrored.base, en, auto)
  const base = mirrored.base
  const scenarios = mirrored.scenarios
  const payload = { base, scenarios }
  const payloadSha = sha256(JSON.stringify(payload))
  const zhChars = [...translatable.values()].reduce((sum, source) => {
    const [file, dotted] = source.key.split('#')
    const mirror = file === 'base.json' ? base : scenarios[source.file.replace(/^scenarios\//, '').replace(/\.json$/, '')]
    return sum + String(getPath(mirror, dotted) || '').length
  }, 0)
  const enChars = [...translatable.values()].reduce((sum, source) => sum + source.clean.length, 0)
  const story = {
    prologue: buildProphecy(base),
    labels: base.label || {},
    questions: base.question || {},
    recordLabels: base.key || {},
    specialRules: base.specialRules || [],
    additionalRules: base.additionalRulesAndClarifications || {},
    interludes: buildInterludes(base),
    epilogue: buildEpilogue(base),
    chapters: buildChapters(scenarios),
    keywords: auto.keywords,
    chapterTitles: auto.chapterTitles,
    investigatorTitles: auto.investigatorTitles,
    conceptTerms: auto.concepts,
    localeKeys: asLocaleKeys(base, scenarios),
    batches: results.map(result => ({
      id: result.id,
      title: BATCH_BY_ID.get(result.id).title,
      translator: result.translator,
      keys: result.keys,
      enChars: result.enChars,
      zhChars: result.zhChars,
      status: result.ok ? 'translated' : 'pending',
    })),
  }
  const meta = {
    status: missingBatches.length === 0 ? 'translated' : 'pending',
    stage: 'P8-T',
    sourceKind: TDE_STORY_TERMS_META.sourceKind,
    officialChinese: TDE_STORY_TERMS_META.officialChinese,
    generator: GENERATED_BY,
    generatedFrom: 'content/campaigns/theDreamEaters/story-source',
    glossaryVersion: TDE_STORY_TERMS_META.version,
    translationBatches: BATCHES.length,
    completedBatches: results.filter(result => result.ok).map(result => result.id),
    pendingBatches: missingBatches,
    enSourceHashes: Object.fromEntries(EN_FILES.map(file => [file, en[file].sha256])),
    zhSourceHashes: Object.fromEntries(await Promise.all(BATCH_FILES.map(async id => [batchFileName(id), existsSync(batchFilePath(id)) ? sha256(await readFile(batchFilePath(id))) : null]))),
    generatedSha256: payloadSha,
    chars: { en: enChars, zh: zhChars },
    exclusions: [
      ...SCENARIO_EXCLUDED,
      { prefix: 'base.json#specialRules[*]', reason: '_@: 引用，正文由 additionalRulesAndClarifications 派生' },
      { prefix: 'base.json#key.*', reason: '55 个记录标签复用 record-labels.js（与游戏内 UI 同词，不自造译名）' },
      { prefix: 'base.json#label.<章节/线名>', reason: '8 章标题与双线名复用 shared.js 已公开中文名' },
    ],
  }
  // 兼容既有消费方（audit-tde-scenarios 读 TDE_STORY_TEXT.meta.status）：story 根上再挂一份 meta。
  // payload（= {base, scenarios}）与 generatedSha256 不受影响。
  story.meta = meta
  const source = renderStoryText({ meta, story })
  const ledger = buildLedger({ meta, story, results, excluded, enChars, zhChars, payloadSha, problems })
  return {
    en, translatable, excluded, results, problems, missingBatches,
    meta, story, source, ledger,
    ledgerSource: `${JSON.stringify(ledger, null, 2)}\n`,
  }
}

function buildLedger({ meta, story, results, excluded, enChars, zhChars, payloadSha, problems }) {
  const checks = {
    batchesComplete: results.every(result => result.ok),
    coverage: problems.length === 0,
    markupClean: true,
    provenance: meta.sourceKind === 'self-translated' && meta.officialChinese === false,
    generated: meta.status === 'translated',
  }
  const remaining = []
  if (!checks.batchesComplete) {
    for (const result of results.filter(item => !item.ok)) remaining.push(`批 ${result.id} 未完成：${result.problems[0] || '待翻译'}`)
  }
  return {
    schemaVersion: 1,
    campaignId: 'theDreamEaters',
    stage: 'P8-T',
    milestone: 'M3-C',
    generatedBy: GENERATED_BY,
    sourceKind: meta.sourceKind,
    officialChinese: meta.officialChinese,
    status: meta.status,
    glossaryVersion: meta.glossaryVersion,
    generatedSha256: payloadSha,
    enSourceHashes: meta.enSourceHashes,
    zhSourceHashes: meta.zhSourceHashes,
    batches: results.map(result => ({
      id: result.id,
      title: BATCH_BY_ID.get(result.id).title,
      translator: result.translator,
      keys: result.keys,
      enChars: result.enChars,
      zhChars: result.zhChars,
      status: result.ok ? 'translated' : 'pending',
    })),
    coverage: {
      totalKeys: results.reduce((sum, result) => sum + result.keys, 0),
      translatedKeys: results.filter(result => result.ok).reduce((sum, result) => sum + result.keys, 0),
      batches: results.length,
      excludedKeys: excluded.length,
      excluded,
    },
    inventory: {
      chapters: Object.keys(story.chapters).length,
      epilogueCells: story.epilogue.cells.length,
      interludes: Object.keys(story.interludes).length,
      recordLabels: Object.keys(story.recordLabels).length,
      localizations: story.batches.length,
    },
    chars: { en: enChars, zh: zhChars },
    checks,
    gate: { pass: Object.values(checks).every(Boolean) },
    remaining,
  }
}

function renderStoryText({ meta, story }) {
  const header = [
    '// 食梦者（The Dream Eaters）· 剧情正文生成物（P8-T / M3-C 自译）。',
    '//',
    '// 口径（路线图 §8.5 / D2 / docs/tde-story.md）：',
    '//   · 中文剧情是**自译补齐**，不是官方中文；本文件必须保留 sourceKind/officialChinese 两个字段。',
    '//   · 底本是锁定 en locale（9 文件，哈希见 meta.enSourceHashes）；',
    '//     正文来自 content/campaigns/theDreamEaters/story-source/batch-*.json（自译），',
    '//     由 tools/import-tde-story.mjs 生成；运行时不读参考资源。',
    '//   · 不要手改本文件：改 story-source 批次或 story-terms.js 后重跑 `node tools/import-tde-story.mjs --write`，',
    '//     再用 `node tools/import-tde-story.mjs --check` 复核逐字节一致。',
    '//',
    '// 结构：prologue / labels / questions / recordLabels / specialRules / additionalRules /',
    '//   interludes（3）/ epilogue（16 格 + brokeTheLawOfUlthar）/ chapters（8）/ localeKeys（interludes、',
    '//   manifest 用的 theDreamEaters.* 键 → 中文）。',
    '',
    `export const TDE_STORY_META = ${JSON.stringify(meta, null, 2)}`,
    '',
    `export const TDE_STORY_TEXT = ${JSON.stringify(story, null, 2)}`,
    '',
    '// `theDreamEaters.*` locale 键 → 中文（interludes.js / dual-story.js / manifest.js 直接用）。',
    'export const TDE_STORY_KEYS = TDE_STORY_TEXT.localeKeys',
    '',
    'export function tdeStoryKeys(key) {',
    '  return TDE_STORY_TEXT.localeKeys[key] ?? null',
    '}',
    '',
    'export function tdeStoryChapter(id) {',
    '  return TDE_STORY_TEXT.chapters[id] ?? null',
    '}',
    '',
    'export function storyInventory() {',
    '  const chapterIds = Object.keys(TDE_STORY_TEXT.chapters)',
    '  const narrativeSections = chapterIds.reduce((total, id) => total + (TDE_STORY_TEXT.chapters[id].narration?.length || 0), 0)',
    '  const interludeSections = Object.values(TDE_STORY_TEXT.interludes).reduce((total, interlude) => total + interlude.sections.length, 0)',
    '  return {',
    '    chapters: chapterIds.length,',
    '    narrativeSections,',
    '    resolutions: Object.values(TDE_STORY_TEXT.chapters).reduce((total, chapter) => total + Object.keys(chapter.resolutions || {}).length, 0),',
    '    prologueSections: 3,',
    '    interludes: Object.keys(TDE_STORY_TEXT.interludes).length,',
    '    interludeSections,',
    '    epilogueCells: TDE_STORY_TEXT.epilogue.cells.length,',
    '    recordLabels: Object.keys(TDE_STORY_TEXT.recordLabels).length,',
    '    batches: TDE_STORY_TEXT.batches.length,',
    '    status: TDE_STORY_META.status,',
    '  }',
    '}',
    '',
  ].join('\n')
  return header
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
async function writeExtract() {
  const en = await loadEnSources()
  const { entries, excluded } = collectTranslatable(en)
  const auto = autoTexts()
  await mkdir(path.join(WORK_DIR, 'en'), { recursive: true })
  const namePairs = Object.keys(ALL_CARDS)
    .filter(code => /^06\d{3}[a-z]?$/.test(code))
    .map(code => ALL_CARDS[code])
    .filter(card => card?.name && card?.nameZh)
    .map(card => ({ en: card.name, zh: card.nameZh }))
    .filter((pair, index, list) => list.findIndex(item => item.en === pair.en) === index)
    .sort((a, b) => a.en.localeCompare(b.en))
  const batchRows = []
  let translatedChars = 0
  for (const id of BATCH_FILES) {
    const batch = BATCH_BY_ID.get(id)
    const keys = batchKeys(batch, entries)
    const items = keys.map(key => entries.get(key))
    translatedChars += items.reduce((sum, item) => sum + item.clean.length, 0)
    const payload = {
      schemaVersion: 1,
      batch: id,
      title: batch.title,
      worker: batch.worker,
      file: batch.file,
      output: `content/campaigns/theDreamEaters/story-source/${batchFileName(id)}`,
      conventions: '见 artifacts/migration/tde/p8t/P8T-WORKER-BRIEF.md 与 glossary.md',
      entries: items.map(item => ({
        key: item.key,
        file: item.file,
        path: item.path,
        paragraphs: item.paragraphs.length,
        en: item.clean,
      })),
    }
    await writeFile(path.join(WORK_DIR, 'en', `batch-${id}.json`), `${JSON.stringify(payload, null, 2)}\n`)
    batchRows.push({ id, title: batch.title, worker: batch.worker, file: batch.file, keys: keys.length, enChars: payload.entries.reduce((sum, entry) => sum + entry.en.length, 0), output: payload.output })
  }
  const glossary = [
    '# 食梦者 P8-T 术语表与专名对照（批 00）',
    '',
    `- glossaryVersion: \`${TDE_STORY_TERMS_META.version}\`；口径：**自译，非官方中文**（officialChinese: false）。`,
    `- 风格：${TDE_STORY_TERMS_META.style.punctuation} 标点；引号 ${TDE_STORY_TERMS_META.style.quote}；正文不写 HTML、不写 _斜体_/*强调*；图标保留 [skull]/[tablet] 这类方括号记号。`,
    '- 段落：**逐段对应**英文段落（空行分隔），项目符号段以「• 」开头；分支指引写「前往〈设置〉。」。',
    '- 长度：中文/英文字符比约 0.2–0.5；不要漏句、不要合并段落、不要用摘要替代原文。',
    '',
    '## 关键词（7 个，必须用官方词形）',
    '',
    '| English | 中文 |',
    '| --- | --- |',
    ...TDE_KEYWORD_TERMS.map(entry => `| ${entry.en} | ${entry.zh} |`),
    '',
    '## 章题 / 线名 / 调查员',
    '',
    '| English | 中文 |',
    '| --- | --- |',
    ...TDE_CHAPTER_TITLES.map(entry => `| ${entry.en} | ${entry.zh} |`),
    ...TDE_PART_TITLES.map(entry => `| ${entry.en} | ${entry.zh} |`),
    ...TDE_INVESTIGATOR_TITLES.map(entry => `| ${entry.en} | ${entry.zh} |`),
    '',
    '## 概念词（跨章统一）',
    '',
    '| English | 中文 |',
    '| --- | --- |',
    ...TDE_CONCEPT_TERMS.map(entry => `| ${entry.en} | ${entry.zh} |`),
    '',
    '## 高风险词形（出现即错）',
    '',
    '| 错误写法 | 应为 | 说明 |',
    '| --- | --- | --- |',
    ...TDE_FORBIDDEN_VARIANTS.map(rule => `| ${rule.pattern} | ${rule.correct} | ${rule.reason} |`),
    '',
    '## 55 个战役记录标签（正文提及记录时必须同词）',
    '',
    '| 记录键 | 中文 |',
    '| --- | --- |',
    ...Object.entries(RECORD_LABELS).map(([key, value]) => `| ${key} | ${value} |`),
    '',
    `## 卡名对照（TDE 388 条记录的 340 个英文→中文名；正文提到卡牌/地点/敌人时必须用同名）`,
    '',
    '| English | 中文 |',
    '| --- | --- |',
    ...namePairs.map(pair => `| ${pair.en} | ${pair.zh} |`),
    '',
    '## 分批与 worker',
    '',
    '| 批 | 内容 | worker | key 数 | en 字符 | 输出 |',
    '| --- | --- | --- | ---: | ---: | --- |',
    ...batchRows.map(row => `| ${row.id} | ${row.title} | ${row.worker} | ${row.keys} | ${row.enChars} | ${row.output} |`),
    '',
    `可翻译条目总计：${[...entries.values()].length} 个 key / ${translatedChars} en 字符（排除 ${excluded.length} 个 UI 数据 key，见 story-text meta.exclusions）。`,
    '',
  ].join('\n')
  await writeFile(path.join(WORK_DIR, 'glossary.md'), glossary)
  await writeFile(path.join(WORK_DIR, 'batches.json'), `${JSON.stringify({ generatedBy: GENERATED_BY, enFiles: Object.fromEntries(Object.entries(en).map(([file, data]) => [file, data.sha256])), batches: batchRows, totals: { keys: [...entries.values()].length, enChars: translatedChars, excluded: excluded.length } }, null, 2)}\n`)
  console.log(`extract: ${batchRows.length} 批 / ${[...entries.values()].length} key / ${translatedChars} en 字符`)
  console.log(`  worker 输入：${path.relative(ROOT, path.join(WORK_DIR, 'en'))}`)
  console.log(`  术语表：${path.relative(ROOT, path.join(WORK_DIR, 'glossary.md'))}`)
}

async function write() {
  const result = await assemble()
  if (result.missingBatches.length > 0) {
    console.error(`还有 ${result.missingBatches.length} 批未完成：${result.missingBatches.join(', ')}`)
    console.error(result.problems.filter((problem, index, list) => list.indexOf(problem) === index).slice(0, 40).join('\n'))
    process.exitCode = 1
    return
  }
  if (result.problems.length > 0) {
    console.error('译文校验失败：')
    console.error([...new Set(result.problems)].slice(0, 60).join('\n'))
    process.exitCode = 1
    return
  }
  await mkdir(SOURCE_DIR, { recursive: true })
  await writeFile(STORY_TEXT, result.source)
  await writeFile(LEDGER, result.ledgerSource)
  console.log(`story-text.js 已生成：${Object.keys(result.story.chapters).length} 章 / ${result.story.epilogue.cells.length} 段尾声 / ${Object.keys(result.story.recordLabels).length} 记录标签`)
  console.log(`  en ${result.meta.chars.en} 字符 → zh ${result.meta.chars.zh} 字符；generatedSha256=${result.meta.generatedSha256.slice(0, 16)}…`)
  console.log(`账本：${path.relative(ROOT, LEDGER)}（gate ${result.ledger.gate.pass ? 'pass' : 'FAIL'}）`)
}

async function check() {
  const result = await assemble()
  const failures = []
  if (result.missingBatches.length > 0) failures.push(`未完成批次：${result.missingBatches.join(', ')}`)
  if (result.problems.length > 0) failures.push(...[...new Set(result.problems)].slice(0, 40))
  const current = existsSync(STORY_TEXT) ? await readFile(STORY_TEXT, 'utf8') : null
  if (current !== result.source) failures.push('story-text.js 与 story-source 复算结果不一致（重新 --write）')
  const currentLedger = existsSync(LEDGER) ? await readFile(LEDGER, 'utf8') : null
  if (currentLedger !== result.ledgerSource) failures.push('audit/tde-story-acceptance.json 与复算结果不一致（重新 --write）')
  if (!result.ledger.gate.pass) failures.push('账本 gate 未通过')
  if (failures.length) {
    console.error('P8-T story check FAILED:')
    for (const failure of failures) console.error(`  - ${failure}`)
    process.exitCode = 1
    return
  }
  console.log(`P8-T story check OK：${Object.keys(result.story.chapters).length} 章、${result.story.epilogue.cells.length} 段尾声、${result.meta.chars.zh} 中文字符、gate pass`)
}

async function checkBatch(id) {
  const normalized = String(id).padStart(2, '0')
  const en = await loadEnSources()
  const { entries } = collectTranslatable(en)
  const result = await validateBatch(normalized, en, entries)
  if (result.ok) {
    console.log(`batch ${normalized} OK：${result.keys} key / en ${result.enChars} → zh ${result.zhChars} 字符（${result.translator || '未署名'}）`)
    return
  }
  console.error(`batch ${normalized} FAILED（${result.problems.length} 个问题）：`)
  for (const problem of result.problems.slice(0, 80)) console.error(`  - ${problem}`)
  process.exitCode = 1
}

async function main() {
  const args = process.argv.slice(2)
  const mode = args.includes('--write') ? 'write'
    : args.includes('--check') ? 'check'
      : args.includes('--extract') ? 'extract'
        : args.includes('--check-batch') ? 'check-batch' : 'report'
  if (mode === 'extract') return writeExtract()
  if (mode === 'write') return write()
  if (mode === 'check') return check()
  if (mode === 'check-batch') return checkBatch(args[args.indexOf('--check-batch') + 1] || '')
  const result = await assemble()
  console.log(JSON.stringify({
    status: result.meta.status,
    batches: { total: result.results.length, ok: result.results.filter(item => item.ok).length, pending: result.missingBatches },
    chars: result.meta.chars,
    chapters: Object.keys(result.story.chapters).length,
    problems: [...new Set(result.problems)].slice(0, 20),
  }, null, 2))
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  await main()
}
