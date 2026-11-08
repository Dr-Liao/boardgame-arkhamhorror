// 七循环《地球边缘》（Edge of the Earth）P1 第 1 步：冒险指南与规则/剧情来源扫描。
//
// 本文件只读参考资源（`参考资源/ArkhamHorror-main/`），输出确定性的纯数据（无时间戳、无副作用）：
//   · buildGuides()    —— 8 个章节单元的完整指南段落清单。en 指南 JSON 是段落事实源；中文覆盖按
//                        同路径 zh 叶子是否存在、是否含中日韩字符判定；sourceSha256 锁 en 叶子文本，
//                        sources.sha256 锁原始文件字节。
//   · buildRulesScan() —— 战役剧情/规则（base.json 的序幕、检查点、幕间、尾声、特别规则…）、
//                        战役记录键（参考 Key.hs 的构造函数 × locale `key.*` 标签）、9 位探险队伙伴名
//                        与 7 项探险物资的中文覆盖。
//
// 口径见 docs/edgeOfTheEarth/README.md §3 P1、§4、§5 与 docs/arkham-content-migration.md §4.2/§4.5.2：
//   · 只做分类与覆盖清单，不写卡、不冒充已实现；所有条目 status 保持 `pending`；
//   · 中文状态：zh 缺同路径 → missing；有但不含 CJK → untranslated；含 CJK → present-needs-review；
//   · `specialRule: path.startsWith('specialRules.')`（战役级 specialRules 归 buildRulesScan，不在 guides 行里）。
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { REFERENCE, readJson, sha, sourceLock } from './eote-migration-lib.mjs'
import { chapters } from '../content/campaigns/edgeOfTheEarth/shared.js'

// 来源根（签入账本时只记相对路径）：参考资源在 Mod 仓库的上一级。
export const SOURCE_ROOT = '参考资源/ArkhamHorror-main'
const LOCALE_ROOT = 'frontend/src/locales'
const GUIDE_DIR = 'edgeOfTheEarth'
const KEY_HS = 'backend/arkham-api/library/Arkham/Campaigns/EdgeOfTheEarth/Key.hs'
const SUPPLIES_HS = 'backend/arkham-api/library/Arkham/Campaigns/EdgeOfTheEarth/Supplies.hs'
const CJK_PATTERN = /[\u3400-\u9fff]/

// 拆分成多个部分的指南：共享段落取这些顶层键；其余只取当前 `partN.*`。
// 这是 README §4 的篇章映射（《亡命冰原》I–III 与《疯狂之心》I–II），P7 逐章生成指南时复用。
const SPLIT_GUIDES = Object.freeze({
  iceAndDeath: Object.freeze({ sharedTopLevel: Object.freeze(['heading', 'tokens', 'icebreakerLanding', 'manifestationsOfEvil']) }),
  theHeartOfMadness: Object.freeze({ sharedTopLevel: Object.freeze(['heading', 'tokens', 'specialRules']) }),
})

const localePath = (lang, file) => `${LOCALE_ROOT}/${lang}/${GUIDE_DIR}/${file}`
const guideFileOf = guideId => `scenarios/${guideId}.json`

// 把嵌套 JSON 摊平成叶子路径 → 文本；数组按数字下标展开（locale 目前全是对象/字符串，保留兜底）。
export function leaves(value, path = '') {
  if (typeof value === 'string') return [{ path, text: value }]
  if (Array.isArray(value)) return value.flatMap((child, index) => leaves(child, path ? `${path}.${index}` : String(index)))
  return Object.entries(value || {}).flatMap(([key, child]) => leaves(child, path ? `${path}.${key}` : key))
}

// 段落 layer：按路径段分类，覆盖 shape 约定的 10 种层。规则按“越具体越先”排序，保证确定性。
export function layerOf(path) {
  const segments = path.split('.')
  const has = pattern => segments.some(segment => pattern.test(segment))
  if (segments[0] === 'specialRules') return 'specialRules'
  if (segments[0] === 'tokens') return 'tokens'
  if (segments[0] === 'heading' || has(/^heading$/i)) return 'heading'
  if (has(/setup/i)) return 'setup'
  if (has(/^intro/i) || has(/intro\d*$/i)) return 'intro'
  if (has(/interlude/i)) return 'interlude'
  if (has(/^resolution/i)) return 'resolutions'
  if (has(/deck/i)) return 'deck'
  if (has(/label|tooltip/i)) return 'labels'
  if (has(/killed|missing|alive|otherwise|present|partner|confronted/i)) return 'characters'
  // 其余都是剧情/结算文案（如 remembered.*、proceed.*、xp.*、votes.*）：归入 resolutions 之外的
  // 叙事层；用 intro 表示“正文/后续剧情”，避免出现约定之外的 layer。
  return 'intro'
}

const zhIndex = zhJson => new Map(leaves(zhJson).map(row => [row.path, row.text]))
function chineseStatus(zhIndexMap, path) {
  if (!zhIndexMap.has(path)) return 'missing'
  return CJK_PATTERN.test(zhIndexMap.get(path)) ? 'present-needs-review' : 'untranslated'
}
function lockOf(relativePath) {
  const lock = sourceLock(relativePath, REFERENCE)
  return { path: lock.path, sha256: lock.sha256 }
}
function sectionOf(row, zhIndexMap) {
  return {
    path: row.path,
    sourceSha256: sha(row.text),
    layer: layerOf(row.path),
    specialRule: row.path.startsWith('specialRules.'),
    chinese: chineseStatus(zhIndexMap, row.path),
    status: 'pending',
  }
}
function summarize(sections) {
  return {
    total: sections.length,
    missing: sections.filter(section => section.chinese === 'missing').length,
    untranslated: sections.filter(section => section.chinese === 'untranslated').length,
    specialRules: sections.filter(section => section.specialRule).length,
    setupSections: sections.filter(section => section.layer === 'setup').length,
    resolutionSections: sections.filter(section => section.layer === 'resolutions').length,
  }
}

// 章节 → 指南文件/篇章：`iceAndDeathPart2` → guideId `iceAndDeath`、part `part2`。
// 不写死拆分表：按 `…PartN` 命名从章节 id 推导，再校验指南文件真实存在。
function guideMappingOf(chapter) {
  const match = /^(.*)Part([123])$/.exec(chapter.id)
  const guideId = match ? match[1] : chapter.id
  const part = match ? `part${match[2]}` : null
  return { guideId, part, partMapping: part || 'whole-file', file: guideFileOf(guideId) }
}

export function buildGuides() {
  return chapters.map(chapter => {
    const { guideId, part, partMapping, file } = guideMappingOf(chapter)
    const en = readJson(join(REFERENCE, localePath('en', file)))
    const zh = readJson(join(REFERENCE, localePath('zh', file)))
    const zhIndexMap = zhIndex(zh)
    // en 叶子是段落事实源；拆分指南按共享顶层键 + 当前 partN.* 切片。
    const allRows = leaves(en)
    const shared = part ? SPLIT_GUIDES[guideId] : null
    if (part && !shared) throw new Error(`未登记的拆分指南 ${guideId}`)
    const rows = part
      ? allRows.filter(row => shared.sharedTopLevel.includes(row.path.split('.')[0]) || row.path.startsWith(`${part}.`))
      : allRows
    const sections = rows.map(row => sectionOf(row, zhIndexMap))
    return {
      id: chapter.id, guideId, part, partMapping,
      sources: { en: lockOf(localePath('en', file)), zh: lockOf(localePath('zh', file)) },
      sections,
      summary: summarize(sections),
    }
  })
}

// 剧情/规则分组的顶层键归类：记录键、标签、伙伴名与物资单独成组，其余按顶层键一组。
const SPECIAL_STORY_TOP_LEVEL = Object.freeze({
  key: 'recordLabels',
  label: 'labels',
  partnerNames: 'partnerNames',
  suppliesRecovered: 'suppliesRecovered',
})
const LABEL_ONLY_PATTERN = /^[A-Za-z0-9]+$/

// 只含 `${key}.label…` 的顶层卡片提示（nightmarishVapors / apeirophobia / wukWukWuk）并进 labels 组。
function isLabelOnlySubtree(enJson, key) {
  const rows = leaves(enJson[key], key)
  return rows.length > 0 && rows.every(row => /(^|\.)label(\.|$)/.test(row.path))
}

// base.json 的剧情/规则分组：按顶层键推导，不硬编码段落列表。
export function buildStoryGroups(enJson, zhIndexMap) {
  const buckets = new Map()
  const push = (id, rows) => {
    if (!buckets.has(id)) buckets.set(id, [])
    buckets.get(id).push(...rows)
  }
  for (const key of Object.keys(enJson)) {
    const value = enJson[key]
    const rows = leaves(value, key)
    if (rows.length === 0) continue
    if (['0', '1', '2', '3', '4'].includes(key)) continue // 防御：数组式顶层键不进 base 分组
    if (Object.hasOwn(SPECIAL_STORY_TOP_LEVEL, key)) {
      push(SPECIAL_STORY_TOP_LEVEL[key], rows)
    } else if (typeof value === 'string') {
      // 顶层字符串 = 伙伴开场白（amyKensler、roaldEllsworth…），由文件内容推导，不写死名单。
      push('partnerIntros', rows)
    } else if (isLabelOnlySubtree(enJson, key) && LABEL_ONLY_PATTERN.test(key)) {
      push('labels', rows)
    } else {
      push(key, rows)
    }
  }
  return [...buckets.entries()].map(([id, rows]) => {
    const sections = rows.map(row => sectionOf(row, zhIndexMap))
    return { id, sections, summary: summarize(sections) }
  })
}

function totalsOfGroups(groups) {
  const acc = { sections: 0, missing: 0, untranslated: 0, specialRules: 0 }
  for (const group of groups) {
    acc.sections += group.summary.total
    acc.missing += group.summary.missing
    acc.untranslated += group.summary.untranslated
    acc.specialRules += group.summary.specialRules
  }
  return acc
}

// 参考 Key.hs：解析 `data EdgeOfTheEarthKey = …` 构造子；label 路径按 locale `key.*` 的命名规则
// （首字母小写，如 Camp_BarrierCamp → key.camp_BarrierCamp）推导，再用 en/zh 叶子核对覆盖。
const lowerFirst = value => value.charAt(0).toLowerCase() + value.slice(1)
function parseRecordKeyConstructors(source) {
  const start = source.indexOf('data EdgeOfTheEarthKey')
  if (start < 0) throw new Error(`${KEY_HS} 缺少 data EdgeOfTheEarthKey 声明`)
  const end = source.indexOf('deriving stock', start)
  const block = source.slice(start, end < 0 ? undefined : end)
  return [...block.matchAll(/^\s*(?:=\s*|\|\s*)([A-Za-z][A-Za-z0-9_']*)/gm)].map(match => match[1])
}

function recordKeysScan(enIndexMap, zhIndexMap) {
  const lock = sourceLock(KEY_HS, REFERENCE)
  const source = readFileSync(join(REFERENCE, KEY_HS), 'utf8')
  const constructors = parseRecordKeyConstructors(source)
  const keys = constructors.map(key => {
    const zhLabelPath = `key.${lowerFirst(key)}`
    return { key, zhLabelPath, en: enIndexMap.has(zhLabelPath), zh: zhIndexMap.has(zhLabelPath) }
  })
  return {
    source: lock.path,
    sha256: lock.sha256,
    keys,
    totals: {
      keys: keys.length,
      withZhLabel: keys.filter(entry => entry.zh).length,
      missingZhLabel: keys.filter(entry => !entry.zh).length,
    },
  }
}

function partnerNamesScan(enJson, enIndexMap, zhIndexMap) {
  // 卡号是补零的 5 位字符串（08714…08722），按字符串排序即是自然顺序，不能转 Number。
  const codes = Object.keys(enJson.partnerNames || {}).sort()
  const entries = codes.map(code => {
    const path = `partnerNames.${code}`
    return { code, zhPath: path, en: enIndexMap.has(path), zh: zhIndexMap.has(path) }
  })
  return {
    source: 'base.json',
    paths: { en: localePath('en', 'base.json'), zh: localePath('zh', 'base.json') },
    entries,
    missingZh: entries.filter(entry => !entry.zh).map(entry => entry.code),
  }
}

// Supplies.hs 的构造子 → 卡号（GreenSoapstone → "08614"）；base.json 的 suppliesRecovered
// 键名是构造子首字母小写（greenSoapstone），两边由文件推导后按命名规则对齐。
function suppliesScan(enJson, enIndexMap, zhIndexMap) {
  const lock = sourceLock(SUPPLIES_HS, REFERENCE)
  const source = readFileSync(join(REFERENCE, SUPPLIES_HS), 'utf8')
  const codes = new Map([...source.matchAll(/([A-Z][A-Za-z0-9_']*)\s*->\s*"(\d{5})"/g)]
    .map(match => [match[1], match[2]]))
  const recovered = enJson.suppliesRecovered || {}
  const entries = Object.keys(recovered).map(name => {
    const path = `suppliesRecovered.${name}`
    // locale 键名是构造子首字母小写（greenSoapstone ↔ GreenSoapstone），两边由文件推导后对齐。
    const constructor = name.charAt(0).toUpperCase() + name.slice(1)
    if (!codes.has(constructor)) throw new Error(`${SUPPLIES_HS} 缺少物资 ${constructor} 的卡号`)
    return { code: codes.get(constructor), path, en: enIndexMap.has(path), zh: zhIndexMap.has(path) }
  })
  return {
    source: lock.path,
    sha256: lock.sha256,
    entries,
    missingZh: entries.filter(entry => !entry.zh).map(entry => entry.path),
  }
}

export function buildRulesScan() {
  const en = readJson(join(REFERENCE, localePath('en', 'base.json')))
  const zh = readJson(join(REFERENCE, localePath('zh', 'base.json')))
  const enIndexMap = new Map(leaves(en).map(row => [row.path, row.text]))
  const zhIndexMap = zhIndex(zh)
  const groups = buildStoryGroups(en, zhIndexMap)
  return {
    campaignStory: {
      sources: { en: lockOf(localePath('en', 'base.json')), zh: lockOf(localePath('zh', 'base.json')) },
      groups,
      totals: totalsOfGroups(groups),
    },
    recordKeys: recordKeysScan(enIndexMap, zhIndexMap),
    partnerNames: partnerNamesScan(en, enIndexMap, zhIndexMap),
    suppliesRecovered: suppliesScan(en, enIndexMap, zhIndexMap),
  }
}
