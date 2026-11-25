import test from 'node:test'
import assert from 'node:assert/strict'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { registeredEntry } from '../src/engine/ability.js'
import { getStat, placeLocation } from '../src/engine/engine.js'
import { createEffect, expireEffects } from '../src/engine/effect-state.js'
import { canonicalCode } from '../src/integration/arkhamdb.js'
import { enemy, fixture, move, play, settle, validateMove } from './core-fixture.mjs'

const investigator = state => state.investigators[0]
const currentLocation = state => state.locations.find(location => location.id === investigator(state).location)

test('60216 按其他手牌张数减费至零，按规则发现两条线索', () => {
  const code = '60216'
  for (const handSize of [0, 2, 10]) {
    const state = fixture('01002')
    const inv = investigator(state)
    inv.hand = Array(handSize).fill('01088')
    inv.clues = 0
    currentLocation(state).clues = 3
    play(state, code)
    settle(state)
    assert.equal(investigator(state).resources, 30 - Math.max(0, ALL_CARDS[code].cost - handSize))
    assert.equal(investigator(state).actionsLeft, 19)
    assert.equal(investigator(state).clues, 2)
    assert.equal(currentLocation(state).clues, 1)
  }
})

test('60226 自己回合不消耗行动，抽牌并以实时智识加成至本轮结束', () => {
  const code = '60226'
  const state = fixture('01002', 2)
  const inv = investigator(state)
  const combat = getStat(state, inv, 'combat')
  const agility = getStat(state, inv, 'agility')
  const intellect = getStat(state, inv, 'intellect')
  inv.hand = [code]
  const command = { action: 'play', cardId: code }
  state.phase = 'enemy'
  assert.ok(validateMove(state, 0, command), '敌军阶段不能打出')
  state.phase = 'investigation'
  move(state, command)
  settle(state)
  assert.equal(investigator(state).actionsLeft, 20)
  assert.equal(investigator(state).resources, 30 - ALL_CARDS[code].cost)
  assert.deepEqual(investigator(state).hand, ['01088'])
  assert.equal(getStat(state, investigator(state), 'combat'), combat + intellect)
  assert.equal(getStat(state, investigator(state), 'agility'), agility + intellect)
  const restored = JSON.parse(JSON.stringify(state))
  createEffect(restored, { controllerSeat: 0, duration: 'endOfRound', modifiers: [{ target: 'skill:intellect', amount: 2 }] })
  assert.equal(getStat(restored, investigator(restored), 'agility'), agility + intellect + 2)
  expireEffects(restored, 'endOfRound')
  assert.equal(getStat(restored, investigator(restored), 'combat'), combat)
  assert.equal(getStat(restored, investigator(restored), 'agility'), agility)
})

test('60416 获得基础资源，只按印刷列出的混乱符号追加资源', () => {
  for (const [bag, extra] of [[['0', 'eldersign', '-1'], 0], [['skull', 'cultist', 'autofail'], 6]]) {
    const state = fixture('01002')
    state.chaosBag = [...bag]
    play(state, '60416')
    settle(state)
    assert.equal(investigator(state).resources, 31 + extra - ALL_CARDS['60416'].cost)
    assert.deepEqual(state.chaosBag.slice().sort(), bag.slice().sort())
  }
})

test('60118 只向选中的同地另一位调查员和自己各发两资源', () => {
  const code = '60118'
  const state = fixture('01001', 3)
  const [owner, partner, other] = state.investigators
  const here = owner.location
  const elsewhere = Object.keys(state.scenario.locations).find(id => id !== here)
  partner.location = elsewhere
  other.location = elsewhere
  owner.hand = [code]
  const command = { action: 'play', cardId: code }
  assert.ok(validateMove(state, 0, command), '只有自己在该地点时不能打出')
  partner.location = here
  other.location = here
  move(state, command)
  assert.ok(state.pendingChoice?.options.some(option => option.id === '2'))
  assert.ok(!state.pendingChoice.options.some(option => option.id === '0'))
  settle(state, choice => choice.options.find(option => option.id === '2')?.id)
  assert.deepEqual(state.investigators.map(inv => inv.resources), [32 - ALL_CARDS[code].cost, 30, 32])
})

function assertAlias(code, canonical) {
  assert.equal(canonicalCode(code), canonical)
  assert.equal(registeredEntry(code)?.reprintOf, canonical)
}

for (const code of ['60227', '01685']) {
  test(`${code} 寻找答案按调查结果在本地及相连地点分配两条线索，额外调查线索留在本地`, () => {
    for (const { token, local, adjacent, picks, deduction, restricted, expected } of [
      { token: '0', local: 3, adjacent: 3, picks: ['attic', 'hallway'], expected: [2, 2] },
      { token: '0', local: 3, adjacent: 3, picks: ['hallway', 'hallway'], deduction: true, expected: [2, 1] },
      { token: '0', local: 0, adjacent: 1, picks: [], expected: [0, 0] },
      { token: '0', local: 3, adjacent: 3, restricted: true, picks: [], expected: [1, 3] },
      { token: 'autofail', local: 3, adjacent: 3, picks: [], expected: [3, 3] },
    ]) {
      const state = fixture('01002', 2)
      for (const id of ['attic', 'hallway', 'cellar']) placeLocation(state, id, [])
      const location = id => state.locations.find(item => item.id === id)
      Object.assign(location('attic'), { revealed: true, clues: local, shroud: 2 })
      Object.assign(location('hallway'), { revealed: true, clues: adjacent })
      if (restricted) location('hallway').originalCode = '07247' // 海德拉祭坛只允许通过调查发现线索
      Object.assign(location('cellar'), { revealed: true, clues: 4 })
      Object.assign(investigator(state), { location: 'attic', clues: 0, hand: deduction ? ['01039'] : [] })
      state.chaosBag = [token]
      play(state, code)
      let chosenCount = 0
      settle(state, choice => {
        if (choice.kind === 'commit' && deduction && choice.seat === 0)
          return choice.options.find(option => option.cardCode === '01039' || option.id === '0')?.id
        if (choice.kind !== 'location') return undefined
        assert.equal(choice.seat, 0)
        assert.deepEqual(choice.options.map(option => option.id).sort(), ['attic', 'hallway'])
        assert.ok(chosenCount < picks.length, '只有多个合法地点时才需选择')
        return picks[chosenCount++]
      })
      assert.equal(state.lastTestResult.success, token !== 'autofail')
      assert.equal(chosenCount, picks.length)
      assert.deepEqual(['attic', 'hallway'].map(id => location(id).clues), expected)
      assert.equal(location('cellar').clues, 4)
      assert.equal(investigator(state).clues, local + adjacent - expected[0] - expected[1])
      assert.equal(investigator(state).resources, 30 - ALL_CARDS[code].cost)
      assert.equal(investigator(state).actionsLeft, 19)
      assert.ok(investigator(state).discard.includes(code))
    }
  })
}

test('60206 打出后按五、十、十五张手牌三个阈值叠加智识和意志', () => {
  const state = fixture('01002')
  const baseIntellect = getStat(state, investigator(state), 'intellect')
  const baseWillpower = getStat(state, investigator(state), 'willpower')
  play(state, '60206')
  settle(state)
  for (const [size, intellect, willpower] of [[4, 0, 0], [5, 1, 0], [9, 1, 0], [10, 1, 1], [14, 1, 1], [15, 2, 1]]) {
    const inv = investigator(state)
    inv.hand = Array(size).fill('01088')
    assert.equal(getStat(state, inv, 'intellect'), baseIntellect + intellect, `${size} 张手牌`)
    assert.equal(getStat(state, inv, 'willpower'), baseWillpower + willpower, `${size} 张手牌`)
  }
})

test('60457 支援入场增加一点意志，横置后仍有效，离场后移除加成', () => {
  const state = fixture('01004')
  const baseWillpower = getStat(state, investigator(state), 'willpower')
  play(state, '60457')
  settle(state)
  const inv = investigator(state)
  assert.equal(getStat(state, inv, 'willpower'), baseWillpower + 1)
  inv.assets[0].exhausted = true
  assert.equal(getStat(state, inv, 'willpower'), baseWillpower + 1)
  inv.assets = []
  assert.equal(getStat(state, inv, 'willpower'), baseWillpower)
})

for (const code of ['60218', '60263']) {
  test(`${code} 重印通过原版行为检查地点线索并真实抽三张牌`, () => {
    assertAlias(code, '02186')
    const state = fixture('01002')
    investigator(state).hand = [code]
    const command = { action: 'play', cardId: code }
    currentLocation(state).clues = 0
    assert.ok(validateMove(state, 0, command))
    currentLocation(state).clues = 1
    move(state, command)
    settle(state)
    assert.deepEqual(investigator(state).hand, Array(3).fill('01088'))
    assert.equal(currentLocation(state).clues, 1)
    assert.equal(investigator(state).resources, 30 - ALL_CARDS[code].cost)
  })
}

function commitSelectedCard(state, code) {
  let committed = false
  settle(state, choice => {
    if (committed || choice.kind !== 'commit') return undefined
    const option = choice.options.find(option => option.cardCode === code || option.id === '0')
    if (!option) return undefined
    committed = true
    return option.id
  })
  assert.ok(committed, `${code} 应出现在检定投入选项里`)
}

for (const [code, canonical, upgraded] of [['60119', '01025', false], ['60176', '02299', true]]) {
  test(`${code} 重印在真实攻击检定中按成功差值结算追加伤害`, () => {
    assertAlias(code, canonical)
    for (const [token, expected] of [['autofail', 0], ['0', upgraded ? 3 : 2], ['-2', 2]]) {
      const state = fixture('01001')
      investigator(state).hand = [code]
      state.chaosBag = [token]
      const target = enemy(state, { fight: 3 })
      move(state, { action: 'fight', enemyId: target.id })
      commitSelectedCard(state, code)
      assert.equal(state.enemies.find(item => item.id === target.id).damageTaken, expected)
      assert.deepEqual(investigator(state).discard, [code])
    }
  })
}

for (const [code, canonical, upgraded] of [['60219', '01039', false], ['60267', '01039', false], ['60275', '02150', true]]) {
  test(`${code} 重印投入真实调查后，按成功差值发现线索`, () => {
    assertAlias(code, canonical)
    for (const [token, expected] of [['autofail', 0], ['0', upgraded ? 3 : 2], [upgraded ? '-2' : '-1', 2]]) {
      const state = fixture('01002')
      investigator(state).hand = [code]
      investigator(state).intellect = 3
      investigator(state).clues = 0
      currentLocation(state).clues = 4
      currentLocation(state).shroud = 3
      state.chaosBag = [token]
      move(state, { action: 'investigate' })
      commitSelectedCard(state, code)
      assert.equal(investigator(state).clues, expected)
      assert.equal(currentLocation(state).clues, 4 - expected)
    }
  })
}
