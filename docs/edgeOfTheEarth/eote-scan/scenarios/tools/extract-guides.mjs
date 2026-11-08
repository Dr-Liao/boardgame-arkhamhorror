// 提取 EOTE 八章官方指南（en 为主、zh 对照）为可读 markdown；同时统计中英 key 覆盖。
// 输入只读：web/scenario-guides/*.json（已生成的指南面板数据）+ 参考资源 en/zh locale。
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

const strip = value => String(value || '')
  .replace(/<li[^>]*>/gi, '\n• ')
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<\/p>/gi, '\n')
  .replace(/<[^>]*>/g, '')
  .replace(/\{setImgPath\}/g, '')
  .replace(/&nbsp;/g, ' ')
  .replace(/\n{3,}/g, '\n\n')
  .trim()

function flatten (value, prefix, out) {
  if (value == null) return
  if (typeof value === 'string') { out.push([prefix, value]); return }
  if (Array.isArray(value)) { value.forEach((item, index) => flatten(item, `${prefix}[${index}]`, out)); return }
  for (const [key, child] of Object.entries(value)) flatten(child, prefix ? `${prefix}.${key}` : key, out)
}

const collectStrings = value => {
  const list = []
  flatten(value, '', list)
  return list
}

fs.mkdirSync(OUT, { recursive: true })
const report = []
for (const [id, refId] of CHAPTERS) {
  const web = JSON.parse(fs.readFileSync(path.join(WEB, `${id}.json`), 'utf8'))
  const refEn = JSON.parse(fs.readFileSync(path.join(REF, 'en/edgeOfTheEarth/scenarios', `${refId}.json`), 'utf8'))
  const refZhPath = path.join(REF, 'zh/edgeOfTheEarth/scenarios', `${refId}.json`)
  const refZh = fs.existsSync(refZhPath) ? JSON.parse(fs.readFileSync(refZhPath, 'utf8')) : null
  const enEntries = collectStrings(web.locales.en)
  const zhEntries = collectStrings(web.locales.zh)
  const enKeys = new Map(enEntries)
  const zhKeys = new Map(zhEntries)
  const missingZh = [...enKeys.keys()].filter(key => !zhKeys.has(key))
  // zh 值与 en 相同的条目（可能是英文冒充）
  const zhSameAsEn = [...zhKeys.entries()].filter(([key, value]) => enKeys.get(key) === value)
  // 参考 locale 自身的 key 覆盖（扁平路径）
  const refEnEntries = collectStrings(refEn)
  const refZhEntries = refZh ? collectStrings(refZh) : []
  const refEnKeys = new Map(refEnEntries)
  const refZhKeys = new Map(refZhEntries)
  const refMissingZh = [...refEnKeys.keys()].filter(key => !refZhKeys.has(key))

  const lines = [`# ${id} 官方指南摘要（en）`, '', `guide meta: sourceKind=${web.sourceKind} officialChinese=${web.officialChinese} chineseStatus=${web.chineseStatus} sectionCount=${web.sectionCount} guideKeyCount=${web.guideKeyCount}`, `chinese meta: ${JSON.stringify(web.chinese)}`, `web en keys=${enKeys.size} zh keys=${zhKeys.size} missingZh=${missingZh.length} sameAsEn=${zhSameAsEn.length}`, `reference en keys=${refEnKeys.size} zh keys=${refZhKeys.size} refMissingZh=${refMissingZh.length}`, '']
  for (const section of Object.keys(web.locales.en)) {
    lines.push(`## ${section}`, '')
    const entries = collectStrings(web.locales.en[section])
    for (const [key, value] of entries) lines.push(`### ${section}.${key}`, strip(value), '')
  }
  fs.writeFileSync(path.join(OUT, `${id}.en.md`), lines.join('\n'), 'utf8')
  if (missingZh.length) {
    fs.writeFileSync(path.join(OUT, `${id}.zh-missing.json`), JSON.stringify({ webMissingZh: missingZh, zhSameAsEn: zhSameAsEn.map(([k]) => k), refMissingZh }, null, 1), 'utf8')
  }
  report.push({ id, webEnKeys: enKeys.size, webZhKeys: zhKeys.size, missingZh: missingZh.length, zhSameAsEn: zhSameAsEn.length, refEnKeys: refEnKeys.size, refZhKeys: refZhKeys.size, refMissingZh: refMissingZh.length, chinese: web.chinese, chineseStatus: web.chineseStatus })
}
fs.writeFileSync(path.join(OUT, '_coverage.json'), JSON.stringify(report, null, 1), 'utf8')
console.log(JSON.stringify(report, null, 1))
