// 扫描 EOTE 章节/战役内容层钩子函数：是否被 引擎(src) 或 其他内容 调用；仅测试引用/零引用 = 死钩子候选。
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
const MODS = 'G:/boardgame-hall-ai/games/arkhamhorror'
const SCAN = 'G:/boardgame-hall-ai/games/arkhamhorror/docs/edgeOfTheEarth/eote-scan'
const EOTE = join(MODS, 'content/campaigns/edgeOfTheEarth')
function walk(dir, filt, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const f = join(dir, e.name)
    if (e.isDirectory()) walk(f, filt, out)
    else if (filt(f)) out.push(f)
  }
  return out
}
const contentFiles = walk(EOTE, f => f.endsWith('.js')).filter(f => !f.endsWith('story-text.js'))
const srcFiles = [...walk(join(MODS, 'src'), f => f.endsWith('.js'))]
const testFiles = walk(join(MODS, 'tests'), f => f.endsWith('.mjs'))
const webFiles = walk(join(MODS, 'web'), f => f.endsWith('.js'))
const readAll = list => list.map(f => ({ path: f.split('\\').join('/').replace(MODS + '/', ''), text: readFileSync(f, 'utf8') }))
const src = readAll(srcFiles)
const tests = readAll(testFiles)
const web = readAll(webFiles)
const content = readAll(contentFiles)
// 提取钩子名
const COMMON = new Set(['constructor', 'state', 'inv', 'api', 'data', 'options', 'events', 'event', 'value', 'code', 'card', 'enemy', 'location', 'args', 'result', 'error', 'x', 'y', 'index', 'id', 'name', 'label', 'text', 'when', 'then', 'filter', 'map', 'find', 'some', 'every', 'reduce', 'forEach', 'push', 'get', 'set', 'run', 'apply', 'resolve', 'setup', 'start', 'init', 'tick', 'move', 'attack', 'test', 'draw', 'discard', 'choose', 'choice', 'info', 'log', 'try', 'catch', 'if', 'for', 'while', 'return', 'function', 'const', 'let', 'var', 'new', 'this', 'super', 'import', 'export', 'default', 'async', 'await', 'class', 'extends', 'yield', 'of', 'in', 'do', 'else', 'switch', 'case', 'break', 'continue', 'throw', 'typeof', 'instanceof', 'void', 'delete', 'true', 'false', 'null', 'undefined'])
const hookRows = []
for (const f of content) {
  const text = f.text
  const names = new Set()
  // behavior 对象方法 / 对象属性 function
  for (const m of text.matchAll(/^\s{0,4}([A-Za-z_$][\w$]{2,})\s*\([^)]*\)\s*\{/gm)) names.add(m[1])
  for (const m of text.matchAll(/^\s{0,4}([A-Za-z_$][\w$]{2,})\s*:\s*(?:async\s*)?(?:function|\()/gm)) names.add(m[1])
  for (const m of text.matchAll(/^export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]{2,})/gm)) names.add(m[1])
  for (const m of text.matchAll(/^export\s+const\s+([A-Za-z_$][\w$]{2,})\s*=/gm)) names.add(m[1])
  for (const name of names) {
    if (COMMON.has(name)) continue
    const re = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`)
    const srcRefs = src.filter(r => re.test(r.text)).map(r => r.path)
    const contentRefs = content.filter(r => r.path !== f.path && re.test(r.text)).map(r => r.path)
    const testRefs = tests.filter(r => re.test(r.text)).map(r => r.path)
    const webRefs = web.filter(r => re.test(r.text)).map(r => r.path)
    if (srcRefs.length + contentRefs.length === 0) {
      hookRows.push({ file: f.path, hook: name, srcRefs, contentRefs, testRefs, webRefs, verdict: testRefs.length ? 'test-only' : 'dead' })
    }
  }
}
const byFile = {}
for (const r of hookRows) { const key = r.file.replace(/^content\/campaigns\/edgeOfTheEarth\//, ''); byFile[key] = byFile[key] || []; byFile[key].push(`${r.hook}(${r.verdict})`) }
const out = { generatedAt: new Date().toISOString(), summary: { totalHooks: hookRows.length, byVerdict: hookRows.reduce((a, r) => ((a[r.verdict] = (a[r.verdict] || 0) + 1), a), {}) }, byFile, rows: hookRows }
writeFileSync(`${SCAN}/screen/dead-hooks.json`, JSON.stringify(out, null, 1))
console.log(JSON.stringify(out.summary, null, 1))
for (const [f, names] of Object.entries(byFile)) console.log('\n' + f + ':', names.slice(0, 20).join(', '))
