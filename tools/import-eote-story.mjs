// 七循环《地球边缘》（Edge of the Earth）P7：剧情正文/指南读取物生成器。
//
// 职责（只读参考资源，输出确定性纯数据；无时间戳、无副作用）：
//   en 源：参考资源 `frontend/src/locales/en/edgeOfTheEarth/{base.json, scenarios/*.json}`
//   zh 源：同路径 `zh/`（官方本地化参考；缺失/未译由本生成器显式标记，不用英文冒充中文）
//   → `content/campaigns/edgeOfTheEarth/story-text.js`（`EOTE_STORY_META/EOTE_STORY_TEXT/EOTE_STORY_KEYS`）
//
// 篇章拆分复用 P1 指南扫描的同一口径（`tools/eote-guide-scan.mjs#buildGuides/buildRulesScan`）：
//   · `iceAndDeath` → part1/part2/part3（共享 heading/tokens/icebreakerLanding/manifestationsOfEvil）；
//   · `theHeartOfMadness` → part1/part2（共享 heading/tokens/specialRules）；
//   · 其余章节整文件。
// 因此生成物每章 `sections` 的数量与 P1 指南扫描的 guideKeyCount 逐条对齐（测试直接复核）。
//
// 中文覆盖三态（与 P1 扫描一致）：
//   missing（zh 缺同路径）/ untranslated（zh 有但不含 CJK）/ present-needs-review（含 CJK，待校对）。
// 展示值 `display`：present-needs-review 取 zh，其余回退 en（en 原文始终保留在 `en`/`sectionsEn`）。
//
// 用法：
//   node tools/import-eote-story.mjs --write   # 重写 story-text.js
//   node tools/import-eote-story.mjs --check   # 逐字节复算（漂移即失败）
//   node tools/import-eote-story.mjs           # 打印摘要 JSON（不写文件）
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildGuides, buildRulesScan } from './eote-guide-scan.mjs'
import { cleanText } from './import-tde-story.mjs'
import { chapters } from '../content/campaigns/edgeOfTheEarth/shared.js'

export const MOD = fileURLToPath(new URL('../', import.meta.url))
export const WORKSPACE = fileURLToPath(new URL('../../../', import.meta.url))
export const REFERENCE = join(WORKSPACE, '参考资源/ArkhamHorror-main')
export const STORY_TEXT = join(MOD, 'content/campaigns/edgeOfTheEarth/story-text.js')
export const GENERATED_BY = 'tools/import-eote-story.mjs'

// ---------------------------------------------------------------------------
// 本地中文补充层（参考资源只读）：content/campaigns/edgeOfTheEarth/locale-supplement/*.json
// 参考工程 zh locale 缺失/未译/有错的叶子，由本仓补译/修正；生成物 meta.zhSupplement 如实标注。
// ---------------------------------------------------------------------------
const SUPPLEMENT_DIR = join(MOD, 'content/campaigns/edgeOfTheEarth/locale-supplement')
export const SUPPLEMENT_FILES = Object.freeze(['chapters-a.json', 'chapters-b.json', 'chapters-c.json', 'campaign.json'])

function loadZhSupplement() {
  const table = new Map() // `${file}::${path}` -> zh
  const files = []
  for (const name of SUPPLEMENT_FILES) {
    const path = join(SUPPLEMENT_DIR, name)
    if (!existsSync(path)) continue
    let payload
    try {
      payload = JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''))
    } catch (error) {
      throw new Error(`本地中文补充层解析失败 ${name}：${error.message}`)
    }
    let count = 0
    for (const entry of payload.entries || []) {
      if (!entry?.file || !entry?.path) continue
      if (typeof entry.zh !== 'string' || !entry.zh.trim()) continue
      table.set(`${entry.file}::${entry.path}`, entry.zh.trim())
      count++
    }
    files.push({ name, entries: count })
  }
  return { table, files }
}

const ZH_SUPPLEMENT = loadZhSupplement()

/** 本地补充层：某参考文件某路径的中文覆盖。 */
function supplementZhFor(file, path) {
  return ZH_SUPPLEMENT.table.get(`${file}::${path}`) ?? null
}

/** 参考 zh locale 的跨节引用（i18next `@:edgeOfTheEarth.<guide>.<path>`）展开；zh 侧优先本地补充层。 */
function resolveLocaleRef(value, lang, file, depth = 0) {
  if (typeof value !== 'string' || !value.startsWith('@:')) return value
  if (depth > 8) return ''
  const tokens = value.slice(2).split('.')
  if (tokens[0] !== 'edgeOfTheEarth') return ''
  const guideId = tokens[1]
  const targetFile = guideId === 'base' ? 'base.json' : `scenarios/${guideId}.json`
  const rest = tokens.slice(2).join('.')
  if (lang === 'zh') {
    const override = supplementZhFor(targetFile, rest)
    if (override != null) return override
  }
  return resolveLocaleRef(getPath(readJson(sourceRelative(lang, targetFile)), rest), lang, targetFile, depth + 1)
}

/** 中文发布文本的后处理（参考 locale 历史遗留问题的确定性修复；仅作用于 zh 展示值）。 */
export function normalizeZhText(value) {
  let text = String(value ?? '')
  // 1) i18next 转义残渣：{'{'}frost{'}'} -> [frost]
  text = text.replace(/\{'\{'\}([^{}]+)\{'\}'\}/g, '[$1]')
  text = text.replace(/\{'\}'\}/g, '')
  // 2) markdown 强调标记 _x_ / *x*（面板/剧情直排会原样显示）
  text = text.replace(/(^|[^\w])_([^_\n]+)_(?=[^\w]|$)/g, '$1$2')
  // 3) 未注册占位符 / 英文标签（参考 locale 半译）
  text = text.replace(/•\s*Shelter Value:\s*\[shelterValue\]/g, '• 庇护值：营地庇护值')
  text = text.replace(/•\s*Experience:\s*（按上述说明计算）/g, '• 经验值：（按上述说明计算）')
  text = text.replace(/庇护值\s*[:：]\s*\[shelterValue\]/g, '庇护值：营地庇护值')
  text = text.replace(/\[shelterValue\]/g, '营地庇护值')
  // 4) 参考 locale 印刷留白/占位
  text = text.replace(/冒险\?\?\?：/g, '冒险：').replace(/冒险\?\?\?/g, '冒险')
  text = text.replace(/第I部分I/g, '第II部分')
  // 5) 重复/半角标点（参考 locale 常见）。注意保留小数、英文缩写与图标 token。
  text = text.replace(/\.{2,}/g, '……')
  text = text.replace(/。\s*\.+/g, '。')
  text = text.replace(/：\s*:/g, '：').replace(/，\s*,/g, '，').replace(/；\s*;/g, '；')
  text = text.replace(/！\s*!/g, '！').replace(/？\s*\?/g, '？')
  text = text.replace(/([，。：；！？、])\1+/g, '$1')
  text = text.replace(/([\u3400-\u9fff])\s*,\s*/g, '$1，')
  text = text.replace(/([\u3400-\u9fff])\s*;\s*/g, '$1；')
  text = text.replace(/([\u3400-\u9fff])\s*:\s*/g, '$1：')
  text = text.replace(/([\u3400-\u9fff])\s*!\s*/g, '$1！')
  text = text.replace(/([\u3400-\u9fff])\s*\?\s*/g, '$1？')
  text = text.replace(/([\u3400-\u9fff])\.(?!\d)/g, '$1。')
  // 6) 英文式编号：引言 1: / 导言 2. / 第2部分:
  text = text.replace(/([\u3400-\u9fff]\s*\d+)\s*:\s*/g, '$1：')
  text = text.replace(/([\u3400-\u9fff]\s*\d+)\.(?=\s|$)/g, '$1。')
  // 7) 简繁：「著」作「着」（保留著名/著作/著称/显著/著有/编著/土著/著书/著者）
  text = text.replace(/(?<![显土编])著(?![名作述称者书])/g, '着')
  text = text.replace(/明瞭(?=\S)/g, '明了')
  // 7b) 术语/译名统一（terms findings：牌组→牌库、没有结局→未达成结局）
  text = text.replace(/牌组/g, '牌库')
  text = text.replace(/没有结局/g, '未达成结局')
  // 7c) 台港用词 → 大陆简中（guides-0006）
  text = text.replace(/计画/g, '计划').replace(/网路/g, '网络').replace(/想像/g, '想象')
  // 7d) 中文语境内半角括号统一全角（guides-0010）
  text = text.replace(/\(([^()]*)\)/g, (match, inner) => (/[\u3400-\u9fff]/.test(inner) ? `（${inner}）` : match))
  // 8) 罗马数字章节号统一为「第I部分」（不带空格）；章节小标题体例统一为「冒险 X」
  text = text.replace(/第\s*([IVX]+)\s*部分/g, '第$1部分')
  text = text.replace(/^剧本\s*([IVX]+)$/gm, '冒险 $1')
  text = text.replace(/^亡命冰原：第(\d)部分$/gm, (_, digit) => `亡命冰原 第${({ 1: 'I', 2: 'II', 3: 'III', 4: 'IV' })[digit]}部分`)
  // 9) 空白清理
  text = text.replace(/[ \t]+/g, ' ')
  text = text.replace(/ *\n */g, '\n')
  text = text.replace(/\n{3,}/g, '\n\n')
  text = text.replace(/\s+([，。：；！？、])/g, '$1')
  return text.trim()
}


const LOCALE_DIR = 'frontend/src/locales'
const GUIDE_DIR = 'edgeOfTheEarth'
const SOURCE_FILES = Object.freeze([
  'base.json',
  'scenarios/iceAndDeath.json',
  'scenarios/fatalMirage.json',
  'scenarios/toTheForbiddenPeaks.json',
  'scenarios/cityOfTheElderThings.json',
  'scenarios/theHeartOfMadness.json',
])
export const EN_FILES = Object.freeze(SOURCE_FILES.map(file => `en/${file}`))
export const ZH_FILES = Object.freeze(SOURCE_FILES.map(file => `zh/${file}`))
const CJK_PATTERN = /[\u3400-\u9fff]/
const sha256 = value => createHash('sha256').update(value).digest('hex')
const readJson = relative => JSON.parse(readFileSync(join(REFERENCE, relative), 'utf8').replace(/^\uFEFF/, ''))
const sourceRelative = (lang, file) => `${LOCALE_DIR}/${lang}/${GUIDE_DIR}/${file}`

// ---------------------------------------------------------------------------
// 叶子读写与中文状态
// ---------------------------------------------------------------------------

/** 叶子行：嵌套 JSON → `[{ path, text }]`（数组按数字下标展开，与 P1 扫描同一函数语义）。 */
export function walkLeaves(value, prefix = '', out = []) {
  if (typeof value === 'string') { out.push({ path: prefix, text: value }); return out }
  for (const [key, child] of Object.entries(value || {})) walkLeaves(child, prefix ? `${prefix}.${key}` : key, out)
  return out
}

const getPath = (object, dotted) => {
  let current = object
  for (const segment of dotted.split('.')) {
    if (current == null || typeof current !== 'object') return undefined
    current = current[segment]
  }
  return typeof current === 'string' ? current : undefined
}

// 参考 zh locale 里「含中文但夹整句英文」的叶子（如把 Gather all cards... 原样留在 zh）不能算已译：
// 与指南层同一判定（连续 3+ 个英文小写单词）时标记 untranslated，display 回退 en。
const ENGLISH_SENTENCE_PATTERN = /\b[a-z]{4,}\s+[a-z]{3,}\s+[a-z]{3,}\b/i

export function chineseStatusOf(zhText) {
  if (zhText === undefined || zhText === null) return 'missing'
  if (!CJK_PATTERN.test(zhText)) return 'untranslated'
  return ENGLISH_SENTENCE_PATTERN.test(zhText) ? 'untranslated' : 'present-needs-review'
}

function chineseCounts(statuses) {
  return {
    total: statuses.length,
    presentNeedsReview: statuses.filter(status => status === 'present-needs-review').length,
    untranslated: statuses.filter(status => status === 'untranslated').length,
    missing: statuses.filter(status => status === 'missing').length,
  }
}

function overallStatus(counts) {
  if (counts.total === 0) return 'missing'
  if (counts.presentNeedsReview === counts.total) return 'present-needs-review'
  if (counts.presentNeedsReview > 0) return 'mixed'
  return counts.untranslated === counts.total ? 'untranslated' : 'missing'
}

/**
 * 参考 locale 的正文占位符本地化（与 `tools/import-scenario-guides.mjs#guideText` 同口径）：
 * 标准 `{xp}/{name}/{key}/{fast}/{perPlayer}` 转成展示文本/UI 记号，其余 `{变量}` 统一成 `[变量]`
 * （如庇护值 `{shelterValue}`、计数 `{count}`），生成物里不再残留模板花括号。
 */
function localizePlaceholders(text, language) {
  return String(text)
    .replaceAll('{perPlayer}', '[per_investigator]')
    .replaceAll('{fast}', '[free]')
    .replaceAll('{xp}', language === 'en' ? '(calculate as instructed above)' : '（按上述说明计算）')
    .replaceAll('{name}', language === 'en' ? 'the chosen investigator' : '所选调查员')
    .replaceAll('{key}', language === 'en' ? 'the chosen key' : '所选钥匙')
    .replace(/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g, '[$1]')
}

/** 一条叶子 → 生成物条目（双语 + 覆盖状态 + en 源短哈希锁）。正文走 TDE 同一套 HTML→纯文本清洗。
 *  zh 侧额外经过 normalizeZhText（参考 locale 的转义残渣/半角标点/繁简等确定性修复）；
 *  en 侧仅做 i18next 转义还原（参考 locale 同源残渣，en 面板也会显示）。 */
function sectionOf(path, rawEn, rawZh, layer) {
  const enText = localizePlaceholders(cleanText(rawEn ?? ''), 'en')
    .replace(/\{'\{'\}([^{}]+)\{'\}'\}/g, '[$1]')
    .replace(/\{'\}'\}/g, '')
  const zhText = rawZh == null ? null : normalizeZhText(localizePlaceholders(cleanText(rawZh), 'zh'))
  const status = rawZh == null ? 'missing' : chineseStatusOf(zhText)
  return {
    path,
    layer,
    status,
    display: status === 'present-needs-review' ? zhText : enText,
    en: enText,
    zh: status === 'missing' ? null : zhText,
    enSha256: sha256(enText),
  }
}

const strip = (path, prefix) => (prefix && path.startsWith(`${prefix}.`) ? path.slice(prefix.length + 1) : path)

/** 把 `a.b.c` 路径写进嵌套对象（chapter.sections 的可读形状，供 flattenStory/storyText 直接消费）。 */
function setPath(target, path, value) {
  const segments = path.split('.')
  let current = target
  for (const segment of segments.slice(0, -1)) {
    if (current[segment] == null || typeof current[segment] !== 'object') current[segment] = {}
    current = current[segment]
  }
  current[segments.at(-1)] = value
  return target
}

// ---------------------------------------------------------------------------
// 章节：按 P1 指南扫描的切片生成，sections 数 = guideKeyCount
// ---------------------------------------------------------------------------

function partOf(chapter) {
  const match = /^(.*)Part([123])$/.exec(chapter.id)
  return match ? { guideId: match[1], part: `part${match[2]}` } : { guideId: chapter.id, part: null }
}

const stripDisplaySuffix = path => path

/** 结局行（`…resolutions.<key>.title|body`）→ `resolutions[key] = { title, body, text }`。 */
function buildResolutions(entries) {
  const resolutions = {}
  for (const entry of entries) {
    const match = /(?:^|\.)resolutions\.([^.]*)\.(title|body)$/.exec(entry.path)
    if (!match) continue
    const key = match[1]
    resolutions[key] ||= { key, title: '', body: '', text: '' }
    resolutions[key][match[2]] = entry.display
  }
  for (const resolution of Object.values(resolutions)) {
    resolution.text = [resolution.title, resolution.body].filter(Boolean).join('\n\n')
  }
  return resolutions
}

function buildChapter(chapter, guide) {
  const { guideId, part } = partOf(chapter)
  const guideFile = `scenarios/${guideId}.json`
  const en = readJson(sourceRelative('en', guideFile))
  const zh = readJson(sourceRelative('zh', guideFile))
  const rows = guide.sections.map(section => {
    const rawEn = resolveLocaleRef(getPath(en, section.path) ?? '', 'en', guideFile)
    const rawZh = supplementZhFor(guideFile, section.path) ?? resolveLocaleRef(getPath(zh, section.path), 'zh', guideFile)
    return sectionOf(section.path, rawEn, rawZh, section.layer)
  })
  // 结局正文常以「结局 N：」开头，展示层会再显示一次标题；去掉正文里重复的标题前缀，避免「结局 1 结局 1：……」。
  const escapeRegex = value => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const resolutionTitles = new Map()
  for (const row of rows) {
    const match = /(?:^|\.)resolutions\.([^.]+)\.title$/.exec(row.path)
    if (match && row.display) resolutionTitles.set(match[1], row.display)
  }
  for (const row of rows) {
    const match = /(?:^|\.)resolutions\.([^.]+)\.body$/.exec(row.path)
    if (!match) continue
    const title = resolutionTitles.get(match[1])
    if (title) row.display = row.display.replace(new RegExp(`^${escapeRegex(title)}\\s*[：:]\\s*`), '')
  }
  const counts = chineseCounts(rows.map(row => row.status))
  const displayKey = row => strip(row.path, part)
  // 章节正文树：display（zh 优先，缺译回退 en）+ en 原文树（fallback）+ 缺译清单（显式标记）。
  const sections = {}
  const sectionsEn = {}
  const chineseGaps = {}
  for (const row of rows) {
    setPath(sections, displayKey(row), row.display)
    setPath(sectionsEn, displayKey(row), row.en)
    if (row.status !== 'present-needs-review') chineseGaps[displayKey(row)] = row.status
  }
  const headingRow = rows.find(row => row.path === 'heading' || row.path.endsWith('.heading'))
  const resolutions = buildResolutions(rows
    .filter(row => strip(row.path, part).includes('resolutions.'))
    .map(row => ({ ...row, path: strip(row.path, part) })))
  const layerRows = layer => rows.filter(row => row.layer === layer)
  const joinDisplay = list => list.map(row => row.display).filter(Boolean).join('\n\n')
  const guideKeyCount = guide.summary.total
  const partRows = part ? rows.filter(row => row.path.startsWith(`${part}.`)) : rows
  const partSectionCount = partRows.length
  const partChinese = chineseCounts(partRows.map(row => row.status))
  return {
    id: chapter.id,
    guideId,
    part,
    partMapping: part || 'whole-file',
    referenceCode: chapter.referenceCode,
    stepId: chapter.stepId,
    title: chapter.name,
    titleEn: chapter.nameEn,
    heading: headingRow?.display || '',
    status: overallStatus(counts),
    chinese: counts,
    sectionCount: rows.length,
    guideKeyCount,
    partSectionCount,
    sharedSectionCount: rows.length - partSectionCount,
    partChinese,
    sections,
    sectionsEn,
    chineseGaps,
    intro: joinDisplay(layerRows('intro')),
    setup: joinDisplay(layerRows('setup')),
    resolutions,
    sources: {
      en: sourceLockRecord('en', `scenarios/${guideId}.json`),
      zh: sourceLockRecord('zh', `scenarios/${guideId}.json`),
    },
  }
}

const splitParagraphs = text => String(text || '').split(/\n{2,}/).map(part => part.trim()).filter(Boolean)

const LOCK_CACHE = new Map()
function sourceLockOf(lang, file) {
  const key = `${lang}/${file}`
  if (!LOCK_CACHE.has(key)) LOCK_CACHE.set(key, sha256(readFileSync(join(REFERENCE, sourceRelative(lang, file)))))
  return LOCK_CACHE.get(key)
}

/** 来源锁（path/bytes/sha256），与 P0 scope 的 guideSources 逐字段同形，便于对齐校验。 */
function sourceLockRecord(lang, file) {
  const relative = sourceRelative(lang, file)
  const bytes = readFileSync(join(REFERENCE, relative))
  return { path: relative, bytes: bytes.length, sha256: sha256(bytes) }
}

// ---------------------------------------------------------------------------
// 战役级：base.json 的序幕/检查点/幕间/尾声/特别规则/记录
// ---------------------------------------------------------------------------

function buildGroup(id, rows, { kind = 'group' } = {}) {
  const counts = chineseCounts(rows.map(row => row.status))
  // 条目层：把 `<key>.title` + `<key>.body` / 直接字符串聚成 entries，方便流程节点直接取标题+正文。
  // 路径级正文由 `localeKeys`（edgeOfTheEarth.*）提供，避免同一段正文在文件里存三份。
  const entries = []
  const byKey = new Map()
  for (const row of rows) {
    const segments = row.path.split('.')
    const entryKey = segments.length > 1 && ['title', 'body'].includes(segments.at(-1)) ? segments.slice(0, -1).join('.') : row.path
    if (!byKey.has(entryKey)) byKey.set(entryKey, { key: entryKey, title: '', body: '', text: '', status: 'present-needs-review' })
    const entry = byKey.get(entryKey)
    if (segments.at(-1) === 'title' && segments.length > 1) entry.title = row.display
    else if (segments.at(-1) === 'body' && segments.length > 1) entry.body = row.display
    else entry.body = [entry.body, row.display].filter(Boolean).join('\n\n')
    if (row.status === 'missing') entry.status = 'missing'
    else if (row.status === 'untranslated' && entry.status !== 'missing') entry.status = 'untranslated'
  }
  for (const entry of byKey.values()) entry.text = [entry.title, entry.body].filter(Boolean).join('\n\n')
  entries.push(...byKey.values())
  return {
    id,
    kind,
    status: overallStatus(counts),
    chinese: counts,
    sectionCount: rows.length,
    entries,
  }
}

// 战役分组 → 生成物结构：与 Lead 约定的 campaign.{prologue,checkpoints,interludes,epilogue,specialRules,records}。
const PROLOGUE_GROUPS = Object.freeze(['madnessUnderTheIce', 'prologue', 'prologue1', 'prologue2', 'prologue3', 'prologue4'])
const CHECKPOINT_GROUPS = Object.freeze(['checkpoint1', 'checkpoint2', 'checkpoint3'])
const INTERLUDE_GROUPS = Object.freeze(['interludes', 'interlude1', 'interlude2', 'interlude3'])
const RECORD_GROUPS = Object.freeze(['recordLabels', 'labels', 'partnerNames', 'suppliesRecovered'])

function buildCampaign(baseScan) {
  const groups = new Map(baseScan.campaignStory.groups.map(group => [group.id, group]))
  const en = readJson(sourceRelative('en', 'base.json'))
  const zh = readJson(sourceRelative('zh', 'base.json'))
  const rowsOf = group => group.sections.map(section => {
    const rawEn = resolveLocaleRef(getPath(en, section.path) ?? '', 'en', 'base.json')
    const rawZh = supplementZhFor('base.json', section.path) ?? resolveLocaleRef(getPath(zh, section.path), 'zh', 'base.json')
    return sectionOf(section.path, rawEn, rawZh, section.layer)
  })
  const groupOf = id => (groups.has(id) ? buildGroup(id, rowsOf(groups.get(id))) : null)
  const mergeGroups = (id, ids) => {
    const rows = []
    const seen = new Set()
    for (const groupId of ids) {
      const group = groups.get(groupId)
      if (!group) continue
      for (const row of rowsOf(group)) {
        if (seen.has(row.path)) continue
        seen.add(row.path)
        rows.push(row)
      }
    }
    return rows.length ? buildGroup(id, rows) : null
  }
  const prologue = mergeGroups('prologue', PROLOGUE_GROUPS)
  const partnerIntrosGroup = groups.get('partnerIntros') ? buildGroup('partnerIntros', rowsOf(groups.get('partnerIntros')), { kind: 'intros' }) : null
  const checkpoints = {
    checkpoint1: groupOf('checkpoint1'),
    checkpoint2: groupOf('checkpoint2'),
    checkpoint3: groupOf('checkpoint3'),
  }
  const interludes = {
    openings: groupOf('interludes'),
    interlude1: groupOf('interlude1'),
    interlude2: groupOf('interlude2'),
    interlude3: groupOf('interlude3'),
  }
  const epilogue = groupOf('epilogue')
  const specialRules = groupOf('specialRules')
  const records = Object.fromEntries(RECORD_GROUPS
    .map(id => [id, groupOf(id)])
    .filter(([, group]) => group))
  // 其它 base 顶层键（卡片提示、label-only 子树等）保留原分组，避免内容静默丢失。
  const knownGroupIds = new Set([
    ...PROLOGUE_GROUPS, ...CHECKPOINT_GROUPS, ...INTERLUDE_GROUPS, ...RECORD_GROUPS,
    'epilogue', 'specialRules', 'partnerIntros',
  ])
  const other = Object.fromEntries([...groups.values()]
    .filter(group => !knownGroupIds.has(group.id))
    .map(group => [group.id, buildGroup(group.id, rowsOf(group))]))
  const campaign = {
    prologue,
    partnerIntros: partnerIntrosGroup,
    checkpoints,
    interludes,
    epilogue,
    specialRules,
    records,
  }
  if (Object.keys(other).length) campaign.other = other
  return campaign
}

// `edgeOfTheEarth.<path>` locale 键 → `{ body, status, path }`（流程/展示层用；正文按 display 取值）。
function buildLocaleKeys(baseScan) {
  const en = readJson(sourceRelative('en', 'base.json'))
  const zh = readJson(sourceRelative('zh', 'base.json'))
  const keys = {}
  for (const group of baseScan.campaignStory.groups) {
    for (const section of group.sections) {
      const path = section.path
      const rawEn = resolveLocaleRef(getPath(en, path) ?? '', 'en', 'base.json')
      const rawZh = supplementZhFor('base.json', path) ?? resolveLocaleRef(getPath(zh, path), 'zh', 'base.json')
      const row = sectionOf(path, rawEn, rawZh, section.layer)
      keys[`edgeOfTheEarth.${path}`] = { body: row.display, status: row.status }
    }
  }
  return keys
}

// ---------------------------------------------------------------------------
// 组装与输出
// ---------------------------------------------------------------------------

const LOCKED_SOURCES = Object.freeze(SOURCE_FILES.flatMap(file => [
  { lang: 'en', file, path: sourceRelative('en', file) },
  { lang: 'zh', file, path: sourceRelative('zh', file) },
]))

function sourceLocks() {
  const locks = {}
  for (const source of LOCKED_SOURCES) {
    const bytes = readFileSync(join(REFERENCE, source.path))
    locks[source.path] = { path: source.path, bytes: bytes.length, sha256: sha256(bytes) }
  }
  return locks
}

export function storyInventory() {
  const { story } = buildStoryText()
  return {
    chapters: Object.keys(story.chapters).length,
    chapterSections: Object.values(story.chapters).reduce((total, chapter) => total + chapter.sectionCount, 0),
    campaignGroups: Object.keys(story.campaign).length,
    prologueSections: story.campaign.prologue?.sectionCount || 0,
    checkpointSections: Object.values(story.campaign.checkpoints).reduce((total, group) => total + (group?.sectionCount || 0), 0),
    interludeSections: Object.values(story.campaign.interludes).reduce((total, group) => total + (group?.sectionCount || 0), 0),
    epilogueSections: story.campaign.epilogue?.sectionCount || 0,
    specialRuleSections: story.campaign.specialRules?.sectionCount || 0,
    recordKeys: Object.keys(story.localeKeys).length,
    status: story.meta.status,
  }
}

// 生成时先构造一次（供 --write/--check 复用；模块被 import 时不产生副作用）。
let built = null
export function buildStoryText() {
  if (built) return built
  const guides = buildGuides()
  const baseScan = buildRulesScan()
  const guideById = new Map(guides.map(guide => [guide.id, guide]))
  const chapterStories = {}
  for (const chapter of chapters) {
    const guide = guideById.get(chapter.id)
    if (!guide) throw new Error(`P1 指南扫描缺少章节 ${chapter.id}`)
    chapterStories[chapter.id] = buildChapter(chapter, guide)
  }
  const chapterCounts = Object.values(chapterStories).map(chapter => chapter.sectionCount)
  const campaign = buildCampaign(baseScan)
  const localeKeys = buildLocaleKeys(baseScan)
  const locks = sourceLocks()
  const byLang = lang => Object.fromEntries(LOCKED_SOURCES.filter(source => source.lang === lang)
    .map(source => [source.file, locks[source.path].sha256]))
  const story = {
    campaign,
    chapters: chapterStories,
    localeKeys,
    guide: {
      chapters: guides.map(guide => ({
        id: guide.id,
        guideId: guide.guideId,
        part: guide.part,
        partMapping: guide.partMapping,
        guideKeyCount: guide.summary.total,
        sections: guide.sections.length,
        specialRuleSections: guide.summary.specialRules,
        setupSections: guide.summary.setupSections,
        resolutionSections: guide.summary.resolutionSections,
      })),
    },
  }
  const enChars = Object.values(chapterStories).reduce((total, chapter) => total + textChars(chapter.sectionsEn), 0)
  const zhChars = Object.values(chapterStories).reduce((total, chapter) => total + presentChineseChars(chapter.sections, chapter.chineseGaps), 0)
  const meta = {
    status: 'generated',
    stage: 'P7-story',
    sourceKind: 'reference-project-zh-locale+local-supplement',
    officialChinese: false,
    note: '中文正文优先参考工程 zh locale；缺失/未译/有错叶子由本仓 locale-supplement 补译修正（非官方中文）；缺译不再回退英文展示。',
    generator: GENERATED_BY,
    generatedFrom: '参考资源/ArkhamHorror-main/frontend/src/locales',
    zhSupplement: {
      path: 'content/campaigns/edgeOfTheEarth/locale-supplement',
      files: ZH_SUPPLEMENT.files,
      entries: ZH_SUPPLEMENT.table.size,
      note: '本仓补译/修正层；参考 locale 保持只读，来源锁仍记录参考文件哈希。',
    },
    files: [...SOURCE_FILES],
    sources: locks,
    enSourceHashes: byLang('en'),
    zhSourceHashes: byLang('zh'),
    chapters: Object.keys(chapterStories).length,
    chapterSections: chapterCounts.reduce((total, count) => total + count, 0),
    guideKeyCounts: Object.fromEntries(guides.map(guide => [guide.id, guide.summary.total])),
    chinese: chineseChapterSummary(chapterStories),
    chars: { en: enChars, zh: zhChars },
  }
  story.meta = meta
  built = { meta, story }
  return built
}

/** 正文树的字符数（只统计字符串叶子）。 */
function textChars(tree) {
  if (typeof tree === 'string') return tree.length
  if (!tree || typeof tree !== 'object') return 0
  return Object.values(tree).reduce((total, child) => total + textChars(child), 0)
}

/** 已译中文字符数（跳过 chineseGaps 标记的叶子）。 */
function presentChineseChars(tree, gaps, prefix = '') {
  if (typeof tree === 'string') return gaps[prefix] ? 0 : tree.length
  if (!tree || typeof tree !== 'object') return 0
  return Object.entries(tree).reduce((total, [key, child]) =>
    total + presentChineseChars(child, gaps, prefix ? `${prefix}.${key}` : key), 0)
}

function chineseChapterSummary(chapterStories) {
  const totals = { total: 0, presentNeedsReview: 0, untranslated: 0, missing: 0 }
  for (const chapter of Object.values(chapterStories)) {
    for (const key of Object.keys(totals)) totals[key] += chapter.chinese[key]
  }
  return { ...totals, byChapter: Object.fromEntries(Object.values(chapterStories).map(chapter => [chapter.id, chapter.chinese])) }
}

// ---------------------------------------------------------------------------
// 渲染 / 写入 / 检查
// ---------------------------------------------------------------------------

const HEADER = `// 地球边缘（The Edge of the Earth）· 剧情正文生成物（P7）。
//
// 本文件由 \`node tools/import-eote-story.mjs --write\` 生成，请勿手改；改源后重跑并 --check。
// 来源：参考工程 en/zh locale（frontend/src/locales/{en,zh}/edgeOfTheEarth）；
// 中文逐键取自 zh locale，缺失/未译叶子在 sections.status/chinese 上显式标记（不冒充官方中文）。
// 章节切片与 P1 指南扫描（tools/eote-guide-scan.mjs）同口径：sections 数 = guideKeyCount。
//
// 结构：campaign（序幕/检查点/幕间/尾声/特别规则/记录）· chapters（8 章，按 part 拆分）·
//   interludes（3 段幕间的段落视图）· epilogue · localeKeys（edgeOfTheEarth.* 键）· guide（对齐摘要）· meta。
`

/** 生成 story-text.js 的完整源码文本（确定性；不含时间戳）。 */
export function renderStoryText({ meta, story }) {
  const body = `export const EOTE_STORY_META = ${JSON.stringify(meta, null, 2)}

const EOTE_STORY_DATA = ${JSON.stringify(story, null, 2)}

// ---------------------------------------------------------------------------
// 幕间/尾声/别名的派生视图（从 campaign 容器现算，不在文件里重复存正文）。
// ---------------------------------------------------------------------------
const paragraphsOf = text => String(text || '').split(/\\n{2,}/).map(part => part.trim()).filter(Boolean)

function interludeView(group) {
  if (!group) return null
  return {
    id: group.id,
    title: (group.entries.find(entry => entry.title) || {}).title || group.id,
    status: group.status,
    chinese: group.chinese,
    sections: group.entries.filter(entry => entry.text).map(entry => ({
      key: \`edgeOfTheEarth.\${group.id}.\${entry.key}\`,
      title: entry.title || group.id,
      paragraphs: paragraphsOf(entry.body ?? entry.text),
      status: entry.status,
    })),
    text: group.text,
    entries: group.entries,
  }
}

const campaignData = EOTE_STORY_DATA.campaign
for (const [id, group] of Object.entries(campaignData.checkpoints || {})) if (group) campaignData[id] = group
for (const [id, group] of Object.entries(campaignData.interludes || {})) if (group && group.id !== 'interludes') campaignData[id] = group

// \`edgeOfTheEarth.*\` locale 键 → 中文展示值（story-access.js 的 storyEntry 读这里）。
export const EOTE_STORY_KEYS = EOTE_STORY_DATA.localeKeys

export const EOTE_STORY_TEXT = {
  ...EOTE_STORY_DATA,
  interludes: {
    interlude1: interludeView(campaignData.interludes?.interlude1),
    interlude2: interludeView(campaignData.interludes?.interlude2),
    interlude3: interludeView(campaignData.interludes?.interlude3),
  },
  epilogue: {
    sections: (campaignData.epilogue?.entries || []).map(entry => ({
      key: \`edgeOfTheEarth.epilogue.\${entry.key}\`,
      title: entry.title || entry.key,
      paragraphs: paragraphsOf(entry.body ?? entry.text),
    })),
    cells: [],
    special: {},
  },
}

export function eoteStoryChapter(id) {
  return EOTE_STORY_TEXT.chapters[id] ?? null
}

export function eoteStoryKeys(key) {
  return EOTE_STORY_TEXT.localeKeys[key] ?? null
}

export function eoteStoryInventory() {
  const chapterIds = Object.keys(EOTE_STORY_TEXT.chapters)
  return {
    chapters: chapterIds.length,
    chapterSections: chapterIds.reduce((total, id) => total + (EOTE_STORY_TEXT.chapters[id].sectionCount || 0), 0),
    campaignGroups: Object.keys(EOTE_STORY_TEXT.campaign).length,
    recordKeys: Object.keys(EOTE_STORY_TEXT.localeKeys).length,
    status: EOTE_STORY_META.status,
  }
}
`
  return `${HEADER}\n${body}`
}

/** 组装一次并返回 { meta, story, source }（测试用；不写文件、不读缓存状态）。 */
export function assemble() {
  built = null
  const result = buildStoryText()
  return { ...result, source: renderStoryText(result) }
}

export function write({ log = console.log } = {}) {
  const { source } = assemble()
  writeFileSync(STORY_TEXT, source)
  log(`eote story-text: 已写入 ${STORY_TEXT}（${Buffer.byteLength(source)} 字节）`)
  return { byteLength: Buffer.byteLength(source), sha256: sha256(source) }
}

export function check() {
  const { source, meta, story } = assemble()
  const current = readFileSync(STORY_TEXT, 'utf8')
  if (current !== source) {
    throw new Error(`story-text.js 漂移：请重跑 node tools/import-eote-story.mjs --write（期望 ${sha256(source)}，实际 ${sha256(current)}）`)
  }
  return { byteLength: Buffer.byteLength(current), sha256: sha256(current), inventory: storyInventory(), meta: { chapters: meta.chapters, guideKeyCounts: meta.guideKeyCounts } }
}

// ---------------------------------------------------------------------------
// P0 scope 对齐（只读；不写 audit）
// ---------------------------------------------------------------------------

/**
 * 把 P0 账本 `audit/eote-scope.json#chapters` 与生成物对齐：
 *   · 每章 `guideSources`（en/zh 的 path/bytes/sha256）必须与生成物 `sources` 逐字段一致；
 *   · 每章 `guideKeyCounts.en`（part 切片叶子数）必须等于生成物 `partSectionCount`；
 *   · `guidePartKey` 必须与生成物 `part` 一致（null ↔ whole-file）；
 *   · scope 顶层 `guideSources` 必须全部出现在 meta.sources 中（正文来源锁不漂移）。
 * 返回 `{ ok, problems, chapters }`，不抛错，由测试/校验命令决定失败方式（不写 audit/）。
 */
export function scopeAlignment() {
  const scope = JSON.parse(readFileSync(join(MOD, 'audit/eote-scope.json'), 'utf8').replace(/^\uFEFF/, ''))
  const { meta, story } = buildStoryText()
  const problems = []
  const chapterRows = []
  for (const chapterScope of scope.chapters || []) {
    const chapter = story.chapters[chapterScope.id]
    if (!chapter) { problems.push(`P0 scope 章节 ${chapterScope.id} 在生成物中缺失`); continue }
    const sources = Object.fromEntries((chapterScope.guideSources || []).map(source => [source.lang, source]))
    const row = { id: chapterScope.id, sources: {}, guideKeyCount: chapterScope.guideKeyCounts?.en, partSectionCount: chapter.partSectionCount, part: chapter.part }
    for (const lang of ['en', 'zh']) {
      const expected = sources[lang]
      const actual = chapter.sources[lang]
      const match = Boolean(expected && actual && expected.path === actual.path
        && expected.bytes === actual.bytes && expected.sha256 === actual.sha256)
      row.sources[lang] = match
      if (!match) problems.push(`${chapterScope.id}：${lang} 来源锁与 P0 scope 不一致（${JSON.stringify(actual)} ≠ ${JSON.stringify(expected)}）`)
    }
    const countMatch = chapter.partSectionCount === chapterScope.guideKeyCounts?.en
    row.guideKeyCountMatch = countMatch
    if (!countMatch) problems.push(`${chapterScope.id}：part 叶子数 ${chapter.partSectionCount} ≠ P0 scope guideKeyCounts.en ${chapterScope.guideKeyCounts?.en}`)
    if (chapterScope.guidePartKey !== chapter.part) {
      problems.push(`${chapterScope.id}：part 映射不一致 ${chapterScope.guidePartKey} ≠ ${chapter.part}`)
    }
    chapterRows.push(row)
  }
  // scope 顶层 guideSources（全部来源文件）↔ meta.sources
  const lockedPaths = new Set(Object.keys(meta.sources || {}))
  for (const source of scope.guideSources || []) {
    const locked = meta.sources?.[source.path]
    const match = Boolean(locked && locked.sha256 === source.sha256 && locked.bytes === source.bytes)
    if (!match) problems.push(`来源文件未与 P0 scope 对齐：${source.path}`)
    else lockedPaths.delete(source.path)
  }
  return { ok: problems.length === 0, problems, chapters: chapterRows, extraSources: [...lockedPaths].sort() }
}

function main() {
  if (process.argv.includes('--write')) {
    const result = write()
    console.log(JSON.stringify({ written: result, inventory: storyInventory() }, null, 2))
  } else if (process.argv.includes('--check')) {
    const result = check()
    console.log(JSON.stringify({ ok: true, ...result }, null, 2))
  } else {
    const { meta, story } = assemble()
    console.log(JSON.stringify({ meta, inventory: storyInventory(), guide: story.guide }, null, 2))
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main()
