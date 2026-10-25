// 万象无终（第四循环）M2 玩家卡 · M2-4 逐卡验收 —— P7。
//
// 分片：05275–05283、05313–05324（21 张）。
// 约定：每张卡至少一条以 `TCU <code> <中文名>` 开头的真实行为测试；账本按这个前缀收集证据。
// 测试只走公开读点（core-fixture、engine.js、resolution.js、campaign.js），不 import 卡文件。

import test from 'node:test'
import assert from 'node:assert/strict'

import { fixture, move, settle, asset, enemy, validateMove, legalMoves } from './core-fixture.mjs'
import {
  applyHarm, baseStatValue, createGameState, enemyEvadeValue, enemyFightValue, enemyHealth, getHandSize, getStat,
  performTest, reactionWindow, returnAssetToHand,
} from '../src/engine/engine.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { expireEffects } from '../src/engine/effect-state.js'
import { tarotSlotCapacity } from '../src/engine/tarot-slot.js'
import { campaignCardChange } from '../src/campaign/campaign.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'

const codes = [
  '05275', '05276', '05277', '05278', '05279', '05280', '05281', '05282', '05283',
  '05313', '05314', '05315', '05316', '05317', '05318', '05319', '05320', '05321',
  '05322', '05323', '05324',
]
assert.equal(codes.length, 21)

const me = state => state.investigators[0]
const nameOf = code => ALL_CARDS[code].nameZh || ALL_CARDS[code].name

// 在事务里跑一段会触发选择的结算，直到不再有待决选择。
function run(state, fn, choose) {
  const execute = current => fn(current)
  resolveTransaction(state, 0, { action: 'tcuPlayerM24Test' }, execute)
  for (let guard = 0; state.pendingChoice; guard++) {
    assert.ok(guard < 120, `Choice loop: ${state.pendingChoice.kind}`)
    const pending = state.pendingChoice
    const optionId = choose?.(pending, state)
      ?? ['done', 'skip', 'self', 'normal'].find(id => pending.options.some(option => option.id === id))
      ?? pending.options[0].id
    resolveTransaction(state, pending.seat, { action: 'choose', choiceId: pending.id, optionId }, execute)
  }
}

// 走真实的开局通道（hub）：把永久卡/开局卡塞进战役牌组，进入剧本看它们的效果。
function startWithCards(cardCodes, { investigator = '01001', seed = 'tcu-m2-4' } = {}) {
  const state = createGameState({ campaignHub: true, seed }, [{ seat: 0, role: 'human' }])
  move(state, { action: 'hubGoSetup' })
  move(state, { action: 'hubSelectInvestigator', code: investigator })
  move(state, { action: 'hubAutoDeck' })
  for (const code of cardCodes) campaignCardChange(state.campaign, 0, code, 'add', 'tcu-m2-4-test')
  move(state, { action: 'hubDoneSeat' })
  move(state, { action: 'hubBeginScenario' })
  settle(state)
  return state
}

// 一条连接地点：study ↔ hallway（可按需继续接 attic）。
function addConnections(state, extra = []) {
  for (const location of extra) state.locations.push(location)
  return state
}

// ---------------------------------------------------------------------------
// 05275 恐怖揭露
// ---------------------------------------------------------------------------

test(`TCU 05275 ${nameOf('05275')} 发现 3 线索后自我击败并受 1 点精神创伤`, () => {
  const state = fixture('01001', 2)
  const inv = me(state)
  state.locations[0].clues = 3
  inv.hand = ['05275']
  move(state, { action: 'play', cardId: '05275' })
  settle(state, pending => {
    if (pending.kind === 'effect' && pending.options.some(option => option.id === 'done')) return 'done'
    if (pending.kind === 'target') return pending.options[0].id
    if (pending.kind === 'resource') return pending.options.at(-1).id
    return null
  })
  assert.equal(me(state).defeated, true, '打出后被击败')
  assert.equal(me(state).defeatCause, 'card', '被击败原因记为卡牌效果（不是因伤害/恐惧）')
  assert.equal(state.locations[0].clues, 3, '被击败后，身上的 3 个线索按消除规则放回地点')
  assert.equal(state.campaign.trauma[0].mental, 1, '承受 1 点精神创伤')
  assert.equal(state.campaign.trauma[0].physical, 0, '没有伤害/恐惧创伤（关末 applyDefeatTrauma 只结算 damage/horror/both）')
})

test(`TCU 05275 ${nameOf('05275')} 可把线索交给另一位调查员`, () => {
  const state = fixture('01001', 2)
  const inv = me(state)
  state.locations[0].clues = 3
  inv.hand = ['05275']
  move(state, { action: 'play', cardId: '05275' })
  settle(state, pending => {
    if (pending.kind === 'effect' && pending.options.some(option => option.id === 'give')) return 'give'
    if (pending.kind === 'target') return pending.options[0].id
    if (pending.kind === 'resource') return '2'
    return null
  })
  assert.equal(state.investigators[1].clues, 2, '交给另一位调查员 2 个线索')
  assert.equal(state.locations[0].clues, 1, '被击败后自己留的 1 个线索按消除规则放回地点')
})

test(`TCU 05275 ${nameOf('05275')} 修复：把线索放到地点不改变地点 maxClues`, () => {
  const state = fixture('01001', 2)
  const inv = me(state)
  state.locations[0].clues = 3
  const maxCluesBefore = state.locations[0].maxClues
  inv.hand = ['05275']
  move(state, { action: 'play', cardId: '05275' })
  settle(state, pending => {
    if (pending.kind === 'effect' && pending.options.some(option => option.id === 'place')) return 'place'
    if (pending.kind === 'target') return pending.options[0].id
    if (pending.kind === 'resource') return '1'
    return null
  })
  assert.equal(state.locations[0].maxClues, maxCluesBefore, '放置线索不再抬高 maxClues（非卡面规则）')
})

test(`TCU 05275 ${nameOf('05275')} 最后一名存活调查员：结算中断也不补肉体创伤，只结算 1 点精神创伤`, () => {
  // 单人局：lethalSelfDamage 触发 checkDefeated→checkOutcome→finishScenario（抛 ScenarioEnded），
  // 后面的语句不会执行。条目已把「defeatCause='card' + 1 点精神创伤」提前记账，结局不得按肉体伤害补创伤。
  const state = fixture('01001', 1)
  state.locations[0].clues = 3
  me(state).hand = ['05275']
  move(state, { action: 'play', cardId: '05275' })
  settle(state, pending => (pending.kind === 'effect' ? 'done' : null))
  // 单人局被击败 → 剧本立即结算并进入下一关；击败与创伤记录在 campaign.scenarioResults 里。
  const result = state.campaign.scenarioResults[0]
  assert.ok(result, '剧本已按「最后一名调查员被击败」结算')
  const record = result.investigators[0]
  assert.equal(record.defeated, true, '最后一名存活者被击败')
  assert.deepEqual(record.traumaAfter, { physical: 0, mental: 1 },
    '结局补算时 defeatCause 保留为 card：只结算 1 点精神创伤、不补肉体创伤')
  assert.equal(state.campaign.trauma[0].mental, 1)
  assert.equal(state.campaign.trauma[0].physical, 0)
})

// ---------------------------------------------------------------------------
// 05277 帮个小忙
// ---------------------------------------------------------------------------

test(`TCU 05277 ${nameOf('05277')} 对所在地点非精英敌人造成 1 点伤害`, () => {
  const state = fixture('01001')
  const target = enemy(state, { fight: 2, evade: 2, health: 5, damageTaken: 0 })
  me(state).hand = ['05277']
  move(state, { action: 'play', cardId: '05277' })
  settle(state)
  assert.equal(state.enemies.find(item => item.id === target.id).damageTaken, 1)
  assert.equal(me(state).resources, 28, '打出费用 2')
  assert.ok(me(state).discard.includes('05277'))
})

test(`TCU 05277 ${nameOf('05277')} 额外付 2 费改成 2 点伤害`, () => {
  const state = fixture('01001')
  const target = enemy(state, { fight: 2, evade: 2, health: 5, damageTaken: 0 })
  me(state).hand = ['05277']
  move(state, { action: 'play', cardId: '05277' })
  settle(state, pending => pending.kind === 'reaction'
    ? (pending.options.find(option => (option.label || '').includes('造成 2 点伤害'))?.id ?? null) : null)
  assert.equal(state.enemies.find(item => item.id === target.id).damageTaken, 2)
  assert.equal(me(state).resources, 26, '打出费用 2 + 额外 2')
})

test(`TCU 05277 ${nameOf('05277')} 额外付 2 费可指向连接 2 次内的地点`, () => {
  const state = fixture('01001')
  addConnections(state, [
    { id: 'hallway', name: '走廊', connections: ['study', 'attic'], clues: 0, revealed: true },
    { id: 'attic', name: '阁楼', connections: ['hallway'], clues: 0, revealed: true },
  ])
  state.locations[0].connections = ['hallway']
  const far = enemy(state, { location: 'attic', fight: 2, evade: 2, health: 5, damageTaken: 0 })
  me(state).hand = ['05277']
  move(state, { action: 'play', cardId: '05277' })
  settle(state, pending => pending.kind === 'reaction'
    ? (pending.options.find(option => (option.label || '').includes('2 次连接内的地点'))?.id ?? null) : null)
  assert.equal(state.enemies.find(item => item.id === far.id).damageTaken, 1, '连接 2 次内的敌人被命中')
})

test(`TCU 05277 ${nameOf('05277')} 修复：范围模式不含自身地点；没有可伤害目标时打不出`, () => {
  // 范围内（1–2 连接）有敌人：范围模式不应把「自身地点」算进范围——
  // 只放一个「本地」敌人时，本模式没有合法目标，可选模式只剩基础模式。
  const state = fixture('01001')
  addConnections(state, [
    { id: 'hallway', name: '走廊', connections: ['study', 'attic'], clues: 0, revealed: true },
    { id: 'attic', name: '阁楼', connections: ['hallway'], clues: 0, revealed: true },
  ])
  state.locations[0].connections = ['hallway']
  const local = enemy(state, { id: 'local-only', fight: 2, evade: 2, health: 5, damageTaken: 0 })
  me(state).hand = ['05277']
  move(state, { action: 'play', cardId: '05277' })
  settle(state)
  assert.equal(state.enemies.find(item => item.id === local.id).damageTaken, 1, '基础模式打本地敌人')

  // 完全没有非精英敌人：打出被拒绝。
  const bare = fixture('01001')
  me(bare).hand = ['05277']
  assert.match(String(validateMove(bare, 0, { action: 'play', cardId: '05277' })), /非\[\[精英\]\]敌人|不能打出/,
    '没有合法目标时不能打出「帮个小忙」')

  // 只剩范围模式时必须付得起「基础 2 + 提升费用 2」：资源 3 时打不出，资源 4 才能打出。
  const nearOnly = fixture('01001')
  addConnections(nearOnly, [
    { id: 'hallway', name: '走廊', connections: ['study', 'attic'], clues: 0, revealed: true },
    { id: 'attic', name: '阁楼', connections: ['hallway'], clues: 0, revealed: true },
  ])
  nearOnly.locations[0].connections = ['hallway']
  enemy(nearOnly, { location: 'attic', fight: 2, evade: 2, health: 5 })
  me(nearOnly).hand = ['05277']
  me(nearOnly).resources = 3
  assert.match(String(validateMove(nearOnly, 0, { action: 'play', cardId: '05277' })), /资源不足 4|不能打出/,
    '只剩范围模式时资源不足 4 不能打出')
  me(nearOnly).resources = 4
  assert.equal(validateMove(nearOnly, 0, { action: 'play', cardId: '05277' }), null,
    '资源 4 时范围模式可以打出')
})

// ---------------------------------------------------------------------------
// 05279 黛雅娜·艾丝帕伦斯
// ---------------------------------------------------------------------------

test(`TCU 05279 ${nameOf('05279')} 把手牌中的法术事件附属到自身`, () => {
  const state = fixture('01001')
  const inv = me(state)
  const dayana = asset(state, '05279')
  inv.hand = ['05314']
  move(state, { action: 'ability', assetId: dayana.id, abilityIndex: 0, targetId: '05314' })
  const current = state.investigators[0].assets.find(item => item.id === dayana.id)
  assert.deepEqual(current.attachments.map(entry => entry.code), ['05314'], '05314 附属在黛雅娜身上')
  assert.ok(!me(state).hand.includes('05314'), '事件离开手牌')
})

test(`TCU 05279 ${nameOf('05279')} 附属事件可如同手牌打出（横置+1秘密，打出后仍附属）`, () => {
  const state = fixture('01001')
  const inv = me(state)
  const dayana = asset(state, '05279')
  inv.hand = ['05314']
  inv.damage = 2
  inv.deck = ['01088', '01088', '01088']
  move(state, { action: 'ability', assetId: dayana.id, abilityIndex: 0, targetId: '05314' })
  settle(state)
  const host = () => state.investigators[0].assets.find(item => item.id === dayana.id)
  const playMove = legalMoves(state).find(item => item.action === 'play'
    && item.cardId === '05314' && item.fromAttachedEventOf === dayana.id)
  assert.ok(playMove, '附属事件出现在合法打出列表（如同其在你手牌中）')
  move(state, playMove)
  settle(state, pending => {
    if (pending.kind !== 'heal') return null
    const option = pending.options.find(item => String(item.id).startsWith('dmg:'))
    return option?.id ?? 'done'
  })
  assert.equal(host().uses, 2, '额外费用：花费 1 秘密（3→2）')
  assert.equal(host().exhausted, true, '额外费用：横置黛雅娜')
  assert.equal(me(state).damage, 0, '附属的舒缓旋律真实结算（治愈 2 点伤害）')
  assert.deepEqual(host().attachments.map(entry => entry.code), ['05314'], '打出后事件仍附属在原处')
  assert.ok(!me(state).discard.includes('05314'), '事件不放进弃牌堆')
})

test(`TCU 05279 ${nameOf('05279')} 宿主已横置或没有秘密时打不出附属事件`, () => {
  const exhaustedState = fixture('01001')
  const exhaustedInv = me(exhaustedState)
  const exhaustedHost = asset(exhaustedState, '05279')
  exhaustedInv.hand = ['05314']
  move(exhaustedState, { action: 'ability', assetId: exhaustedHost.id, abilityIndex: 0, targetId: '05314' })
  settle(exhaustedState)
  exhaustedState.investigators[0].assets.find(item => item.id === exhaustedHost.id).exhausted = true
  const exhaustedMove = { action: 'play', cardId: '05314', fromAttachedEventOf: exhaustedHost.id }
  assert.equal(legalMoves(exhaustedState).some(item => item.action === 'play'
    && item.cardId === '05314' && item.fromAttachedEventOf === exhaustedHost.id), false, '宿主横置时无候选')
  assert.match(String(validateMove(exhaustedState, 0, exhaustedMove) || ''), /宿主已横置/, 'validateMove 报宿主已横置')

  const noSecretsState = fixture('01001')
  const noSecretsInv = me(noSecretsState)
  const noSecretsHost = asset(noSecretsState, '05279')
  noSecretsInv.hand = ['05314']
  move(noSecretsState, { action: 'ability', assetId: noSecretsHost.id, abilityIndex: 0, targetId: '05314' })
  settle(noSecretsState)
  noSecretsState.investigators[0].assets.find(item => item.id === noSecretsHost.id).uses = 0
  const noSecretsMove = { action: 'play', cardId: '05314', fromAttachedEventOf: noSecretsHost.id }
  assert.equal(legalMoves(noSecretsState).some(item => item.action === 'play'
    && item.cardId === '05314' && item.fromAttachedEventOf === noSecretsHost.id), false, '没有秘密时无候选')
  assert.match(String(validateMove(noSecretsState, 0, noSecretsMove) || ''), /使用次数不足/, 'validateMove 报使用次数不足')
})


test(`TCU 05279 ${nameOf('05279')} 反应窗口从附属打出 05033（Spell 事件）并支付附加费、结算后仍附属`, () => {
  const state = fixture('01001')
  const inv = me(state)
  const dayana = asset(state, '05279')
  const wither = asset(state, '05157')
  const target = enemy(state, { id: 'dayana-attached-target', fight: 3, evade: 3, health: 20 })
  inv.hand = ['05033']
  inv.resources = 30
  state.chaosBag = ['skull']
  move(state, { action: 'ability', assetId: dayana.id, abilityIndex: 0, targetId: '05033' })
  settle(state)
  assert.deepEqual(state.investigators[0].assets.find(item => item.id === dayana.id).attachments.map(entry => entry.code),
    ['05033'], '05033 已附属在黛雅娜身上')
  let attachedOffered = false
  let playedFromAttached = false
  let attachedPlayedOnce = false
  move(state, { action: 'ability', assetId: wither.id, abilityIndex: 0, targetId: target.id })
  settle(state, pending => {
    if (pending.kind === 'reaction') {
      const attached = pending.options.find(option => String(option.id).startsWith('attached:')
        && option.cardCode === '05033')
      if (attached && !attachedPlayedOnce) { attachedOffered = true; playedFromAttached = true; attachedPlayedOnce = true; return attached.id }
    }
    if (pending.kind === 'effect') {
      const cancel = pending.options.find(option => option.id === 'cancel')
      if (cancel) return cancel.id
    }
    return null
  })
  assert.equal(attachedOffered, true, 'symbolRevealed 反应窗口出现「附属事件」候选（attached:05033）')
  assert.equal(playedFromAttached, true, '从附属打出 05033')
  // 05033「恐怖灵感」是 0 费事件：反应窗口打出按印刷费用 0 支付；额外费由宿主支付。
  assert.equal(me(state).resources, 30, '05033 印刷费用 0，资源不变')
  const host = state.investigators[0].assets.find(item => item.id === dayana.id)
  assert.equal(host.uses, 2, '附加费：花 1 秘密（3→2）')
  assert.equal(host.exhausted, true, '附加费：横置黛雅娜')
  assert.deepEqual(host.attachments.map(entry => entry.code), ['05033'], '结算后事件仍附属在原处')
  assert.ok(!me(state).discard.includes('05033'), '事件不放进弃牌堆')
})

// ---------------------------------------------------------------------------
// 05280 否决存在
// ---------------------------------------------------------------------------

test(`TCU 05280 ${nameOf('05280')} 忽略敌人攻击的伤害并反向治愈`, () => {
  const state = fixture('01001')
  const inv = me(state)
  inv.hand = ['05280']
  inv.damage = 2
  run(state, current => {
    current._enemyAttackResolving = true
    applyHarm(current, current.investigators[0], 2, 0, [], false,
      { enemy: { id: 'e1', name: '测试敌人' }, damage: 2, horror: 0 })
  }, pending => {
    if (pending.kind !== 'reaction') return null
    return pending.options.find(option => option.cardCode === '05280')?.id ?? null
  })
  assert.equal(me(state).damage, 0, '忽略 2 点伤害后反向治愈 2 点旧伤害')
})

test(`TCU 05280 ${nameOf('05280')} 忽略遭遇卡造成的恐惧并反向治愈`, () => {
  const state = fixture('01001')
  const inv = me(state)
  inv.hand = ['05280']
  inv.horror = 1
  run(state, current => {
    current._treacheryResolving = 'test-treachery'
    applyHarm(current, current.investigators[0], 0, 2, [], false, null)
  }, pending => {
    if (pending.kind !== 'reaction') return null
    return pending.options.find(option => option.cardCode === '05280')?.id ?? null
  })
  assert.equal(me(state).horror, 0, '忽略 2 点恐惧后反向治愈 1 点旧恐惧')
})

// ---------------------------------------------------------------------------
// 05281 勇闯火线
// ---------------------------------------------------------------------------

test(`TCU 05281 ${nameOf('05281')} 把选定技能的基础值设为 5 直到回合结束`, () => {
  const state = fixture('01001')
  const inv = me(state)
  inv.hand = ['05281']
  const base = inv.agility
  move(state, { action: 'play', cardId: '05281' })
  settle(state, pending => pending.kind === 'skill' ? 'agility' : null)
  assert.equal(getStat(state, me(state), 'agility'), 5, '敏捷基础值视为 5（第五轮：真 base 覆盖而非差值修正）')
  // 交叉复核补强：引擎新增 baseStatValue（印刷基值 + 临时基值覆盖），actions.js 的
  // doubleBaseSkill/noIntellectBoost 分支改读它；这里直接断言该读点也看到覆盖。
  assert.equal(baseStatValue(state, me(state), 'agility'), 5,
    'baseStatValue 读点看到临时基值覆盖（doubleBaseSkill/noIntellectBoost 走同一读点）')
  assert.notEqual(base, 5, '对照：印刷基值本身不是 5')
  // 基础值覆盖读点是 turnSerial：下一次回合开始（turn.js turnBeginningWindow）序号 +1 后自然过期。
  state.turnSerial = (state.turnSerial || 0) + 1
  assert.equal(getStat(state, me(state), 'agility'), base, '回合结束后 getStat 恢复')
  assert.equal(baseStatValue(state, me(state), 'agility'), base, 'baseStatValue 过期后回到印刷基值')
})

// ---------------------------------------------------------------------------
// 05282 偷梁换柱
// ---------------------------------------------------------------------------

test(`TCU 05282 ${nameOf('05282')} 修复：没有可躲避的敌人时打不出`, () => {
  const state = fixture('01001')
  me(state).hand = ['05282']
  assert.match(String(validateMove(state, 0, { action: 'play', cardId: '05282' })), /没有可以躲避|不能打出/,
    '无合法目标时不能打出「偷梁换柱」')
})

test(`TCU 05282 ${nameOf('05282')} 躲避交战敌人成功后把它移到连接地点`, () => {
  const state = fixture('01001')
  addConnections(state, [{ id: 'hallway', name: '走廊', connections: ['study'], clues: 0, revealed: true }])
  state.locations[0].connections = ['hallway']
  state.chaosBag = ['0']
  const target = enemy(state, { engagedSeat: 0, fight: 1, evade: 1, health: 5 })
  me(state).hand = ['05282']
  move(state, { action: 'play', cardId: '05282' })
  settle(state)
  const moved = state.enemies.find(item => item.id === target.id)
  assert.equal(moved.location, 'hallway', '敌人被移动到连接地点')
  assert.equal(moved.exhausted, true, '敌人被躲避（横置）')
})

test(`TCU 05282 ${nameOf('05282')} 躲避连接地点的非精英敌人并交换地点`, () => {
  const state = fixture('01001')
  addConnections(state, [{ id: 'hallway', name: '走廊', connections: ['study'], clues: 0, revealed: true }])
  state.locations[0].connections = ['hallway']
  state.chaosBag = ['0']
  const target = enemy(state, { location: 'hallway', engagedSeat: null, fight: 1, evade: 1, health: 5 })
  me(state).hand = ['05282']
  move(state, { action: 'play', cardId: '05282' })
  settle(state)
  const moved = state.enemies.find(item => item.id === target.id)
  assert.equal(me(state).location, 'hallway', '调查员移动到敌人原来的地点')
  assert.equal(moved.location, 'study', '敌人换到调查员原来的地点')
  assert.equal(moved.exhausted, true, '敌人被躲避（横置）')
})

// ---------------------------------------------------------------------------
// 05282 偷梁换柱：选项 B 走真实躲避（第六轮 evade allowConnecting）
// ---------------------------------------------------------------------------

test(`TCU 05282 ${nameOf('05282')} 选项 B 走真实躲避（含躲避支援加值/evadeSuccess 窗口）`, () => {
  const state = fixture('01001')
  addConnections(state, [{ id: 'hallway', name: '走廊', connections: ['study'], clues: 0, revealed: true }])
  state.locations[0].connections = ['hallway']
  // 04203「战壕大衣」：被动 evadeBonus +1；真实 doEvade 会把它加进躲避检定，api.test 窄口径不会。
  asset(state, '04203')
  state.chaosBag = ['0']
  const target = enemy(state, { location: 'hallway', engagedSeat: null, fight: 1, evade: 2, health: 5 })
  me(state).hand = ['05282']
  move(state, { action: 'play', cardId: '05282' })
  settle(state)
  const moved = state.enemies.find(item => item.id === target.id)
  assert.equal(me(state).location, 'hallway', '选项 B 成功后换位')
  assert.equal(moved.location, 'study', '敌人换到原地点')
  assert.equal(state.lastTestResult?.source?.label, '躲避', '走真实躲避流程')
  assert.equal(state.lastTestResult?.value, 3, '躲避检定吃到战壕大衣 +1（敌人躲避 2 + 1）')
})

test(`TCU 05283 ${nameOf('05283')} 额外 2 个塔罗槽位`, () => {
  const state = fixture('01001')
  assert.equal(tarotSlotCapacity(me(state)), 1)
  asset(state, '05283')
  assert.equal(tarotSlotCapacity(me(state)), 3, '基础 1 + 安娜 2')
})

test(`TCU 05283 ${nameOf('05283')} 入场后检索一张塔罗支援并放置入场`, () => {
  const state = fixture('01001')
  const inv = me(state)
  inv.hand = ['05283']
  inv.deck = ['05023', ...Array(9).fill('01088')]
  move(state, { action: 'play', cardId: '05283' })
  settle(state, pending => pending.kind === 'search' ? '0' : null)
  assert.ok(me(state).assets.some(item => item.code === '05283'), '安娜入场')
  assert.ok(me(state).assets.some(item => item.code === '05023'), '检索到的塔罗支援直接放置入场')
  assert.ok(!me(state).deck.includes('05023'), '塔罗支援离开牌库')
})

test(`TCU 05283 ${nameOf('05283')} 游戏开始时从起始手牌放置入场`, () => {
  const state = fixture('01001')
  const inv = me(state)
  inv.hand = ['05283']
  inv.deck = ['05023', ...Array(9).fill('01088')]
  run(state, current => reactionWindow(current, 'scenarioStarts', { when: 'scenarioStarts' }, []), pending => {
    if (pending.kind === 'reaction') return pending.options.find(option => option.cardCode === '05283')?.id ?? null
    if (pending.kind === 'search') return '0'
    return null
  })
  assert.ok(me(state).assets.some(item => item.code === '05283'), '开局放置入场')
  assert.ok(!me(state).hand.includes('05283'), '离开起始手牌')
})

// ---------------------------------------------------------------------------
// 05313 圣化之镜 / 05316 密教辞典（绑定主卡）
// ---------------------------------------------------------------------------

test(`TCU 05313 ${nameOf('05313')} 入场检索 3 张舒缓旋律（1 张入手，其余洗回牌库）`, () => {
  const state = fixture('01001')
  const inv = me(state)
  inv.hand = ['05313']
  inv.deck = Array(20).fill('01088')
  move(state, { action: 'play', cardId: '05313' })
  settle(state)
  assert.equal(me(state).hand.filter(code => code === '05314').length, 1, '1 张加入手牌')
  assert.equal(me(state).deck.filter(code => code === '05314').length, 2, '其余 2 张洗回牌库')
  assert.deepEqual(state.bondedSets['05313'].cards, [], '场外集合清空')
  assert.equal(state.bondedSets['05313'].retrieved, true)
})

test(`TCU 05316 ${nameOf('05316')} 入场检索 3 张鲜血仪式（1 张入手，其余洗回牌库）`, () => {
  const state = fixture('01001')
  const inv = me(state)
  inv.hand = ['05316']
  inv.deck = Array(20).fill('01088')
  move(state, { action: 'play', cardId: '05316' })
  settle(state)
  assert.equal(me(state).hand.filter(code => code === '05317').length, 1, '1 张加入手牌')
  assert.equal(me(state).deck.filter(code => code === '05317').length, 2, '其余 2 张洗回牌库')
})

// ---------------------------------------------------------------------------
// 05314 舒缓旋律（绑定：圣化之镜）
// ---------------------------------------------------------------------------

test(`TCU 05314 ${nameOf('05314')} 两点治疗可分配给伤害/恐惧并抽 1 张`, () => {
  const state = fixture('01001')
  const inv = me(state)
  inv.hand = ['05314']
  inv.damage = 2
  inv.horror = 0
  inv.deck = ['01088', '01088', '01088']
  move(state, { action: 'play', cardId: '05314' })
  settle(state, pending => {
    if (pending.kind !== 'heal') return null
    const option = pending.options.find(item => item.kind === 'damage' || String(item.id).startsWith('dmg:'))
    return option?.id ?? 'done'
  })
  assert.equal(me(state).damage, 0, '2 点治疗都用来治愈伤害')
  assert.ok(me(state).hand.includes('01088'), '结算后抽 1 张牌')
})

test(`TCU 05314 ${nameOf('05314')} 恐惧与盟友支援同样是治疗目标`, () => {
  const state = fixture('01001')
  const inv = me(state)
  inv.hand = ['05314']
  inv.damage = 0
  inv.horror = 2
  inv.deck = ['01088', '01088']
  move(state, { action: 'play', cardId: '05314' })
  settle(state, pending => {
    if (pending.kind !== 'heal') return null
    const option = pending.options.find(item => item.kind === 'horror' || String(item.id).startsWith('hor:'))
    return option?.id ?? 'done'
  })
  assert.equal(me(state).horror, 0, '2 点治疗都用来治愈恐惧')
})

// ---------------------------------------------------------------------------
// 05315 “我见过更糟的……”
// ---------------------------------------------------------------------------

test(`TCU 05315 ${nameOf('05315')} 取消最多 2 点伤害并换成同等资源`, () => {
  const state = fixture('01001')
  const inv = me(state)
  inv.hand = ['05315']
  inv.resources = 5
  inv.damage = 2
  inv.horror = 0
  run(state, current => applyHarm(current, current.investigators[0], 2, 0, [], false), pending => {
    if (pending.kind === 'reaction') {
      const option = pending.options.find(item => item.cardCode === '05315')
      if (option) return option.id
    }
    if (pending.kind === 'harm') return '2:0'
    return null
  })
  assert.equal(me(state).damage, 2, '2 点伤害被取消，只剩原有的 2 点')
  assert.equal(me(state).resources, 7, '取消 2 点获得 2 资源')
  assert.ok(me(state).discard.includes('05315'), '快速事件结算后进弃牌堆')
})

// ---------------------------------------------------------------------------
// 05317 鲜血仪式
// ---------------------------------------------------------------------------

test(`TCU 05317 ${nameOf('05317')} 抽 2 张、弃 1 张换资源`, () => {
  const state = fixture('01001')
  const inv = me(state)
  inv.hand = ['05317', '01088', '01089']
  inv.deck = Array(20).fill('01088')
  inv.resources = 30
  move(state, { action: 'play', cardId: '05317' })
  let discardAsked = 0
  settle(state, pending => {
    if (pending.kind === 'discard') { discardAsked++; return discardAsked === 1 ? '0' : 'done' }
    if (pending.kind === 'effect') return 'resource'
    return null
  })
  assert.equal(me(state).resources, 31, '弃 1 张牌换 1 资源')
  assert.ok(me(state).discard.includes('01088'), '弃掉的是选中的那张手牌')
  assert.equal(me(state).hand.length, 3, '抽 2 弃 1 后的手牌数')
})

test(`TCU 05317 ${nameOf('05317')} 弃牌后可花 1 资源对敌人造成伤害`, () => {
  const state = fixture('01001')
  const inv = me(state)
  inv.hand = ['05317', '01088']
  inv.deck = Array(20).fill('01089')
  inv.resources = 30
  const target = enemy(state, { fight: 2, evade: 2, health: 5, damageTaken: 0 })
  move(state, { action: 'play', cardId: '05317' })
  let discardAsked = 0
  settle(state, pending => {
    if (pending.kind === 'discard') { discardAsked++; return discardAsked === 1 ? '0' : 'done' }
    if (pending.kind === 'effect') return 'damage'
    if (pending.kind === 'target') return pending.options[0].id
    return null
  })
  assert.equal(state.enemies.find(item => item.id === target.id).damageTaken, 1)
  assert.equal(me(state).resources, 29, '打出 0 费，造成伤害花 1 资源')
})

// ---------------------------------------------------------------------------
// 05318 窥看不思议之事
// ---------------------------------------------------------------------------

test(`TCU 05318 ${nameOf('05318')} 非弱点手牌洗回牌库并补抽到手牌上限、自身移出游戏`, () => {
  const state = fixture('01001')
  const inv = me(state)
  inv.hand = ['05318', '01088', '01089']
  inv.deck = Array(10).fill('01090')
  move(state, { action: 'play', cardId: '05318' })
  let asked = 0
  settle(state, pending => {
    if (pending.kind === 'card') { asked++; return asked === 1 ? (pending.options[1]?.id ?? 'done') : 'done' }
    return null
  })
  assert.ok((state.exiled || []).includes('05318'), '自身从游戏中移除（流放）')
  const max = getHandSize(state, me(state))
  assert.equal(me(state).hand.length, max, '补抽到手牌上限')
  assert.equal(me(state).deck.length, 11 - (max - 1), '牌库 = 10 + 1 张洗回 - 补抽')
})

// ---------------------------------------------------------------------------
// 05319 “你欠我一次”
// ---------------------------------------------------------------------------

test(`TCU 05319 ${nameOf('05319')} 打出另一位调查员手牌并双方各抽 1`, () => {
  const state = fixture('01001', 2)
  const inv = me(state)
  const other = state.investigators[1]
  inv.hand = ['05319']
  inv.deck = Array(10).fill('01090')
  other.hand = ['01088']
  other.deck = Array(10).fill('01089')
  move(state, { action: 'play', cardId: '05319' })
  settle(state, pending => {
    if (pending.kind === 'card') return pending.options.find(option => option.cardCode === '01088')?.id ?? 'done'
    return null
  })
  assert.ok(!state.investigators[1].hand.includes('01088'), '对方手牌被拿走')
  assert.equal(me(state).resources, 33, '打出了对方的「应急物品」，获得 3 资源')
  assert.equal(me(state).hand.length, 1, '打牌者抽 1 张')
  assert.equal(state.investigators[1].hand.length, 1, '对方抽 1 张')
  // 修复：手牌内容走 privateInfo 私密投影，公开日志只报张数（不再包含卡名）。
  assert.ok(state.log.some(line => /查看了.*手牌（共 1 张）/.test(line)), '公开日志只报张数')
  assert.ok(!state.log.some(line => /查看了.*手牌：/.test(line)), '公开日志不列出对方手牌内容')
})

test(`TCU 05319 ${nameOf('05319')} 打出对方手牌中的支援后置于自己控制之下`, () => {
  const state = fixture('01001', 2)
  const inv = me(state)
  const other = state.investigators[1]
  inv.hand = ['05319']
  inv.deck = Array(10).fill('01090')
  inv.resources = 30
  other.hand = ['01020'] // 大砍刀（3 费支援）
  other.deck = Array(10).fill('01089')
  move(state, { action: 'play', cardId: '05319' })
  settle(state, pending => {
    if (pending.kind === 'card') return pending.options.find(option => option.cardCode === '01020')?.id ?? 'done'
    return null
  })
  const actor = state.investigators[0]
  assert.ok(actor.assets.some(item => item.code === '01020'), '支援置于打出者控制之下')
  assert.ok(!state.investigators[1].assets.some(item => item.code === '01020'), '原持有者不控制该支援')
  assert.equal(actor.resources, 27, '费用由打出者支付（30-3）')
  assert.equal(actor.hand.length, 1, '打出者抽 1 张')
  assert.equal(state.investigators[1].hand.length, 1, '原持有者抽 1 张')
})

test(`TCU 05319 ${nameOf('05319')} 对方手里有同名两张时只拿走一张`, () => {
  const state = fixture('01001', 2)
  const inv = me(state)
  const other = state.investigators[1]
  inv.hand = ['05319']
  inv.deck = Array(10).fill('01090')
  inv.resources = 30
  other.hand = ['01088', '01088']
  other.deck = Array(10).fill('01089')
  move(state, { action: 'play', cardId: '05319' })
  settle(state, pending => {
    if (pending.kind === 'card') return pending.options.find(option => option.cardCode === '01088')?.id ?? 'done'
    return null
  })
  assert.equal(state.investigators[1].hand.filter(code => code === '01088').length, 1, '同名第二张留在对方手中')
  assert.equal(me(state).resources, 33, '只打出一张（+3 资源）')
})

test(`TCU 05319 ${nameOf('05319')} 技能/弱点/付不起的卡不作为可打出候选`, () => {
  const state = fixture('01001', 2)
  const inv = me(state)
  const other = state.investigators[1]
  inv.hand = ['05319']
  inv.resources = 1
  other.hand = ['01025', '01009', '01020'] // 技能 / 弱点支援 / 3 费支援（只有 1 资源）
  move(state, { action: 'play', cardId: '05319' })
  let cardAsked = false
  settle(state, pending => {
    if (pending.kind === 'card') { cardAsked = true; return 'done' }
    return null
  })
  assert.equal(cardAsked, false, '没有合法候选时不进入选牌')
  assert.deepEqual(state.investigators[1].hand.slice().sort(), ['01009', '01020', '01025'], '对方手牌原样保留')
  assert.ok(!state.log.some(line => String(line).includes('双方各抽')), '未打出则双方都不抽牌')
})

// ---------------------------------------------------------------------------
// 05321 凋零术
// ---------------------------------------------------------------------------

test(`TCU 05321 ${nameOf('05321')} 用意志代替战斗攻击并 +2 意志`, () => {
  const state = fixture('01001')
  const wither = asset(state, '05321')
  state.chaosBag = ['0']
  const target = enemy(state, { fight: 2, evade: 2, health: 5, damageTaken: 0 })
  move(state, { action: 'ability', assetId: wither.id, abilityIndex: 0, targetId: target.id })
  settle(state)
  assert.equal(state.enemies.find(item => item.id === target.id).damageTaken, 1, '攻击造成 1 点伤害')
  assert.equal(state.lastTestResult.skill, 'willpower', '本次攻击使用意志')
  assert.equal(state.lastTestResult.value, 5, '意志 3 + 2')
})

test(`TCU 05321 ${nameOf('05321')} 攻击揭示符号标记后敌人本回合 -1 攻/-1 血/-1 躲（最低 1）`, () => {
  const state = fixture('01001')
  const wither = asset(state, '05321')
  me(state).willpower = 8 // 保证揭示骷髅后检定仍成功
  state.chaosBag = ['skull']
  const target = enemy(state, { id: 'wither-symbol', fight: 2, evade: 2, health: 4, damageTaken: 0 })
  move(state, { action: 'ability', assetId: wither.id, abilityIndex: 0, targetId: target.id })
  settle(state, pending => {
    if (pending.kind !== 'reaction') return null
    return pending.options.find(option => option.cardCode === '05321')?.id ?? 'skip'
  })
  const after = state.enemies.find(item => item.id === 'wither-symbol')
  assert.ok(after, '敌人仍在场')
  assert.equal(enemyFightValue(state, after, me(state)), 1, '攻击值 -1')
  assert.equal(enemyEvadeValue(state, after, me(state)), 1, '躲避值 -1')
  assert.equal(enemyHealth(state, after), 3, '生命值 -1')
  // 「本回合剩余时间」：下一次回合开始 turnSerial +1 后运行期修正过期，数值恢复。
  state.turnSerial = (state.turnSerial || 0) + 1
  const restored = state.enemies.find(item => item.id === 'wither-symbol')
  assert.equal(enemyFightValue(state, restored, me(state)), 2, '回合结束后攻击值恢复')
  assert.equal(enemyEvadeValue(state, restored, me(state)), 2, '回合结束后躲避值恢复')
  assert.equal(enemyHealth(state, restored), 4, '回合结束后生命值恢复')
})

test(`TCU 05321 ${nameOf('05321')} 05033「恐怖灵感」可取消符号窗口里的凋零术效果`, () => {
  const state = fixture('01001')
  const wither = asset(state, '05321')
  me(state).willpower = 8
  me(state).hand = ['05033']
  state.chaosBag = ['skull']
  const target = enemy(state, { id: 'wither-cancel', fight: 3, evade: 3, health: 4, damageTaken: 0 })
  move(state, { action: 'ability', assetId: wither.id, abilityIndex: 0, targetId: target.id })
  settle(state, pending => {
    if (pending.kind === 'reaction') {
      const inspiration = pending.options.find(option => option.cardCode === '05033')
      if (inspiration) return inspiration.id
      return 'skip'
    }
    if (pending.kind === 'effect') return 'cancel'
    return null
  })
  const after = state.enemies.find(item => item.id === 'wither-cancel')
  assert.equal(enemyFightValue(state, after, me(state)), 3, '取消后攻击值不变')
  assert.equal(enemyEvadeValue(state, after, me(state)), 3, '取消后躲避值不变')
  assert.equal(enemyHealth(state, after), 4, '取消后生命值不变')
  assert.ok(me(state).discard.includes('05033'), '05033 快速事件结算后进弃牌堆')
})

test(`TCU 05321 ${nameOf('05321')} 05033「恐怖灵感」可让符号窗口里的凋零术效果再结算一次`, () => {
  const state = fixture('01001')
  const wither = asset(state, '05321')
  me(state).willpower = 8
  me(state).hand = ['05033']
  state.chaosBag = ['skull']
  const target = enemy(state, { id: 'wither-repeat', fight: 3, evade: 3, health: 5, damageTaken: 0 })
  move(state, { action: 'ability', assetId: wither.id, abilityIndex: 0, targetId: target.id })
  let sawWitherAfterInspiration = false
  settle(state, pending => {
    if (pending.kind === 'reaction') {
      const inspiration = pending.options.find(option => option.cardCode === '05033')
      if (inspiration) return inspiration.id
      const witherOption = pending.options.find(option => option.cardCode === '05321')
      if (witherOption) { sawWitherAfterInspiration = true; return witherOption.id }
      return 'skip'
    }
    if (pending.kind === 'effect') return 'repeat'
    return null
  })
  const after = state.enemies.find(item => item.id === 'wither-repeat')
  assert.equal(sawWitherAfterInspiration, true, '再次结算由 05321 自己的符号反应完成')
  assert.equal(enemyHealth(state, after), 3, '生命值 -2（同一效果结算两次）')
  assert.equal(enemyFightValue(state, after, me(state)), 1, '攻击值 -2 后被下限 1 钳制')
  assert.equal(enemyEvadeValue(state, after, me(state)), 1, '躲避值 -2 后被下限 1 钳制')
})


// ---------------------------------------------------------------------------
// 05322 第六感
// ---------------------------------------------------------------------------

test(`TCU 05322 ${nameOf('05322')} 用意志代替智力调查并 +2 意志`, () => {
  const state = fixture('01001')
  const sixth = asset(state, '05322')
  state.chaosBag = ['0']
  state.locations[0].clues = 2
  move(state, { action: 'ability', assetId: sixth.id, abilityIndex: 0 })
  settle(state)
  assert.equal(me(state).clues, 1, '调查成功发现 1 个线索')
  assert.equal(state.lastTestResult.skill, 'willpower', '本次调查使用意志')
  assert.equal(state.lastTestResult.value, 5, '意志 3 + 2')
})

// 05322 双地点调查用图：书房(原) — 走廊 — 阁楼（≤2 连接），阁楼 — 屋顶（3 次连接，不可选）；
// 书房 — 地下室（未揭示，不可选）。各地点线索/隐藏值都不同，便于区分「新/原」两个分支。
function sixthSenseGraph(state) {
  const here = state.locations.find(location => location.id === me(state).location)
  here.shroud = 2
  here.clues = 2
  here.connections = ['hall', 'cellar']
  state.locations.push(
    { ...structuredClone(here), id: 'hall', name: '走廊', connections: [here.id, 'attic'], revealed: true, clues: 3, shroud: 4 },
    { ...structuredClone(here), id: 'attic', name: '阁楼', connections: ['hall', 'roof'], revealed: true, clues: 3, shroud: 5 },
    { ...structuredClone(here), id: 'roof', name: '屋顶', connections: ['attic'], revealed: true, clues: 3, shroud: 7 },
    { ...structuredClone(here), id: 'cellar', name: '地下室', connections: [here.id], revealed: false, clues: 3, shroud: 6 },
  )
  return state
}

test(`TCU 05322 ${nameOf('05322')} 符号后同时在 2 次连接内的已揭示地点调查（新隐藏值分支）`, () => {
  const state = sixthSenseGraph(fixture('01001'))
  const sixth = asset(state, '05322')
  me(state).willpower = 8
  state.chaosBag = ['skull']
  legalMoves(state)
  let locationOptions = []
  move(state, { action: 'ability', assetId: sixth.id, abilityIndex: 0 })
  settle(state, pending => {
    if (pending.kind === 'reaction') {
      return pending.options.find(option => option.cardCode === '05322')?.id ?? 'skip'
    }
    if (pending.kind === 'location') {
      locationOptions = pending.options.map(option => option.id)
      return 'attic'
    }
    if (pending.kind === 'effect') return 'new'
    return null
  })
  assert.deepEqual(locationOptions.slice().sort(), ['attic', 'hall'],
    '只能选 2 次连接内的已揭示地点：走廊(1)/阁楼(2)；未揭示地下室与 3 连接的屋顶不可选')
  assert.equal(state.lastTestResult.difficulty, 5, '使用所选「阁楼」的隐藏值 5')
  assert.equal(state.locations.find(location => location.id === 'study').clues, 1, '原调查地点也发现 1 个线索')
  assert.equal(state.locations.find(location => location.id === 'attic').clues, 2, '所选地点也发现 1 个线索')
  assert.equal(state.locations.find(location => location.id === 'hall').clues, 3, '范围内的其他地点不受影响')
  assert.equal(state.locations.find(location => location.id === 'cellar').clues, 3, '未揭示地点不参与')
  assert.ok(state.log.some(line => String(line).includes('同时在「阁楼」调查，线索在该地点也被发现')),
    '日志记录双地点调查的第二处发现')
})

test(`TCU 05322 ${nameOf('05322')} 符号后双地点调查可选原隐藏值分支`, () => {
  const state = sixthSenseGraph(fixture('01001'))
  const sixth = asset(state, '05322')
  me(state).willpower = 8
  state.chaosBag = ['skull']
  legalMoves(state)
  move(state, { action: 'ability', assetId: sixth.id, abilityIndex: 0 })
  settle(state, pending => {
    if (pending.kind === 'reaction') {
      return pending.options.find(option => option.cardCode === '05322')?.id ?? 'skip'
    }
    if (pending.kind === 'location') return 'hall'
    if (pending.kind === 'effect') return 'original'
    return null
  })
  assert.equal(state.lastTestResult.difficulty, 2, '使用原调查地点的隐藏值 2')
  assert.equal(state.locations.find(location => location.id === 'study').clues, 1, '原地点发现 1 个线索')
  assert.equal(state.locations.find(location => location.id === 'hall').clues, 2, '所选「走廊」也发现 1 个线索')
  assert.equal(state.locations.find(location => location.id === 'attic').clues, 3, '未选中的阁楼不发现线索')
})

test(`TCU 05322 ${nameOf('05322')} 没有 2 次连接内的已揭示地点时符号窗口不提供双地点调查`, () => {
  const state = fixture('01001')
  const here = state.locations[0]
  here.shroud = 2
  here.clues = 2
  here.connections = ['cellar']
  state.locations.push(
    { ...structuredClone(here), id: 'cellar', name: '地下室', connections: [here.id, 'attic'], revealed: false, clues: 3, shroud: 6 },
    { ...structuredClone(here), id: 'attic', name: '阁楼', connections: ['cellar', 'roof'], revealed: false, clues: 3, shroud: 5 },
    { ...structuredClone(here), id: 'roof', name: '屋顶', connections: ['attic'], revealed: true, clues: 3, shroud: 7 },
  )
  const sixth = asset(state, '05322')
  me(state).willpower = 8
  state.chaosBag = ['skull']
  legalMoves(state)
  let reactionCardCodes = []
  move(state, { action: 'ability', assetId: sixth.id, abilityIndex: 0 })
  settle(state, pending => {
    if (pending.kind === 'reaction') {
      reactionCardCodes = pending.options.map(option => option.cardCode).filter(Boolean)
      return 'skip'
    }
    return null
  })
  assert.deepEqual(reactionCardCodes, [], '相邻未揭示、已揭示地点在 3 次连接外：不触发双地点调查')
  assert.equal(state.locations.find(location => location.id === 'study').clues, 1, '只做普通调查')
  assert.equal(state.locations.find(location => location.id === 'roof').clues, 3, '3 次连接外的地点不受影响')
})

test(`TCU 05322 ${nameOf('05322')} 未揭示符号标记时不做双地点调查`, () => {
  const state = sixthSenseGraph(fixture('01001'))
  const sixth = asset(state, '05322')
  me(state).willpower = 8
  state.chaosBag = ['0']
  legalMoves(state)
  let sawReaction = false
  move(state, { action: 'ability', assetId: sixth.id, abilityIndex: 0 })
  settle(state, pending => {
    if (pending.kind === 'reaction') { sawReaction = true; return 'skip' }
    return null
  })
  assert.equal(sawReaction, false, '普通标记不打开符号效果')
  assert.equal(state.locations.find(location => location.id === 'study').clues, 1, '原地点发现 1 个线索')
  assert.equal(state.locations.find(location => location.id === 'attic').clues, 3, '所选地点不被自动调查')
})


// ---------------------------------------------------------------------------
// 05323 诱敌深入
// ---------------------------------------------------------------------------

test(`TCU 05323 ${nameOf('05323')} 附属到地点：敌人阶段朝附属地点移动、轮末恰好弃 1 张`, () => {
  const state = fixture('01001')
  addConnections(state, [
    { id: 'hallway', name: '走廊', connections: ['study'], clues: 0, revealed: true },
    { id: 'attic', name: '阁楼', connections: ['hallway'], clues: 0, revealed: true },
  ])
  state.locations[0].connections = ['hallway']
  enemy(state, { id: 'lure-hunter', location: 'attic', engagedSeat: null, hunter: true, fight: 1, evade: 1, health: 4 })
  me(state).hand = ['05323']
  move(state, { action: 'play', cardId: '05323' })
  settle(state, pending => pending.kind === 'target' ? 'hallway' : null)
  const attached = (state.playerLocationAttachments || []).find(item => item.code === '05323')
  assert.ok(attached, '真实地点附属（state.playerLocationAttachments）')
  assert.equal(attached.location, 'hallway', '附属在连接地点')
  assert.equal(attached.ownerSeat, 0)
  assert.ok(!me(state).discard.includes('05323'), '打出后不立即进弃牌堆（keepOnPlay）')
  move(state, { action: 'endTurn' })
  settle(state)
  assert.equal(state.enemies.find(item => item.id === 'lure-hunter').location, 'hallway', '猎手朝诱饵最短路径移动')
  assert.ok(!(state.playerLocationAttachments || []).some(item => item.code === '05323'), '轮末移除真实附属')
  assert.equal(me(state).discard.filter(code => code === '05323').length, 1,
    '轮末恰好弃 1 张「诱敌深入」（keepOnPlay + discardAtRoundEnd，不再推两次）')
})

test(`TCU 05323 ${nameOf('05323')} 多诱饵取最近：两个地点附属时猎手走向最近的一个`, () => {
  const state = fixture('01001')
  addConnections(state, [
    { id: 'hallway', name: '走廊', connections: ['study', 'attic'], clues: 0, revealed: true },
    { id: 'attic', name: '阁楼', connections: ['hallway'], clues: 0, revealed: true },
  ])
  state.locations[0].connections = ['hallway']
  enemy(state, { id: 'lure-hunter-2', location: 'attic', engagedSeat: null, hunter: true, fight: 1, evade: 1, health: 4 })
  me(state).hand = ['05323']
  move(state, { action: 'play', cardId: '05323' })
  settle(state, pending => pending.kind === 'target' ? 'study' : null)
  me(state).hand = ['05323']
  move(state, { action: 'play', cardId: '05323' })
  settle(state, pending => pending.kind === 'target' ? 'hallway' : null)
  const attachedLocations = (state.playerLocationAttachments || [])
    .filter(item => item.code === '05323').map(item => item.location)
  assert.deepEqual(attachedLocations.sort(), ['hallway', 'study'], '两处真实地点附属')
  move(state, { action: 'endTurn' })
  settle(state)
  assert.equal(state.enemies.find(item => item.id === 'lure-hunter-2').location, 'hallway', '多诱饵取距离最近（走廊距离 0 < 研究所距离 2）')
})

test(`TCU 05278 ${nameOf('05278')} 永久卡在开局多给 2 资源`, () => {
  const state = startWithCards(['05278'])
  assert.ok(me(state).assets.some(item => item.code === '05278'), '永久卡开局即在场')
  assert.equal(me(state).resources, 7, '起始 5 资源 + 2')
  assert.ok(!me(state).hand.includes('05278'), '永久卡不进起始手牌')
})

// ---------------------------------------------------------------------------
// 05276 苦心钻研（永久卡）
// ---------------------------------------------------------------------------

test(`TCU 05276 ${nameOf('05276')} 永久卡让起始手牌多 1 张`, () => {
  const control = startWithCards(['05278'])
  const withStudious = startWithCards(['05276'], { seed: 'tcu-m2-4-studious' })
  assert.ok(me(withStudious).assets.some(item => item.code === '05276'), '永久卡开局即在场')
  assert.equal(me(control).hand.length + 1, me(withStudious).hand.length, '起始手牌比对照多 1 张')
  assert.ok(!me(withStudious).deck.includes('05276'), '永久卡不在牌库里')
})

// ---------------------------------------------------------------------------
// 05313 / 05316 离场收回绑定副本
// ---------------------------------------------------------------------------

test(`TCU 05313 ${nameOf('05313')} 离场时把所有舒缓旋律收回场外集合（含其他调查员区域与场外区域）`, () => {
  const state = fixture('01001', 2)
  const inv = me(state)
  inv.hand = ['05313']
  inv.deck = Array(20).fill('01088')
  move(state, { action: 'play', cardId: '05313' })
  settle(state)
  const mirror = me(state).assets.find(item => item.code === '05313')
  assert.equal(me(state).hand.filter(code => code === '05314').length, 1, '入场检索 1 张')
  // 跨调查员：手牌副本移到另一名调查员手牌；牌库副本移到他的弃牌堆；最后一张放到地点 beneath（场外区域）。
  const other = state.investigators[1]
  other.hand.push(me(state).hand.splice(me(state).hand.indexOf('05314'), 1)[0])
  other.discard.push(me(state).deck.splice(me(state).deck.indexOf('05314'), 1)[0])
  state.locations[0].beneath = [{ code: me(state).deck.splice(me(state).deck.indexOf('05314'), 1)[0], ownerSeat: 0 }]
  run(state, current => returnAssetToHand(current, 0, { assetId: mirror.id }, []))
  const otherAfter = state.investigators[1]
  assert.equal(state.bondedSets['05313'].cards.filter(code => code === '05314').length, 3, '3 张全部收回场外集合')
  assert.equal(me(state).hand.filter(code => code === '05314').length, 0, '手牌里的副本被收回')
  assert.equal(otherAfter.hand.filter(code => code === '05314').length, 0, '其他调查员手牌里的副本被收回')
  assert.equal(otherAfter.discard.filter(code => code === '05314').length, 0, '其他调查员弃牌堆里的副本被收回')
  assert.equal((state.locations[0].beneath || []).filter(entry => (entry.code || entry) === '05314').length, 0,
    '地点 beneath（场外区域）里的副本被收回（交叉复核修复）')
})

test(`TCU 05316 ${nameOf('05316')} 离场时把所有鲜血仪式收回场外集合（含其他调查员区域与移出游戏区）`, () => {
  const state = fixture('01001', 2)
  const inv = me(state)
  inv.hand = ['05316']
  inv.deck = Array(20).fill('01088')
  move(state, { action: 'play', cardId: '05316' })
  settle(state)
  const lexicon = me(state).assets.find(item => item.code === '05316')
  assert.equal(me(state).hand.filter(code => code === '05317').length, 1, '入场检索 1 张')
  const other = state.investigators[1]
  other.hand.push(me(state).hand.splice(me(state).hand.indexOf('05317'), 1)[0])
  other.discard.push(me(state).deck.splice(me(state).deck.indexOf('05317'), 1)[0])
  // 最后一张放进「移出游戏」区（非调查员场外区域），离场时同样要收回。
  state.removedFromGame = [me(state).deck.splice(me(state).deck.indexOf('05317'), 1)[0]]
  run(state, current => returnAssetToHand(current, 0, { assetId: lexicon.id }, []))
  const otherAfter = state.investigators[1]
  assert.equal(state.bondedSets['05316'].cards.filter(code => code === '05317').length, 3, '3 张全部收回场外集合')
  assert.equal(me(state).hand.filter(code => code === '05317').length, 0, '手牌里的副本被收回')
  assert.equal(otherAfter.hand.filter(code => code === '05317').length, 0, '其他调查员手牌里的副本被收回')
  assert.equal(otherAfter.discard.filter(code => code === '05317').length, 0, '其他调查员弃牌堆里的副本被收回')
  assert.equal((state.removedFromGame || []).filter(entry => (entry.code || entry) === '05317').length, 0,
    '移出游戏区里的副本被收回（交叉复核修复）')
})

// ---------------------------------------------------------------------------
// 05320 超级加倍（卓越）
// ---------------------------------------------------------------------------

test(`TCU 05320 ${nameOf('05320')} 打出一张事件后横置自身再次打出该事件`, () => {
  const state = fixture('01001')
  const inv = me(state)
  const dd = asset(state, '05320')
  inv.hand = ['01088']
  inv.resources = 30
  move(state, { action: 'play', cardId: '01088' })
  settle(state, pending => {
    if (pending.kind !== 'reaction') return null
    return pending.options.find(option => option.cardCode === '05320')?.id ?? 'skip'
  })
  const current = state.investigators[0].assets.find(item => item.id === dd.id)
  assert.equal(current.exhausted, true, '超级加倍被横置')
  assert.equal(me(state).resources, 36, '应急物品打出两次，共 +6 资源')
  assert.ok(state.log.some(line => String(line).includes('超级加倍')), '日志记录了「超级加倍」的重放')
  assert.equal(me(state).discard.filter(code => code === '01088').length, 1, '第二次打出后事件仍正常进弃牌堆')
  assert.equal(me(state).hand.filter(code => code === '01088').length, 0, '重放的是刚打出的那一张')
})

test(`TCU 05320 ${nameOf('05320')} 再次打出时支付该事件自己的费用（2 费事件结算两次）`, () => {
  const state = fixture('01001')
  asset(state, '05320')
  me(state).hand = ['05277']
  me(state).resources = 30
  const target = enemy(state, { id: 'double-double-target', fight: 2, evade: 2, health: 6, damageTaken: 0 })
  move(state, { action: 'play', cardId: '05277' })
  settle(state, pending => {
    if (pending.kind !== 'reaction') return null
    return pending.options.find(option => option.cardCode === '05320')?.id ?? 'skip'
  })
  assert.equal(state.enemies.find(item => item.id === target.id).damageTaken, 2,
    '「帮个小忙」被真实结算两次：各造成 1 点伤害')
  assert.equal(me(state).resources, 26, '两次打出各支付印刷费用 2（30-2-2）')
  assert.equal(me(state).discard.filter(code => code === '05277').length, 1, '第二次结算后事件进弃牌堆')
})

// ---------------------------------------------------------------------------
// 05324 美满结局（显式简化：负修正标记 → 等值正修正）
// ---------------------------------------------------------------------------

test(`TCU 05324 ${nameOf('05324')} 负修正标记将要令技能值降到 0 时翻转为正修正`, () => {
  const state = fixture('01001')
  const inv = me(state)
  inv.hand = ['05324']
  inv.resources = 10
  state.chaosBag = ['-4']
  state.testResult = null
  run(state, current => {
    performTest(current, 0, 'willpower', 3, { resolve: result => { current.testResult = result } })
  }, pending => {
    if (pending.kind !== 'reaction') return null
    return pending.options.find(option => option.cardCode === '05324')?.id ?? null
  })
  assert.equal(state.testResult?.drawn?.includes('-4'), true, '揭示了 -4 标记')
  assert.equal(state.testResult?.success, true, '翻转成正修正后检定成功')
  assert.equal(me(state).resources, 8, '打出费用 2')
  assert.ok(me(state).discard.includes('05324'), '快速事件结算后进弃牌堆')
})
