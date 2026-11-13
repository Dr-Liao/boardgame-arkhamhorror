// 八循环《绯红密钥》（The Scarlet Keys）P7：剧情正文与指南读取物生成器。
//
// 只读参考资源（`参考资源/ArkhamHorror-main/`），输出确定性纯数据（无时间戳、无副作用）：
//   en 源：参考工程 `frontend/src/locales/en/theScarletKeys/{base.json, scenarios/*.json}`
//   zh 源：同路径 `zh/`（官方参考本地化；缺失/未译叶子由本生成器显式标记，不冒充官方中文）
//   → `content/campaigns/theScarletKeys/story-text.js`
//
// 口径与 P1 指南扫描（tools/tsk-guide-scan.mjs）一致：章节文件 = `scenarios/<id>.json`，
// base.json 承载序章/幕间 I/启程与旅行/世界地图密档/状况报告/幕间式支线/尾声/特别规则。
//
// 用法：
//   node tools/import-tsk-story.mjs --write   # 重写 story-text.js
//   node tools/import-tsk-story.mjs --check   # 逐字节复算（漂移即失败）
//   node tools/import-tsk-story.mjs           # 打印摘要（不写盘）
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { REFERENCE, sha } from './tsk-migration-lib.mjs'
import { chapters } from '../content/campaigns/theScarletKeys/shared.js'

export const MOD = fileURLToPath(new URL('../', import.meta.url))
export const STORY_TEXT = join(MOD, 'content/campaigns/theScarletKeys/story-text.js')
export const GENERATED_BY = 'tools/import-tsk-story.mjs'
const LOCALE_ROOT = 'frontend/src/locales'
const CAMPAIGN_DIR = 'theScarletKeys'
const CJK_PATTERN = /[\u3400-\u9fff]/
// 本地中文补译层（参考 zh locale 缺失/未译叶子的自译修正，非官方中文；来源只读）。
export const SUPPLEMENT_DIR = 'content/campaigns/theScarletKeys/locale-supplement'

function loadZhSupplement() {
  const dir = join(MOD, SUPPLEMENT_DIR)
  let names = []
  try {
    names = readdirSync(dir).filter(name => name.endsWith('.json')).sort()
  } catch {
    return { table: new Map(), files: [] }
  }
  const table = new Map()
  const files = []
  for (const name of names) {
    const payload = JSON.parse(readFileSync(join(dir, name), 'utf8'))
    let count = 0
    for (const entry of payload.entries || []) {
      if (!entry?.file || !entry?.path || typeof entry.zh !== 'string' || !entry.zh.trim()) continue
      table.set(`${entry.file}::${entry.path}`, entry.zh.trim())
      count += 1
    }
    files.push({ name, entries: count })
  }
  return { table, files }
}
const ZH_SUPPLEMENT = loadZhSupplement()
const supplementZh = (file, path) => ZH_SUPPLEMENT.table.get(`${file}::${path}`)

const readJson = relativePath => JSON.parse(readFileSync(join(REFERENCE, relativePath), 'utf8'))
const localeFile = (language, file) => readJson(`${LOCALE_ROOT}/${language}/${CAMPAIGN_DIR}/${file}`)

/** 中文覆盖三态（与 P1 指南扫描一致）：缺路径 / 有但非中文 / 含中文待校对。 */
function chineseStatus(zhValue) {
  if (zhValue === undefined) return 'missing'
  if (typeof zhValue !== 'string' || !zhValue.trim()) return 'untranslated'
  return CJK_PATTERN.test(zhValue) ? 'present-needs-review' : 'untranslated'
}

function leaves(value, path = '') {
  if (typeof value === 'string') return [{ path, text: value }]
  if (Array.isArray(value)) return value.flatMap((child, index) => leaves(child, path ? `${path}.${index}` : String(index)))
  return Object.entries(value || {}).flatMap(([key, child]) => leaves(child, path ? `${path}.${key}` : key))
}

const zhIndex = zhNode => new Map(leaves(zhNode).map(row => [row.path, row.text]))

/**
 * 以 en 结构为骨架生成展示层：叶子取 zh（含 CJK 才视为已译），否则回退 en；
 * 所有回退/未译路径逐条记录，展示端据此渲染「缺译」标记，不静默冒充中文。
 */
function localizedTree(enNode, zhIndexMap, gaps, path = '', file = null) {
  if (typeof enNode === 'string') {
    const zh = (file && supplementZh(file, path)) ?? zhIndexMap.get(path)
    const status = chineseStatus(zh)
    if (status === 'present-needs-review') return zh
    gaps.push({ path, status })
    return enNode
  }
  if (Array.isArray(enNode)) return enNode.map((child, index) => localizedTree(child, zhIndexMap, gaps, path ? `${path}.${index}` : String(index), file))
  return Object.fromEntries(Object.entries(enNode || {}).map(([key, child]) => [
    key, localizedTree(child, zhIndexMap, gaps, path ? `${path}.${key}` : key, file),
  ]))
}

function sectionSummary(sectionsEn, sections, gaps) {
  const all = leaves(sectionsEn)
  return {
    total: all.length,
    missing: gaps.filter(gap => gap.status === 'missing').length,
    untranslated: gaps.filter(gap => gap.status === 'untranslated').length,
    present: all.length - gaps.length,
    specialRules: all.filter(row => row.path.startsWith('specialRules.')).length,
  }
}

const lockedFile = file => {
  const path = `${LOCALE_ROOT}/en/${CAMPAIGN_DIR}/${file}`
  const bytes = readFileSync(join(REFERENCE, path))
  return { path, sha256: sha(bytes) }
}

export function buildStoryText() {
  const baseEn = localeFile('en', 'base.json')
  const baseZh = localeFile('zh', 'base.json')
  const baseGaps = []
  const campaignSections = localizedTree(baseEn, zhIndex(baseZh), baseGaps, '', 'base.json')
  const chapterEntries = {}
  const chapterSummaries = {}
  for (const chapter of chapters) {
    const file = `scenarios/${chapter.id}.json`
    const en = localeFile('en', file)
    const zh = localeFile('zh', file)
    const gaps = []
    const sections = localizedTree(en, zhIndex(zh), gaps, '', file)
    chapterEntries[chapter.id] = {
      id: chapter.id,
      name: chapter.name,
      nameEn: chapter.nameEn,
      referenceCode: chapter.referenceCode,
      file,
      sectionsEn: en,
      sections,
      chineseGaps: gaps,
      status: 'generated',
      chinese: gaps.length ? 'reference-zh-with-gaps' : 'reference-zh',
      summary: sectionSummary(en, sections, gaps),
    }
    chapterSummaries[chapter.id] = { ...chapterEntries[chapter.id].summary, file }
  }
  const keys = Object.fromEntries(Object.entries(baseEn).map(([key, en]) => {
    const gaps = []
    return [key, { en, zh: localizedTree(en, zhIndex(baseZh), gaps, key, 'base.json'), chineseGaps: gaps }]
  }))
  const gapTotal = baseGaps.length + Object.values(chapterEntries).reduce((sum, entry) => sum + (entry.summary.missing + entry.summary.untranslated), 0)
  const text = {
    campaign: { file: 'base.json', sectionsEn: baseEn, sections: campaignSections, summary: sectionSummary(baseEn, campaignSections, baseGaps), chineseGaps: baseGaps },
    chapters: chapterEntries,
    keys,
  }
  const meta = {
    status: 'generated',
    stage: 'P7-story',
    sourceKind: 'reference-project-zh-locale',
    officialChinese: false,
    note: '中文正文优先参考工程 zh locale；缺失/未译叶子在 chineseGaps 与各章 summary 上显式标记，展示层回退英文但不冒充中文。',
    generator: GENERATED_BY,
    generatedFrom: '参考资源/ArkhamHorror-main/frontend/src/locales',
    sources: [...ZH_SUPPLEMENT.files.map(item => ({ path: `${SUPPLEMENT_DIR}/${item.name}`, entries: item.entries })), lockedFile('base.json'), ...chapters.map(chapter => lockedFile(`scenarios/${chapter.id}.json`))],
    zhSupplement: { path: SUPPLEMENT_DIR, files: ZH_SUPPLEMENT.files },
    counts: {
      chapters: chapters.length,
      campaignLeaves: text.campaign.summary.total,
      chapterLeaves: Object.values(chapterSummaries).reduce((sum, item) => sum + item.total, 0),
      chineseGaps: gapTotal,
    },
  }
  return { meta, story: text, chapterSummaries }
}

function renderModule({ meta, story }) {
  return `// 绯红密钥（The Scarlet Keys）· 剧情正文生成物（P7）。
//
// 本文件由 \`node tools/import-tsk-story.mjs --write\` 生成，请勿手改；改源后重跑并 --check。
// 来源：参考工程 en/zh locale（frontend/src/locales/{en,zh}/theScarletKeys）；
// 中文逐键取自 zh locale，缺失/未译叶子在 chineseGaps/summary 上显式标记（不冒充官方中文）。
//
// 结构：campaign（序章/幕间 I/启程与旅行/世界地图密档/状况报告/支线幕间/尾声/特别规则）·
//   chapters（10 章，按世界地图到达章节）· keys（base.json 顶层段落，供流程直接读取）。

export const TSK_STORY_META = ${JSON.stringify(meta, null, 2)}

export const TSK_STORY_TEXT = ${JSON.stringify(story, null, 2)}

export const TSK_STORY_KEYS = TSK_STORY_TEXT.keys
`
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const built = buildStoryText()
  const source = renderModule(built)
  if (process.argv.includes('--write')) {
    writeFileSync(STORY_TEXT, source)
    console.log(`tsk story: 已写入 ${STORY_TEXT}（${built.meta.counts.chapters} 章 / ${built.meta.counts.chapterLeaves} 叶 / 缺译 ${built.meta.counts.chineseGaps}）`)
  } else if (process.argv.includes('--check')) {
    const disk = readFileSync(STORY_TEXT, 'utf8')
    if (disk !== source) throw new Error('content/campaigns/theScarletKeys/story-text.js 与来源不一致：审阅后 --write')
    console.log('tsk story: 复算一致')
  } else {
    console.log(JSON.stringify({ meta: built.meta, chapters: built.chapterSummaries }, null, 2))
  }
}
