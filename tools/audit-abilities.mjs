// 能力层覆盖度与重构指标（重构路线 Phase 0）。
//
// 用法：
//   node tools/audit-abilities.mjs            # 只打印指标与通道分布
//   node tools/audit-abilities.mjs --write    # 重写 audit/ability-coverage.json、ability-migration.json，
//                                             # 并收缩两份白名单（只减不增；新增需要 --allow-growth 人工放行）
//   node tools/audit-abilities.mjs --check    # 校验产物与当前实现一致（CI / 迁移前后用）
//
// 口径（对应 docs/architecture-refactor-roadmap.md §1、§2）：
//   · engineCodes        src/engine/engine.js 里以字符串字面量出现的 5 位码（卡号为主，含少量关卡/幕/议程码）
//   · effectsEntries     src/cards/card-effects.js 的 EFFECTS 条目
//   · effectsTopLevelFields  EFFECTS 条目的顶层字段并集（生命周期/metadata/条件混在一起的程度）
//   · escapeCards        用「战役逃生原语」（tfaPlayer 等）表达的卡；EFFECTS 与描述子的生命周期数据体
//                        都会扫描（迁移不能把债务藏进描述子，否则指标会假性下降）
//   · descriptorEntries  注册进能力层的 card-abilities.js 条目
//   · windows            src/engine/windows.js 的时机窗口
//
// 规则：指标只允许下降。`--write` 会把白名单收缩到当前实现；一旦出现新增码就直接失败，
// 逼一次人工评审——这是"引擎不得新增卡号分支"的机械保障。

import { readFile, writeFile, readdir } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { EFFECTS } from '../src/cards/card-effects.js'
import { EFFECT_PRIMITIVES } from '../src/engine/effects.js'
import {
  ABILITY_KINDS, registerCardAbilities, registeredCodes, declaredAbilityCount, unknownTriggerWarnings,
  nonPlayerEntries, ABILITY_SCOPES,
} from '../src/engine/ability.js'
import { CARD_ABILITY_ENTRIES } from '../src/cards/card-abilities.js'
import { DATA_IMPLEMENTED_CODES } from '../src/cards/card-implementation.js'
import { NON_PLAYER_ABILITY_ENTRIES } from '../src/cards/encounter-abilities.js'
import { windows } from '../src/engine/windows.js'

// 以战役命名的效果动词，等于承认"这张卡的语义在原语层表达不了"。
const ESCAPE_PRIMITIVE = /^(tfa|carcosa|dunwich|notz|circle|innsmouth|edge|scarlet)[A-Z]/
const CODE_LITERAL = /'(0\d{4}[a-z]?)'/g
const CARD_CODE = /^0\d{4}[a-z]?$/

const COVERAGE_URL = new URL('../audit/ability-coverage.json', import.meta.url)
const LEDGER_URL = new URL('../audit/ability-migration.json', import.meta.url)
const CODE_WHITELIST_URL = new URL('../audit/card-code-whitelist.json', import.meta.url)
const EFFECTS_WHITELIST_URL = new URL('../audit/effects-whitelist.json', import.meta.url)
const ENGINE_URL = new URL('../src/engine/engine.js', import.meta.url)

const sorted = values => [...values].sort()

function collectEscapePrimitives(value, found = new Set()) {
  if (!value || typeof value !== 'object') return found
  if (Array.isArray(value)) {
    for (const item of value) collectEscapePrimitives(item, found)
    return found
  }
  if (typeof value.type === 'string' && ESCAPE_PRIMITIVE.test(value.type)) found.add(value.type)
  for (const [key, child] of Object.entries(value)) {
    if (ESCAPE_PRIMITIVE.test(key)) found.add(key)
    collectEscapePrimitives(child, found)
  }
  return found
}

// Phase 1：逃生原语不再只出现在 EFFECTS 里——生命周期钩子（played/commit/weakness/
// entersPlay/leavesPlay）的数据体也可能带 `tfaPlayer` 之类的战役原语。审计必须一起扫，
// 否则迁移一张卡就等于把债务藏起来（指标会假性下降）。
function collectDescriptorEscapePrimitives(entry) {
  const found = new Set()
  for (const descriptor of entry?.abilities || []) {
    for (const key of ['effect', 'skill', 'weakness', 'entersPlay', 'leavesPlay']) {
      if (descriptor[key]) collectEscapePrimitives(descriptor[key], found)
    }
  }
  return found
}

function ensureRegistered() {
  if (!registeredCodes().length) registerCardAbilities([...CARD_ABILITY_ENTRIES, ...NON_PLAYER_ABILITY_ENTRIES])
}

// Phase 3（D1/D3）：非玩家卡通道与剧本声明化的指标。
//   · nonPlayerCards   注册了行为的敌人/地点/幕/议程/剧情支援数（按 scope 分组的账本）
//   · behaviorLines    content/campaigns/**/behavior.js 的总行数（只减不增：迁移证据）
//   · declaredScenarios 用 content/scenario-declaration.js 声明布置/推进/结局的关卡数
async function collectPhase3() {
  const nonPlayer = nonPlayerEntries()
  const root = new URL('../content/campaigns/', import.meta.url)
  const behaviorFiles = []
  let behaviorLines = 0
  let declaredScenarios = 0
  const campaigns = (await readdir(root, { withFileTypes: true })).filter(entry => entry.isDirectory())
  for (const campaign of campaigns) {
    const scenarioRoot = new URL(`${campaign.name}/scenarios/`, root)
    let scenarios = []
    try {
      scenarios = (await readdir(scenarioRoot, { withFileTypes: true })).filter(entry => entry.isDirectory())
    } catch { continue }
    for (const scenario of scenarios) {
      const file = new URL(`${scenario.name}/behavior.js`, scenarioRoot)
      let source = null
      try { source = await readFile(file, 'utf8') } catch { continue }
      behaviorFiles.push(`content/campaigns/${campaign.name}/scenarios/${scenario.name}/behavior.js`)
      behaviorLines += source.split('\n').length - 1
      if (source.includes('declareScenario')) declaredScenarios++
    }
  }
  // 后期章节的共享行为文件（邓威治的 6 个后续关卡写在同一文件里）也算行为面。
  const later = new URL('../content/campaigns/theDunwichLegacy/later-behaviors.js', import.meta.url)
  behaviorFiles.push('content/campaigns/theDunwichLegacy/later-behaviors.js')
  behaviorLines += (await readFile(later, 'utf8')).split('\n').length - 1
  const byScope = {}
  for (const entry of nonPlayer) byScope[entry.scope] = (byScope[entry.scope] || 0) + 1
  return {
    nonPlayerCards: nonPlayer.length,
    nonPlayerByScope: byScope,
    nonPlayerCodes: nonPlayer.map(entry => entry.code).sort(),
    nonPlayerAbilities: nonPlayer.reduce((sum, entry) => sum + entry.abilities.length, 0),
    nonPlayerModifiers: nonPlayer.reduce((sum, entry) => sum + entry.modifiers.length, 0),
    abilityScopes: [...ABILITY_SCOPES],
    behaviorFiles: behaviorFiles.sort(),
    behaviorLines,
    declaredScenarios,
  }
}

// 纯读取：不写文件，供 CLI 与守卫测试共用。
export async function collect() {
  ensureRegistered()

  const phase3 = await collectPhase3()
  const nonPlayerCodes = new Set(phase3.nonPlayerCodes)
  const engineSource = await readFile(ENGINE_URL, 'utf8')
  const engineCodes = sorted(new Set([...engineSource.matchAll(CODE_LITERAL)].map(match => match[1])))
  const effectsCodes = sorted(Object.keys(EFFECTS))
  // 玩家卡账本只统计卡片通道：非玩家卡（敌人/地点/幕…）单独成账，避免把遭遇卡
  // 混进「EFFECTS 残留」的指标里。
  const descriptorCodes = sorted(new Set(CARD_ABILITY_ENTRIES.map(entry => entry.code)
    .filter(code => !nonPlayerCodes.has(code))))

  const topLevelFields = new Set()
  for (const code of effectsCodes) {
    for (const key of Object.keys(EFFECTS[code] || {})) topLevelFields.add(key)
  }

  const descriptorCounts = new Map()
  const descriptorEntries = new Map()
  for (const code of descriptorCodes) {
    const entry = CARD_ABILITY_ENTRIES.find(item => item.code === code)
    descriptorCounts.set(code, (entry?.abilities || []).length)
    descriptorEntries.set(code, entry)
  }

  const cards = []
  // Phase 6（6e-1）：通道口径与 src/cards/card-implementation.js 的实现账本对齐——
  // 「纯登记条目」（只有 engine/note 标记）与「数据即实现」的卡记成 data 通道，
  // 这样删掉登记条目只让 effectsEntries 下降，通道账本不会凭空丢卡。
  const DATA_CODES = new Set(DATA_IMPLEMENTED_CODES)
  for (const code of sorted(new Set([...effectsCodes, ...descriptorCodes, ...DATA_CODES]))) {
    const entry = EFFECTS[code]
    const escapePrimitives = sorted(new Set([
      ...(entry ? collectEscapePrimitives(entry) : []),
      ...collectDescriptorEscapePrimitives(descriptorEntries.get(code)),
    ]))
    // engineMarked = 行为完全由引擎硬编码（EFFECTS 里只有登记）；engineReferenced = engine.js
    // 里出现了这个码（可能是分支、也可能是注释或特判），后者只用于 5a 工作单排序。
    const engineMarked = Boolean(entry?.engine)
    const engineReferenced = engineCodes.includes(code)
    const hasDescriptor = descriptorCodes.includes(code)
    const inEffects = Boolean(entry)
    const registrationOnly = inEffects && Object.keys(entry).every(key => ['engine', 'note', 'simplified', 'text'].includes(key))
    const channel = engineMarked ? 'engine'
      : escapePrimitives.length ? 'escape'
        : hasDescriptor && inEffects ? 'hybrid'
          : hasDescriptor ? 'descriptor'
            : (inEffects && !registrationOnly) ? 'legacy' : 'data'
    cards.push({
      code,
      channel,
      descriptors: descriptorCounts.get(code) || 0,
      ...(escapePrimitives.length ? { escapePrimitives } : {}),
      ...(engineMarked ? { engineMarked: true } : {}),
      ...(engineReferenced ? { engineReferenced: true } : {}),
      ...(channel === 'data' ? { dataImplemented: true } : {}),
    })
  }

  const channels = cards.reduce((acc, card) => {
    acc[card.channel] = (acc[card.channel] || 0) + 1
    return acc
  }, {})

  return {
    engineCodes,
    effectsCodes,
    effectsTopLevelFields: sorted(topLevelFields),
    escapePrimitives: EFFECT_PRIMITIVES.filter(name => ESCAPE_PRIMITIVE.test(name)),
    abilityKinds: [...ABILITY_KINDS],
    windowIds: sorted(windows().map(window => window.id)),
    unknownTriggers: unknownTriggerWarnings(),
    descriptorEntries: descriptorCodes.length,
    descriptorAbilities: declaredAbilityCount(),
    phase3,
    cards,
    channels,
  }
}

export function buildCoverage(data) {
  return {
    schemaVersion: 1,
    note: '由 tools/audit-abilities.mjs --write 生成，勿手改。指标只允许下降；'
      + 'engineCodes / effectsEntries 的每一次减少都是一次迁移证据，必须随迁移一起提交。',
    metrics: {
      engineCodes: data.engineCodes.length,
      effectsEntries: data.effectsCodes.length,
      effectsTopLevelFields: data.effectsTopLevelFields.length,
      escapeCards: data.cards.filter(card => card.channel === 'escape').length,
      descriptorEntries: data.descriptorEntries,
      descriptorAbilities: data.descriptorAbilities,
      abilityKinds: data.abilityKinds.length,
      windows: data.windowIds.length,
      effectPrimitives: EFFECT_PRIMITIVES.length,
      // Phase 3：非玩家卡通道与剧本声明化（behavior.js 行数只减不增）。
      nonPlayerCards: data.phase3.nonPlayerCards,
      behaviorLines: data.phase3.behaviorLines,
      declaredScenarios: data.phase3.declaredScenarios,
    },
    channels: data.channels,
    nonPlayer: {
      byScope: data.phase3.nonPlayerByScope,
      codes: data.phase3.nonPlayerCodes,
      abilities: data.phase3.nonPlayerAbilities,
      modifiers: data.phase3.nonPlayerModifiers,
    },
    declaration: {
      abilityScopes: data.phase3.abilityScopes,
      behaviorFiles: data.phase3.behaviorFiles,
      behaviorLines: data.phase3.behaviorLines,
      declaredScenarios: data.phase3.declaredScenarios,
    },
    cards: data.cards,
  }
}

export function buildLedger(data) {
  const byChannel = channel => data.cards.filter(card => card.channel === channel).map(card => card.code)
  const escapeByPrimitive = {}
  for (const card of data.cards) {
    for (const primitive of card.escapePrimitives || []) {
      escapeByPrimitive[primitive] = (escapeByPrimitive[primitive] || 0) + 1
    }
  }
  const engineMarkedCodes = data.cards.filter(card => card.engineMarked).map(card => card.code)
  return {
    schemaVersion: 1,
    note: '迁移工作单：由 tools/audit-abilities.mjs --write 生成，勿手改。'
      + '批次定义见 docs/architecture-refactor-roadmap.md §6 Phase 5。',
    targets: {
      engineCodes: {
        batch: '5a',
        reason: 'engine.js 里出现的 5 位码（分支、特判或注释引用），迁一个删一个白名单条目',
        count: data.engineCodes.length,
        codes: data.engineCodes,
      },
      engineMarkedCards: {
        batch: '5a',
        reason: 'EFFECTS 里有 engine 标记：行为完全由引擎硬编码，迁移收益最高',
        count: engineMarkedCodes.length,
        codes: engineMarkedCodes,
      },
      escapeCards: {
        batch: '5c',
        reason: '用战役逃生原语表达的卡，需要先补表达力再改写',
        count: byChannel('escape').length,
        byPrimitive: escapeByPrimitive,
        codes: byChannel('escape'),
      },
      hybridCards: {
        batch: '5b',
        reason: '同时存在旧 DSL 条目与描述子，迁移时删掉旧条目',
        count: byChannel('hybrid').length,
        codes: byChannel('hybrid'),
      },
    },
  }
}

const serialize = value => `${JSON.stringify(value, null, 2)}\n`

async function readJson(url) {
  try {
    return JSON.parse(await readFile(url, 'utf8'))
  } catch (error) {
    if (error.code === 'ENOENT') return null
    throw error
  }
}

// 白名单只允许收缩：出现新码即失败，避免"顺手把守卫调绿"。
function nextWhitelist(name, currentCodes, previous, { allowGrowth }) {
  const current = sorted(currentCodes)
  if (!previous) {
    return { value: { note: `${name}：只减不增。由 tools/audit-abilities.mjs 维护，新增必须人工评审。`, count: current.length, codes: current }, added: [] }
  }
  const previousCodes = new Set(previous.codes || [])
  const added = current.filter(code => !previousCodes.has(code))
  if (added.length && !allowGrowth) {
    throw new Error(`${name} 出现 ${added.length} 个新增项，已拒绝写入：${added.join(', ')}\n`
      + '  重构期不允许新增卡号分支或 EFFECTS 条目；确需新增请人工评审后加 --allow-growth。')
  }
  return {
    value: { note: previous.note || `${name}：只减不增。`, count: current.length, codes: current },
    added,
    removed: (previous.codes || []).filter(code => !current.includes(code)),
  }
}

function summarize(coverage, data) {
  const metrics = coverage.metrics
  return [
    `指标：engineCodes=${metrics.engineCodes} effectsEntries=${metrics.effectsEntries} `
      + `effectsTopLevelFields=${metrics.effectsTopLevelFields} escapeCards=${metrics.escapeCards}`,
    `能力层：descriptorEntries=${metrics.descriptorEntries} descriptorAbilities=${metrics.descriptorAbilities} `
      + `abilityKinds=${metrics.abilityKinds} windows=${metrics.windows} effectPrimitives=${metrics.effectPrimitives}`,
    `内容来源：nonPlayerCards=${metrics.nonPlayerCards} behaviorLines=${metrics.behaviorLines} `
      + `declaredScenarios=${metrics.declaredScenarios}`,
    `通道：${Object.entries(data.channels).map(([channel, count]) => `${channel}=${count}`).join(' ')}`,
  ].join('\n')
}

async function main() {
  const mode = process.argv[2]
  const allowGrowth = process.argv.includes('--allow-growth')
  if (mode && !['--write', '--check'].includes(mode)) throw new Error('使用 --write 或 --check')

  const data = await collect()
  const coverage = buildCoverage(data)
  const ledger = buildLedger(data)
  const summary = summarize(coverage, data)

  if (mode === '--check') {
    const checks = [
      [COVERAGE_URL, coverage, 'ability-coverage.json'],
      [LEDGER_URL, ledger, 'ability-migration.json'],
    ]
    for (const [url, expected, name] of checks) {
      const actual = await readJson(url)
      if (!actual) throw new Error(`缺少 ${name}，先运行 node tools/audit-abilities.mjs --write`)
      if (serialize(expected) !== serialize(actual)) {
        throw new Error(`${name} 与当前实现不一致，请运行 node tools/audit-abilities.mjs --write 后审阅 diff`)
      }
    }
    for (const [url, currentCodes, name] of [
      [CODE_WHITELIST_URL, data.engineCodes, 'card-code-whitelist.json'],
      [EFFECTS_WHITELIST_URL, data.effectsCodes, 'effects-whitelist.json'],
    ]) {
      const whitelist = await readJson(url)
      if (!whitelist) throw new Error(`缺少 ${name}，先运行 node tools/audit-abilities.mjs --write`)
      if (serialize(sorted(whitelist.codes).map(String)) !== serialize(sorted(currentCodes))) {
        throw new Error(`${name} 与当前实现不一致（新增或残留），请运行 node tools/audit-abilities.mjs --write 后审阅 diff`)
      }
    }
    console.log(summary)
    return
  }

  if (!mode) {
    console.log(summary)
    console.log(`\n未知窗口触发：${data.unknownTriggers.length ? data.unknownTriggers.join(', ') : '无'}`)
    return
  }

  // --write：先算完全部产物，任一白名单新增就直接失败，不留下半写状态。
  const codeWhitelist = nextWhitelist('engine.js 5 位码白名单', data.engineCodes, await readJson(CODE_WHITELIST_URL), { allowGrowth })
  const effectsWhitelist = nextWhitelist('EFFECTS 白名单', data.effectsCodes, await readJson(EFFECTS_WHITELIST_URL), { allowGrowth })

  await writeFile(COVERAGE_URL, serialize(coverage))
  await writeFile(LEDGER_URL, serialize(ledger))
  await writeFile(CODE_WHITELIST_URL, serialize(codeWhitelist.value))
  await writeFile(EFFECTS_WHITELIST_URL, serialize(effectsWhitelist.value))
  console.log(summary)
  for (const [label, result] of [['engine 码', codeWhitelist], ['EFFECTS 键', effectsWhitelist]]) {
    const parts = []
    if (result.removed?.length) parts.push(`收缩 ${result.removed.length} 项`)
    if (result.added?.length) parts.push(`新增 ${result.added.length} 项（已放行）`)
    if (parts.length) console.log(`${label}白名单：${parts.join('，')}`)
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) await main()
