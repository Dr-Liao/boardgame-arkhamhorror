// 一次性迁移工具：把旧 card-abilities.js / ability-migration-batches.js 里的卡牌条目
// 拆成 src/cards/entries/<code>.js（一张卡一个文件）。
//
// 用法（在 games/arkhamhorror/ 下）：
//   node tools/split-card-entries.mjs --check   只解析并对照运行时条目，不写文件
//   node tools/split-card-entries.mjs --write   生成 entries/、_shared.js、index.js，并重写 card-abilities.js
//
// 为什么用源码切片而不是运行时序列化：
//   条目里的 criteria / playCondition 大量使用 matcher 工厂（atTrait('ancient')、ownSeat()…），
//   运行时拿到的是闭包；Function.prototype.toString() 只能还原函数体，闭包参数（trait 等）会丢。
//   源码切片把 `atTrait('ancient')` 原样保留，行为才可能零变化。
//
// 拆分后的纪律（写进 ARCHITECTURE.md / docs/card-entry-files.md）：
//   · 一张卡一个文件；新增/修改只改 entries/<code>.js。
//   · card-abilities.js 只做聚合与公开导出，不再放条目。
//   · 不恢复任何 BATCH_* / MIGRATED_* 大数组。

import { readFile, writeFile, mkdir, readdir, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

import {
  arrayElements, arraySpan, codeOf, collectSymbols, leadingComment, matchBracket, mergeEntrySources,
  objectProperties, objectSpan, renderEntryModule, renderIndexModule, renderSharedModule,
  scanTopLevelDeclarations, skipTrivia, splitTopLevel,
} from './card-entry-source.mjs'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const abs = file => path.join(ROOT, file)
const rel = file => path.relative(ROOT, file).split(path.sep).join('/')

const LEGACY_FILE = 'src/cards/card-abilities.js'
const BATCH_FILE = 'src/cards/ability-migration-batches.js'
const ENTRY_DIR = 'src/cards/entries'
const CHECK_ONLY = process.argv.includes('--check')
const WRITE = process.argv.includes('--write')

if (!CHECK_ONLY && !WRITE) {
  console.error('用法：node tools/split-card-entries.mjs --check | --write')
  process.exit(2)
}

if (!existsSync(abs(LEGACY_FILE))) {
  console.error('这是一次性拆分工具：旧 card-abilities.js 已不存在，说明拆分已完成。')
  console.error('旧源快照在 artifacts/legacy/；当前流程见 docs/card-entry-files.md，不要重跑本工具。')
  process.exit(2)
}

function quote(value) {
  return JSON.stringify(value)
}

function readText(file) {
  return readFile(abs(file), 'utf8')
}

// ---------------------------------------------------------------------------
// 解析：顶层数组 / 特殊条目
// ---------------------------------------------------------------------------

function declarationMap(text) {
  const map = new Map()
  for (const declaration of scanTopLevelDeclarations(text)) {
    const close = matchBracket(text, declaration.start)
    map.set(declaration.name, {
      ...declaration,
      body: text.slice(declaration.start + (declaration.kind === '[' ? 1 : 1), close),
      end: close,
    })
  }
  return map
}

function entryFromPart(part) {
  const code = codeOf(part)
  if (!code) return null
  const object = objectSpan(part)
  if (!object) return null
  return { code, source: object.source, comment: leadingComment(part) }
}

function entriesFromArray(declaration) {
  if (!declaration || declaration.kind !== '[') return []
  const entries = []
  const parts = splitTopLevel(declaration.body, 0, declaration.body.length)
  for (const part of parts) {
    if (!part.trim()) continue
    const body = part.slice(skipTrivia(part, 0)).trim()
    if (body.startsWith('...')) {
      entries.push({ spread: body })
      continue
    }
    const entry = entryFromPart(part)
    if (entry) entries.push(entry)
  }
  return entries
}

function parseElderSigns(text) {
  const declarations = declarationMap(text)
  const declaration = declarations.get('elderSigns')
  if (!declaration || declaration.kind !== '{') throw new Error('找不到 elderSigns 对象')
  const object = objectSpan(text.slice(declaration.start, declaration.end + 1))
  const { properties } = objectProperties(object.source)
  return properties.map(property => ({
    code: property.key,
    kind: 'elder',
    factory: property.value,
    comment: property.comment || [],
  }))
}

function parseEventEntries(text) {
  const declarations = declarationMap(text)
  const declaration = declarations.get('eventEntries6e8')
  if (!declaration) throw new Error('找不到 eventEntries6e8')
  const tuples = vm.runInNewContext(`[${declaration.body}]`)
  return tuples.map(([code, label, when, criteria, effect, extra = {}]) => {
    const entry = {
      code,
      abilities: [{
        kind: 'played',
        ...(when ? { fast: true, trigger: when } : {}),
        ...(criteria ? { criteria } : {}),
        label,
        effect,
        ...extra,
      }],
    }
    return {
      code,
      source: JSON.stringify(entry, null, 2),
      comment: [`${code} ${label}`],
    }
  })
}

function parseSpreadEntries(part) {
  // ...[[ '04029', 4 ], [ '04271', 5 ]].map(([code, uses]) => ({ ... }))
  const tupleStart = part.indexOf('[[')
  const tupleEnd = matchBracket(part, tupleStart)
  const tuples = vm.runInNewContext(`(${part.slice(tupleStart, tupleEnd + 1)})`)
  const mapAt = part.indexOf('.map(')
  if (mapAt < 0) throw new Error('找不到 spread 的 .map(')
  const parenStart = matchBracket(part, part.indexOf('(', mapAt))
  const inner = part.slice(part.indexOf('(', mapAt) + 1, parenStart)
  const arrow = inner.indexOf('=>')
  if (arrow < 0) throw new Error('找不到 spread 的箭头函数')
  let objectText = inner.slice(arrow + 2).trim()
  if (objectText.startsWith('(')) {
    const close = matchBracket(objectText, 0)
    objectText = objectText.slice(1, close)
  }
  const object = objectSpan(objectText)
  if (!object) throw new Error('找不到 spread 的对象字面量')
  return tuples.map(([code, uses]) => ({
    code,
    source: object.source,
    preamble: `const code = ${quote(code)}\nconst uses = ${Number(uses)}`,
    comment: [`${code} 意志闪避（旧 lureEvade）`],
  }))
}

function parseCalvin(text) {
  const declarations = declarationMap(text)
  const declaration = declarations.get('CALVIN_ENTRY')
  if (!declaration) throw new Error('找不到 CALVIN_ENTRY')
  const object = objectSpan(text.slice(declaration.start, declaration.end + 1))
  return [{
    code: '04005',
    source: object.source,
    comment: ['04005 加尔文·怀特：每点恐惧使意志/智识 +1，每点伤害使战斗/敏捷 +1。'],
  }]
}

// ---------------------------------------------------------------------------
// 构建模型：按旧 for 循环的顺序收集并合并
// ---------------------------------------------------------------------------

function parseForOrder(text) {
  const marker = 'const byCode = new Map()'
  const index = text.indexOf(marker)
  if (index < 0) throw new Error('找不到 byCode 合并段')
  const forAt = text.indexOf('for (const entry of [', index)
  if (forAt < 0) throw new Error('找不到 byCode 的 for 循环')
  const open = text.indexOf('[', forAt)
  const close = matchBracket(text, open)
  const names = splitTopLevel(text, open + 1, close)
    .map(part => part.trim().replace(/^\.\.\./, '').trim())
    .filter(Boolean)
  return names.map(name => name.replace(/\s+/g, ''))
}

function buildModel(legacyText, batchText) {
  const legacyDeclarations = declarationMap(legacyText)
  const batchDeclarations = declarationMap(batchText)
  const elderEntries = parseElderSigns(legacyText)
  const eventEntries = parseEventEntries(legacyText)
  const calvinEntries = parseCalvin(legacyText)
  const batchNames = ['BATCH_5B_1', 'BATCH_5B_2', 'BATCH_5B_3', 'BATCH_5B_4', 'BATCH_5B_5']

  const groups = []
  for (const name of parseForOrder(legacyText)) {
    if (name === 'elderSignEntries') { groups.push({ name, entries: elderEntries }); continue }
    if (name === 'MIGRATED_EVENT_ENTRIES_6E8') { groups.push({ name, entries: eventEntries }); continue }
    if (name === 'CALVIN_ENTRY') { groups.push({ name, entries: calvinEntries }); continue }
    if (name === 'MIGRATED_CARD_ENTRIES') {
      const entries = []
      for (const batch of batchNames) {
        const declaration = batchDeclarations.get(batch)
        if (!declaration) throw new Error(`找不到 ${batch}`)
        entries.push(...entriesFromArray(declaration))
      }
      groups.push({ name, entries })
      continue
    }
    const declaration = legacyDeclarations.get(name) || batchDeclarations.get(name)
    if (!declaration) throw new Error(`for 列表里的 ${name} 既不在 card-abilities.js 也不在批次文件里`)
    groups.push({ name, entries: entriesFromArray(declaration) })
  }

  const byCode = new Map()
  let order = 0
  for (const group of groups) {
    for (const entry of group.entries) {
      if (entry.spread) {
        for (const generated of parseSpreadEntries(entry.spread)) {
          addEntry(generated, group.name)
        }
        continue
      }
      addEntry(entry, group.name)
    }
  }

  function addEntry(entry, groupName) {
    if (!entry?.code) throw new Error(`解析到没有卡号的条目：${groupName}`)
    if (!byCode.has(entry.code)) {
      byCode.set(entry.code, { ...entry, order: order++, patches: [] })
    } else {
      byCode.get(entry.code).patches.push(entry)
    }
  }

  const merged = new Map()
  for (const [code, entry] of byCode) {
    if (entry.kind === 'elder') {
      const baseSource = `{\n  code: ${quote(code)},\n  kind: 'investigator',\n  elderSign: { id: ${quote(`${code}-eldersign`)}, resolve: factory() },\n  abilities: [],\n  modifiers: [],\n}`
      const source = entry.patches.length
        ? mergeEntrySources(baseSource, entry.patches.map(patch => patch.source))
        : baseSource
      merged.set(code, {
        code,
        order: entry.order,
        source,
        preamble: `const factory = ${entry.factory.trim()}`,
        comment: entry.comment || [],
        patches: entry.patches.map(patch => patch.code),
        kind: 'elder',
      })
      continue
    }
    const source = mergeEntrySources(entry.source, entry.patches.map(patch => patch.source))
    merged.set(code, {
      code,
      order: entry.order,
      source,
      preamble: entry.preamble,
      comment: entry.comment || [],
      patches: entry.patches.map(patch => patch.code),
    })
  }
  return { groups, merged, elderEntries, eventEntries }
}

// ---------------------------------------------------------------------------
// 校验：解析出的代码/字段与运行时 CARD_ABILITY_ENTRIES 对齐
// ---------------------------------------------------------------------------

async function runtimeEntries() {
  const { CARD_ABILITY_ENTRIES } = await import('../src/cards/card-abilities.js')
  return new Map(CARD_ABILITY_ENTRIES.map(entry => [entry.code, entry]))
}

function compareModels(model, runtime) {
  const problems = []
  const parsedCodes = new Set(model.merged.keys())
  const runtimeCodes = new Set(runtime.keys())
  for (const code of runtimeCodes) if (!parsedCodes.has(code)) problems.push(`缺少 ${code}`)
  for (const code of parsedCodes) if (!runtimeCodes.has(code)) problems.push(`多出 ${code}`)
  for (const code of parsedCodes) {
    if (!runtimeCodes.has(code)) continue
    const modelEntry = model.merged.get(code)
    if (!modelEntry.source) continue // 旧印：源码由 preamble + 固定骨架生成，字段另行核对
    const { properties } = objectProperties(modelEntry.source)
    const parsedKeys = new Set(properties.map(property => property.key))
    const actualKeys = new Set(Object.keys(runtime.get(code)))
    for (const key of actualKeys) if (!parsedKeys.has(key)) problems.push(`${code} 缺字段 ${key}`)
    for (const key of parsedKeys) if (!actualKeys.has(key)) problems.push(`${code} 多字段 ${key}`)
    for (const key of ['abilities', 'modifiers']) {
      const property = properties.find(item => item.key === key)
      const elements = property ? arrayElements(property.value) : null
      // 不是数组字面量（例如 04051 的 allSkillModifiers(...)）只能运行时核对，跳过静态条数。
      if (!elements) continue
      const actualCount = runtime.get(code)[key]?.length ?? 0
      if (elements.length !== actualCount) problems.push(`${code}.${key} 条数 ${elements.length} != ${actualCount}`)
    }
  }
  return problems
}

function summarize(model) {
  const entries = [...model.merged.values()]
  const abilities = entries.reduce((sum, entry) => {
    if (!entry.source) return sum
    const property = objectProperties(entry.source).properties.find(item => item.key === 'abilities')
    return sum + (property ? (arrayElements(property.value)?.length ?? 0) : 0)
  }, 0)
  const patches = entries.filter(entry => entry.patches.length)
  return {
    groups: model.groups.length,
    codes: entries.length,
    abilities,
    elderSigns: model.elderEntries.length,
    eventEntries: model.eventEntries.length,
    merged: patches.length,
    mergedCodes: patches.map(entry => entry.code).sort(),
  }
}

// ---------------------------------------------------------------------------
// 生成
// ---------------------------------------------------------------------------

async function cardData() {
  const { ALL_CARDS } = await import('../src/cards/cards-data.js')
  return ALL_CARDS
}

function moduleFor(entry, cards) {
  const card = cards[entry.code] || {}
  const name = card.nameZh || card.name || entry.name || entry.code
  const text = card.textZh || card.text || ''
  if (entry.preamble) {
    const symbols = collectSymbols(`${entry.preamble}\n${entry.source}`)
    // 旧印工厂体内部已有 `const es = investigatorSign(...)`，不要再生成顶层 es。
    if (entry.kind === 'elder') symbols.usesEs = false
    return renderEntryModule({
      code: entry.code, name, text, source: entry.source, preamble: entry.preamble, comment: entry.comment || [],
      symbols,
    })
  }
  return renderEntryModule({
    code: entry.code, name, text, source: entry.source, comment: entry.comment || [],
    symbols: collectSymbols(entry.source),
  })
}

function phase5Codes(model) {
  const codes = new Set()
  for (const group of model.groups) {
    if (!group.name.startsWith('MIGRATED_')) continue
    for (const entry of group.entries) {
      if (entry.spread) {
        for (const generated of parseSpreadEntries(entry.spread)) codes.add(generated.code)
      } else if (entry.code) {
        codes.add(entry.code)
      }
    }
  }
  return [...codes].sort()
}

function renderPhase5Module(codes) {
  const lines = [
    '// 由 tools/split-card-entries.mjs 从旧 PHASE5_MIGRATED_CODES 的成员关系生成，不要手改。',
    '// 这些卡的数据从旧 EFFECTS 搬到能力层时形状不变，自动构筑评分要把它们原样计回分数。',
    '// 更早的手写描述子（NEW_CARD_ABILITIES / LIFECYCLE / TRANSITION / 旧印）不在这个集合里。',
    '',
    'export const PHASE5_MIGRATED_CODES = new Set([',
  ]
  for (const code of codes) lines.push(`  ${quote(code)},`)
  lines.push('])', '')
  return lines.join('\n')
}

function renderAggregatorModule() {
  return `// 诡镇奇谈：卡牌版 · 声明式卡牌能力（聚合入口）
//
// 行为条目已经拆到 src/cards/entries/<code>.js：一张卡一个文件。
// 本文件只做聚合与公开导出，不再放任何条目；不要在这里加卡。
//
// 新增/修改一张卡：
//   1. 打开或创建 src/cards/entries/<code>.js（新卡用 node tools/scaffold-card.mjs <code>）；
//   2. 修改 export default 的条目；
//   3. 运行 node tools/build-card-index.mjs 更新 entries/index.js；
//   4. 跑 npm run test:fast，并用 replay 基线证明行为零变化。
//
// 规矩由 tests/card-entries.test.mjs 与 architecture-guard 守住。

import { CARD_ENTRY_LIST } from './entries/index.js'

// 已进入能力层的卡号集合。构筑层、图鉴与审计用它判断「这张卡有没有行为实现」。
export const CARD_ABILITY_ENTRIES = CARD_ENTRY_LIST
export const CARD_ABILITY_CODES = new Set(CARD_ABILITY_ENTRIES.map(entry => entry.code))

// Phase 5 迁走的卡号（数据从 EFFECTS 搬进能力层，形状不变）。
export { PHASE5_MIGRATED_CODES } from './phase5-codes.js'
`
}

async function backupLegacy() {
  await mkdir(abs('artifacts/legacy'), { recursive: true })
  for (const file of [LEGACY_FILE, BATCH_FILE]) {
    const target = abs(`artifacts/legacy/${path.basename(file)}`)
    if (!existsSync(target)) await writeFile(target, await readText(file), 'utf8')
  }
}

async function writeOutputs(model) {
  const cards = await cardData()
  await backupLegacy()
  if (existsSync(abs(ENTRY_DIR))) {
    for (const file of await readdir(abs(ENTRY_DIR))) {
      if (file.endsWith('.js')) await rm(abs(path.join(ENTRY_DIR, file)))
    }
  }
  await mkdir(abs(ENTRY_DIR), { recursive: true })
  await writeFile(abs(path.join(ENTRY_DIR, '_shared.js')), renderSharedModule(), 'utf8')

  const ordered = [...model.merged.values()].sort((left, right) => left.order - right.order)
  for (const entry of ordered) {
    await writeFile(abs(path.join(ENTRY_DIR, `${entry.code}.js`)), moduleFor(entry, cards), 'utf8')
  }
  await writeFile(abs(path.join(ENTRY_DIR, 'index.js')), renderIndexModule(ordered), 'utf8')
  await writeFile(abs('src/cards/phase5-codes.js'), renderPhase5Module(phase5Codes(model)), 'utf8')
  await writeFile(abs(LEGACY_FILE), renderAggregatorModule(), 'utf8')
  console.log(`写入 ${ordered.length} 个卡牌文件、_shared.js、index.js、phase5-codes.js，并重写 card-abilities.js`)
  return ordered
}

async function main() {
  const legacyText = await readText(LEGACY_FILE)
  const batchText = await readText(BATCH_FILE)
  const model = buildModel(legacyText, batchText)
  const summary = summarize(model)
  console.log(JSON.stringify(summary, null, 2))

  if (CHECK_ONLY) {
    const runtime = await runtimeEntries()
    const problems = compareModels(model, runtime)
    if (problems.length) {
      console.error(`\n✖ 与运行时不一致 ${problems.length} 处：`)
      for (const problem of problems.slice(0, 80)) console.error(`  ${problem}`)
      process.exit(1)
    }
    console.log('\n✔ 代码集合、字段集合、abilities/modifiers 条数与运行时完全一致')
    return
  }

  if (!WRITE) return
  await writeOutputs(model)
}

await main().catch(error => {
  console.error(error?.stack || String(error))
  process.exit(1)
})
