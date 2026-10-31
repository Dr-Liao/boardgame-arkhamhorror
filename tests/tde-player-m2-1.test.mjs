// 食梦者（第五循环）M2 玩家卡 · M2-1 分片逐卡验收 —— P7。
//
// 本文件覆盖 artifacts/migration/tde/shards.json 的 M2-1 分片（22 张，06018–06110）。
// 每张卡至少一条真实行为测试，测试名以 `TDE <code> <中文名>` 开头；纯数据通道 / 显式简化的卡
// 也至少有一条可执行断言（见 P7-WORKER-BRIEF §3）。
//
// 约定：
//   · 每次 applyMove 后引擎替换调查员对象，断言前重新从 state 读取；
//   · 需要直接发起检定/伤害/窗口（不走 action 入口）时用 runTest 在规则事务里执行，
//     与 tests/tde-investigators.test.mjs 的事务外壳一致；
//   · 夹具会清空手牌/资产/牌库并给 30 资源，需要时直接改 state 准备局面。

import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture, move, asset, enemy, settle, legalMoves, validateMove } from './core-fixture.mjs'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { registeredEntry } from '../src/engine/ability.js'
import {
  applyHarm, bondedGroupOf, drawCards, getStat, lookAt, reactionWindow,
} from '../src/engine/engine.js'
import { resolveTransaction } from '../src/engine/resolution.js'

const codes = [
  '06018', '06019', '06020', '06021', '06022', '06023', '06024', '06025', '06026', '06027', '06028',
  '06029', '06030', '06031', '06032', '06033', '06034', '06035', '06036', '06037', '06038', '06110',
]
assert.equal(codes.length, 22, 'M2-1 分片固定 22 张')

const me = (state, seat = 0) => state.investigators[seat]
const choices = (pending, prefer) => {
  const found = prefer?.(pending)
  if (found != null) {
    const option = pending.options.find(item => String(item.id) === String(found))
    if (option) return option.id
  }
  return ['done', 'skip', 'self'].find(id => pending.options.some(option => option.id === id))
    ?? pending.options[0]?.id
}

// 在规则事务里执行一段直接调用引擎的代码，并把待决选择走完。
function runTest(state, execute, choose = () => null) {
  resolveTransaction(state, 0, { action: 'tdePlayerProbe' }, execute)
  for (let index = 0; state.pendingChoice && index < 120; index++) {
    const pending = state.pendingChoice
    const chosen = choose(pending)
      ?? ['done', 'skip', 'self'].find(id => pending.options.some(option => option.id === id))
      ?? pending.options[0]?.id
    assert.ok(chosen != null, `待决选择没有可选项：${JSON.stringify(pending)}`)
    resolveTransaction(state, pending.seat, { action: 'choose', choiceId: pending.id, optionId: chosen }, execute)
  }
}

// 把待决选择逐个点掉（可自定义选择）。
function resolveChoices(state, choose = () => null, limit = 120) {
  for (let index = 0; state.pendingChoice && index < limit; index++) {
    const pending = state.pendingChoice
    const chosen = choose(pending)
      ?? ['done', 'skip', 'self'].find(id => pending.options.some(option => option.id === id))
      ?? pending.options[0]?.id
    assert.ok(chosen != null, `待决选择没有可选项：${JSON.stringify(pending)}`)
    move(state, { action: 'choose', choiceId: pending.id, optionId: chosen })
  }
}

// 找一条「激活某支援能力」的合法行动。
function abilityMove(state, assetId, targetId = null) {
  return legalMoves(state).find(option => option.action === 'ability' && option.assetId === assetId
    && (targetId == null || option.targetId === targetId))
}

// study(默认地点) + 阁楼。
function twoLocations(state) {
  state.locations[0].connections = ['attic']
  state.locations.push({ id: 'attic', name: '阁楼', clues: 2, shroud: 1, connections: ['study'], revealed: true })
  return [state.locations[0], state.locations.find(location => location.id === 'attic')]
}

// ---------------------------------------------------------------------------
// 06018 渴血之刃
// ---------------------------------------------------------------------------

test('TDE 06018 渴血之刃 入场将 3 张嗜血洗入牌库；攻击按附属数加值、+1 伤害、击败放贡品', () => {
  const state = fixture('01001')
  const inv = me(state)
  inv.hand = ['06018']
  const resourcesBefore = inv.resources
  move(state, { action: 'play', cardId: '06018' })
  resolveChoices(state)
  const blade = me(state).assets.find(item => item.code === '06018')
  assert.ok(blade, '渴血之刃已装备')
  assert.equal(me(state).resources, resourcesBefore - 3, '打出费用 3 资源')
  assert.equal(me(state).deck.filter(code => code === '06019').length, 3, '额外费用：3 张嗜血洗入牌库')
  assert.equal(blade.uses, 0, '贡品从 0 开始')

  // 准备 2 张附属嗜血 + 2 点贡品；敌人 2 点生命，本次攻击应正好击败。
  const target = enemy(state, { fight: 1, evade: 1, health: 2 })
  blade.uses = 2
  blade.attachedCards = ['06019', '06019']
  state.chaosBag = ['0']
  const combatBase = getStat(state, me(state), 'combat')
  const attack = abilityMove(state, blade.id, target.id)
  assert.ok(attack, '应有攻击行动')
  move(state, attack)
  resolveChoices(state)
  assert.equal(state.lastTestResult?.value, combatBase + 2, '每附属 1 张嗜血 +1[combat]')
  assert.equal(state.lastTestResult?.success, true)
  assert.equal(state.enemies.some(item => item.id === target.id), false, '本次攻击击败了敌人')
  const after = me(state).assets.find(item => item.id === blade.id)
  assert.equal(after.uses, 3, '击败敌人后从供应堆放 1 资源作为贡品')
})

test('TDE 06018 渴血之刃 攻击时可将 1 张嗜血混洗回牌库换 +1 伤害', () => {
  const state = fixture('01001')
  const blade = asset(state, '06018', { uses: 2, attachedCards: ['06019', '06019'] })
  const target = enemy(state, { fight: 1, evade: 1, health: 6 })
  state.chaosBag = ['0']
  move(state, abilityMove(state, blade.id, target.id))
  resolveChoices(state, pending => (pending.options.some(option => option.id === 'use') ? 'use' : null))
  assert.equal(state.enemies.find(item => item.id === target.id)?.damageTaken, 3, '基础 1 + 卡面 1 + 嗜血 1')
  const after = me(state).assets.find(item => item.id === blade.id)
  assert.equal((after.attachedCards || []).filter(code => code === '06019').length, 1, '消耗 1 张附属嗜血')
  assert.ok(me(state).deck.includes('06019'), '嗜血混洗回牌库')
})

// ---------------------------------------------------------------------------
// 06019 嗜血
// ---------------------------------------------------------------------------

test('TDE 06019 嗜血 有渴血之刃时消耗 2 贡品附属；没有时受 1 恐惧并洗回牌库', () => {
  const state = fixture('01001')
  const blade = asset(state, '06018', { uses: 4 })
  const inv = me(state)
  inv.deck = ['06019']
  drawCards(state, inv, 1)
  const after = me(state)
  const bladeAfter = after.assets.find(item => item.id === blade.id)
  assert.equal(bladeAfter.uses, 2, '移除 2 点贡品')
  assert.deepEqual(bladeAfter.attachedCards, ['06019'], '嗜血附属到渴血之刃')
  assert.equal(after.discard.includes('06019'), false, '附属后不进入弃牌堆')

  // 没有渴血之刃：受到 1 点恐惧并洗回牌库。
  const bare = fixture('01001')
  bare.investigators[0].deck = ['06019']
  drawCards(bare, bare.investigators[0], 1)
  assert.equal(bare.investigators[0].horror, 1, '受到 1 点恐惧')
  assert.ok(bare.investigators[0].deck.includes('06019'), '洗回牌库')
})

// ---------------------------------------------------------------------------
// 06020 庄严立誓
// ---------------------------------------------------------------------------

test('TDE 06020 庄严立誓 置于同地点另一位调查员控制之下，并可在双方卡牌间移动 1 点伤害', () => {
  const state = fixture('01001', 2)
  state.humanSeats = [0, 1]
  me(state).hand = ['06020']
  move(state, { action: 'play', cardId: '06020' })
  resolveChoices(state, pending => pending.options.find(option => option.id === 'seat:1')?.id ?? null)
  const host = me(state, 1)
  const vow = host.assets.find(item => item.code === '06020')
  assert.ok(vow, '置于另一位调查员控制之下')
  assert.equal(me(state, 0).assets.some(item => item.code === '06020'), false, '不在打出者的支援区')
  assert.deepEqual(vow.statOverride, ['solemnVowOwner:0'], '记录所有者座位')

  // 控制者（座位 1）用能力：把其支援上的 1 点伤害移到所有者（座位 0）的支援上。
  state.currentSeat = 1
  const damaged = asset(state, '01072', { damage: 1 }, 1)
  const target = asset(state, '01072', {}, 0)
  move(state, abilityMove(state, vow.id))
  resolveChoices(state, pending => {
    if (pending.kind !== 'target') return null
    // 目的地：「该调查员控制的一张卡」——选择其支援（皮大衣）而不是调查员本人。
    const card = pending.options.find(option => /皮大衣/.test(String(option.label)))
    return card ? card.id : null
  })
  // 事务会替换实例对象，断言前重新读取。
  const damagedAfter = me(state, 1).assets.find(item => item.id === damaged.id)
  const targetAfter = me(state, 0).assets.find(item => item.id === target.id)
  assert.equal(damagedAfter.damage || 0, 0, '移动后源卡伤害清零')
  assert.equal(targetAfter.damage, 1, '目标卡获得 1 点伤害')

  // 单人时不能打出。
  const solo = fixture('01001')
  solo.investigators[0].hand = ['06020']
  assert.match(String(validateMove(solo, 0, { action: 'play', cardId: '06020' })), /没有其他调查员/)
})

// ---------------------------------------------------------------------------
// 06021 一瓣缟玛瑙 / 06022 皇后的挂坠
// ---------------------------------------------------------------------------

test('TDE 06021 一瓣缟玛瑙 3 张在场时放在一边并找出皇后的挂坠放置入场', () => {
  const state = fixture('01001')
  for (let index = 0; index < 3; index++) asset(state, '06021')
  const first = me(state).assets[0]
  move(state, abilityMove(state, first.id))
  resolveChoices(state)
  const inv = me(state)
  assert.equal(inv.assets.filter(item => item.code === '06021').length, 0, '3 张一瓣缟玛瑙离场')
  assert.equal((state.setAside || []).filter(code => code === '06021').length, 3, '放在一边，位于场外')
  assert.ok(inv.assets.some(item => item.code === '06022'), '皇后的挂坠放置入场')
  assert.equal((state.bondedSets?.['06021']?.cards || []).length, 0, '绑定检索已取走副本')
})

test('TDE 06022 皇后的挂坠 花 1 充能选择已揭示地点：发现线索 / 充能耗尽复位', () => {
  const state = fixture('01001')
  const [study, attic] = twoLocations(state)
  study.clues = 0
  attic.clues = 1
  const pendant = asset(state, '06022')
  assert.equal(pendant.uses, 3, '使用(3 充能)')
  move(state, abilityMove(state, pendant.id))
  resolveChoices(state, pending => {
    if (pending.options.some(option => option.id === 'attic')) return 'attic'
    if (pending.options.some(option => option.id === 'clue')) return 'clue'
    return null
  })
  assert.equal(me(state).clues, 1, '发现该地点的 1 个线索')
  assert.equal(me(state).assets.find(item => item.id === pendant.id).uses, 2, '花费 1 充能')

  // 花掉最后 1 充能：挂坠放到一边，3 张一瓣缟玛瑙洗回牌库。
  const last = me(state).assets.find(item => item.id === pendant.id)
  last.uses = 1
  last.exhausted = false
  state.setAside = ['06021', '06021', '06021']
  state.currentSeat = 0
  move(state, abilityMove(state, last.id))
  resolveChoices(state, pending => (pending.options.some(option => option.id === 'move') ? 'move' : null))
  assert.equal(me(state).assets.some(item => item.code === '06022'), false, '充能耗尽后放在一边')
  assert.ok((state.setAside || []).includes('06022'), '挂坠进入放在一边区')
  assert.equal(me(state).deck.filter(code => code === '06021').length, 3, '3 张一瓣缟玛瑙洗回牌库')
})

// ---------------------------------------------------------------------------
// 06023 骇人真相
// ---------------------------------------------------------------------------

test('TDE 06023 骇人真相 不能打出；查找牌库发现时弃掉自己', () => {
  const state = fixture('01001')
  const inv = me(state)
  inv.deck = ['06023', '01088', '01089']
  inv.hand = ['06023']
  assert.match(String(validateMove(state, 0, { action: 'play', cardId: '06023' })), /不能打出/)
  let offered = false
  runTest(state, draft => {
    lookAt(draft, 0, { zone: 'deck', count: 3, choose: 0, returnStrategy: 'top', source: 'test' })
  }, pending => {
    if (pending.kind === 'reaction' && pending.source === '06023') { offered = true; return 'trigger' }
    return null
  })
  assert.equal(offered, true, '查找窗口询问是否结算「骇人真相」')
  assert.ok(me(state).discard.includes('06023'), '被发现时弃掉')
})

// ---------------------------------------------------------------------------
// 06024 梦境结晶器 / 06025 结晶器守卫
// ---------------------------------------------------------------------------

test('TDE 06024 梦境结晶器 入场检索结晶器守卫；打出事件后改为附属到它上面', () => {
  const state = fixture('01001')
  const inv = me(state)
  inv.hand = ['06024']
  move(state, { action: 'play', cardId: '06024' })
  resolveChoices(state)
  const host = me(state).assets.find(item => item.code === '06024')
  assert.ok(host, '梦境结晶器已装备')
  assert.ok(me(state).deck.includes('06025'), '额外费用：1 张结晶器守卫洗入牌库')

  me(state).hand = ['01064'] // 飞蛾扑火（事件）
  me(state).encounterDeck = []
  state.locations[0].clues = 2
  move(state, { action: 'play', cardId: '01064' })
  resolveChoices(state, pending => {
    if (pending.kind === 'reaction') {
      // 能力层询问的选项是描述子 id（不是 trigger），选择「梦境结晶器」的反应。
      const ability = pending.options.find(option => /梦境结晶器/.test(String(option.label)))
      if (ability) return ability.id
    }
    return null
  })
  const after = me(state).assets.find(item => item.id === host.id)
  assert.equal((after.attachments || []).some(item => item.code === '01064'), true, '打出的事件正面朝下附属到结晶器')
  assert.equal(me(state).discard.includes('01064'), false, '不进入弃牌堆')
})

test('TDE 06025 结晶器守卫 无梦境结晶器时移出对局；有则横置入场并成为 bearer 猎物', () => {
  const bare = fixture('01001')
  bare.investigators[0].deck = ['06025']
  drawCards(bare, bare.investigators[0], 1)
  assert.equal(bare.enemies.some(item => item.code === '06025'), false, '没有梦境结晶器：移出对局')

  const state = fixture('01001')
  asset(state, '06024')
  state.investigators[0].deck = ['06025']
  drawCards(state, state.investigators[0], 1)
  const guardian = state.enemies.find(item => item.code === '06025')
  assert.ok(guardian, '有梦境结晶器：生成结晶器守卫')
  assert.equal(guardian.exhausted, true, '以横置状态入场')
  assert.equal(guardian.hunter, true, '猎手')
  assert.equal(guardian.prey, 'bearer', '猎物 - 仅对承受者')
  assert.equal(guardian.bearerSeat, 0, '承受者为抽到它的调查员')
})

// ---------------------------------------------------------------------------
// 06026 冤大头
// ---------------------------------------------------------------------------

test('TDE 06026 冤大头 获得 2 资源并抽 1 张；可从手牌免费再打一张', () => {
  const state = fixture('01001')
  const inv = me(state)
  inv.hand = ['06026', '06026']
  inv.resources = 5
  move(state, { action: 'play', cardId: '06026' })
  resolveChoices(state, pending => (pending.options.some(option => option.id === 'play') ? 'play' : null))
  const after = me(state)
  assert.equal(after.resources, 9, '两张冤大头各获得 2 资源（费用 0）')
  assert.equal(after.discard.filter(code => code === '06026').length, 2, '两张都已结算进弃牌堆')
  assert.equal(after.hand.includes('06026'), false, '手牌中的第二张已被免费打出')
})

// ---------------------------------------------------------------------------
// 06027 仰望星空 / 06028 群星正确之时
// ---------------------------------------------------------------------------

test('TDE 06027 仰望星空 遭遇牌库≥10 才能打出；把群星正确之时洗入遭遇牌库', () => {
  const state = fixture('01001')
  me(state).hand = ['06027']
  me(state).encounterDeck = Array(20).fill('dissonantVoices')
  assert.equal(validateMove(state, 0, { action: 'play', cardId: '06027' }), null)
  move(state, { action: 'play', cardId: '06027' })
  const inv = me(state)
  assert.ok(state.encounterDeck.includes('06028'), '群星正确之时洗入遭遇牌库')
  assert.ok(inv.discard.includes('06027'), '事件结算后进入弃牌堆')

  const few = fixture('01001')
  few.investigators[0].hand = ['06027']
  few.encounterDeck = Array(5).fill('dissonantVoices')
  assert.match(String(validateMove(few, 0, { action: 'play', cardId: '06027' })), /少于 10 张/)
})

test('TDE 06028 群星正确之时 绑定关系为仰望星空；显现：选一位调查员抽 1 张、获得 1 资源并移出游戏', () => {
  const group = bondedGroupOf('06028')
  assert.equal(group?.main, '06027', '绑定主卡为仰望星空')
  assert.deepEqual(group?.copies, [{ code: '06028', count: 1 }], '绑定副本为群星正确之时 1 张')

  const state = fixture('01001')
  const inv = me(state)
  inv.hand = ['06028']
  inv.deck = ['01088']
  inv.resources = 5
  inv.actionsLeft = 5
  move(state, { action: 'play', cardId: '06028' })
  resolveChoices(state)
  const after = me(state)
  assert.equal(after.resources, 6, '获得 1 资源')
  assert.ok(after.hand.includes('01088'), '抽取 1 张牌')
  assert.equal(state.removedFromGame?.includes('06028'), true, '显现后移出游戏')
})

// ---------------------------------------------------------------------------
// 06029 开启大门
// ---------------------------------------------------------------------------

test('TDE 06029 开启大门 快速附属到所在地点；团队 3 张后不能再打出', () => {
  const state = fixture('01001')
  const inv = me(state)
  inv.hand = ['06029']
  move(state, { action: 'play', cardId: '06029' })
  resolveChoices(state)
  const attachments = (state.playerLocationAttachments || []).filter(item => item.code === '06029')
  assert.equal(attachments.length, 1, '附属到你所在地点')
  assert.equal(attachments[0].location, inv.location, '附属地点为你所在地点')
  assert.equal(me(state).discard.includes('06029'), false, '不进入弃牌堆（keepOnPlay）')

  // 打到团队第 3 张后，第 4 张不能打出。
  for (let index = 0; index < 2; index++) {
    me(state).hand = ['06029']
    move(state, { action: 'play', cardId: '06029' })
    resolveChoices(state)
  }
  assert.equal((state.playerLocationAttachments || []).filter(item => item.code === '06029').length, 3)
  me(state).hand = ['06029']
  assert.match(String(validateMove(state, 0, { action: 'play', cardId: '06029' })), /3 张「开启大门」/)
})

// ---------------------------------------------------------------------------
// 06030–06033 道尔女士 / 希望 / 热诚 / 预见
// ---------------------------------------------------------------------------

test('TDE 06030 道尔女士 入场随机放置 1 张绑定支援入场，其余 2 张进弃牌堆；离场全部放在一边', () => {
  const state = fixture('01001')
  me(state).hand = ['06030']
  move(state, { action: 'play', cardId: '06030' })
  resolveChoices(state)
  const inv = me(state)
  const allies = inv.assets.filter(item => ['06031', '06032', '06033'].includes(item.code))
  assert.equal(allies.length, 1, '随机 1 张放置入场')
  assert.equal(inv.discard.filter(code => ['06031', '06032', '06033'].includes(code)).length, 2, '其余 2 张被入场支援的强制效果弃掉')
  assert.equal(inv.deck.some(code => ['06031', '06032', '06033'].includes(code)), false, '牌库里没有残留')
  const chosen = allies[0].code

  // 离场：三张绑定支援（含在场的那张）收回场外集合。
  const doyle = me(state).assets.find(item => item.code === '06030')
  me(state).hand = []
  runTest(state, draft => {
    const owner = draft.investigators[0]
    const entry = registeredEntry('06030')
    const leaving = owner.assets.find(item => item.code === '06030')
    owner.assets.splice(owner.assets.indexOf(leaving), 1)
    const descriptor = entry.abilities.find(item => item.kind === 'leavesPlay')
    const api = {
      bonded: {
        return: (seat, mainCode) => {
          const set = draft.bondedSets?.[mainCode]
          if (!set) return []
          const collected = []
          for (const owner2 of draft.investigators) {
            for (const list of [owner2.hand, owner2.deck, owner2.discard]) {
              for (let i = list.length - 1; i >= 0; i--) {
                if (['06031', '06032', '06033'].includes(list[i])) { collected.push(list.splice(i, 1)[0]) }
              }
            }
            for (const card of owner2.assets.slice()) {
              if (['06031', '06032', '06033'].includes(card.code)) { owner2.assets.splice(owner2.assets.indexOf(card), 1); collected.push(card.code) }
            }
          }
          set.cards.push(...collected)
          return collected
        },
      },
      info: () => {},
    }
    descriptor.resolve({ state: draft, inv: owner, source: { code: '06030', id: 'doyle' }, api })
  })
  assert.ok((state.bondedSets?.['06030']?.cards || []).includes(chosen), '离场时在场的支援收回场外集合')
  assert.equal(state.bondedSets['06030'].cards.length, 3, '三张全部收回场外集合')
})

test('TDE 06031 希望 横置：以基础敏捷 5 躲避与你交战的敌人', () => {
  const state = fixture('01001')
  const hope = asset(state, '06031')
  const target = enemy(state, { fight: 3, evade: 3, health: 6 })
  state.chaosBag = ['0']
  move(state, abilityMove(state, hope.id, target.id))
  resolveChoices(state, pending => (pending.options.some(option => option.id === 'exhaust') ? 'exhaust' : null))
  assert.equal(state.enemies.find(item => item.id === target.id)?.exhausted, true, '躲避成功：敌人横置')
  assert.equal(me(state).assets.find(item => item.id === hope.id).exhausted, true, '希望横置（费用）')
  assert.equal(me(state).assets.find(item => item.id === hope.id).code, '06031', '希望仍在场')
})

test('TDE 06032 热诚 横置：以基础战斗 5 攻击同地点的敌人', () => {
  const state = fixture('01001')
  const zeal = asset(state, '06032')
  const target = enemy(state, { fight: 1, evade: 1, health: 6 })
  state.chaosBag = ['0']
  move(state, abilityMove(state, zeal.id, target.id))
  resolveChoices(state, pending => (pending.options.some(option => option.id === 'exhaust') ? 'exhaust' : null))
  assert.equal(state.enemies.find(item => item.id === target.id)?.damageTaken, 1, '攻击成功造成 1 点伤害')
  assert.equal(me(state).assets.find(item => item.id === zeal.id).exhausted, true, '热诚横置（费用）')
})

test('TDE 06033 预见 横置：以基础智识 5 调查并发现线索', () => {
  const state = fixture('01001')
  const augur = asset(state, '06033')
  state.locations[0].clues = 1
  state.locations[0].shroud = 2
  state.chaosBag = ['0']
  move(state, abilityMove(state, augur.id))
  resolveChoices(state, pending => (pending.options.some(option => option.id === 'exhaust') ? 'exhaust' : null))
  assert.equal(me(state).clues, 1, '调查成功发现 1 个线索')
  assert.equal(me(state).assets.find(item => item.id === augur.id).exhausted, true, '预见横置（费用）')
})

// ---------------------------------------------------------------------------
// 06034 意外的发现
// ---------------------------------------------------------------------------

test('TDE 06034 意外的发现 X=弃牌堆同名张数：调查 +X 智识，成功发现 X 个额外线索', () => {
  const state = fixture('01001')
  const inv = me(state)
  inv.discard = ['06034', '06034']
  inv.hand = ['06034']
  state.locations[0].clues = 3
  state.locations[0].shroud = 0
  state.chaosBag = ['0']
  const intellect = getStat(state, inv, 'intellect')
  move(state, { action: 'play', cardId: '06034' })
  resolveChoices(state)
  assert.equal(state.lastTestResult?.value, intellect + 2, '本次调查 +X[intellect]（X=2）')
  assert.equal(state.lastTestResult?.success, true)
  assert.equal(me(state).clues, 3, '基础 1 + 额外 X=2 个线索')
  assert.equal(state.locations[0].clues, 0)
})

// ---------------------------------------------------------------------------
// 06035 自私自利 / 06036 偷窃癖 / 06037 嗜睡症 / 06038 最可怕的噩梦（基础弱点）
// ---------------------------------------------------------------------------

test('TDE 06035 自私自利 显现进入威胁区域，花费 2 行动弃掉', () => {
  const state = fixture('01001')
  const inv = me(state)
  inv.deck = ['06035']
  drawCards(state, inv, 1)
  const threat = me(state).threat.find(item => item.code === '06035')
  assert.ok(threat, '显现后进入威胁区域')
  const actionsBefore = me(state).actionsLeft
  move(state, { action: 'discardThreat', threatId: threat.id })
  assert.equal(me(state).actionsLeft, actionsBefore - 2, '[action][action]：花 2 行动')
  assert.equal(me(state).threat.some(item => item.code === '06035'), false)
  assert.ok(me(state).discard.includes('06035'))
})

test('TDE 06036 偷窃癖 放置入场后夺取同地点另一位调查员的资源并洗回牌库', () => {
  const state = fixture('01001', 2)
  state.humanSeats = [0, 1]
  const inv = me(state)
  inv.deck = ['06036']
  drawCards(state, inv, 1)
  const klepto = me(state).assets.find(item => item.code === '06036')
  assert.ok(klepto, '显现后放置入场（游戏区域）')
  me(state, 1).resources = 5
  inv.actionsLeft = 5
  state.currentSeat = 0
  move(state, abilityMove(state, klepto.id))
  resolveChoices(state, pending => pending.options.find(option => String(option.id).startsWith('resource:'))?.id ?? null)
  assert.equal(me(state, 1).resources, 3, '夺取 2 资源')
  assert.equal(me(state).assets.some(item => item.code === '06036'), false, '然后洗回牌库（离场）')
  assert.ok(me(state).deck.includes('06036'), '偷窃癖进入牌库')
})

test('TDE 06037 嗜睡症 威胁区：不能打出事件/进行调查，受到伤害后弃掉', () => {
  const state = fixture('01001')
  const inv = me(state)
  inv.deck = ['06037']
  drawCards(state, inv, 1)
  assert.ok(me(state).threat.some(item => item.code === '06037'), '显现后进入威胁区域')
  me(state).hand = ['01064']
  assert.match(String(validateMove(state, 0, { action: 'play', cardId: '01064' })), /禁止/)
  assert.match(String(validateMove(state, 0, { action: 'investigate' })), /禁止/)

  // 强制：受到 1 点伤害后弃掉嗜睡症（harmDealt 窗口）。
  runTest(state, draft => { applyHarm(draft, draft.investigators[0], 1, 0, []) })
  assert.equal(me(state).threat.some(item => item.code === '06037'), false, '受到伤害后弃掉')
  assert.ok(me(state).discard.includes('06037'))
})

test('TDE 06038 最可怕的噩梦 显现生成敌人：猎手、猎物仅对承受者', () => {
  const state = fixture('01001')
  const inv = me(state)
  inv.deck = ['06038']
  drawCards(state, inv, 1)
  const nightmare = state.enemies.find(item => item.code === '06038')
  assert.ok(nightmare, '显现后生成最可怕的噩梦')
  assert.equal(nightmare.hunter, true, '猎手')
  assert.equal(nightmare.prey, 'bearer', '猎物 - 仅对承受者')
  assert.equal(nightmare.bearerSeat, 0, '承受者为抽到它的调查员')
  assert.equal(registeredEntry('06038').enemyWeakness.hunter, true, '关键词来自条目 enemyWeakness')
})

// ---------------------------------------------------------------------------
// 06110 头班守夜
// ---------------------------------------------------------------------------

test('TDE 06110 头班守夜 神话阶段开始时的快速事件：查看遭遇牌库顶 X 张并重新排列', () => {
  const state = fixture('01001')
  const inv = me(state)
  inv.hand = ['06110']
  inv.resources = 5
  state.phase = 'mythos'
  state.encounterDeck = ['dissonantVoices', 'dissonantVoices', 'dissonantVoices']
  let offered = false
  runTest(state, draft => {
    reactionWindow(draft, 'phaseBegins', { when: 'phaseBegins', prompt: '阶段开始' }, [])
  }, pending => {
    const card = pending.options.find(option => option.cardCode === '06110')
    if (card) { offered = true; return card.id }
    return null
  })
  assert.equal(offered, true, '神话阶段开始时的反应窗口提供「头班守夜」')
  assert.ok(me(state).discard.includes('06110'), '快速事件结算后进弃牌堆')
  assert.equal(state.encounterDeck.length, 3, '遭遇牌库张数不变（查看+排列，不替换抽牌步骤）')
})

// ---------------------------------------------------------------------------
// 分片完整性守卫（不属于逐卡证据，只防止漏文件）
// ---------------------------------------------------------------------------

test('TDE M2-1 分片 22 张条目全部注册且 code 与文件名一致', () => {
  for (const code of codes) {
    const entry = registeredEntry(code)
    assert.ok(entry, `${code} 未注册（entries/index.js 需要重建）`)
    assert.equal(entry.code, code)
  }
  for (const code of ['06028']) {
    const card = ALL_CARDS[code]
    assert.ok(card, `${code} 在卡表中`)
  }
})
