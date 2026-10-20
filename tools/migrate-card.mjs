// Phase 5 · 迁移提效工具：把旧 DSL（EFFECTS）里可以机械搬家的条目改写成能力层描述子。
//
// 用法（在 games/arkhamhorror/ 下）：
//   node tools/migrate-card.mjs --list                 列出每张旧 DSL 卡的迁移判定（mechanical / residual）
//   node tools/migrate-card.mjs --plan 01089 01090     只打印这两张卡的迁移计划（不改文件）
//   node tools/migrate-card.mjs --write 01089 01090    写入：追加描述子 + 删除旧条目 + 登记卡包
//   node tools/migrate-card.mjs --write --batch 5b-1   按批次清单写入（清单见 audit/migration-batches.json）
//   node tools/migrate-card.mjs --verify               校验：所有已登记批次都没有旧条目残留
//
// 设计原则（对应 docs/architecture-refactor-roadmap.md §6 Phase 5、§7 迁移判据）：
//   · 只搬「读点已经存在」的槽位。数据体原样搬运，**不改写成 resolve 闭包**。
//   · 判不了、或会改变行为的条目一律拒绝写入（residual 非空），不做静默近似。
//   · 迁移后读点不变：played → lifecycle.playedEffect，commit → commitProfile，
//     weakness → weaknessProfile，entersPlay → entersPlayEffect，abilities → abilityShim，
//     passive.stats → modifiers，playCondition 由 play-condition.js 统一判定。
//   · 行为零变化靠 replay 指纹证明：每批用 tools/replay-fixtures.mjs --baseline/--compare。
//
// 一个「可机械迁移」的条目 = 所有顶层字段都在下面的 FIELD_HANDLERS 里，且没有战役逃生原语。

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const rel = file => path.relative(ROOT, file).split(path.sep).join('/')
const abs = file => path.join(ROOT, file)

// 旧 DSL 条目的定义处（EFFECTS 由 card-effects.js 汇总；卡包各自导出 effects/ signatureEffects）。
export const ENTRY_SOURCES = Object.freeze([
  'src/cards/card-effects.js',
  'content/packs/dunwichSupport/manifest.js',
  'content/packs/dunwichPlayer/effects.js',
  'content/packs/carcosaPlayer/effects.js',
  'content/packs/tfaPlayer/effects.js',
  'content/packs/dunwichInvestigators/manifest.js',
  'content/packs/carcosaInvestigators/manifest.js',
  'content/packs/tfaInvestigators/manifest.js',
])

// 卡包的「有行为实现」判定读 effects 表时，迁走的卡要登记到 abilityLayerCodes
// （content/expansions.js 的 expansionCardReady）；其它卡包按卡号清单判定，不需要登记。
export const PACK_MANIFESTS = Object.freeze({
  'content/packs/dunwichPlayer/effects.js': 'content/packs/dunwichPlayer/manifest.js',
  'content/packs/carcosaPlayer/effects.js': 'content/packs/carcosaPlayer/manifest.js',
  // dunwichSupport 的 effects 与 manifest 在同一个文件里（先删条目、再登记同一份文本）。
  'content/packs/dunwichSupport/manifest.js': 'content/packs/dunwichSupport/manifest.js',
})

export const BATCH_FILE = 'src/cards/ability-migration-batches.js'
export const BATCH_LEDGER = 'audit/migration-batches.json'

// 战役逃生原语：带这些前缀的效果动词说明"这张卡的语义在原语层表达不了"，
// 机械迁移搬不走（5c 批次要先补表达力），因此一律拒绝。
const ESCAPE_PRIMITIVE = /^(tfa|carcosa|dunwich|notz|circle|innsmouth|edge|scarlet)[A-Z]/

// 旧 DSL 的打出条件字段 → playCondition 组合子。
// 顺序必须与 src/engine/play-condition.js 的 LEGACY_RULES 一致：
// 多个条件同时不满足时，报错文案才不会因为迁移而改变。
const PLAY_CONDITION_RULES = Object.freeze([
  { field: 'requiresClueAtLocation', when: () => 'clueAtLocation()', message: () => '当前地点没有线索' },
  { field: 'requiresClue', when: () => 'investigatorClues(1)', message: () => '需要至少 1 个线索才能打出' },
  {
    field: 'requiresRemainingSanity',
    when: value => `remainingSanityAtLeast(${Number(value) || 1})`,
    message: value => `剩余神志不足 ${value} 点`,
  },
  { field: 'firstActionOnly', when: () => 'ownFirstAction()', message: () => '只能作为本回合的第一个行动打出' },
  { field: 'requiresNoEnemies', when: () => 'noEnemiesHere()', message: () => '当前地点有敌人' },
  { field: 'ownTurnOnly', when: () => 'ownTurn()', message: () => '只能在自己的回合打出' },
  { field: 'duringOwnTurn', when: () => 'ownTurn()', message: () => '只能在自己的回合打出' },
  { field: 'requiresResign', when: () => 'resignAvailable()', message: () => '场上没有带「撤退」能力的剧本卡' },
])

// 旧式能力的合法字段：全部有描述子对应物（maxClicks 没有，单独判死）。
const ABILITY_KEYS = new Set(['label', 'cost', 'effect', 'duringOwnSkillTest',
  'maximumInvestigatorDamage', 'requiresNoClues'])
// 费用字段：discardSelf / exileSelf / assetDamage 会在「使用」日志之前产生副作用日志，
// 与描述子路径的日志顺序不同（state.log 参与指纹），因此不算零变化迁移。
const SAFE_COST_KEYS = new Set(['action', 'uses', 'exhaust', 'resources', 'clues',
  'discardHand', 'discardHandIcon', 'damageSelf', 'horror'])
const BLOCKING_COST_KEYS = new Set(['discardSelf', 'exileSelf', 'assetDamage', 'requiresNoEnemies'])

const empty = value => value == null || (typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length === 0)

// 纯数据检查：迁移只搬 JSON 可表达的数据；函数（resolve）与计算属性一律判死。
export function isPlainData(value, trail = '') {
  if (value == null) return true
  const type = typeof value
  if (type === 'string' || type === 'number' || type === 'boolean') return true
  if (type === 'function') return `${trail} 是函数`
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      const problem = isPlainData(item, `${trail}[${index}]`)
      if (problem !== true) return problem
    }
    return true
  }
  if (type === 'object') {
    // 逃生原语写在 `type:` 上（如 `{ type: 'tfaPlayer', action: '…' }`）：
    // 这是"语义在原语层表达不了"的直接证据，机械迁移搬不走。
    if (typeof value.type === 'string' && ESCAPE_PRIMITIVE.test(value.type)) {
      return `${trail || '根'} 的效果类型 ${value.type} 是战役逃生原语`
    }
    for (const [key, item] of Object.entries(value)) {
      if (ESCAPE_PRIMITIVE.test(key)) return `${trail}${trail ? '.' : ''}${key} 是战役逃生原语`
      const problem = isPlainData(item, `${trail}${trail ? '.' : ''}${key}`)
      if (problem !== true) return problem
    }
    return true
  }
  return `${trail} 类型不支持（${type}）`
}

// 收集条目里所有战役逃生原语（type 与键名两处都看）。
export function collectEscapePrimitives(value, found = new Set()) {
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

// ---------------------------------------------------------------------------
// 迁移判定
// ---------------------------------------------------------------------------

/**
 * 分析一张卡：返回 { code, fields, residual:[{field, reason}], entry, notes, mechanical }。
 * entry 是可以直接注册的能力层条目；residual 是搬不动的字段（非空即不可机械迁移）。
 */
export function analyzeCard(code, effects, { registered = new Set(), cardData = {} } = {}) {
  const legacy = effects[code]
  if (!legacy) return null
  if (registered.has(code)) {
    return { code, fields: Object.keys(legacy), residual: [{ field: '<entry>', reason: '已在能力层注册（合并或人工迁移）' }],
      entry: null, notes: [], mechanical: false }
  }
  const name = cardData[code]?.nameZh || cardData[code]?.name || code
  const fields = Object.keys(legacy)
  const residual = []
  const notes = []
  const abilities = []
  const modifiers = []
  // field → { when, message }；最后按 LEGACY_RULES 的顺序输出（见下方 orderedConditions）。
  const playConditions = new Map()
  const entry = { code }

  for (const field of fields) {
    const value = legacy[field]
    switch (field) {
      case 'event': {
        if (collectEscapePrimitives(value).size) {
          residual.push({ field, reason: '效果体里是战役逃生原语（5c 批次）' })
          break
        }
        const plain = isPlainData(value, 'event')
        if (plain !== true) { residual.push({ field, reason: plain }); break }
        const descriptor = { kind: 'played', label: name }
        if (legacy.fast === true) descriptor.fast = true
        if (legacy.noOpportunityAttack === true) descriptor.noOpportunityAttack = true
        descriptor.effect = value
        abilities.unshift(descriptor)
        break
      }
      case 'skill': {
        const plain = isPlainData(value, 'skill')
        if (plain !== true) { residual.push({ field, reason: plain }); break }
        abilities.unshift({ kind: 'commit', label: name, skill: value })
        break
      }
      case 'weakness': {
        if (collectEscapePrimitives(value).size) {
          residual.push({ field, reason: '弱点数据里是战役逃生原语（5c 批次）' })
          break
        }
        const plain = isPlainData(value, 'weakness')
        if (plain !== true) { residual.push({ field, reason: plain }); break }
        abilities.unshift({ kind: 'weakness', label: name, weakness: value })
        break
      }
      case 'onEnter': {
        const plain = isPlainData(value, 'onEnter')
        if (plain !== true) { residual.push({ field, reason: plain }); break }
        abilities.unshift({ kind: 'entersPlay', label: name, entersPlay: value })
        break
      }
      case 'uses':
        entry.uses = value
        break
      case 'usesType':
        entry.usesType = value
        break
      case 'discardWhenEmpty':
        // Phase 5（D2）：使用次数元数据搬进注册表条目（读点 assetEffect / executeDescriptor）。
        entry.discardWhenEmpty = value === true
        break
      case 'fast':
      case 'noOpportunityAttack':
        // 两个都是卡面关键字，只有事件卡（played 描述子）才有读点。
        if (!legacy.event) residual.push({ field, reason: '没有 event：卡面关键字只对事件卡有读点' })
        break
      case 'abilities': {
        const list = Array.isArray(value) ? value : []
        const problems = []
        for (const [index, ability] of list.entries()) {
          for (const key of Object.keys(ability || {})) {
            if (!ABILITY_KEYS.has(key)) problems.push(`abilities[${index}].${key} 没有描述子字段`)
          }
          for (const key of Object.keys(ability?.cost || {})) {
            if (!SAFE_COST_KEYS.has(key)) {
              problems.push(`abilities[${index}].cost.${key} ${BLOCKING_COST_KEYS.has(key) ? '会改变日志顺序' : '不是描述子费用'}`)
            }
          }
          const plain = isPlainData(ability?.effect, `abilities[${index}].effect`)
          if (plain !== true) problems.push(plain)
        }
        if (problems.length) residual.push({ field, reason: problems.slice(0, 3).join('；') })
        else {
          for (const ability of list) {
            const descriptor = {
              kind: 'action',
              label: ability.label || name,
              cost: { ...(ability.cost || {}) },
            }
            if (ability.effect !== undefined) descriptor.effect = ability.effect
            if (ability.duringOwnSkillTest) descriptor.duringOwnSkillTest = true
            if (ability.requiresNoClues) descriptor.requiresNoClues = true
            if (ability.maximumInvestigatorDamage != null) {
              descriptor.maximumInvestigatorDamage = ability.maximumInvestigatorDamage
            }
            abilities.push(descriptor)
          }
        }
        break
      }
      case 'passive': {
        const keys = Object.keys(value || {})
        if (keys.length === 1 && keys[0] === 'stats') {
          for (const [skill, amount] of Object.entries(value.stats || {})) {
            if (typeof amount !== 'number') { residual.push({ field, reason: `passive.stats.${skill} 不是数字` }); continue }
            modifiers.push({ target: `skill:${skill}`, amount })
          }
        } else {
          residual.push({ field, reason: `passive 只支持纯 stats（当前：${keys.join(',') || '空'}）` })
        }
        break
      }
      default: {
        const rule = PLAY_CONDITION_RULES.find(item => item.field === field)
        if (rule) {
          playConditions.set(field, { when: rule.when(value), message: rule.message(value) })
          break
        }
        residual.push({ field, reason: '没有对应的描述子读点' })
      }
    }
  }

  // playCondition 的顺序按 LEGACY_RULES 排，而不是按字段出现顺序：
  // 文案的"第一条不满足"必须与迁移前一致。
  const orderedConditions = PLAY_CONDITION_RULES
    .filter(rule => playConditions.has(rule.field))
    .map(rule => playConditions.get(rule.field))
  if (orderedConditions.length) entry.playCondition = orderedConditions
  if (modifiers.length) entry.modifiers = modifiers
  if (abilities.length) entry.abilities = abilities

  const mechanical = residual.length === 0 && (abilities.length > 0 || modifiers.length > 0
    || entry.uses != null || entry.usesType != null)
  if (!mechanical && !residual.length) residual.push({ field: '<entry>', reason: '没有可搬运的字段' })
  return { code, name, fields, residual, entry: mechanical ? entry : null, notes, mechanical }
}

// 一次分析全部旧 DSL 卡。
export function analyzeAll({ effects, registered, cardData }) {
  const plans = []
  for (const code of Object.keys(effects).sort()) {
    const plan = analyzeCard(code, effects, { registered, cardData })
    if (plan) plans.push(plan)
  }
  return plans
}

// ---------------------------------------------------------------------------
// 源码读写：定位并删除旧条目
// ---------------------------------------------------------------------------

function scanString(text, start) {
  const quote = text[start]
  let index = start + 1
  while (index < text.length) {
    const char = text[index]
    if (char === '\\') { index += 2; continue }
    if (char === quote) return index + 1
    if (quote === '`' && char === '$' && text[index + 1] === '{') {
      index = scanBraces(text, index + 1, '}', true)
      continue
    }
    index++
  }
  throw new Error('字符串没有闭合')
}

// 从 `{` / `(` / `[` 开始做括号匹配，跳过字符串与注释。
function scanBraces(text, start, closer = null, raw = false) {
  const pairs = { '{': '}', '(': ')', '[': ']' }
  const stack = closer ? [closer] : [pairs[text[start]]]
  let index = start + (closer ? 0 : 1)
  while (index < text.length) {
    const char = text[index]
    if (char === '/' && text[index + 1] === '/') {
      const end = text.indexOf('\n', index)
      index = end < 0 ? text.length : end
      continue
    }
    if (char === '/' && text[index + 1] === '*') {
      const end = text.indexOf('*/', index + 2)
      index = end < 0 ? text.length : end + 2
      continue
    }
    if (char === '\'' || char === '"' || char === '`') { index = scanString(text, index); continue }
    if (pairs[char]) { stack.push(pairs[char]); index++; continue }
    if (char === stack[stack.length - 1]) {
      stack.pop()
      index++
      if (!stack.length) return index
      continue
    }
    index++
  }
  throw new Error('括号没有闭合')
}

/**
 * 在源文件里定位 `'CODE': { ... }` 条目，返回删除区间与起始行。
 * 找不到或出现多次都抛错（宁可人工处理，也不猜）。
 */
export function locateEntry(text, code) {
  const needle = `'${code}'`
  const hits = []
  let from = 0
  while (true) {
    const index = text.indexOf(needle, from)
    if (index < 0) break
    from = index + needle.length
    let cursor = from
    while (cursor < text.length && /\s/.test(text[cursor])) cursor++
    if (text[cursor] !== ':') continue
    cursor++
    while (cursor < text.length && /\s/.test(text[cursor])) cursor++
    if (text[cursor] !== '{') continue
    hits.push({ keyStart: index, valueStart: cursor, valueEnd: scanBraces(text, cursor) })
  }
  if (!hits.length) return null
  if (hits.length > 1) throw new Error(`${code} 在同一个文件里出现了 ${hits.length} 次，无法自动判定`)
  const hit = hits[0]
  const lineStart = text.lastIndexOf('\n', hit.keyStart) + 1
  let end = hit.valueEnd
  while (end < text.length && (text[end] === ' ' || text[end] === '\t')) end++
  if (text[end] === ',') end++
  while (end < text.length && (text[end] === ' ' || text[end] === '\t')) end++
  if (text[end] === '\r') end++
  if (text[end] === '\n') end++
  return { ...hit, lineStart, end, indent: text.slice(lineStart, hit.keyStart) }
}

export function removeEntry(text, code) {
  const located = locateEntry(text, code)
  if (!located) return null
  return { text: text.slice(0, located.lineStart) + text.slice(located.end), located }
}

// ---------------------------------------------------------------------------
// 源码生成
// ---------------------------------------------------------------------------

const quote = value => (/^[^'\\]*$/.test(value) && !value.includes('\n')
  ? `'${value}'`
  : JSON.stringify(value))

// 极简源码渲染器：对象/数组多行缩进，短值单行，保证生成的 diff 可读。
export function render(value, indent = 0, maxInline = 96) {
  const pad = ' '.repeat(indent)
  const inline = inlineValue(value)
  if (inline != null && inline.length + pad.length <= maxInline) return inline
  if (Array.isArray(value)) {
    if (!value.length) return '[]'
    return `[\n${value.map(item => `${pad}  ${render(item, indent + 2, maxInline)},`).join('\n')}\n${pad}]`
  }
  if (value && typeof value === 'object') {
    const keys = Object.keys(value)
    if (!keys.length) return '{}'
    const body = keys.map(key => `${pad}  ${keyLabel(key)}: ${render(value[key], indent + 2, maxInline)},`)
    return `{\n${body.join('\n')}\n${pad}}`
  }
  return inlineValue(value)
}

const keyLabel = key => (/^[A-Za-z_$][\w$]*$/.test(key) ? key : quote(key))

function inlineValue(value) {
  if (value == null) return String(value)
  if (typeof value === 'string') return quote(value)
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) {
    if (!value.length) return '[]'
    const parts = value.map(inlineValue)
    return parts.every(part => part != null) ? `[${parts.join(', ')}]` : null
  }
  if (typeof value === 'object') {
    if (value.__raw) return String(value.__raw)
    const keys = Object.keys(value)
    if (!keys.length) return '{}'
    const parts = keys.map(key => {
      const rendered = inlineValue(value[key])
      return rendered == null ? null : `${keyLabel(key)}: ${rendered}`
    })
    return parts.every(part => part != null) && parts.join(', ').length <= 76 ? `{ ${parts.join(', ')} }` : null
  }
  return null
}

const raw = expression => ({ __raw: expression })

// 把「playCondition 里的 predicate 表达式」变成真的函数调用：渲染时用 __raw 占位，
// 注册时替换成 matcher.js 的组合子（生成文件顶部按需 import）。
export function renderEntry(plan, matcherNames) {
  const entry = plan.entry
  const lines = [`  {`, `    code: ${quote(entry.code)},`]
  if (entry.uses != null) lines.push(`    uses: ${entry.uses},`)
  if (entry.usesType) lines.push(`    usesType: ${quote(entry.usesType)},`)
  if (entry.discardWhenEmpty) lines.push('    discardWhenEmpty: true,')
  if (entry.playCondition) {
    lines.push('    playCondition: [')
    for (const item of entry.playCondition) {
      matcherNames.add(matcherCallName(item.when))
      lines.push(`      { when: ${item.when}, message: ${quote(item.message)} },`)
    }
    lines.push('    ],')
  }
  if (entry.modifiers) {
    lines.push('    modifiers: [')
    for (const modifier of entry.modifiers) lines.push(`      ${render(modifier, 6)},`)
    lines.push('    ],')
  }
  if (entry.abilities) {
    lines.push('    abilities: [')
    for (const descriptor of entry.abilities) {
      const copy = { ...descriptor }
      lines.push(`      ${render(copy, 6)},`)
    }
    lines.push('    ],')
  }
  lines.push('  },')
  return lines.join('\n')
}

function matcherCallName(expression) {
  const match = /^([A-Za-z_$][\w$]*)\(/.exec(String(expression))
  return match ? match[1] : null
}

export function collectMatcherNames(plans) {
  const names = new Set()
  for (const plan of plans) {
    for (const item of plan.entry?.playCondition || []) {
      const name = matcherCallName(item.when)
      if (name) names.add(name)
    }
  }
  return names
}

const BATCH_HEADER = `// 诡镇奇谈：卡牌版 · Phase 5 批量迁移批次（由 tools/migrate-card.mjs 维护）
//
// 这个文件是**迁移目标**：\`tools/migrate-card.mjs --write\` 把旧 DSL（EFFECTS）里
// 可以机械搬家的条目改写成能力层描述子，追加到下面按批次分组的常量里，同时删掉
// 旧条目本身。手写新卡**不要**加到这里——新卡直接写 src/cards/card-abilities.js。
//
// 文件结构：每个批次是一个标记块，工具的读写都靠这两行标记
//     // >>> batch: <批次名>
//     // <<< batch: <批次名>
// 块里只有 \`export const BATCH_<批次名> = [...]\`（批次名会转成大写常量名），
// 文件末尾的 MIGRATED_CARD_ENTRIES 由工具按块清单重新生成，不要手改。
//
// 迁移纪律（见 docs/phase5-migration.md）：
//   · **搬槽位，不改写法**：\`event → played\`、\`skill → commit\`、\`weakness → weakness\`、
//     \`onEnter → entersPlay\`、\`passive.stats → modifiers\`、\`abilities → action 描述子\`；
//     数据对象原样保留，不顺手改写成 resolve 闭包（否则覆盖度、AI 解释、审计都会退化）。
//   · 每次只搬「读点已经存在」的槽位；读点还没到位或字段没有对应能力时，工具会把这张卡
//     判成不可机械迁移（residual 非空），留给后续批次，不静默近似。
//   · 行为必须零变化：每批用 \`node tools/replay-fixtures.mjs --baseline/--compare\` 逐条比指纹。
`

function batchConstName(batch) {
  return `BATCH_${String(batch).toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`
}

// 解析生成文件里的批次块（保留人工块，按名称覆盖同名块）。
// 只认「块内容以 export const BATCH_ 开头」的标记块，文件头的示意文字因此不会被误读。
export function parseBatchFile(text) {
  const blocks = new Map()
  const pattern = /\/\/ >>> batch: ([^\n]+)\n([\s\S]*?)\n?\/\/ <<< batch: \1\n/g
  for (const match of text.matchAll(pattern)) {
    const name = match[1].trim()
    if (!/^export const BATCH_/.test(match[2].trim())) continue
    blocks.set(name, match[2])
  }
  return blocks
}

export function renderBatchFile(blocks, matcherNames) {
  const names = [...matcherNames].sort()
  const imports = names.length
    ? `\nimport { ${names.join(', ')} } from '../engine/matcher.js'\n`
    : ''
  const body = [...blocks.entries()]
    .filter(([, content]) => content.trim())
    .map(([batch, content]) => `// >>> batch: ${batch}\n${content.replace(/\n?$/, '\n')}// <<< batch: ${batch}\n`)
    .join('\n')
  const aggregate = [...blocks.entries()]
    .filter(([, content]) => content.trim())
    .map(([batch]) => batchConstName(batch))
  const footer = aggregate.length
    ? `\nexport const MIGRATED_CARD_ENTRIES = [\n${aggregate.map(name => `  ...${name},`).join('\n')}\n]\n`
    : '\nexport const MIGRATED_CARD_ENTRIES = []\n'
  return `${BATCH_HEADER}${imports}${body}${footer}`
}

export function renderBatchBlock(batch, plans) {
  const matcherNames = collectMatcherNames(plans)
  // 只为了把 predicate 表达式写进源码：渲染时用占位文本，注册时由 matcher 组合子替换。
  const entries = plans.map(plan => renderEntry(plan, matcherNames))
  return `export const ${batchConstName(batch)} = [\n${entries.join('\n')}\n]\n`
}

// 拆出批次块里的逐卡条目，返回 Map(code → 源码片段)。
// 同一批次分几次 --write 时，先前的条目必须原样保留，否则重跑一次就丢卡。
export function parseEntryChunks(blockText) {
  const chunks = new Map()
  const open = blockText.indexOf('[')
  const close = blockText.lastIndexOf(']')
  if (open < 0 || close < open) return chunks
  const body = blockText.slice(open + 1, close)
  let index = 0
  while (index < body.length) {
    const brace = body.indexOf('{', index)
    if (brace < 0) break
    const end = scanBraces(body, brace)
    const lineStart = body.lastIndexOf('\n', brace) + 1
    const chunk = body.slice(lineStart, end)
    const code = /code: '([^']+)'/.exec(chunk)?.[1]
    if (code) chunks.set(code, `${chunk},`)
    index = end
  }
  return chunks
}

// ---------------------------------------------------------------------------
// 卡包登记
// ---------------------------------------------------------------------------

export function registerAbilityLayerCodes(text, codes) {
  const marker = 'export const abilityLayerCodes = Object.freeze(['
  const start = text.indexOf(marker)
  if (start < 0) throw new Error('找不到 abilityLayerCodes 声明')
  const end = text.indexOf('])', start)
  if (end < 0) throw new Error('abilityLayerCodes 声明没有闭合')
  const current = [...text.slice(start + marker.length, end).matchAll(/'([^']+)'/g)].map(match => match[1])
  const merged = [...new Set([...current, ...codes])].sort()
  if (merged.length === current.length) return { text, added: [] }
  const before = text.slice(0, start + marker.length)
  const after = text.slice(end)
  const line = merged.map(code => `  '${code}',`).join('\n')
  return { text: `${before}\n${line}\n${after}`, added: merged.filter(code => !current.includes(code)) }
}

// ---------------------------------------------------------------------------
// 文件级操作
// ---------------------------------------------------------------------------

export async function loadState() {
  const { EFFECTS } = await import('../src/cards/card-effects.js')
  const { CARD_ABILITY_ENTRIES } = await import('../src/cards/card-abilities.js')
  const { ALL_CARDS } = await import('../src/cards/cards-data.js')
  return { effects: EFFECTS, registered: new Set(CARD_ABILITY_ENTRIES.map(entry => entry.code)), cardData: ALL_CARDS }
}

/**
 * 把一批计划写入仓库：
 *   1. 从 ENTRY_SOURCES 里删掉旧条目（同一份文本里改，最后统一落盘）；
 *   2. 生成/更新 ability-migration-batches.js 的批次块；
 *   3. 卡包清单登记 abilityLayerCodes（只有 dunwichPlayer / carcosaPlayer 需要）。
 * 返回 { removed, batches, registeredPacks }；调用方负责事后校验与账本更新。
 */
export async function applyMigration(plans, { batch }) {
  const texts = new Map()
  const read = async file => {
    if (!texts.has(file)) texts.set(file, await readFile(abs(file), 'utf8'))
    return texts.get(file)
  }
  const removed = []
  for (const plan of plans) {
    const sources = []
    for (const file of ENTRY_SOURCES) {
      const text = await read(file)
      const located = locateEntry(text, plan.code)
      if (located) sources.push({ file, located })
    }
    if (sources.length !== 1) {
      throw new Error(`${plan.code} 的旧条目前置条件不成立：在 ${sources.length} 个文件里找到`
        + `（${sources.map(item => item.file).join(', ') || '没有找到'}）`)
    }
    const { file } = sources[0]
    const result = removeEntry(await read(file), plan.code)
    texts.set(file, result.text)
    removed.push({ code: plan.code, file })
  }

  const registeredPacks = []
  const packCodes = new Map()
  for (const item of removed) {
    const manifest = PACK_MANIFESTS[item.file]
    if (!manifest) continue
    if (!packCodes.has(manifest)) packCodes.set(manifest, [])
    packCodes.get(manifest).push(item.code)
  }
  for (const [manifest, codes] of packCodes) {
    const result = registerAbilityLayerCodes(await read(manifest), codes)
    texts.set(manifest, result.text)
    if (result.added.length) registeredPacks.push({ manifest, added: result.added })
  }

  const existing = existsSync(abs(BATCH_FILE)) ? await readFile(abs(BATCH_FILE), 'utf8') : BATCH_HEADER
  const blocks = parseBatchFile(existing)
  const matcherNames = collectMatcherNames(plans)
  for (const [file, text] of texts) await writeFile(abs(file), text, 'utf8')
  // 同一批次可能分多次写入：先保留块里已有的条目，本次计划覆盖同号条目。
  const merged = new Map(parseEntryChunks(blocks.get(batch) || ''))
  for (const [code, chunk] of parseEntryChunks(renderBatchBlock(batch, plans))) merged.set(code, chunk)
  const ordered = [...merged.entries()].sort(([left], [right]) => left.localeCompare(right))
  blocks.set(batch, `export const ${batchConstName(batch)} = [\n${ordered.map(([, chunk]) => chunk).join('\n')}\n]\n`)
  await mkdir(path.dirname(abs(BATCH_FILE)), { recursive: true })
  await writeFile(abs(BATCH_FILE), renderBatchFile(blocks, collectBlockMatcherNames(blocks) || matcherNames), 'utf8')
  return { removed, batch, registeredPacks }
}

// 生成文件里已经用到的组合子（重写文件时保持 import 完整）。
// playCondition 的写法固定是 `when: <name>(`，只认这个位置，避免把数据里的同形文本算进来。
function collectBlockMatcherNames(blocks) {
  const names = new Set()
  for (const content of blocks.values()) {
    for (const match of content.matchAll(/when:\s*([A-Za-z_$][\w$]*)\(/g)) names.add(match[1])
  }
  return names
}

// ---------------------------------------------------------------------------
// 批次清单（audit/migration-batches.json）
// ---------------------------------------------------------------------------

export async function readBatchLedger() {
  if (!existsSync(abs(BATCH_LEDGER))) return { batches: {} }
  return JSON.parse(await readFile(abs(BATCH_LEDGER), 'utf8'))
}

export async function writeBatchLedger(ledger) {
  await mkdir(path.dirname(abs(BATCH_LEDGER)), { recursive: true })
  await writeFile(abs(BATCH_LEDGER), `${JSON.stringify(ledger, null, 2)}\n`, 'utf8')
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const MATCHER_EXPORTS = new Set(['all', 'any', 'none', 'not', 'always', 'never', 'ownTurn',
  'ownFirstAction', 'investigatorClues', 'clueAtLocation', 'noEnemiesHere', 'remainingSanityAtLeast',
  'resignAvailable'])

function describe(plan) {
  if (plan.mechanical) return '✔ 可机械迁移'
  return `✖ ${plan.residual.map(item => `${item.field}（${item.reason}）`).join('；')}`
}

async function main() {
  const args = process.argv.slice(2)
  const mode = args.find(arg => ['--list', '--plan', '--write', '--verify', '--report', '--rebuild'].includes(arg)) || '--list'
  const batchIndex = args.indexOf('--batch')
  const batch = batchIndex >= 0 ? args[batchIndex + 1] : null
  const skipIndex = batchIndex >= 0 ? batchIndex + 1 : -1
  const positional = args.filter((arg, index) => !arg.startsWith('--') && index !== skipIndex)

  const { effects, registered, cardData } = await loadState()
  const plans = analyzeAll({ effects, registered, cardData })
  const ledger = await readBatchLedger()

  if (mode === '--list') {
    const groups = new Map()
    for (const plan of plans) {
      const key = plan.mechanical ? 'mechanical' : 'residual'
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key).push(plan)
    }
    console.log(`旧 DSL 条目 ${plans.length} 个：可机械迁移 ${(groups.get('mechanical') || []).length}，`
      + `需要先补表达力 ${(groups.get('residual') || []).length}`)
    console.log('\n== 可机械迁移 ==')
    for (const plan of groups.get('mechanical') || []) {
      console.log(`  ${plan.code}  ${plan.fields.join(',')}`)
    }
    console.log('\n== 需要先补表达力 ==')
    for (const plan of groups.get('residual') || []) console.log(`  ${plan.code}  ${describe(plan)}`)
    return
  }

  if (mode === '--plan') {
    const codes = positional.length ? positional : Object.values(ledger.batches || {})[0] || []
    for (const code of codes) {
      const plan = plans.find(item => item.code === code)
      if (!plan) { console.log(`${code}: 没有旧 DSL 条目（可能已迁移）`); continue }
      console.log(`\n== ${code} ${plan.mechanical ? '可机械迁移' : '不可机械迁移'} ==`)
      console.log(`  字段：${plan.fields.join(',')}`)
      if (plan.residual.length) for (const item of plan.residual) console.log(`  残留：${item.field} —— ${item.reason}`)
      if (plan.entry) console.log(renderEntry(plan, new Set()).split('\n').map(line => `  ${line}`).join('\n'))
    }
    return
  }

  if (mode === '--report') {
    const summary = {}
    for (const plan of plans) {
      const key = plan.mechanical ? 'mechanical' : plan.residual[0]?.reason || 'unknown'
      summary[key] = (summary[key] || 0) + 1
    }
    console.log(JSON.stringify({ total: plans.length, summary }, null, 2))
    return
  }

  if (mode === '--verify') {
    let failures = 0
    for (const [name, codes] of Object.entries(ledger.batches || {})) {
      for (const code of codes) {
        if (effects[code]) { console.error(`  ✖ ${name} 的 ${code} 仍有旧 DSL 条目`); failures++ }
        if (!registered.has(code)) { console.error(`  ✖ ${name} 的 ${code} 没有能力层条目`); failures++ }
      }
    }
    console.log(failures ? `✖ ${failures} 处不一致` : `✔ ${Object.keys(ledger.batches || {}).length} 个批次与实现一致`);
    process.exit(failures ? 1 : 0)
  }

  if (mode === '--rebuild') {
    // 只重排生成文件（修复标记块、补齐 import 与聚合清单），不动旧 DSL。
    const blocks = parseBatchFile(await readFile(abs(BATCH_FILE), 'utf8'))
    await writeFile(abs(BATCH_FILE), renderBatchFile(blocks, collectBlockMatcherNames(blocks)), 'utf8')
    console.log(`重建 ${BATCH_FILE}：${blocks.size} 个批次块`)
    return
  }

  // --write
  let codes = positional
  if (batch) codes = [...new Set([...(ledger.batches?.[batch] || []), ...codes])]
  if (!codes.length) throw new Error('没有指定卡号：用 --plan <code…> 或 --write <code…>，或用 --batch <名称>')
  const selected = []
  const rejected = []
  const skipped = []
  for (const code of codes) {
    const plan = plans.find(item => item.code === code)
    if (!plan) {
      // 批次重跑时，已经迁完的卡自然没有旧条目——跳过而不是报错（幂等）。
      if (registered.has(code)) { skipped.push(code); continue }
      rejected.push({ code, reason: '没有旧 DSL 条目，也不在能力层注册表里' }); continue
    }
    if (!plan.mechanical) { rejected.push({ code, reason: describe(plan) }); continue }
    for (const name of collectMatcherNames([plan])) {
      if (!MATCHER_EXPORTS.has(name)) rejected.push({ code, reason: `matcher 没有 ${name}` })
    }
    selected.push(plan)
  }
  if (skipped.length) console.log(`已迁移，跳过：${skipped.join(', ')}`)
  if (rejected.length) {
    console.error('以下卡不满足机械迁移条件，已拒绝写入（不静默近似）：')
    for (const item of rejected) console.error(`  ${item.code}: ${item.reason}`)
    process.exit(1)
  }
  if (!selected.length) {
    console.log('没有需要写入的卡（批次已全部迁移）。')
    return
  }
  const batchName = batch || `adhoc-${new Date().toISOString().slice(0, 10)}`
  const result = await applyMigration(selected, { batch: batchName })
  ledger.batches ||= {}
  ledger.batches[batchName] = [...new Set([...(ledger.batches[batchName] || []), ...selected.map(plan => plan.code)])].sort()
  await writeBatchLedger(ledger)
  console.log(`批次 ${batchName}：写入 ${selected.length} 张卡（${selected.map(plan => plan.code).join(', ')}）`)
  for (const item of result.removed) console.log(`  删除旧条目 ${item.code} ← ${item.file}`)
  for (const item of result.registeredPacks) console.log(`  登记卡包 ${item.manifest}：${item.added.join(', ')}`)
  console.log('\n下一步：node tools/audit-abilities.mjs --write && node tools/replay-fixtures.mjs --compare <基线>'
    + ' && npm run test:fast')
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  await main().catch(error => {
    console.error(error?.stack || String(error))
    process.exit(1)
  })
}
