// 过滤 screen/*.json 中属于本分片（08596–08647）的条目，输出汇总 JSON 到 campaign/c/_screen-filtered.json。
import fs from 'node:fs'
import path from 'node:path'

const ROOT = 'G:/boardgame-hall-ai/games/arkhamhorror/docs/edgeOfTheEarth/eote-scan'
const inScope = code => /^08(59[6-9]|6[0-4][0-9])$/.test(String(code))
const read = name => JSON.parse(fs.readFileSync(path.join(ROOT, 'screen', name), 'utf8'))
const out = { generatedAt: new Date().toISOString() }

const integrity = read('integrity.json')
out.integrity = (integrity.cards || []).filter(c => inScope(c.code))

const kw = read('keyword-coverage.json')
out.keywordCoverage = (kw.cards || []).filter(c => inScope(c.code))

const fr = read('flags-readpoints.json')
out.flagsUnread = (fr.unread || []).filter(c => inScope(c.code))
out.flagsAll = (fr.all || []).filter(c => inScope(c.code))

const tc = read('tests-coverage.json')
out.testsCoverage = (tc.cards || []).filter(c => inScope(c.code)).map(c => ({
  code: c.code, name: c.name, level: c.level, files: c.files,
  strongTitles: c.strongTitles, weakTitles: c.weakTitles,
}))

const kd = read('known-deviations.json')
out.knownDeviationsKeys = Object.keys(kd)
out.knownDeviations = {}
for (const [k, v] of Object.entries(kd)) {
  if (Array.isArray(v)) out.knownDeviations[k] = v.filter(item => inScope(item?.code || item?.card || ''))
  else if (v && typeof v === 'object') {
    out.knownDeviations[k] = {}
    for (const [k2, v2] of Object.entries(v)) {
      if (Array.isArray(v2)) out.knownDeviations[k][k2] = v2.filter(item => inScope(item?.code || ''))
      else out.knownDeviations[k][k2] = v2
    }
  } else out.knownDeviations[k] = v
}

const comp = read('primitive-compliance.json')
out.primitiveComplianceKeys = Object.keys(comp)
out.primitiveCompliance = {}
for (const [k, v] of Object.entries(comp)) {
  if (Array.isArray(v)) out.primitiveCompliance[k] = v.filter(item => inScope(item?.code || ''))
  else if (v && typeof v === 'object') {
    out.primitiveCompliance[k] = {}
    for (const [k2, v2] of Object.entries(v)) {
      if (Array.isArray(v2)) out.primitiveCompliance[k][k2] = v2.filter(item => inScope(item?.code || ''))
      else out.primitiveCompliance[k][k2] = v2
    }
  } else out.primitiveCompliance[k] = v
}

const dup = read('duplication.json')
out.duplicationKeys = Object.keys(dup)
out.duplication = {}
for (const [k, v] of Object.entries(dup)) {
  if (Array.isArray(v)) {
    out.duplication[k] = v.filter(item => {
      const s = JSON.stringify(item)
      return [...s.matchAll(/08(?:59[6-9]|6[0-4][0-9])/g)].length > 0
    })
  } else if (v && typeof v === 'object') {
    out.duplication[k] = {}
    for (const [k2, v2] of Object.entries(v)) {
      if (Array.isArray(v2)) {
        out.duplication[k][k2] = v2.filter(item => /08(?:59[6-9]|6[0-4][0-9])/.test(JSON.stringify(item)))
      } else out.duplication[k][k2] = v2
    }
  } else out.duplication[k] = v
}

const pc = read('perceivability.json')
out.perceivability = Array.isArray(pc.cards) ? pc.cards.filter(c => inScope(c.code)) : pc

fs.writeFileSync(path.join(ROOT, 'campaign/c/_screen-filtered.json'), JSON.stringify(out, null, 1), 'utf8')
console.log('written; sizes:')
for (const [k, v] of Object.entries(out)) {
  console.log(k, Array.isArray(v) ? v.length : typeof v === 'object' ? JSON.stringify(v).length : v)
}
