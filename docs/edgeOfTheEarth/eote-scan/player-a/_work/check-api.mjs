// 核验：条目所用的 api.* / trigger / ability kind / 字段 是否在引擎中有定义与消费点
import fs from 'node:fs'
import path from 'node:path'

const MOD = 'G:/boardgame-hall-ai/games/arkhamhorror'
const codes = Array.from({ length: 60 }, (_, i) => String(8019 + i).padStart(5, '0'))
const engineFiles = []
function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p)
    else if (/\.(js|mjs)$/.test(e.name)) engineFiles.push(p)
  }
}
walk(path.join(MOD, 'src'))
const rel = p => p.replace(MOD + '\\', '').replace(MOD + '/', '').replace(/\\/g, '/')
const srcIndex = engineFiles.map(p => ({ path: rel(p), text: fs.readFileSync(p, 'utf8') }))

// 1. api 方法
const apiCalls = new Map()
for (const code of codes) {
  const s = fs.readFileSync(path.join(MOD, 'src/cards/entries', code + '.js'), 'utf8')
  for (const m of s.matchAll(/api\.([A-Za-z0-9_]+)/g)) {
    if (!apiCalls.has(m[1])) apiCalls.set(m[1], [])
    apiCalls.get(m[1]).push(code)
  }
}
const apiPaths = srcIndex.filter(f => /src[\\/]engine[\\/]api-|src[\\/]engine[\\/]card-defs|src[\\/]engine[\\/]dispatch/.test(f.path))
function findDefs(name) {
  const pats = [
    new RegExp(`\\b${name}\\s*[:=]\\s*(async\\s*)?(\\(|function|\\{)`),
    new RegExp(`function\\s+${name}\\b`),
    new RegExp(`\\b${name}\\s*\\(`),
  ]
  const hits = []
  for (const f of srcIndex) {
    const lines = f.text.split('\n')
    for (let i = 0; i < lines.length; i++) {
      for (const pat of pats) {
        if (pat.test(lines[i])) { hits.push(`${f.path}:${i + 1}: ${lines[i].trim().slice(0, 150)}`); break }
      }
    }
  }
  return hits
}
const out = { api: {}, triggers: {}, kinds: {}, fields: {} }
for (const [name, cs] of [...apiCalls.entries()].sort()) {
  const defs = findDefs(name)
  out.api[name] = { codes: [...new Set(cs)], defs: defs.slice(0, 4) }
}

// 2. 出现在条目里的 trigger 字符串
const triggers = new Set()
for (const code of codes) {
  const s = fs.readFileSync(path.join(MOD, 'src/cards/entries', code + '.js'), 'utf8')
  for (const m of s.matchAll(/trigger:\s*'([^']+)'/g)) triggers.add(m[1])
  for (const m of s.matchAll(/trigger:\s*\[([^\]]+)\]/g)) for (const t of m[1].matchAll(/'([^']+)'/g)) triggers.add(t[1])
}
function findTrigger(t) {
  const pat = new RegExp(`(['"\`])${t}\\1`)
  const hits = []
  for (const f of srcIndex) {
    if (/src[\\/]cards[\\/]entries/.test(f.path)) continue
    const lines = f.text.split('\n')
    lines.forEach((line, i) => { if (pat.test(line)) hits.push(`${f.path}:${i + 1}: ${line.trim().slice(0, 130)}`) })
  }
  return hits.slice(0, 6)
}
for (const t of [...triggers].sort()) out.triggers[t] = findTrigger(t)

// 3. kind 字符串
const kinds = new Set()
for (const code of codes) {
  const s = fs.readFileSync(path.join(MOD, 'src/cards/entries', code + '.js'), 'utf8')
  for (const m of s.matchAll(/kind:\s*'([^']+)'/g)) kinds.add(m[1])
}
for (const k of [...kinds].sort()) {
  const hits = []
  for (const f of srcIndex) {
    if (/src[\\/]cards[\\/]entries/.test(f.path)) continue
    f.text.split('\n').forEach((line, i) => {
      if (new RegExp(`kind\\s*===\\s*'${k}'|'${k}'\\s*===|case\\s*'${k}'`).test(line)) hits.push(`${f.path}:${i + 1}: ${line.trim().slice(0, 130)}`)
    })
  }
  out.kinds[k] = hits.slice(0, 5)
}

fs.writeFileSync('G:/boardgame-hall-ai/games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/player-a/_work/api-check.json', JSON.stringify(out, null, 1))
console.log('wrote api-check.json', Object.keys(out.api).length, 'apis,', Object.keys(out.triggers).length, 'triggers,', Object.keys(out.kinds).length, 'kinds')
