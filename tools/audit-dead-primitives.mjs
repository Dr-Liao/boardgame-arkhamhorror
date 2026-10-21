// Phase 5 · 5a 的一类机械动作：找出引擎里**已经没有任何数据引用**的旧原语分支。
//
// 判断依据（只读、可复算）：
//   1. 引擎里的 `effect.action === 'X'` 是旧原语的分派点，X 的「分派出现次数」记为 D；
//   2. 只要 EFFECTS / 能力层描述子 / 调查员异能的数据体里还有 `action: 'X'`，或 `content/**`、
//      `src/cards/**` 的源码里还出现 `'X'`，这条分支就还活着；
//   3. 引擎源码里 `'X'` 的出现次数大于 D，说明还有别的引擎代码在引用它（直接调用 / 分派表），也算活着；
//   4. 四条都不满足 ⇒ 死代码：卡已迁到描述子、旧条目已删，可以整段删除。
//
// 用法：
//   node tools/audit-dead-primitives.mjs            # 列表（0 个才算干净）
//   node tools/audit-dead-primitives.mjs --check    # 有死分支就 exit 1（架构守卫用）
//   node tools/audit-dead-primitives.mjs --json     # 机器可读

import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { EFFECTS, INVESTIGATOR_ABILITIES } from '../src/cards/card-effects.js'
import { CARD_ABILITY_ENTRIES } from '../src/cards/card-abilities.js'
import { NON_PLAYER_ABILITY_ENTRIES } from '../src/cards/encounter-abilities.js'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
// Phase 6：分派点不再只在 engine.js —— 6d-6e 把战役/玩家卡效果调度搬到内容层
// （src/cards/player-effects.js、src/cards/campaign-plugin.js），6e-7 之后 engine.js 里
// 一个 `effect.action === 'X'` 都不剩。扫描范围必须跟着覆盖「引擎全部模块 + 内容层调度器」，
// 否则指标会假性归零（本轮实测：旧口径 8 → 0，实际分派点没消失）。
const ENGINE_DIR = path.join(ROOT, 'src/engine')
const DISPATCH_FILES = [
  path.join(ENGINE_DIR, 'engine.js'),
  path.join(ROOT, 'src', 'cards', 'player-effects.js'),
  path.join(ROOT, 'src', 'cards', 'campaign-plugin.js'),
]

function dispatchSources() {
  const files = []
  for (const name of readdirSync(ENGINE_DIR)) {
    if (name.endsWith('.js')) files.push(path.join(ENGINE_DIR, name))
  }
  for (const file of DISPATCH_FILES) if (!files.includes(file)) files.push(file)
  return files.map(file => ({ file, text: readFileSync(file, 'utf8') }))
}

function collectContentText(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name)
    const stat = statSync(full)
    if (stat.isDirectory()) collectContentText(full, acc)
    else if (/\.(js|mjs)$/.test(name)) acc.push(readFileSync(full, 'utf8'))
  }
  return acc
}

const countOccurrences = (text, needle) => text.split(needle).length - 1

/**
 * 返回 { total, dead: [{ name, lines }], live: [...] }。
 * 纯函数：读引擎源码 + 内容层导出，不做任何写操作。
 */
export function collectDeadPrimitives() {
  const sources = dispatchSources()
  const source = sources.map(item => item.text).join('\n')
  const contentText = [...collectContentText(path.join(ROOT, 'content')),
    ...collectContentText(path.join(ROOT, 'src/cards'))].join('\n')

  const dispatch = new Map()
  for (const { file, text } of sources) {
    const relative = path.relative(ROOT, file).replace(/\\/g, '/')
    for (const match of text.matchAll(/effect\.action === '([A-Za-z0-9_]+)'/g)) {
      const name = match[1]
      const line = text.slice(0, match.index).split('\n').length
      if (!dispatch.has(name)) dispatch.set(name, [])
      dispatch.get(name).push(`${relative}:${line}`)
    }
  }

  const dataReference = new Set()
  const walk = value => {
    if (!value || typeof value !== 'object') return
    if (Array.isArray(value)) { for (const item of value) walk(item); return }
    if (typeof value.action === 'string') dataReference.add(value.action)
    // Phase 6：迁移后的数据体常把原语写成「布尔标记」（skill.onSuccess.placeChargeOrSecret: true），
    // 不是 action 字段；这里一并算作数据引用。
    for (const [key, child] of Object.entries(value)) {
      if (child === true) dataReference.add(key)
      walk(child)
    }
  }
  for (const entry of Object.values(EFFECTS)) walk(entry)
  for (const ability of Object.values(INVESTIGATOR_ABILITIES)) walk(ability)
  for (const entry of [...CARD_ABILITY_ENTRIES, ...NON_PLAYER_ABILITY_ENTRIES]) {
    for (const descriptor of entry.abilities || []) {
      walk(descriptor.effect)
      walk(descriptor.skill)
      walk(descriptor.weakness)
      walk(descriptor.entersPlay)
      walk(descriptor.leavesPlay)
    }
  }

  const rows = [...dispatch.entries()].map(([name, lines]) => {
    const engineOccurrences = countOccurrences(source, `'${name}'`)
    const reasons = []
    if (dataReference.has(name)) reasons.push('数据体仍在引用')
    const identifierPattern = new RegExp(`\\b${name}\\b`)
    if (contentText.includes(`'${name}'`) || identifierPattern.test(contentText)) reasons.push('内容层源码仍在引用')
    if (engineOccurrences > lines.length) reasons.push(`引擎里另有 ${engineOccurrences - lines.length} 处引用`)
    return { name, lines, dead: reasons.length === 0, reasons }
  }).sort((left, right) => Number(right.dead) - Number(left.dead) || left.name.localeCompare(right.name))

  return { total: rows.length, dead: rows.filter(row => row.dead), live: rows.filter(row => !row.dead) }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const result = collectDeadPrimitives()
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ total: result.total, dead: result.dead.map(({ name, lines }) => ({ name, lines })) }, null, 2))
  } else {
    console.log(`旧原语分派点 ${result.total} 个：已无数据引用 ${result.dead.length} 个`)
    for (const row of result.dead) console.log(`  ☠ ${row.name}  (L${row.lines.join(', L')})`)
    if (!result.dead.length) console.log('✔ 没有死分支')
  }
  if (process.argv.includes('--check') && result.dead.length) {
    console.error(`\n✖ ${result.dead.length} 个旧原语分支已无数据引用：删除它们（或补上数据引用）`)
    process.exit(1)
  }
}
