// 精确版：对比「引擎支持的 scenarioBehavior 钩子」与「各章 behavior 定义的钩子」，列出死钩子。
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
const MODS = 'G:/boardgame-hall-ai/games/arkhamhorror'
const SCAN = 'G:/boardgame-hall-ai/games/arkhamhorror/docs/edgeOfTheEarth/eote-scan'
function walk(dir, filt, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const f = join(dir, e.name)
    if (e.isDirectory()) walk(f, filt, out)
    else if (filt(f)) out.push(f)
  }
  return out
}
const norm = f => f.split('\\').join('/').replace(MODS + '/', '')
const srcFiles = walk(join(MODS, 'src'), f => f.endsWith('.js'))
const srcText = srcFiles.map(f => ({ path: norm(f), text: readFileSync(f, 'utf8') }))
const supported = new Set()
for (const f of srcText) {
  for (const m of f.text.matchAll(/scenarioBehavior\([^)]*\)\s*\??\.\s*([A-Za-z_$][\w$]*)/g)) supported.add(m[1])
  for (const m of f.text.matchAll(/scenarioBehavior\([^)]*\)\s*\.\s*([A-Za-z_$][\w$]*)\s*\?\./g)) supported.add(m[1])
}
const behaviorFiles = walk(join(MODS, 'content/campaigns/edgeOfTheEarth'), f => f.endsWith('behavior.js') || /[/\\](flow|interludes|checkpoints|epilogue|prologue)\.js$/.test(f))
const contentFiles = walk(join(MODS, 'content/campaigns/edgeOfTheEarth'), f => f.endsWith('.js'))
const contentTexts = contentFiles.map(f => ({ path: norm(f), text: readFileSync(f, 'utf8') }))
const testTexts = walk(join(MODS, 'tests'), f => f.endsWith('.mjs')).map(f => ({ path: norm(f), text: readFileSync(f, 'utf8') }))
const results = []
for (const f of behaviorFiles) {
  const text = readFileSync(f, 'utf8')
  // 取导出契约函数名字（export function / export const x = { 下的方法）
  const hooks = new Set()
  for (const m of text.matchAll(/^export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/gm)) hooks.add(m[1])
  // 常见 behavior 对象：export const behavior = { ... } 或 const behavior = { ... }
  const idx = text.search(/(?:export\s+)?const\s+behavior\s*=\s*\{/)
  if (idx >= 0) {
    const start = text.indexOf('{', idx)
    let depth = 0, end = start
    for (let i = start; i < text.length; i += 1) { if (text[i] === '{') depth += 1; else if (text[i] === '}') { depth -= 1; if (!depth) { end = i; break } } }
    const body = text.slice(start + 1, end)
    // 顶层方法名
    let d = 0, buf = ''
    for (let i = 0; i < body.length; i += 1) {
      const ch = body[i]
      if ('{[('.includes(ch)) d += 1
      else if ('}])'.includes(ch)) d -= 1
      else if (d === 0) {
        buf += ch
        if (ch === ',') { buf = ''; continue }
        if (ch === ':') { const mm = buf.match(/([A-Za-z_$][\w$]*)\s*$/); if (mm) hooks.add(mm[1]); buf = '' }
        if (ch === '(') {
          const mm = buf.match(/([A-Za-z_$][\w$]*)\s*$/); if (mm) hooks.add(mm[1])
          // 跳过参数表
          let pd = 0
          for (; i < body.length; i += 1) { if (body[i] === '(') pd += 1; else if (body[i] === ')') { pd -= 1; if (!pd) break } }
          buf = ''
        }
      }
    }
  }
  // 只看「看起来是钩子」的名字：出现在别处调用、非内部 helper（排除以 _ 开头/大写开头）
  const fileRel = norm(f)
  const rows = []
  for (const hook of hooks) {
    if (/^[A-Z_]/.test(hook) || hook.startsWith('_')) continue
    if (hook.length < 4) continue
    const re = new RegExp(`\\b${hook.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`)
    const supportedByEngine = supported.has(hook)
    const contentCallers = contentTexts.filter(c => c.path !== fileRel && re.test(c.text)).map(c => c.path)
    const testCallers = testTexts.filter(t => re.test(t.text)).map(t => t.path)
    if (!supportedByEngine && contentCallers.length === 0) rows.push({ hook, testCallers })
  }
  if (rows.length) results.push({ file: fileRel, hooks: rows })
}
const out = { generatedAt: new Date().toISOString(), engineHookCount: supported.size, engineHooks: [...supported].sort(), files: results, summary: { files: results.length, hooks: results.reduce((n, r) => n + r.hooks.length, 0) } }
writeFileSync(`${SCAN}/screen/dead-hooks-exact.json`, JSON.stringify(out, null, 1))
console.log(JSON.stringify(out.summary, null, 1))
for (const r of results) console.log('\n' + r.file.replace('content/campaigns/edgeOfTheEarth/', '') + ':', r.hooks.map(h => `${h.hook}${h.testCallers.length ? '(test)' : ''}`).join(', '))
