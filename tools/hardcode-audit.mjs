// 外部硬编码守卫的数据来源（只读扫描 + 白名单生成）。
//
// 设计目标（见 artifacts/arkham-hardcode-audit/REPORT.md §6）：
//   · 卡号只允许出现在 src/cards/entries/<code>.js 与 cards-data.js；
//   · 引擎不得出现内容实体 id（地点 / 敌人 / 剧本 / 战役）；
//   · 效果原语必须在数据里真的被引用；
//   · 现有债务用 audit/hardcode-whitelist.json 冻结，只减不增。
//
// 用法：
//   node tools/hardcode-audit.mjs            # 打印当前计数与相对白名单的增减
//   node tools/hardcode-audit.mjs --write    # 重写白名单（修复后让它下降）
//   node tools/hardcode-audit.mjs --check    # 有增长就 exit 1（架构守卫用）
//
// 扫描口径：先去注释，再取字符串字面量；不把注释里的卡号算作行为。

import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { EFFECT_PRIMITIVES } from '../src/engine/effects.js'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const WHITELIST = path.join(ROOT, 'audit', 'hardcode-whitelist.json')

const rel = file => path.relative(ROOT, file).replaceAll('\\', '/')

function walk(dir, filter, acc = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (['node_modules', '.git', 'test-results'].includes(entry.name)) continue
      walk(full, filter, acc)
    } else if (filter(full)) acc.push(full)
  }
  return acc
}

// 去掉 // 与 /* */ 注释，保留字符串原样（模板字符串按普通字符串处理）。
function stripComments(src) {
  let out = ''
  let i = 0
  while (i < src.length) {
    const ch = src[i]
    const next = src[i + 1]
    if (ch === '/' && next === '/') {
      while (i < src.length && src[i] !== '\n') i++
      continue
    }
    if (ch === '/' && next === '*') {
      i += 2
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++
      i += 2
      continue
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      const quote = ch
      out += quote
      let j = i + 1
      while (j < src.length) {
        if (src[j] === '\\') { out += src[j] + (src[j + 1] ?? ''); j += 2; continue }
        if (src[j] === quote) { out += quote; j++; break }
        out += src[j]
        j++
      }
      i = j
      continue
    }
    out += ch
    i++
  }
  return out
}

const LITERAL = /(['"`])([^'"`\n]{1,80})\1/g
const lineOf = (src, index) => src.slice(0, index).split('\n').length

function literalScan(files, classify) {
  const counts = new Map()
  const hits = []
  for (const file of files) {
    const src = stripComments(readFileSync(file, 'utf8'))
    for (const match of src.matchAll(LITERAL)) {
      const key = classify(match[2])
      if (!key) continue
      counts.set(key, (counts.get(key) || 0) + 1)
      hits.push({ file: rel(file), line: lineOf(src, match.index), value: key })
    }
  }
  return { counts: Object.fromEntries([...counts.entries()].sort(([a], [b]) => a.localeCompare(b))), hits }
}

// 内容实体 id：卡面数据的 scenarioReferences.ruleId（印刷卡自带的场景 id）+ 战役清单的
// 顶层 id / scenarioId(s)。不从 definition.js 里抓 `id:`——那会把选项 id（horror/move）也算进来。
function contentEntityIds() {
  const ids = new Set()
  for (const card of Object.values(ALL_CARDS)) {
    for (const ref of card.scenarioReferences || []) if (ref?.ruleId) ids.add(ref.ruleId)
  }
  const manifestFiles = walk(path.join(ROOT, 'content/campaigns'), file => /[\\/]manifest\.js$/.test(file))
  for (const file of manifestFiles) {
    const src = stripComments(readFileSync(file, 'utf8'))
    const head = src.match(/export const manifest\s*=\s*(?:Object\.freeze\()?\{([\s\S]*?)\n\}/)
    const topId = head?.[1].match(/^\s*id:\s*'([^']+)'/m)
    if (topId) ids.add(topId[1])
    for (const match of src.matchAll(/\bscenarioId\s*:\s*'([a-z][A-Za-z0-9]{2,40})'/g)) ids.add(match[1])
    for (const match of src.matchAll(/\bscenarioIds\s*:\s*\[([^\]]*)\]/g)) {
      for (const quoted of match[1].matchAll(/'([a-z][A-Za-z0-9]{2,40})'/g)) ids.add(quoted[1])
    }
  }
  return ids
}

const CARD_CODE = /^\d{5}[a-z]?$/
const GENERATED = [
  /\/cards-data\.js$/,
  /\/entries\//,
  /\/phase5-codes\.js$/,
  /-acceptance\.js$/,
  /\/core-acceptance\.js$/,
  /\/scenarios-data\.js$/,
]

export function collectHardcodes() {
  const engineFiles = walk(path.join(ROOT, 'src/engine'), file => file.endsWith('.js'))
  const cardFiles = walk(path.join(ROOT, 'src/cards'), file => file.endsWith('.js'))
    .filter(file => !GENERATED.some(pattern => pattern.test(rel(file))))
  const entityIds = contentEntityIds()

  const engineCodes = literalScan(engineFiles, value => CARD_CODE.test(value) ? value : null)
  const engineEntities = literalScan(engineFiles, value => entityIds.has(value) ? value : null)
  const cardLayerCodes = literalScan(cardFiles, value => CARD_CODE.test(value) ? value : null)

  // 效果原语：只在「数据」里找 type: 'X'；引擎里的实现不算引用。
  const dataFiles = [
    ...walk(path.join(ROOT, 'src/cards/entries'), file => file.endsWith('.js')),
    ...walk(path.join(ROOT, 'src/cards'), file => file.endsWith('.js'))
      .filter(file => !rel(file).includes('/entries/') && !/cards-data\.js$|card-implementation\.js$/.test(rel(file))),
    ...walk(path.join(ROOT, 'content'), file => file.endsWith('.js')),
  ]
  const dataSource = dataFiles.map(file => stripComments(readFileSync(file, 'utf8'))).join('\n')
  const usedPrimitive = name => new RegExp(`type['"]?\\s*:\\s*['"]${name}['"]`).test(dataSource)
  const unusedPrimitives = EFFECT_PRIMITIVES.filter(name => !usedPrimitive(name)).sort()

  return {
    engineCodes: engineCodes.counts,
    engineEntityHits: engineEntities.counts,
    cardLayerCodes: cardLayerCodes.counts,
    unusedPrimitives,
    sampleHits: {
      engineCodes: engineCodes.hits.slice(0, 20),
      engineEntities: engineEntities.hits.slice(0, 60),
      cardLayerCodes: cardLayerCodes.hits.slice(0, 20),
    },
  }
}

export function readWhitelist() {
  return JSON.parse(readFileSync(WHITELIST, 'utf8'))
}

export function compareWhitelist(current, whitelist) {
  const growth = []
  const stale = []
  for (const key of ['engineCodes', 'engineEntityHits', 'cardLayerCodes']) {
    const base = whitelist[key] || {}
    for (const [name, count] of Object.entries(current[key])) {
      const allowed = base[name] || 0
      if (count > allowed) growth.push(`${key}:${name}${allowed ? ` +${count - allowed}` : ''}`)
    }
    for (const [name, count] of Object.entries(base)) {
      const actual = current[key][name] || 0
      if (actual < count) stale.push(`${key}:${name}${actual ? ` ${count}→${actual}` : ' 已删除'}`)
    }
  }
  const basePrimitives = new Set(whitelist.unusedPrimitives || [])
  const currentPrimitives = new Set(current.unusedPrimitives)
  for (const name of currentPrimitives) if (!basePrimitives.has(name)) growth.push(`unusedPrimitives:${name} 新增`)
  for (const name of basePrimitives) if (!currentPrimitives.has(name)) stale.push(`unusedPrimitives:${name} 已接线`)
  return { growth, stale }
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invokedDirectly) {
  const snapshot = collectHardcodes()
  const mode = process.argv.includes('--write') ? 'write' : process.argv.includes('--check') ? 'check' : 'summary'
  if (mode === 'write') {
    const payload = {
      note: '外部硬编码冻结基线：只减不增。修复后用 node tools/hardcode-audit.mjs --write 让它下降。',
      engineCodes: snapshot.engineCodes,
      engineEntityHits: snapshot.engineEntityHits,
      cardLayerCodes: snapshot.cardLayerCodes,
      unusedPrimitives: snapshot.unusedPrimitives,
    }
    writeFileSync(WHITELIST, `${JSON.stringify(payload, null, 2)}\n`)
    console.log(`已写入 ${rel(WHITELIST)}`)
  }
  const summary = {
    engineCodes: Object.keys(snapshot.engineCodes).length,
    engineEntityHits: Object.keys(snapshot.engineEntityHits).length,
    cardLayerCodes: Object.keys(snapshot.cardLayerCodes).length,
    unusedPrimitives: snapshot.unusedPrimitives.length,
  }
  console.log(JSON.stringify(summary))
  if (mode === 'summary' || mode === 'check') {
    let whitelist
    try { whitelist = readWhitelist() } catch { whitelist = null }
    if (whitelist) {
      const { growth, stale } = compareWhitelist(snapshot, whitelist)
      if (growth.length) {
        console.log(`新增 ${growth.length}：`)
        for (const line of growth.slice(0, 40)) console.log(`  + ${line}`)
      }
      if (stale.length) {
        console.log(`可下降 ${stale.length}（运行 --write 更新基线）：`)
        for (const line of stale.slice(0, 40)) console.log(`  - ${line}`)
      }
      if (mode === 'check' && growth.length) process.exit(1)
    }
  }
}
