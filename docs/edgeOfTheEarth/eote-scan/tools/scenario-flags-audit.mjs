import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
const MODS = 'G:/boardgame-hall-ai/games/arkhamhorror'
function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const f = join(dir, e.name)
    if (e.isDirectory()) walk(f, out)
    else if (/\.(js|mjs)$/.test(e.name)) out.push(f)
  }
  return out
}
const eoteContent = walk(join(MODS, 'content/campaigns/edgeOfTheEarth'))
const writes = new Map() // key -> [{file,line}]
const readFiles = [...walk(join(MODS, 'src')), ...walk(join(MODS, 'web')), ...walk(join(MODS, 'content'))].filter(f => !f.includes('src\\cards\\entries') && !f.includes('src\\cards\\encounter-entries'))
const norm = f => f.split('\\').join('/').replace(MODS + '/', '')
const readTexts = readFiles.map(f => ({ file: f, text: readFileSync(f, 'utf8'), rel: norm(f) }))
for (const f of eoteContent) {
  const text = readFileSync(f, 'utf8')
  const rel = norm(f)
  const lines = text.split('\n')
  lines.forEach((line, i) => {
    for (const m of line.matchAll(/(?:scenarioFlags|flags)\s*(?:\?\.)?\.?\[?['"]?([A-Za-z_$][\w$]*)['"]?\]?\s*(?:=|:)/g)) { /* too noisy */ }
    for (const m of line.matchAll(/scenarioFlags\??\.([A-Za-z_$][\w$]*)\s*=(?!=)/g)) writes.set(`scenarioFlags.${m[1]}`, [...(writes.get(`scenarioFlags.${m[1]}`) || []), { rel, line: i + 1 }])
    for (const m of line.matchAll(/scenarioFlags\??\[\s*[`'"]([^`'"]+)[`'"]\s*\]\s*=(?!=)/g)) writes.set(`scenarioFlags.${m[1]}:dynamic`, [...(writes.get(`scenarioFlags.${m[1]}:dynamic`) || []), { rel, line: i + 1 }])
    for (const m of line.matchAll(/setScenarioFlag\??\(\s*['"]([^'"]+)['"]/g)) writes.set(`setScenarioFlag:${m[1]}`, [...(writes.get(`setScenarioFlag:${m[1]}`) || []), { rel, line: i + 1 }])
    for (const m of line.matchAll(/setScenarioFlag\??\(\s*['"]([^'"]+)['"]\s*\+\s*/g)) writes.set(`dynamic-key`, [...(writes.get('dynamic-key') || []), { rel, line: i + 1 }])
  })
}
const rows = []
for (const [key, where] of writes) {
  if (key === 'dynamic-key') continue
  const bare = key.replace(/^scenarioFlags\./, '').replace(/^setScenarioFlag:/, '').replace(/:dynamic$/, '').split(':')[0]
  if (!bare || bare.length < 4) continue
  const re = new RegExp(`\\b${bare.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`)
  const readers = readTexts.filter(r => re.test(r.text)).map(r => r.rel)
  rows.push({ key, writtenIn: where, readInSrcOrWeb: readers })
}
for (const r of rows) { r.readInContent = r.readInSrcOrWeb.filter(x => x.startsWith('content/')); r.readInSrcOrWeb = r.readInSrcOrWeb.filter(x => !x.startsWith('content/')) }
const unread = rows.filter(r => r.readInSrcOrWeb.length === 0 && r.readInContent.length === 0)
const contentOnly = rows.filter(r => r.readInSrcOrWeb.length === 0 && r.readInContent.length > 0)
const out = { generatedAt: new Date().toISOString(), totalKeys: rows.length, unreadCount: unread.length, unread, contentOnly, rows }
import { writeFileSync } from 'node:fs'
writeFileSync('G:/boardgame-hall-ai/games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/screen/scenario-flags-write-read.json', JSON.stringify(out, null, 1))
console.log(JSON.stringify({ totalKeys: rows.length, unread: unread.length }, null, 1))
for (const r of unread) console.log(r.key, '| written', r.writtenIn.map(w => `${w.rel}:${w.line}`).join(' ; '))
