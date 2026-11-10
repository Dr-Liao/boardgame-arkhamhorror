// 八循环《绯红密钥》（The Scarlet Keys）P1 第 1 步：完整指南、战役地图密档与剧情/规则来源扫描。
//
// 本文件只读参考资源（`参考资源/ArkhamHorror-main/`），输出确定性的纯数据（无时间戳、无副作用）：
//   · buildGuides()    —— 10 章的完整指南段落清单。en 指南 JSON 是段落事实源；中文覆盖按同路径
//                         zh 叶子是否存在、是否含中日韩字符判定；sourceSha256 锁 en 叶子文本，
//                         sources.sha256 锁原始文件字节；档案编号（File #NN-X）与地图节点互相核对。
//   · buildStoryScan() —— 战役剧情/规则：序幕、幕间 I、启程与旅行、地图密档（worldMap.dossiers）、
//                         17 段海外幕间、8 份状况报告、特别规则、81 个记录键标签、36 个地点名，
//                         单列中文缺译与特别规则，并把档案编号整理成「地图节点 ↔ 章节/幕间」索引。
//
// 口径见 docs/campaign/theScarletKeys/README.md §3 P1、§4、§5 与 docs/arkham-content-migration.md §4.2/§4.5.2：
//   · 只做分类与覆盖清单，不写卡、不冒充已实现；所有条目 status 保持 `pending`；
//   · 中文状态：zh 缺同路径 → missing；有但不含 CJK → untranslated；含 CJK → present-needs-review；
//   · `specialRule: path.startsWith('specialRules.')`；战役级 specialRules 归 buildStoryScan。
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { REFERENCE, readJson, sha, sourceLock } from './tsk-migration-lib.mjs'
import {
  CHAPTER_MAP_TRIGGERS, INTERLUDES, STATUS_REPORTS, chapters,
} from '../content/campaigns/theScarletKeys/shared.js'

// 来源根（签入账本时只记相对路径）：参考资源在 Mod 仓库的上一级。
export const SOURCE_ROOT = '参考资源/ArkhamHorror-main'
const LOCALE_ROOT = 'frontend/src/locales'
const GUIDE_DIR = 'theScarletKeys'
const KEY_HS = 'backend/arkham-api/library/Arkham/Campaigns/TheScarletKeys/Key.hs'
const CJK_PATTERN = /[\u3400-\u9fff]/

// 指南层：TSK 的章节 JSON 比 EotE 多 rules / versions / remembered / 密档小节，逐层可解释。
export const TSK_GUIDE_LAYERS = Object.freeze([
  'heading', 'tokens', 'setup', 'intro', 'interlude', 'resolutions', 'specialRules', 'labels',
  'deck', 'characters', 'rules', 'versions', 'story', 'ui',
])

const localePath = (lang, file) => `${LOCALE_ROOT}/${lang}/${GUIDE_DIR}/${file}`
const guideFileOf = guideId => `scenarios/${guideId}.json`

// 把嵌套 JSON 摊平成叶子路径 → 文本；数组按数字下标展开。
export function leaves(value, path = '') {
  if (typeof value === 'string') return [{ path, text: value }]
  if (Array.isArray(value)) return value.flatMap((child, index) => leaves(child, path ? `${path}.${index}` : String(index)))
  return Object.entries(value || {}).flatMap(([key, child]) => leaves(child, path ? `${path}.${key}` : key))
}

// 段落 layer：按路径段分类；顺序即优先级（越具体越先）。
export function layerOf(path) {
  const segments = path.split('.')
  const has = pattern => segments.some(segment => pattern.test(segment))
  if (segments[0] === 'specialRules') return 'specialRules'
  if (segments[0] === 'tokens') return 'tokens'
  if (segments[0] === 'heading' || has(/^heading$/i)) return 'heading'
  if (has(/^ui$/i) || has(/^tooltips?$/i) || has(/^label$/i) || has(/label|tooltip/i)) return 'labels'
  // 版本化准备（setup.version1.* / version1.*）优先按「准备」归类；顶层 versionN.* 才归 versions。
  if (has(/setup/i) || has(/rawDeal|theBomoh|act2Setup/i)) return 'setup'
  if (has(/^trackingTime$/i) || segments[0] === 'rules') return 'rules'
  if (has(/^version[123]$/i) || has(/^versions?$/i)) return 'versions'
  if (has(/interlude/i)) return 'interlude'
  if (has(/^resolution/i)) return 'resolutions'
  if (has(/deck/i)) return 'deck'
  if (has(/killed|missing|alive|otherwise|present|confronted/i)) return 'characters'
  if (segments[0] === 'remembered' || segments[0] === 'intro' || has(/^intro/i)) return 'intro'
  return 'story'
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
    rulesSections: sections.filter(section => section.layer === 'rules').length,
  }
}

// 档案编号（File #NN-X）：正文里用 en dash / em dash / 连字符三种写法，统一成 `NN-X` 便于跨文件比对。
export const normalizeArchiveLabel = value => {
  const match = String(value || '').match(/File\s*#(\d+)\s*[\u2013\u2014-]\s*([A-Z])/)
  return match ? `${Number(match[1])}-${match[2]}` : null
}
export function collectArchiveLabels(value) {
  const labels = new Set()
  const visit = item => {
    if (typeof item === 'string') {
      for (const match of item.matchAll(/File\s*#(\d+)\s*[\u2013\u2014-]\s*([A-Z])/g)) labels.add(`${Number(match[1])}-${match[2]}`)
      return
    }
    if (Array.isArray(item)) return item.forEach(visit)
    if (item && typeof item === 'object') Object.values(item).forEach(visit)
  }
  visit(value)
  return [...labels].sort()
}

export function buildGuides() {
  const baseEn = readJson(join(REFERENCE, localePath('en', 'base.json')))
  return chapters.map(chapter => {
    const file = guideFileOf(chapter.guideId)
    const en = readJson(join(REFERENCE, localePath('en', file)))
    const zh = readJson(join(REFERENCE, localePath('zh', file)))
    const zhIndexMap = zhIndex(zh)
    const sections = leaves(en).map(row => sectionOf(row, zhIndexMap))
    const archiveLabels = collectArchiveLabels(en)
    const expectedLabel = normalizeArchiveLabel(chapter.archiveLabel)
    const mapNode = chapter.mapLocationId
    const mapSubtitleLabel = normalizeArchiveLabel(baseEn?.locations?.[mapNode]?.subtitle || '')
    const dossierLabels = [...new Set(INTERLUDES
      .filter(entry => entry.triggerLocations.includes(mapNode))
      .flatMap(entry => collectArchiveLabels(baseEn?.headings?.interludes?.[String(entry.number)] || '')))]
    const allLabels = [...new Set([...archiveLabels, mapSubtitleLabel, ...dossierLabels].filter(Boolean))].sort()
    return {
      id: chapter.id, guideId: chapter.guideId, part: null, partMapping: 'whole-file',
      mapLocationId: mapNode,
      archiveLabel: chapter.archiveLabel,
      archiveLabelNormalized: expectedLabel,
      archiveLabelMatched: Boolean(expectedLabel) && allLabels.includes(expectedLabel),
      archiveLabels: allLabels,
      sources: { en: lockOf(localePath('en', file)), zh: lockOf(localePath('zh', file)) },
      sections,
      summary: summarize(sections),
      zhLeafCount: zhIndexMap.size,
    }
  })
}

// 剧情/规则分组的顶层键归类；其余顶层键各自成组（TSK 的幕间 scope 名就是顶层键）。
const SPECIAL_STORY_TOP_LEVEL = Object.freeze({
  worldMap: 'campaignMapDossiers',
  statusReport: 'statusReports',
  specialRules: 'specialRules',
  key: 'recordLabels',
  label: 'labels',
  headings: 'headings',
  locations: 'locations',
  xp: 'xp',
  interludes: 'interludes',
})
const lowerFirst = value => value.charAt(0).toLowerCase() + value.slice(1)

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
    if (Object.hasOwn(SPECIAL_STORY_TOP_LEVEL, key)) push(SPECIAL_STORY_TOP_LEVEL[key], rows)
    else push(key, rows)
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

// 参考 Key.hs：解析 `data TheScarletKeysKey = …` 构造子；label 路径按 locale `key.*` 命名规则
// （首字母小写，如 Camp_BarrierCamp → key.camp_BarrierCamp）推导，再用 en/zh 叶子核对覆盖。
function parseRecordKeyConstructors(source) {
  const start = source.indexOf('data TheScarletKeysKey')
  if (start < 0) throw new Error(`${KEY_HS} 缺少 data TheScarletKeysKey 声明`)
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

// 战役地图密档：worldMap.dossiers 的每个档案 → 档案编号、正文条目、对应地图节点、归属章节/幕间。
function dossierScan(baseEn, baseZh, zhIndexMap, expectedLabels) {
  const dossiersEn = baseEn?.worldMap?.dossiers || {}
  const nodeLabels = Object.fromEntries(Object.entries(baseEn?.locations || {})
    .map(([node, entry]) => [node, normalizeArchiveLabel(entry?.subtitle || '')])
    .filter(([, label]) => label))
  const labelNodeCount = new Map()
  for (const label of Object.values(nodeLabels)) labelNodeCount.set(label, (labelNodeCount.get(label) || 0) + 1)
  const rows = Object.keys(dossiersEn).map(key => {
    const value = dossiersEn[key]
    // 档案编号取法：dossier 键本身是地图节点时用该节点副标题（避免正文里顺带提到的其他档案号干扰，
    // 例如 Havana 正文同时提到 #26-G）；特殊键（Sanctums / DrIrawan）取正文里覆盖地点数最多的编号。
    const candidates = collectArchiveLabels(value)
    const ownLabel = nodeLabels[key] || null
    const label = ownLabel || [...candidates].sort((left, right) =>
      (labelNodeCount.get(right) || 0) - (labelNodeCount.get(left) || 0) || left.localeCompare(right))[0] || null
    const paths = leaves(value, `worldMap.dossiers.${key}`)
    const sections = paths.map(row => sectionOf(row, zhIndexMap))
    const locations = label ? Object.entries(nodeLabels).filter(([, nodeLabel]) => nodeLabel === label).map(([node]) => node) : []
    const chapter = expectedLabels.chapters.get(label) || null
    const interludeNumber = expectedLabels.interludes.get(label) || null
    const zhRow = leaves(baseZh?.worldMap?.dossiers?.[key], `worldMap.dossiers.${key}`)
    return {
      key,
      label,
      locations,
      chapterId: chapter,
      interludeNumber,
      source: `frontend/src/locales/en/theScarletKeys/base.json#worldMap.dossiers.${key}`,
      sections,
      summary: summarize(sections),
      en: paths.length > 0,
      zh: zhRow.some(row => CJK_PATTERN.test(row.text)),
    }
  })
  return rows
}

export function buildStoryScan() {
  const en = readJson(join(REFERENCE, localePath('en', 'base.json')))
  const zh = readJson(join(REFERENCE, localePath('zh', 'base.json')))
  const enIndexMap = new Map(leaves(en).map(row => [row.path, row.text]))
  const zhIndexMap = zhIndex(zh)
  const groups = buildStoryGroups(en, zhIndexMap)
  const guides = buildGuides()
  // 期望的档案编号索引：10 章 + 16 段海外幕间（来自 shared.js，不是从 locale 反推）。
  const expectedLabels = {
    chapters: new Map(chapters.map(chapter => [normalizeArchiveLabel(chapter.archiveLabel), chapter.id])),
    interludes: new Map(INTERLUDES
      .map(entry => [collectArchiveLabels(en?.headings?.interludes?.[String(entry.number)] || '')[0] || null, entry.number])
      .filter(([label]) => label)),
  }
  const dossiers = dossierScan(en, zh, zhIndexMap, expectedLabels)
  const narrativeGroups = groups.filter(group => !['recordLabels', 'labels', 'headings', 'locations', 'xp'].includes(group.id))
  return {
    campaignStory: {
      sources: { en: lockOf(localePath('en', 'base.json')), zh: lockOf(localePath('zh', 'base.json')) },
      groups,
      totals: totalsOfGroups(narrativeGroups),
      narrativeGroupIds: narrativeGroups.map(group => group.id),
    },
    guides: {
      count: guides.length,
      archiveLabelMatched: guides.filter(guide => guide.archiveLabelMatched).length,
      generated: guides.map(guide => ({ id: guide.id, archiveLabel: guide.archiveLabel, archiveLabelMatched: guide.archiveLabelMatched })),
    },
    archiveLabels: {
      expected: {
        chapters: [...expectedLabels.chapters.entries()].map(([label, chapterId]) => ({ label, chapterId })),
        interludes: [...expectedLabels.interludes.entries()].map(([label, number]) => ({ label, interludeNumber: number })),
      },
      mapDossiers: dossiers.map(dossier => ({ key: dossier.key, label: dossier.label, locations: dossier.locations, chapterId: dossier.chapterId, interludeNumber: dossier.interludeNumber })),
      dossierCount: dossiers.length,
      locationLabels: Object.entries(en?.locations || {}).map(([node, entry]) => ({ node, label: normalizeArchiveLabel(entry?.subtitle || '') })).filter(row => row.label),
    },
    mapDossiers: dossiers,
    interludes: INTERLUDES.map(entry => {
      const rows = leaves(en?.interludes?.[String(entry.number)] || {}, `interludes.${entry.number}`)
      const sections = rows.map(row => sectionOf(row, zhIndexMap))
      return {
        number: entry.number,
        nameEn: typeof en?.interludes?.[String(entry.number)] === 'string' ? en.interludes[String(entry.number)] : null,
        nameZh: typeof zh?.interludes?.[String(entry.number)] === 'string' ? zh.interludes[String(entry.number)] : null,
        archiveLabel: collectArchiveLabels(en?.headings?.interludes?.[String(entry.number)] || '')[0] || null,
        triggerLocations: [...entry.triggerLocations],
        sections,
        summary: summarize(sections),
        status: 'pending',
      }
    }),
    statusReports: STATUS_REPORTS.map(entry => {
      const rows = leaves(en?.statusReport?.[entry.report] || {}, `statusReport.${entry.report}`)
      const sections = rows.map(row => sectionOf(row, zhIndexMap))
      return {
        report: entry.report,
        threshold: entry.threshold,
        dynamic: false,
        sections,
        summary: summarize(sections),
        status: 'pending',
      }
    }).concat(['theta', 'psi'].map(report => {
      const rows = leaves(en?.statusReport?.[report] || {}, `statusReport.${report}`)
      const sections = rows.map(row => sectionOf(row, zhIndexMap))
      return { report, threshold: null, dynamic: true, sections, summary: summarize(sections), status: 'pending' }
    })),
    specialRules: {
      entries: Object.keys(en?.specialRules || {}).length,
      sections: leaves(en?.specialRules, 'specialRules').map(row => sectionOf(row, zhIndexMap)),
    },
    recordKeys: recordKeysScan(enIndexMap, zhIndexMap),
    chapterMapTriggers: CHAPTER_MAP_TRIGGERS,
  }
}
