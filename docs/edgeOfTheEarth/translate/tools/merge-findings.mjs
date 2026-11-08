// 《地球边缘》翻译审计 —— findings 合并、校验与统计（Lead 收口工具）。
//
// 输入：docs/edgeOfTheEarth/translate/<area>/findings.json（area = cards/story/guides/terms）
// 输出：docs/edgeOfTheEarth/translate/findings.json（合并版，逐条保留 area 前缀 id 与来源）
//       控制台打印统计与校验告警（location 文件/行号不存在、schema 缺字段、重复项）。
//
// 用法（在 games/arkhamhorror 下）：
//   node docs/edgeOfTheEarth/translate/tools/merge-findings.mjs
//   node docs/edgeOfTheEarth/translate/tools/merge-findings.mjs --check   # 只校验不写文件
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join, isAbsolute } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const MOD = join(HERE, '..', '..', '..', '..')
const TRANSLATE = join(HERE, '..')
const AREAS = ['cards', 'story', 'guides', 'terms']
const CATEGORIES = ['missing-translation', 'mixed-language', 'symbol-format', 'mistranslation', 'marker-leak', 'terminology']
const SEVERITIES = ['high', 'medium', 'low']
const CHECK_ONLY = process.argv.includes('--check')

const lineCountCache = new Map()
function fileLineCount(relative) {
  const abs = isAbsolute(relative) ? relative : join(MOD, relative)
  if (!lineCountCache.has(abs)) {
    try {
      const text = readFileSync(abs, 'utf8')
      lineCountCache.set(abs, text.split('\n').length)
    } catch {
      lineCountCache.set(abs, null)
    }
  }
  return lineCountCache.get(abs)
}
function validateLocation(location) {
  if (typeof location !== 'string' || !location.trim()) return { ok: false, reason: 'missing-location' }
  const match = /^(.*):(\d+)$/.exec(location.trim())
  if (!match) return { ok: false, reason: 'no-line-number' }
  const [, file, lineText] = match
  const count = fileLineCount(file.replace(/\\/g, '/'))
  if (count == null) return { ok: false, reason: 'file-not-found' }
  const line = Number(lineText)
  if (line < 1 || line > count) return { ok: false, reason: `line-out-of-range(${count})` }
  return { ok: true }
}

const normalizeTitle = title => String(title || '').replace(/[，。；：、,.;:\s（）()「」『』“”"']/g, '').slice(0, 40)
const sameScope = (a, b) => JSON.stringify(a || null) === JSON.stringify(b || null)

const findings = []
const validation = { warnings: [], invalidLocations: [], missingFields: [], duplicates: [], areaSummaries: {} }
const seen = new Map()

for (const area of AREAS) {
  const file = join(TRANSLATE, area, 'findings.json')
  if (!existsSync(file)) {
    validation.warnings.push(`缺少 area findings：${area}/findings.json`)
    continue
  }
  let payload
  try {
    payload = JSON.parse(readFileSync(file, 'utf8'))
  } catch (error) {
    validation.warnings.push(`${area}/findings.json 解析失败：${error.message}`)
    continue
  }
  const list = Array.isArray(payload.findings) ? payload.findings : Array.isArray(payload.issues) ? payload.issues : []
  const areaSummary = {
    auditor: payload.auditor ?? null,
    declaredFindings: payload.summary?.findings ?? list.length,
    actualFindings: list.length,
    byCategory: {},
    bySeverity: {},
  }
  for (const raw of list) {
    const category = CATEGORIES.includes(raw.category) ? raw.category : 'symbol-format'
    const severity = SEVERITIES.includes(raw.severity) ? raw.severity : 'medium'
    const location = raw.location ?? raw.evidencePath ?? null
    const locationCheck = validateLocation(location)
    if (!locationCheck.ok) validation.invalidLocations.push({ area, id: raw.id, location, reason: locationCheck.reason })
    if (!raw.title) validation.missingFields.push({ area, id: raw.id, field: 'title' })
    if (!raw.evidence) validation.missingFields.push({ area, id: raw.id, field: 'evidence' })
    if (raw.category && !CATEGORIES.includes(raw.category)) validation.warnings.push(`${area}/${raw.id} 未知 category=${raw.category}，已归为 symbol-format`)
    if (raw.severity && !SEVERITIES.includes(raw.severity)) validation.warnings.push(`${area}/${raw.id} 未知 severity=${raw.severity}，已归为 medium`)

    const entry = {
      id: String(raw.id || `${area}-${findings.length + 1}`).startsWith(area) ? String(raw.id) : `${area}-${raw.id || findings.length + 1}`,
      area,
      category,
      severity,
      title: String(raw.title || '').trim(),
      scope: raw.scope ?? raw.key ?? null,
      location: locationCheck.ok ? location : location,
      locationValid: locationCheck.ok,
      pointer: raw.pointer ?? null,
      evidence: String(raw.evidence ?? '').trim(),
      expected: raw.expected ?? null,
      suggestion: raw.suggestion ?? null,
      source: raw.source ?? null,
      count: Number.isFinite(raw.count) ? raw.count : 1,
      samples: Array.isArray(raw.samples) ? raw.samples : undefined,
      crossArea: raw.crossArea ?? undefined,
      runtimeImpact: raw.runtimeImpact ?? raw.impact ?? undefined,
      raw: raw.raw ?? undefined,
    }
    areaSummary.byCategory[category] = (areaSummary.byCategory[category] || 0) + 1
    areaSummary.bySeverity[severity] = (areaSummary.bySeverity[severity] || 0) + 1

    const dedupeKey = `${category}|${normalizeTitle(entry.title)}|${entry.location}`
    if (seen.has(dedupeKey)) {
      validation.duplicates.push({ kept: seen.get(dedupeKey), dropped: entry.id })
      const kept = findings.find(item => item.id === seen.get(dedupeKey))
      if (kept) kept.relatedIds = [...(kept.relatedIds || []), entry.id]
      continue
    }
    seen.set(dedupeKey, entry.id)
    findings.push(entry)
  }
  validation.areaSummaries[area] = areaSummary
}

const byCategory = {}
const bySeverity = {}
const byArea = {}
for (const finding of findings) {
  byCategory[finding.category] = (byCategory[finding.category] || 0) + 1
  bySeverity[finding.severity] = (bySeverity[finding.severity] || 0) + 1
  byArea[finding.area] = (byArea[finding.area] || 0) + 1
}

const summary = {
  findings: findings.length,
  byCategory,
  bySeverity,
  byArea,
  highFindings: findings.filter(finding => finding.severity === 'high').map(finding => ({
    id: finding.id, area: finding.area, category: finding.category, title: finding.title, location: finding.location,
  })),
}

const output = {
  audit: 'edgeOfTheEarth-translation',
  generatedAt: new Date().toISOString(),
  method: '四个 area 审计员分头扫描 + Lead 独立交叉复核（tools/lead-crosscheck.mjs）+ 合并去重/证据校验',
  schema: 'docs/edgeOfTheEarth/translate/_SPEC.md#五',
  scope: {
    cards: 'src/cards/cards-data.js eoep/eoec 08 号段 403 卡',
    story: 'content/campaigns/edgeOfTheEarth/story-text.js + 战役模块',
    guides: 'web/scenario-guides/ EOTE 8 份指南 JSON',
    terms: '跨内容术语/简繁/专名一致性',
  },
  areas: validation.areaSummaries,
  summary,
  validation: {
    warnings: validation.warnings,
    invalidLocations: validation.invalidLocations,
    missingFields: validation.missingFields,
    duplicates: validation.duplicates,
    locationCheck: 'location 形如 path:line；相对 Mod 根解析并校验文件存在且行号在范围内',
  },
  findings,
}

const printSummary = () => {
  console.log(JSON.stringify({ summary, validation: { warnings: validation.warnings.length, invalidLocations: validation.invalidLocations.length, missingFields: validation.missingFields.length, duplicates: validation.duplicates.length }, areas: validation.areaSummaries }, null, 2))
  if (validation.invalidLocations.length) console.log('\nINVALID LOCATIONS:\n' + JSON.stringify(validation.invalidLocations.slice(0, 30), null, 1))
  if (validation.missingFields.length) console.log('\nMISSING FIELDS:\n' + JSON.stringify(validation.missingFields.slice(0, 30), null, 1))
  if (validation.duplicates.length) console.log('\nDUPLICATES:\n' + JSON.stringify(validation.duplicates.slice(0, 30), null, 1))
}

if (CHECK_ONLY) {
  printSummary()
} else {
  writeFileSync(join(TRANSLATE, 'findings.json'), JSON.stringify(output, null, 2) + '\n')
  printSummary()
  console.log(`\nwritten: ${join(TRANSLATE, 'findings.json')}`)
}
