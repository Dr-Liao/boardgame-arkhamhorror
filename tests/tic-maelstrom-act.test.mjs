// 07315 回到深渊（《暗潮之下》幕 1）：目标判定 + 幕背面「Act 2 布置」。
//
// 读点：
//   · actRule.objective ← act-agenda.js#checkAct（行动结算后读条目函数分支并自动推进）；
//   · actRule.chapterSetup: 'act1Back' ← content entry-rules.actReveal 的数据驱动分派，
//     布置数据来自 chapter-data.setup.act1Back（按调查员人数的坐标图示）；
//   · 条目 setupSpawns 用 record/then/else 声明「达贡按 DagonHasAwakened 记录选面」。

import test from 'node:test'
import assert from 'node:assert/strict'
import { chapterFixture } from './tic-chapter-fixture.mjs'
import { advanceAct, scenarioRuntime } from '../src/engine/engine.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { registeredEntry } from '../src/engine/ability.js'
import { createMechanicsApi } from '../src/engine/api-mechanics.js'
import { floodLevel } from '../src/engine/flood.js'

function transaction(s, execute, select = () => null) {
  resolveTransaction(s, 0, { action: 'testTicMaelstromAct' }, execute)
  for (let guard = 0; s.pendingChoice; guard++) {
    assert.ok(guard < 80, 'choice loop')
    const choice = s.pendingChoice
    const id = select(choice, s) ?? ['done', 'skip', 'self'].find(optionId => choice.options.some(option => option.id === optionId))
      ?? choice.options[0].id
    resolveTransaction(s, choice.seat, { action: 'choose', choiceId: choice.id, optionId: id }, execute)
  }
}
const codeOf = entity => entity?.originalCode || entity?.code
const locationByCode = (s, code) => s.locations.find(location => codeOf(location) === code)
const positionOf = (s, code) => createMechanicsApi(s).map.position(locationByCode(s, code)?.id)

function prepareMaelstrom(count, records = {}) {
  const s = chapterFixture('intoTheMaelstrom', count, { records })
  s.enemies = []
  return s
}
function giveGatewayKeys(s, colors = ['blue', 'red', 'yellow', 'green']) {
  const api = createMechanicsApi(s)
  for (const color of colors) {
    const key = Object.entries(s.scenarioFlags.mechanics.keys || {}).find(([name]) => name === color)?.[1]
    assert.ok(key, `没有初始化 ${color} 钥匙`)
    assert.equal(api.keys.transfer(color, key.holder, 'investigator:0', { reveal: true }), true, `转移 ${color} 钥匙`)
  }
}

test('07315 目标：全员在伊哈·恩斯雷门扉且持有蓝红黄绿钥匙时才成立', () => {
  const s = prepareMaelstrom(1)
  const objective = registeredEntry('07315').actRule.objective
  assert.equal(objective(s, s.acts[s.actIndex]), false, '没拿钥匙时目标不成立')
  giveGatewayKeys(s)
  assert.equal(objective(s, s.acts[s.actIndex]), true, '全员在门扉 + 四色钥匙')
  const gateway = locationByCode(s, '07320')
  s.investigators[0].location = locationByCode(s, '07102')?.id || s.locations.find(location => location.id !== gateway.id).id
  assert.equal(objective(s, s.acts[s.actIndex]), false, '有调查员不在门扉时目标不成立')
})

test('07315 背面：移除旧地点、按 1 人图示布置 Act 2 地图并生成达贡/海德拉', () => {
  const s = prepareMaelstrom(1)
  giveGatewayKeys(s)
  const oldLocations = s.locations.map(location => location.id)
  const victoryLocation = s.locations.find(location => Number(location.victory || 0) > 0 && (location.clues || 0) === 0)
  transaction(s, draft => advanceAct(draft, []))
  assert.equal(s.actIndex, 1, '推进到幕 2（07316）')
  assert.equal(codeOf(s.acts[s.actIndex]), '07316')
  // 起始地点保留，其余旧地点全部移除。
  const gateway = locationByCode(s, '07320')
  assert.ok(gateway, '门扉保留')
  for (const id of oldLocations) if (id !== gateway.id) assert.equal(s.locations.some(location => location.id === id), false)
  if (victoryLocation) {
    assert.equal(s.victoryDisplay.some(card => String(card.id) === `location:${victoryLocation.id}`), true,
      'Victory X 且无线索的旧地点进胜利区')
  }
  // 1 人图示：4 圣堂 + 4 普通地点 + 2 巢穴。
  const sanctums = s.locations.filter(location => ['07324', '07325', '07326', '07327'].includes(codeOf(location)))
  assert.equal(sanctums.length, 4, '四张圣堂地点全部入场')
  const ordinary = s.locations.filter(location => ['07321', '07322', '07323'].includes(codeOf(location)))
  assert.equal(ordinary.length, 4, '1 人图示放 4 个普通地点（池 7 剩 3 留场外）')
  assert.deepEqual(positionOf(s, '07328'), { x: 1, y: -2, isolated: false }, '达贡巢穴在 1 人图示范 (1,-2)')
  assert.deepEqual(positionOf(s, '07329'), { x: -1, y: -2, isolated: false }, '海德拉巢穴在 (-1,-2)')
  for (const [code, expected] of [['07324', 2], ['07325', 2], ['07326', 2], ['07327', 2]]) {
    assert.equal(floodLevel(s, locationByCode(s, code).id), expected, `${code} 入场完全淹没`)
  }
  // 两个古神从 setAside 生成到各自巢穴，达贡默认沉睡面。
  const hydra = s.enemies.find(enemy => codeOf(enemy) === '07331a')
  assert.ok(hydra, '海德拉以深入沉睡面入场')
  assert.equal(hydra.location, locationByCode(s, '07329').id)
  const dagon = s.enemies.find(enemy => ['07330a', '07330b'].includes(codeOf(enemy)))
  assert.ok(dagon, '达贡入场')
  assert.equal(codeOf(dagon), '07330a', '未苏醒记录 → 深入沉睡面')
  assert.equal(dagon.location, locationByCode(s, '07328').id)
})

test('07315 背面：DagonHasAwakened 记录让达贡以苏醒狂怒面入场', () => {
  const s = prepareMaelstrom(1, { DagonHasAwakened: true })
  giveGatewayKeys(s)
  transaction(s, draft => advanceAct(draft, []))
  const dagon = s.enemies.find(enemy => ['07330a', '07330b'].includes(codeOf(enemy)))
  assert.ok(dagon)
  assert.equal(codeOf(dagon), '07330b', '记录已苏醒 → 苏醒狂怒面')
  assert.equal(dagon.location, locationByCode(s, '07328').id)
})

test('07315 背面：4 人图示用 7 个普通地点与 (-3,-1)/(3,-1) 圣堂坐标', () => {
  const s = chapterFixture('intoTheMaelstrom', 4)
  s.enemies = []
  giveGatewayKeys(s)
  transaction(s, draft => advanceAct(draft, []))
  const ordinary = s.locations.filter(location => ['07321', '07322', '07323'].includes(codeOf(location)))
  assert.equal(ordinary.length, 7, '4 人图示 7 个普通地点全放')
  const sanctums = s.locations.filter(location => ['07324', '07325', '07326', '07327'].includes(codeOf(location)))
  assert.equal(sanctums.length, 4)
  const positions = sanctums.map(location => createMechanicsApi(s).map.position(location.id))
    .map(position => `${position.x},${position.y}`)
  assert.deepEqual(positions.sort(), ['-2,-2', '-3,-1', '2,-2', '3,-1'], '圣堂坐标来自 4 人图示')
  assert.deepEqual(positionOf(s, '07328'), { x: 1, y: -3, isolated: false })
  assert.deepEqual(positionOf(s, '07329'), { x: -1, y: -3, isolated: false })
})
