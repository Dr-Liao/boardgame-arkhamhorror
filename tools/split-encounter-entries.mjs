// 一次性迁移工具：把 encounter-abilities.js 的 529 条非玩家条目拆成
// src/cards/encounter-entries/<归属目录>/<code>.js（一条目一个文件）。
//
// 用法（在 games/arkhamhorror/ 下）：
//   node tools/split-encounter-entries.mjs --check   只解析并对账，不写文件（写盘前 / 写盘后都可跑）
//   node tools/split-encounter-entries.mjs --write   生成单卡文件、_lookup.js、index.js，并重写 facade
//
// 为什么用源码切片而不是运行时序列化：
//   529 条里 417 条带函数，运行时拿到的是闭包；Function.prototype.toString() 只能还原函数体，
//   闭包参数会丢。源码切片把 `originalOf(...)`、`teamOnce(...)` 原样保留，行为才可能零变化。
//
// 对账（--check）：
//   1. 解析出的 code 顺序 / 对象 key 顺序 / abilities·modifiers 条数与运行时一致；
//   2. 每条 targetPath = tools/encounter-entry-placement.mjs 的计算结果（0 unresolved）；
//   3. 已写出的单卡文件、index.js、facade 与本次生成内容逐字节一致；
//   4. 目录里没有未登记的多余 .js。
//
// 迁移完成后本工具保留为证据工具；不要拿它覆盖新的单卡文件（有内容差异会先报错）。

import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  arraySpan, arrayElements, codeOf, leadingComment, matchBracket, objectProperties, objectSpan, skipTrivia, splitTopLevel,
} from './card-entry-source.mjs'
import { buildEncounterIndex, renderEncounterIndex } from './build-encounter-index.mjs'
import { ENTRY_SCOPES, loadPlacementIndex, resolvePlacements } from './encounter-entry-placement.mjs'
import { ALL_CARDS } from '../src/cards/cards-data.js'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const abs = file => path.join(ROOT, file)
const rel = file => path.relative(ROOT, file).split(path.sep).join('/')

const LEGACY_FILE = 'src/cards/encounter-abilities.js'
const ENTRY_DIR = 'src/cards/encounter-entries'
const SHARED_FILE = `${ENTRY_DIR}/_shared.js`
const LOOKUP_FILE = `${ENTRY_DIR}/_lookup.js`
const INDEX_FILE = `${ENTRY_DIR}/index.js`
const BACKUP_FILE = 'artifacts/legacy/encounter-abilities.js'

const CHECK = process.argv.includes('--check')
const WRITE = process.argv.includes('--write')

// ---------------------------------------------------------------------------
// 解析
// ---------------------------------------------------------------------------

function parseEntries(text) {
  const marker = 'export const NON_PLAYER_ABILITY_ENTRIES = ['
  const markerAt = text.indexOf(marker)
  if (markerAt < 0) throw new Error('找不到 NON_PLAYER_ABILITY_ENTRIES（迁移已完成？）')
  const open = text.indexOf('[', markerAt)
  const span = arraySpan(text.slice(open))
  const body = text.slice(open + 1, open + span.end)
  const entries = []
  for (const part of splitTopLevel(body, 0, body.length)) {
    if (!part.trim()) continue
    const bodyStart = skipTrivia(part, 0)
    if (part.slice(bodyStart).startsWith('...')) throw new Error(`条目区出现 spread，需要人工处理：${part.slice(0, 120)}`)
    const code = codeOf(part)
    if (!code) throw new Error(`条目没有 code：${part.slice(0, 120)}`)
    const object = objectSpan(part)
    if (!object) throw new Error(`条目 ${code} 不是对象字面量`)
    entries.push({
      code,
      source: object.source,
      comment: leadingComment(part),
      scope: /(?:^|[\s,{])scope\s*:\s*['"]([^'"]+)['"]/.exec(object.source)?.[1] || null,
      name: /(?:^|[\s,{])name\s*:\s*['"]([^'"]*)['"]/.exec(object.source)?.[1] || null,
      text: /(?:^|[\s,{])text\s*:\s*['"]([^'"]*)['"]/.exec(object.source)?.[1] || null,
    })
  }
  const codes = new Set(entries.map(entry => entry.code))
  if (codes.size !== entries.length) throw new Error('条目 code 重复')
  return entries
}

export function parseSharedExports(text) {
  const found = []
  for (const match of text.matchAll(/^export\s+(?:function|const|let|var|class)\s+([A-Za-z_$][\w$]*)/gm)) {
    found.push({ index: match.index, names: [match[1]] })
  }
  for (const match of text.matchAll(/^export\s*\{([^}]*)\}/gm)) {
    found.push({ index: match.index, names: [...match[1].matchAll(/([A-Za-z_$][\w$]*)/g)].map(item => item[1]) })
  }
  return found.sort((left, right) => left.index - right.index).flatMap(item => item.names)
}

function usedNames(source, names) {
  return names.filter(name => new RegExp(`\\b${name}\\b`).test(source))
}

// 去掉数组层级的 2 格缩进（条目都是数组的直接元素）。遇到模板字符串里顶格的行时
// 只去掉公共缩进，避免改到字符串内容。
function dedent(source) {
  const lines = source.split('\n')
  const indents = lines.slice(1).filter(line => line.trim()).map(line => line.match(/^ */)[0].length)
  const common = indents.length ? Math.min(...indents) : 0
  const cut = Math.min(common, 2)
  if (!cut) return source
  return [lines[0], ...lines.slice(1).map(line => line.slice(cut))].join('\n')
}

const SECTION_LABELS = new Set([
  '敌人', '地点', '幕', '议程', '剧情资产', '诡计', '威胁', '地点规则', '敌人规则', '敌人卡面的特殊规则',
])

function cleanComments(lines) {
  return lines.filter(line => {
    const trimmed = line.trim()
    if (!trimmed) return false
    if (/^[-=_*~\s]+$/.test(trimmed)) return false
    if (SECTION_LABELS.has(trimmed)) return false
    return true
  })
}

function headerLines(entry, placement) {
  const card = ALL_CARDS[entry.code] || null
  const name = entry.name || card?.nameZh || card?.name || entry.code
  const lines = [`// ${entry.code} ${name}`]
  if (placement.bucket === 'scenario') {
    lines.push(`// 归属：关卡专用 · ${placement.scenarioId}（${placement.scenarioName}）`)
  } else if (placement.bucket === 'campaign') {
    lines.push(`// 归属：战役共用 · ${placement.campaignId}（${placement.campaignName}）`)
  } else {
    lines.push('// 归属：跨战役通用')
  }
  lines.push(`// 遭遇组：${placement.group || '无（story）'}`)
  const text = card?.textZh || card?.text || entry.text || ''
  for (const line of String(text).split('\n')) {
    if (line.trim()) lines.push(`// 卡面：${line}`)
  }
  lines.push('//', '// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。')
  const notes = cleanComments(entry.comment)
  if (notes.length) {
    lines.push('//')
    for (const note of notes) lines.push(`// ${note}`)
  }
  return lines
}

function lookupNamesFor(source) {
  return usedNames(source, ['nonPlayerEntryFor', 'pallidMaskCode', 'someNonPlayerEntry'])
}

function renderEntryModule(entry, placement, sharedNames, rewrittenSource) {
  const lines = headerLines(entry, placement)
  lines.push('')
  const depth = placement.targetPath.split('/').length - 1
  const prefix = '../'.repeat(depth)
  const shared = usedNames(rewrittenSource, sharedNames)
  const lookup = lookupNamesFor(rewrittenSource)
  if (shared.length) lines.push(`import { ${shared.join(', ')} } from '${prefix}_shared.js'`)
  if (lookup.length) lines.push(`import { ${lookup.join(', ')} } from '${prefix}_lookup.js'`)
  if (shared.length || lookup.length) lines.push('')
  lines.push(`export default ${dedent(rewrittenSource)}`)
  lines.push('')
  return lines.join('\n')
}

// 条目里只剩两处跨条目 `.some(...)`（03124 / 03125）；统一改走 _lookup.js 的窄函数。
function rewriteCrossEntryQueries(source) {
  if (!/\bNON_PLAYER_ABILITY_ENTRIES\b/.test(source)) return source
  return source.replace(/\bNON_PLAYER_ABILITY_ENTRIES\.some\(/g, 'someNonPlayerEntry(')
}

async function listEntryFiles() {
  const files = []
  const walk = async directory => {
    for (const child of await readdir(directory, { withFileTypes: true })) {
      const full = path.join(directory, child.name)
      if (child.isDirectory()) { await walk(full); continue }
      if (child.name.endsWith('.js')) files.push(rel(full))
    }
  }
  if (existsSync(abs(ENTRY_DIR))) await walk(abs(ENTRY_DIR))
  return files
}

// ---------------------------------------------------------------------------
// 生成模型
// ---------------------------------------------------------------------------

export async function buildModel() {
  if (!existsSync(abs(LEGACY_FILE))) throw new Error(`旧文件不存在：${LEGACY_FILE}（迁移已完成？）`)
  if (!existsSync(abs(SHARED_FILE))) {
    throw new Error(`缺少 ${SHARED_FILE}。先完成阶段 1（抽 _shared.js），或从 git 恢复。`)
  }
  const legacyText = await readFile(abs(LEGACY_FILE), 'utf8')
  const sharedText = await readFile(abs(SHARED_FILE), 'utf8')
  const sharedNames = parseSharedExports(sharedText)
  const entries = parseEntries(legacyText)
  const index = loadPlacementIndex()
  const placements = resolvePlacements(entries, index)
  const byCode = new Map(placements.map(placement => [placement.code, placement]))
  const files = entries.map(entry => {
    const placement = byCode.get(entry.code)
    if (!placement || placement.unresolved) throw new Error(`条目 ${entry.code} 未归属`)
    const source = rewriteCrossEntryQueries(entry.source)
    if (/\bNON_PLAYER_ABILITY_ENTRIES\b/.test(source)) throw new Error(`条目 ${entry.code} 仍直接读数组，需要人工改走 _lookup.js`)
    if (!ENTRY_SCOPES.includes(entry.scope)) throw new Error(`条目 ${entry.code} 的 scope 非法：${entry.scope}`)
    return {
      code: entry.code,
      scope: entry.scope,
      relative: placement.targetPath,
      placement,
      source,
      text: renderEntryModule(entry, placement, sharedNames, source),
      entry,
    }
  })
  return {
    legacyText,
    sharedText,
    sharedNames,
    entries,
    placements,
    byCode,
    files,
    filesByCode: new Map(files.map(file => [file.code, file])),
    indexText: renderEncounterIndex(files.map(file => ({ code: file.code, relative: file.relative }))),
    lookupText: renderLookupModule(),
    facadeText: renderFacadeModule(),
  }
}

function renderLookupModule() {
  return `// 非玩家条目的跨条目查询（唯一读点）。
//
// 为什么用「注册 + 惰性建表」而不是直接 import index.js：
//   条目 → _lookup.js → index.js → 条目 是 ESM 循环。如果 _lookup.js 在模块初始化时
//   import index.js，那么单独 import 一个带跨条目查询的条目（02043 等）时，index.js 的
//   数组字面量会先读到尚未初始化的条目绑定，直接 TDZ 报错。
//   因此 index.js 在求值完成后调用 registerNonPlayerEntries()；_lookup.js 只在
//   对局的 resolve / 规则函数里读表，那时所有模块都已就绪。
//
// 条目之间禁止互相 import；需要看另一张卡时只从这里取。

let entryList = null
let byCode = null

export function registerNonPlayerEntries(entries) {
  entryList = entries
  byCode = null
}

function list() {
  if (!entryList) throw new Error('encounter-entries/index.js 尚未加载：跨条目查询只能在对局中调用')
  return entryList
}

const table = () => (byCode ||= new Map(list().map(entry => [entry.code, entry])))

export const entryByCode = code => table().get(code) || null
export const nonPlayerEntryFor = entryByCode
export const someNonPlayerEntry = predicate => list().some(predicate)
export const pallidMaskCode = () => list().find(entry => entry.pallidMask === true)?.code || null
`
}

function renderFacadeModule() {
  return `// 诡镇奇谈：卡牌版 · 非玩家卡能力（聚合入口 / facade）
//
// 行为条目已经拆到 src/cards/encounter-entries/<归属目录>/<code>.js：一条目一个文件。
// 本文件只做聚合与公开导出，不再放任何条目；不要在这里加卡。
//
// 新增/修改一张非玩家卡：
//   1. node tools/scaffold-card.mjs <code> --encounter   （按归属自动落点）
//   2. 修改落点的单卡文件；
//   3. node tools/build-encounter-index.mjs --write       （或 npm run cards:encounter-index）
//   4. npm run test:fast；行为改动先用 replay-fixtures --baseline / --compare 证明零变化。
//
// 规矩由 tests/encounter-entries.test.mjs 与 architecture-guard 守住。

import { NON_PLAYER_ENTRY_LIST } from './encounter-entries/index.js'
import { entryByCode } from './encounter-entries/_lookup.js'
import { originalOf, victoryVengeance } from './encounter-entries/_shared.js'

// 已进入能力层的非玩家条目（保持旧数组顺序；12 个 import 点读取这里）。
export const NON_PLAYER_ABILITY_ENTRIES = NON_PLAYER_ENTRY_LIST
export const NON_PLAYER_ABILITY_CODES = new Set(NON_PLAYER_ABILITY_ENTRIES.map(entry => entry.code))

// 内容层直接按卡号取非玩家条目，不依赖引擎注册表（单元测试可只 import behavior）。
export const nonPlayerEntryFor = entryByCode

// 供内容层复用的读点（避免在 behavior.js 里再写一遍「复仇点数」）。
export { originalOf, victoryVengeance }
`
}

// ---------------------------------------------------------------------------
// 对账
// ---------------------------------------------------------------------------

async function runtimeEntries() {
  const { NON_PLAYER_ABILITY_ENTRIES } = await import(`../${LEGACY_FILE}?split-check=${Date.now()}`)
  return NON_PLAYER_ABILITY_ENTRIES
}

// 顶层对象 key（保持顺序）。兼容 `key: value`、方法简写 `key(...) {}`、引号 key、简写。
function topLevelKeys(source) {
  const open = skipTrivia(source, 0)
  const close = matchBracket(source, open)
  const keys = []
  for (const part of splitTopLevel(source, open + 1, close)) {
    const body = part.slice(skipTrivia(part, 0))
    if (!body.trim()) continue
    const quoted = /^(['"])(.+?)\1\s*:/.exec(body)
    if (quoted) { keys.push(quoted[2]); continue }
    const method = /^(?:async\s+)?(?:\*\s*)?([A-Za-z_$][\w$]*)\s*(?:\(|:)/.exec(body)
    if (method) { keys.push(method[1]); continue }
    const shorthand = /^([A-Za-z_$][\w$]*)\s*(?:,|$)/.exec(body)
    if (shorthand) keys.push(shorthand[1])
  }
  return keys
}

async function compareWithRuntime(model) {
  const problems = []
  const runtime = await runtimeEntries()
  if (runtime.length !== model.entries.length) problems.push(`运行时 ${runtime.length} 条 != 解析 ${model.entries.length} 条`)
  const runtimeCodes = runtime.map(entry => entry.code)
  const parsedCodes = model.entries.map(entry => entry.code)
  for (let index = 0; index < Math.min(runtimeCodes.length, parsedCodes.length); index++) {
    if (runtimeCodes[index] !== parsedCodes[index]) {
      problems.push(`顺序不同（第 ${index} 条：运行时 ${runtimeCodes[index]}，解析 ${parsedCodes[index]}）`)
      break
    }
  }
  const runtimeByCode = new Map(runtime.map(entry => [entry.code, entry]))
  for (const entry of model.entries) {
    const actual = runtimeByCode.get(entry.code)
    if (!actual) { problems.push(`${entry.code} 不在运行时`); continue }
    const parsedKeys = topLevelKeys(entry.source)
    const actualKeys = Object.keys(actual)
    if (parsedKeys.join(',') !== actualKeys.join(',')) {
      problems.push(`${entry.code} 字段顺序/集合不同：解析 [${parsedKeys}] vs 运行时 [${actualKeys}]`)
    }
    for (const key of ['abilities', 'modifiers']) {
      const property = objectProperties(entry.source).properties.find(item => item.key === key)
      const elements = property ? arrayElements(property.value) : null
      if (!elements) continue
      const expected = actual[key]?.length ?? 0
      if (elements.length !== expected) problems.push(`${entry.code}.${key} 条数 ${elements.length} != ${expected}`)
    }
  }
  return problems
}

async function compareFiles(model) {
  const problems = []
  for (const file of model.files) {
    const full = abs(`${ENTRY_DIR}/${file.relative}`)
    if (!existsSync(full)) { problems.push(`缺少文件 ${ENTRY_DIR}/${file.relative}`); continue }
    const actual = await readFile(full, 'utf8')
    if (actual !== file.text) {
      const expected = file.text.split('\n')
      const got = actual.split('\n')
      const line = expected.findIndex((text, index) => text !== got[index])
      problems.push(`${ENTRY_DIR}/${file.relative} 与生成内容不同（首个差异在第 ${line + 1} 行）`)
    }
  }
  for (const name of ['index.js', '_lookup.js', 'encounter-abilities.js']) {
    const full = name === 'encounter-abilities.js' ? abs(LEGACY_FILE) : abs(`${ENTRY_DIR}/${name}`)
    if (!existsSync(full)) continue
    const actual = await readFile(full, 'utf8')
    const expected = name === 'index.js' ? model.indexText : name === '_lookup.js' ? model.lookupText : model.facadeText
    const legacyStillIntact = name === 'encounter-abilities.js' && actual === model.legacyText
    if (actual !== expected && !legacyStillIntact) problems.push(`${rel(full)} 与生成内容不同`)
  }
  if (existsSync(abs(ENTRY_DIR))) {
    const planned = new Set(model.files.map(file => `${ENTRY_DIR}/${file.relative}`))
    const allowed = new Set([...planned, LOOKUP_FILE, INDEX_FILE, SHARED_FILE])
    for (const file of await listEntryFiles()) {
      if (!allowed.has(file)) problems.push(`多余文件 ${file}`)
    }
  }
  return problems
}

function summarize(model) {
  const buckets = { shared: 0, campaign: 0, scenario: 0 }
  const directories = new Map()
  for (const placement of model.placements) {
    buckets[placement.bucket] += 1
    const directory = path.posix.dirname(placement.targetPath)
    directories.set(directory, (directories.get(directory) || 0) + 1)
  }
  return {
    entries: model.files.length,
    buckets,
    directories: directories.size,
    largestDirectory: [...directories].sort((left, right) => right[1] - left[1])[0] || null,
    unresolved: model.placements.filter(placement => placement.unresolved).length,
    sharedExports: model.sharedNames.length,
  }
}

async function main() {
  if (!CHECK && !WRITE) {
    console.error('用法：node tools/split-encounter-entries.mjs --check | --write')
    process.exit(2)
  }
  const legacyText = await readFile(abs(LEGACY_FILE), 'utf8')
  if (!legacyText.includes('export const NON_PLAYER_ABILITY_ENTRIES = [')) {
    if (CHECK) {
      console.log('✔ 迁移已完成：encounter-abilities.js 已是 facade（不再含条目数组）。')
      console.log('  日常校验请用：npm run cards:encounter-check')
      return
    }
    throw new Error('encounter-abilities.js 已是 facade，没有可拆的条目数组')
  }
  const model = await buildModel()
  const summary = summarize(model)
  console.log(JSON.stringify(summary, null, 2))
  if (summary.unresolved) throw new Error(`有 ${summary.unresolved} 条未归属`)

  const runtimeProblems = await compareWithRuntime(model)
  if (runtimeProblems.length) {
    console.error(`✖ 源码解析与运行时不一致 ${runtimeProblems.length} 处：`)
    for (const problem of runtimeProblems.slice(0, 40)) console.error(`  ${problem}`)
    process.exit(1)
  }
  console.log('\n✔ code 顺序 / 字段集合 / abilities·modifiers 条数与运行时一致')

  if (CHECK) {
    if (!existsSync(abs(INDEX_FILE))) {
      console.log('✔ dry-run：尚未写盘（没有 index.js），以上路径/顺序/归属即写盘计划')
      return
    }
    const fileProblems = await compareFiles(model)
    if (fileProblems.length) {
      console.error(`✖ 已写出的文件与生成内容不一致 ${fileProblems.length} 处：`)
      for (const problem of fileProblems.slice(0, 40)) console.error(`  ${problem}`)
      process.exit(1)
    }
    console.log('✔ 已写出的单卡文件 / index.js / _lookup.js / facade 与生成内容一致')
    return
  }

  // 写盘：先确认目录里没有本次迁移之外的文件，避免覆盖别人的卡。
  if (existsSync(abs(ENTRY_DIR))) {
    const planned = new Set(model.files.map(file => `${ENTRY_DIR}/${file.relative}`))
    const allowed = new Set([...planned, LOOKUP_FILE, INDEX_FILE, SHARED_FILE])
    for (const file of await listEntryFiles()) {
      if (!allowed.has(file)) throw new Error(`目录里存在未登记文件 ${file}；先确认它属于本次迁移，或手工移走`)
    }
  }

  if (!existsSync(abs(BACKUP_FILE))) {
    await mkdir(path.dirname(abs(BACKUP_FILE)), { recursive: true })
    await writeFile(abs(BACKUP_FILE), model.legacyText, 'utf8')
    console.log(`备份旧源 → ${BACKUP_FILE}`)
  }
  await mkdir(abs(ENTRY_DIR), { recursive: true })
  await writeFile(abs(LOOKUP_FILE), model.lookupText, 'utf8')
  for (const file of model.files) {
    const full = abs(`${ENTRY_DIR}/${file.relative}`)
    await mkdir(path.dirname(full), { recursive: true })
    await writeFile(full, file.text, 'utf8')
  }
  await writeFile(abs(INDEX_FILE), model.indexText, 'utf8')
  await writeFile(abs(LEGACY_FILE), model.facadeText, 'utf8')
  console.log(`\n写入 ${model.files.length} 个条目文件、_lookup.js、index.js，并把 encounter-abilities.js 改为 facade`)

  const indexCheck = await buildEncounterIndex({ write: false })
  if (indexCheck.changed) throw new Error('生成的 index.js 与 build-encounter-index.mjs 的渲染不一致')
  const problems = await compareFiles(model)
  if (problems.length) throw new Error(`写盘后自检失败：${problems.slice(0, 10).join('；')}`)
  console.log('✔ 写盘后自检通过')
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
if (invokedDirectly) {
  await main().catch(error => {
    console.error(error?.stack || String(error))
    process.exit(1)
  })
}
