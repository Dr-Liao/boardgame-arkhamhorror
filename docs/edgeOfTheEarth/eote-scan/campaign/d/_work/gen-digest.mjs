// 生成 D 审计员的 91 卡审阅摘要（从 bundles + screen JSON 汇总）
import fs from 'node:fs'
import path from 'node:path'

const ROOT = 'G:/boardgame-hall-ai/games/arkhamhorror/docs/edgeOfTheEarth/eote-scan'
const OUT = path.join(ROOT, 'campaign/d/_work')
fs.mkdirSync(OUT, { recursive: true })
const codes = JSON.parse(fs.readFileSync(path.join(ROOT, 'scope/shards.json'), 'utf8'))['campaign-auditor-d'].codes
const set = new Set(codes)

const read = f => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'))
const flags = read('screen/flags-readpoints.json')
const kw = read('screen/keyword-coverage.json')
const tests = read('screen/tests-coverage.json')
const dev = read('screen/known-deviations.json')
const perc = read('screen/perceivability.json')

const byCode = (arr, code) => arr.filter(x => x.code === code)

function parseBundle(code) {
  const raw = fs.readFileSync(path.join(ROOT, 'bundles', code + '.md'), 'utf8')
  const parts = {}
  const head = raw.split(/^## /m)
  const out = { title: head[0].trim(), meta: '', en: '', backEn: '', nums: '', entry: '', testsText: '' }
  const lines = head[0].split('\n')
  out.title = lines[0].replace(/^# /, '')
  out.meta = lines.filter(l => l.startsWith('- ')).join('\n')
  for (const part of head.slice(1)) {
    const nl = part.indexOf('\n')
    const name = part.slice(0, nl).trim()
    const body = part.slice(nl + 1)
    const m = body.match(/```(?:js|json)?\n([\s\S]*?)```/)
    const content = m ? m[1] : body
    if (name.includes('英文')) {
      if (name.includes('背面')) out.backEn = content.trim()
      else out.en = content.trim()
    } else if (name.includes('数值字段')) out.nums = content.trim()
    else if (name.includes('条目源码')) out.entry = content.trim()
    else if (name.includes('相关测试')) out.testsText = content.trim()
  }
  return out
}

const devItems = code => {
  const items = []
  for (const d of byCode(dev.simplified, code)) items.push('SIMPLIFIED: ' + d.reason + (d.pendingRequests ? ' [' + d.pendingRequests.join(',') + ']' : ''))
  for (const d of byCode(dev.deferred, code)) items.push('DEFERRED: ' + JSON.stringify(d).slice(0, 300))
  for (const d of byCode(dev.primitiveRequests, code)) items.push('PRIM-REQ: ' + JSON.stringify(d).slice(0, 300))
  for (const d of byCode(dev.entryMarkers, code)) items.push('MARKER:' + d.line + ': ' + d.text)
  return items
}

const blocks = []
for (const code of codes) {
  const b = parseBundle(code)
  const fDecl = (flags.all || []).filter(x => x.code === code)
  const fUnread = (flags.unread || []).filter(x => x.code === code)
  const unreadSet = new Set(fUnread.map(u => u.block + '.' + u.key + '.' + u.kind))
  const fLines = fDecl.map(d => {
    const un = fUnread.find(u => u.block === d.block && u.key === d.key)
    return `  ${d.block}.${d.key}${un ? '  <<UNREAD kind=' + un.kind : '  read@' + d.engineReadpoints.slice(0, 3).join(',')}`
  })
  const kwc = byCode(kw.cards, code)
  const tc = tests.cards.find(x => x.code === code) || {}
  const pc = byCode(perc.cards, code)
  const tlist = (tc.strongTitles || []).map(t => `  STRONG: ${t.file}:${t.line} ${t.title}`)
  blocks.push([
    '='.repeat(100),
    `CODE ${code} | ${b.title}`,
    b.meta,
    '',
    '--- EN TEXT ---',
    b.en || '(none)',
    b.backEn ? '\n--- BACK EN ---\n' + b.backEn : '',
    b.nums ? '\n--- NUMS ---\n' + b.nums.replace(/\n/g, ' ') : '',
    '',
    '--- FLAGS DECLARED ---',
    fLines.length ? fLines.join('\n') : '  (no flag declarations)',
    '',
    '--- TEST COVERAGE: ' + (tc.level || '?') + ' ---',
    tlist.length ? tlist.join('\n') : '  (no strong titles) file-only=' + JSON.stringify((tc.files || []).slice(0, 4)),
    '',
    '--- KNOWN DEVIATIONS ---',
    devItems(code).join('\n') || '  (none)',
    '',
    '--- KEYWORD-COVERAGE ---',
    kwc.map(x => '  missingFeatureTokens: ' + JSON.stringify(x.missingFeatureTokens) + ' entry=' + x.entry).join('\n') || '  (not flagged)',
    '',
    '--- PERCEIVABILITY ---',
    pc.map(x => '  ' + JSON.stringify(x)).join('\n') || '  (not flagged)',
    '',
    '--- ENTRY SRC ---',
    b.entry,
    '',
  ].filter(x => x !== '').join('\n'))
}

const all = blocks.join('\n')
const CHUNK = 12
let idx = 0
for (let start = 0; start < codes.length; start += CHUNK) {
  idx += 1
  const file = path.join(OUT, `digest-${String(idx).padStart(2, '0')}.md`)
  fs.writeFileSync(file, `# D 分片审阅摘要 ${idx}（${codes[start]}–${codes[Math.min(start + CHUNK, codes.length) - 1]}）\n\n` + blocks.slice(start, start + CHUNK).join('\n'), 'utf8')
  console.log('wrote', file)
}
fs.writeFileSync(path.join(OUT, 'digest-all.md'), all, 'utf8')
console.log('total bytes', all.length, 'chunks', idx)
