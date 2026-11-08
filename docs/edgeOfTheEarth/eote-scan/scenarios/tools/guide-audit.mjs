// 指南面板覆盖审计：web/scenario-guides/<id>.json（EOTE 八章）x 参考 locale en/zh。
// 输出：每章 en/zh key 覆盖、zh 缺失块（missing 标记）、是否存在英文冒充（zh 文本与 en 相同或为英文）。
import fs from 'node:fs'
import path from 'node:path'

const MOD = 'G:/boardgame-hall-ai/games/arkhamhorror'
const WEB = path.join(MOD, 'web/scenario-guides')
const REF = 'G:/boardgame-hall-ai/参考资源/ArkhamHorror-main/frontend/src/locales'
const OUT = 'G:/boardgame-hall-ai/games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/scenarios/guides'

const CHAPTERS = [
  ['iceAndDeathPart1', 'iceAndDeath'],
  ['iceAndDeathPart2', 'iceAndDeath'],
  ['iceAndDeathPart3', 'iceAndDeath'],
  ['fatalMirage', 'fatalMirage'],
  ['toTheForbiddenPeaks', 'toTheForbiddenPeaks'],
  ['cityOfTheElderThings', 'cityOfTheElderThings'],
  ['theHeartOfMadnessPart1', 'theHeartOfMadness'],
  ['theHeartOfMadnessPart2', 'theHeartOfMadness'],
]

const isEnglishText = value => typeof value === 'string' && value.trim().length > 12
  && !/[\u4e00-\u9fff]/.test(value) && /[A-Za-z]{3,}\s+[A-Za-z]{3,}/.test(value)

function walkLocale (value, prefix, out, missing) {
  if (value == null) return
  if (typeof value === 'string') { out.push([prefix, value]); return }
  if (Array.isArray(value)) {
    value.forEach((item, index) => walkLocale(item, `${prefix}[${index}]`, out, missing))
    return
  }
  if (value.missing) { missing.push(prefix); return }
  for (const [key, child] of Object.entries(value)) {
    if (key === 'text' && typeof child === 'string') { out.push([prefix, child]); continue }
    walkLocale(child, prefix ? `${prefix}.${key}` : key, out, missing)
  }
}

const report = { generatedAt: new Date().toISOString(), chapters: [], summary: {} }
let regEn = 0
let regZh = 0
for (const [id, refId] of CHAPTERS) {
  const guide = JSON.parse(fs.readFileSync(path.join(WEB, `${id}.json`), 'utf8'))
  const enEntries = []
  const zhEntries = []
  const enMissing = []
  const zhMissing = []
  walkLocale(guide.locales?.en || {}, '', enEntries, enMissing)
  walkLocale(guide.locales?.zh || {}, '', zhEntries, zhMissing)
  const enMap = new Map(enEntries)
  const zhMap = new Map(zhEntries)
  const zhTextsOnly = new Set(zhEntries.map(([, v]) => v))
  const englishLeak = zhEntries.filter(([key, value]) => isEnglishText(value) && !enMap.has(key + '.enMirror'))
  // zh 中直接用英文（与 en 同 key 文本相同，或整段英文）的条目
  const sameAsEn = zhEntries.filter(([key, value]) => enMap.get(key) === value)
  const refEn = JSON.parse(fs.readFileSync(path.join(REF, 'en/edgeOfTheEarth/scenarios', `${refId}.json`), 'utf8'))
  const refZhPath = path.join(REF, 'zh/edgeOfTheEarth/scenarios', `${refId}.json`)
  const refZh = fs.existsSync(refZhPath) ? JSON.parse(fs.readFileSync(refZhPath, 'utf8')) : null
  const flat = (obj, out = []) => {
    if (obj == null) return out
    if (typeof obj === 'string') { out.push(obj); return out }
    if (Array.isArray(obj)) { obj.forEach(item => flat(item, out)); return out }
    for (const value of Object.values(obj)) flat(value, out)
    return out
  }
  const refEnStrings = flat(refEn).filter(value => typeof value === 'string' && value.trim())
  const refZhStrings = refZh ? flat(refZh).filter(value => typeof value === 'string' && value.trim()) : []
  const zhMissingKeysMeta = Object.entries(guide.chineseGaps || {})
  // 注册一致性：content/scenario-guides.js 的 note/setup 是否有本章
  const guidesSrc = fs.readFileSync(path.join(MOD, 'content/scenario-guides.js'), 'utf8')
  const registered = new RegExp(`\\n  ${id}: \\{`).test(guidesSrc)
  report.chapters.push({
    id,
    campaignId: guide.campaignId,
    sourceKind: guide.sourceKind,
    officialChinese: guide.officialChinese,
    chineseStatus: guide.chineseStatus,
    sectionCount: guide.sectionCount,
    guideKeyCount: guide.guideKeyCount,
    chinese: guide.chinese,
    chineseGapsCount: zhMissingKeysMeta.length,
    enTextBlocks: enEntries.length,
    zhTextBlocks: zhEntries.length,
    zhMissingBlocks: zhMissing.length,
    enMissingBlocks: enMissing.length,
    zhEnglishLeak: englishLeak.map(([key, value]) => ({ key, sample: value.slice(0, 90) })),
    zhSameAsEn: sameAsEn.map(([key]) => key),
    refEnStrings: refEnStrings.length,
    refZhStrings: refZhStrings.length,
    refZhCoverage: refEnStrings.length ? Number((refZhStrings.length / refEnStrings.length).toFixed(3)) : null,
    registeredInScenarioGuidesJs: registered,
    hasSetupEn: Boolean(guide.locales?.en?.setup),
    hasResolutionsEn: Boolean(guide.locales?.en?.resolutions),
    hasSetupZh: Boolean(guide.locales?.zh?.setup),
    hasResolutionsZh: Boolean(guide.locales?.zh?.resolutions),
    zhMissingSamples: zhMissing.slice(0, 8),
  })
  regEn += enEntries.length
  regZh += zhEntries.length
}
report.summary = {
  chapters: report.chapters.length,
  allRegistered: report.chapters.every(chapter => chapter.registeredInScenarioGuidesJs),
  anyZhEnglishLeak: report.chapters.some(chapter => chapter.zhEnglishLeak.length),
  totalEnBlocks: regEn,
  totalZhBlocks: regZh,
  chaptersWithZhMissing: report.chapters.filter(chapter => chapter.zhMissingBlocks > 0).map(chapter => chapter.id),
}
fs.writeFileSync(path.join(OUT, '_guide-coverage-v2.json'), JSON.stringify(report, null, 1), 'utf8')
console.log(JSON.stringify(report.summary, null, 1))
for (const chapter of report.chapters) {
  console.log(chapter.id, '| en', chapter.enTextBlocks, 'zh', chapter.zhTextBlocks, '| zhMissing', chapter.zhMissingBlocks,
    '| leaks', chapter.zhEnglishLeak.length, '| sameAsEn', chapter.zhSameAsEn.length,
    '| refZhCoverage', chapter.refZhCoverage, '| registered', chapter.registeredInScenarioGuidesJs)
}
