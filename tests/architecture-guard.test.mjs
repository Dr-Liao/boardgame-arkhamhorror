// 架构守卫（重构路线 Phase 0）：把"五件唯一"里可机械判定的部分钉死。
//
// 守住四件事：
//   1. 冻结集合——engine.js 的 5 位码、EFFECTS 的键、描述子 kind，都只减不增；
//   2. 分层方向——内容层不得 import 引擎装配点；
//   3. 窗口接线——描述子声明的 trigger 必须是 windows.js 已注册的窗口；
//   4. 产物同步——audit/ability-coverage.json 必须与当前实现一致，指标变化要进 diff。
//
// 新增一条引擎分支或一个 EFFECTS 条目时，这个用例会失败——这是设计意图：
// 先评审（改白名单），再写代码；不能让"顺手把守卫调绿"成为默认路径。

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildCoverage, collect } from '../tools/audit-abilities.mjs'
// Phase 5（5a）：旧原语分派点的死代码检测——引擎里不得留「已经没有数据引用」的分支。
import { collectDeadPrimitives } from '../tools/audit-dead-primitives.mjs'
// Phase 3（D1）：非玩家卡条的修正目标在实体读点上校验（与 C1 的「声明即接线」同一口径）。
import { describeEntityRules } from '../src/engine/modifiers.js'

const root = new URL('../', import.meta.url)
const read = path => readFileSync(new URL(path, root), 'utf8')
const serialize = value => `${JSON.stringify(value, null, 2)}\n`
const sorted = values => [...values].sort()

// 描述子的 kind 是规则模型的一部分：加新 kind 必须同时改文档与这里。
// Phase 1 在 played / commit 之外补齐了三个生命周期钩子：weakness / entersPlay / leavesPlay。
const FROZEN_KINDS = ['action', 'free', 'reaction', 'forced', 'constant', 'elderSign',
  'played', 'commit', 'weakness', 'entersPlay', 'leavesPlay']

const data = await collect()

test('engine.js 的 5 位码集合与白名单一致（只减不增）', () => {
  const whitelist = JSON.parse(read('audit/card-code-whitelist.json'))
  assert.equal(whitelist.count, whitelist.codes.length, '白名单 count 与 codes 长度不一致')
  const added = data.engineCodes.filter(code => !whitelist.codes.includes(code))
  const removed = whitelist.codes.filter(code => !data.engineCodes.includes(code))
  assert.deepEqual(added, [],
    `engine.js 新增了 ${added.length} 个 5 位码：重构期不允许新增卡号分支。\n`
    + `  确有需要时先人工评审，再重跑 node tools/audit-abilities.mjs --write --allow-growth。`)
  assert.deepEqual(removed, [],
    `白名单里有 ${removed.length} 个码已从 engine.js 删除：这是迁移成果，请重跑 `
    + 'node tools/audit-abilities.mjs --write 让账本一起下降。')
})

test('EFFECTS 键集合与白名单一致（只减不增）', () => {
  const whitelist = JSON.parse(read('audit/effects-whitelist.json'))
  assert.equal(whitelist.count, whitelist.codes.length, '白名单 count 与 codes 长度不一致')
  const added = data.effectsCodes.filter(code => !whitelist.codes.includes(code))
  const removed = whitelist.codes.filter(code => !data.effectsCodes.includes(code))
  assert.deepEqual(added, [],
    `card-effects.js 新增了 ${added.length} 个 EFFECTS 条目：新卡请写 card-abilities.js 描述子。\n`
    + `  ${added.join(', ')}`)
  assert.deepEqual(removed, [],
    `白名单里有 ${removed.length} 个 EFFECTS 条目已被删除：请重跑 node tools/audit-abilities.mjs --write。`)
})

test('描述子 kind 冻结在 11 种', () => {
  assert.deepEqual(data.abilityKinds, FROZEN_KINDS,
    'ABILITY_KINDS 变了：新增 kind 需要先更新 docs/architecture-refactor-roadmap.md §4、'
    + 'docs/card-model.md §3 与本用例')
})

test('描述子声明的时机窗口都已注册', () => {
  assert.deepEqual(data.unknownTriggers, [],
    `这些窗口被描述子引用但没有在 windows.js 注册：${data.unknownTriggers.join(', ')}`)
})

test('内容层不得 import 引擎装配点', () => {
  const offenders = []
  const walk = (dir, files = []) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) walk(full, files)
      else if (entry.name.endsWith('.js')) files.push(full)
    }
    return files
  }
  for (const dir of ['src/cards', 'content']) {
    for (const file of walk(fileURLToPath(new URL(dir, root)))) {
      if (/from\s+'[^']*engine\/engine\.js'/.test(readFileSync(file, 'utf8'))) {
        offenders.push(relative(fileURLToPath(root), file).replace(/\\/g, '/'))
      }
    }
  }
  assert.deepEqual(offenders, [],
    `内容层只能依赖 ability/matcher/modifiers/windows 这些稳定契约，不能反向 import engine.js：\n  ${offenders.join('\n  ')}`)
})

test('覆盖度产物与当前实现一致', () => {
  const expected = serialize(buildCoverage(data))
  const actual = read('audit/ability-coverage.json')
  assert.equal(actual, expected,
    'audit/ability-coverage.json 与实现不一致。运行 node tools/audit-abilities.mjs --write 后审阅 diff：'
    + '指标下降是迁移成果，上升一定有问题。')
})

// Phase 3（D1）：非玩家卡通道的守卫。
test('非玩家卡描述子只能声明实体修正/规则目标', () => {
  assert.ok(data.phase3.nonPlayerCards > 0, '非玩家卡通道至少要有敌人/地点条目')
  const fake = { locations: [], enemies: [], acts: [], agendas: [], victoryDisplay: [], investigators: [] }
  for (const code of data.phase3.nonPlayerCodes) {
    // 读一遍会规范化修正目标：未知目标（例如把 skill:combat 写到敌人条目上）在这里就暴露。
    assert.doesNotThrow(() => describeEntityRules(fake, { id: `probe:${code}`, code }),
      `非玩家卡 ${code} 声明了无法实现的修正目标`)
  }
})

// Phase 3（D3）：behavior.js 的行数只减不增——这是"剧本声明化"的机械证据。
test('behavior.js 总行数不超过 Phase 3 基线，且至少一个关卡已声明化', () => {
  const BUDGET = 14831
  assert.ok(data.phase3.behaviorLines <= BUDGET,
    `behavior.js 总行数 ${data.phase3.behaviorLines} 超过基线 ${BUDGET}：新增关卡流程请写 `
    + 'content/scenario-declaration.js 的声明，不要往 behavior.js 加命令式钩子。')
  assert.ok(data.phase3.declaredScenarios >= 3,
    `已声明化的关卡只有 ${data.phase3.declaredScenarios} 个：新关卡必须用 declareScenario`)
})

// Phase 5（5b/5c）：迁走的卡必须登记进卡包的 abilityLayerCodes。
// 不登记 → 包的 deckbuilding 变成 false → 自动牌组池少一张 → 开局牌组与 replay 基线都会变。
test('卡包清单登记了所有迁到能力层的卡', async () => {
  const { registeredCodes } = await import('../src/engine/ability.js')
  const packs = [
    ['dunwichPlayer', await import('../content/packs/dunwichPlayer/manifest.js')],
    ['carcosaPlayer', await import('../content/packs/carcosaPlayer/manifest.js')],
    ['dunwichSupport', await import('../content/packs/dunwichSupport/manifest.js')],
  ]
  const registered = new Set(registeredCodes())
  const offenders = []
  for (const [id, mod] of packs) {
    for (const card of mod.manifest.cards) {
      if (!registered.has(card.code)) continue
      // deckbuilding=false 的卡（基础弱点等）按设计不进自动牌组池，不需要登记。
      if (card.deckbuilding === false) continue
      if (Object.hasOwn(mod.effects, card.code)) continue
      if (mod.abilityLayerCodes.includes(card.code)) continue
      offenders.push(`${id}:${card.code}`)
    }
  }
  assert.deepEqual(offenders, [],
    '这些卡已迁到能力层，但没有登记进卡包的 abilityLayerCodes（会让自动牌组池缺卡）：\n  '
    + offenders.join('\n  '))
})

// Phase 5（5a）：旧原语分派点不得残留死代码。
// 判据：`effect.action === 'X'` 的分派点在 EFFECTS / 描述子数据体 / 内容层源码 / 引擎其它位置
// 四处都没有引用 ⇒ 卡已经迁到描述子，分支该删（迁移证据 = 引擎变小、卡号减少）。
test('引擎里没有已无数据引用的旧原语分支', () => {
  const result = collectDeadPrimitives()
  assert.deepEqual(result.dead.map(row => row.name), [],
    '这些旧原语分支已经没有数据引用，请删除（tools/audit-dead-primitives.mjs --check 可复算）：\n  '
    + result.dead.map(row => `${row.name} (L${row.lines.join(', L')})`).join('\n  '))
})
