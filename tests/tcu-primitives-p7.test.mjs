// 万象无终（TCU）P7 玩家卡批次的原语验收（主进程实现，2026-10）。
//
// 覆盖 P7 原语队列里 implemented 的四项（详见 artifacts/migration/tcu/reports/primitive-queue.json）：
//   1. openingHandBonus（05276 苦心钻研）——条目字段 + setup 开局手牌读点；
//   2. leavesPlay resolve（05313/05316 绑定主卡离场时收回副本）——生命周期描述子可只带 resolve；
//   3. eventPlayed 反应窗口（05320 超级加倍）——事件打出并结算后开窗，配 api.replayPlayedCode；
//   4. conditionalIcons（05022/05026/05030/05034/05038）——投入时按调查员状态追加技能图标。
//
// 这些读点都在通用层；具体卡的行为测试在 tests/tcu-player-m2-*.test.mjs。
import test from 'node:test'
import assert from 'node:assert/strict'

import { fixture, move, settle } from './core-fixture.mjs'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'
import { commitIcons, drawOpeningHand, leaveAsset } from '../src/engine/engine.js'
import { isKnownWindow, windowKind } from '../src/engine/windows.js'

const me = state => state.investigators[0]

// ---------------------------------------------------------------------------
// 1. openingHandBonus（05276）
// ---------------------------------------------------------------------------

test('P7 原语：openingHandBonus 是条目级正整数，注册期校验非法值', () => {
  assert.equal(registeredEntry('05276')?.openingHandBonus, 1, '05276 条目声明开局手牌 +1')
  assert.throws(() => registerCardAbilities({ code: '05999', openingHandBonus: 0 }), /openingHandBonus/)
  assert.throws(() => registerCardAbilities({ code: '05999', openingHandBonus: 1.5 }), /openingHandBonus/)
})

test('P7 原语：在场永久卡的 openingHandBonus 让开局手牌 +1（setup 读点）', () => {
  const base = fixture()
  const baseInv = me(base)
  baseInv.hand = []
  baseInv.deck = Array(10).fill('01016')
  drawOpeningHand(base, baseInv)
  assert.equal(baseInv.hand.length, 5, '无修正时起始手牌为 5')

  const state = fixture()
  const inv = me(state)
  inv.hand = []
  inv.deck = Array(10).fill('01016')
  inv.assets.push({ id: 'perm-05276', code: '05276', exhausted: false })
  drawOpeningHand(state, inv)
  assert.equal(inv.hand.length, 6, '永久卡 05276 在场时起始手牌 5+1')
})

// ---------------------------------------------------------------------------
// 2. leavesPlay resolve（05313 / 05316）
// ---------------------------------------------------------------------------

test('P7 原语：leavesPlay 描述子允许只带 resolve，离场读点传入 api', () => {
  assert.ok(registeredEntry('05313')?.abilities.some(ability =>
    ability.kind === 'leavesPlay' && typeof ability.resolve === 'function'), '圣化之镜的离场收回走 resolve')
  assert.ok(registeredEntry('05316')?.abilities.some(ability =>
    ability.kind === 'leavesPlay' && typeof ability.resolve === 'function'), '密教辞典的离场收回走 resolve')

  const calls = []
  registerCardAbilities({
    code: '05998',
    abilities: [{
      kind: 'leavesPlay',
      label: '离场测试',
      resolve: ({ inv, api }) => {
        calls.push(inv.seat)
        api.drawCards(inv.seat, 1)
      },
    }],
  })
  const state = fixture()
  const inv = me(state)
  inv.hand = []
  const card = { id: 'synthetic-leaves-play', code: '05998', exhausted: false }
  inv.assets.push(card)

  leaveAsset(state, inv, card, [])
  assert.deepEqual(calls, [0], 'resolve 被离场读点调用一次')
  assert.equal(inv.hand.length, 1, 'resolve 内的 ctx.api 可用（抽 1 张）')
})

// ---------------------------------------------------------------------------
// 3. eventPlayed 窗口（05320）
// ---------------------------------------------------------------------------

test('P7 原语：eventPlayed 是已注册的 reaction 窗口，事件结算后可重放（05320 依赖）', () => {
  assert.equal(isKnownWindow('eventPlayed'), true)
  assert.equal(windowKind('eventPlayed'), 'reaction')
  assert.ok(registeredEntry('05320')?.abilities.some(ability =>
    ability.kind === 'reaction' && ability.trigger.includes('eventPlayed')), '超级加倍挂在 eventPlayed 上')

  const replayed = []
  registerCardAbilities({
    code: '05997',
    abilities: [{
      kind: 'reaction',
      trigger: 'eventPlayed',
      label: 'eventPlayed 测试',
      cost: { exhaust: true },
      resolve: ({ inv, context, api }) => {
        replayed.push(context.cardCode)
        api.drawCards(inv.seat, 1)
      },
    }],
  })
  const state = fixture()
  const inv = me(state)
  inv.hand = ['01088'] // 应急物品：0 费，获得 3 资源，无目标
  inv.assets.push({ id: 'synthetic-event-played', code: '05997', exhausted: false })

  move(state, { action: 'play', cardId: '01088' })
  assert.equal(state.pendingChoice?.kind, 'reaction', '事件结算后打开反应窗口')
  settle(state, pending => (pending.kind === 'reaction'
    ? pending.options.find(option => !['skip', 'done'].includes(option.id))?.id ?? null
    : null))
  assert.deepEqual(replayed, ['01088'], '窗口 context 带刚打出的事件卡号')
})

// ---------------------------------------------------------------------------
// 4. conditionalIcons（05022 / 05026 / 05030 / 05034 / 05038）
// ---------------------------------------------------------------------------

test('P7 原语：conditionalIcons 取最后一个满足条件项，把图标叠加在印刷图标上', () => {
  // 05022 坚定不移：印刷 willpower+combat 各 1；生命+神志剩余 >=5 / >=10 时追加。
  const state = fixture()
  const inv = me(state)
  inv.maxHealth = 10
  inv.maxSanity = 10
  inv.damage = 0
  inv.horror = 0
  assert.equal(commitIcons(state, inv, '05022', 'willpower'), 3, '剩余 20 时 +2 willpower')
  assert.equal(commitIcons(state, inv, '05022', 'combat'), 3)
  inv.damage = 12 // 剩余 8：>=5 但 <10
  assert.equal(commitIcons(state, inv, '05022', 'willpower'), 2)
  inv.damage = 18 // 剩余 2：低于 5
  assert.equal(commitIcons(state, inv, '05022', 'willpower'), 1)

  // 05026 好奇心：手牌 >=4 / >=7。
  const curiosity = fixture()
  const owner = me(curiosity)
  owner.hand = Array(7).fill('01016')
  assert.equal(commitIcons(curiosity, owner, '05026', 'intellect'), 3)
  owner.hand = Array(4).fill('01016')
  assert.equal(commitIcons(curiosity, owner, '05026', 'intellect'), 2)
  owner.hand = Array(3).fill('01016')
  assert.equal(commitIcons(curiosity, owner, '05026', 'intellect'), 1)

  // 05030 狡猾：资源 >=5 / >=10。
  const cunning = fixture()
  const rogue = me(cunning)
  rogue.resources = 10
  assert.equal(commitIcons(cunning, rogue, '05030', 'intellect'), 3)
  rogue.resources = 5
  assert.equal(commitIcons(cunning, rogue, '05030', 'intellect'), 2)
  rogue.resources = 4
  assert.equal(commitIcons(cunning, rogue, '05030', 'intellect'), 1)

  // 05034 预见未来：场上毁灭 >=3 / >=6（印刷 wild 1）。
  const foresight = fixture()
  const mystic = me(foresight)
  foresight.doom = 6
  assert.equal(commitIcons(foresight, mystic, '05034', 'willpower'), 3)
  foresight.doom = 3
  assert.equal(commitIcons(foresight, mystic, '05034', 'willpower'), 2)
  foresight.doom = 2
  assert.equal(commitIcons(foresight, mystic, '05034', 'willpower'), 1)

  // 05038 体格强健：控制道具 <=2 / <=1。
  const sturdy = fixture()
  const survivor = me(sturdy)
  survivor.assets = [
    { id: 'item-1', code: '05024', exhausted: false },
    { id: 'item-2', code: '05036', exhausted: false },
    { id: 'item-3', code: '05116', exhausted: false },
  ]
  assert.equal(commitIcons(sturdy, survivor, '05038', 'combat'), 1, '3 件道具不满足条件')
  survivor.assets = survivor.assets.slice(0, 2)
  assert.equal(commitIcons(sturdy, survivor, '05038', 'combat'), 2, '2 件道具 +1')
  survivor.assets = survivor.assets.slice(0, 1)
  assert.equal(commitIcons(sturdy, survivor, '05038', 'combat'), 3, '1 件道具 +2')

  // 注册期校验：未知条件 / 未知图标 / 非正整数都会被拒绝。
  assert.throws(() => registerCardAbilities({
    code: '05996',
    abilities: [{ kind: 'commit', skill: { conditionalIcons: [{ when: { unknownCondition: 1 }, icons: { willpower: 1 } }] } }],
  }), /未知条件/)
  assert.throws(() => registerCardAbilities({
    code: '05996',
    abilities: [{ kind: 'commit', skill: { conditionalIcons: [{ when: { handAtLeast: 1 }, icons: { lore: 1 } }] } }],
  }), /未知图标/)
  assert.throws(() => registerCardAbilities({
    code: '05996',
    abilities: [{ kind: 'commit', skill: { conditionalIcons: [{ when: { handAtLeast: 1 }, icons: { willpower: 0 } }] } }],
  }), /正整数/)
})
