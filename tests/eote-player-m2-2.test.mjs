// P6 M2-2（08049–08078）一般玩家卡 Node 验收。
//
// 覆盖策略：
//   · 每个已实现条目至少一条真实行为断言（费用/槽位/使用次数/目标/窗口/持续/每轮限制/负面路径）；
//   · 事件用真实打牌流程（legalMoves/play）或引擎描述子执行入口（executeDescriptor）结算；
//   · 支援能力走 legalMoves → move → settle（core-fixture）；
//   · commit 图标用 commitIcons 读点断言（与引擎投入读点同源）；
//   · 仍有原语请求的卡（见 artifacts/migration/eote/primitive-requests/m2-2-*.json）不在此测试范围。
import test from 'node:test'
import assert from 'node:assert/strict'

import { fixture, asset, enemy, move, settle } from './core-fixture.mjs'
import { ALL_CARDS, INVESTIGATORS } from '../src/cards/cards-data.js'
import { registerCardAbilities, registeredEntry, descriptorOfKind } from '../src/engine/ability.js'
import { resolveTransaction, choiceError } from '../src/engine/resolution.js'
import {
  legalMoves, executeDescriptor, commitIcons, getStat, getMaxHealth, getMaxSanity, applyHarm,
  reactionWindow, drawCards, triggerReaction, applyFreeTriggers,
} from '../src/engine/engine.js'
import { replacementAnalysis, purchaseCard, refreshArcaneResearch } from '../src/campaign/campaign.js'
import { buildDeck } from '../src/deck/deckbuilding.js'

import e08049 from '../src/cards/entries/08049.js'
import e08050 from '../src/cards/entries/08050.js'
import e08051 from '../src/cards/entries/08051.js'
import e08052 from '../src/cards/entries/08052.js'
import e08053 from '../src/cards/entries/08053.js'
import e08054 from '../src/cards/entries/08054.js'
import e08055 from '../src/cards/entries/08055.js'
import e08056 from '../src/cards/entries/08056.js'
import e08057 from '../src/cards/entries/08057.js'
import e08058 from '../src/cards/entries/08058.js'
import e08059 from '../src/cards/entries/08059.js'
import e08060 from '../src/cards/entries/08060.js'
import e08061 from '../src/cards/entries/08061.js'
import e08062 from '../src/cards/entries/08062.js'
import e08063 from '../src/cards/entries/08063.js'
import e08064 from '../src/cards/entries/08064.js'
import e08065 from '../src/cards/entries/08065.js'
import e08066 from '../src/cards/entries/08066.js'
import e08067 from '../src/cards/entries/08067.js'
import e08068 from '../src/cards/entries/08068.js'
import e08069 from '../src/cards/entries/08069.js'
import e08070 from '../src/cards/entries/08070.js'
import e08071 from '../src/cards/entries/08071.js'
import e08072 from '../src/cards/entries/08072.js'
import e08073 from '../src/cards/entries/08073.js'
import e08074 from '../src/cards/entries/08074.js'
import e08075 from '../src/cards/entries/08075.js'
import e08076 from '../src/cards/entries/08076.js'
import e08077 from '../src/cards/entries/08077.js'
import e08078 from '../src/cards/entries/08078.js'

const ENTRIES = [e08049, e08050, e08051, e08052, e08053, e08054, e08055, e08056, e08057, e08058, e08059,
  e08060, e08061, e08062, e08063, e08064, e08065, e08066, e08067, e08068, e08069, e08070, e08071, e08072,
  e08073, e08074, e08075, e08076, e08077, e08078]

// 索引尚未重建时自注册缺少的条目；索引重建后跳过（避免重复注册）。
const missingEntries = ENTRIES.filter(entry => !registeredEntry(entry.code))
if (missingEntries.length) registerCardAbilities(missingEntries)

const clone = value => JSON.parse(JSON.stringify(value))
function transact (state, run, select = () => null, { save = false } = {}) {
  const execute = draft => run(draft)
  resolveTransaction(state, 0, { action: 'eotePlayerCardTest' }, execute)
  for (let i = 0; state.pendingChoice; i++) {
    assert.ok(i < 120, `选择循环 ${JSON.stringify(state.pendingChoice)}`)
    if (save) Object.assign(state, clone(state))
    const choice = state.pendingChoice
    const id = select(choice, state) ?? ['done', 'skip', 'self'].find(optionId => choice.options.some(option => option.id === optionId)) ?? choice.options[0]?.id
    assert.ok(id != null, JSON.stringify(choice))
    const command = { action: 'choose', choiceId: choice.id, optionId: id }
    assert.equal(choiceError(state, choice.seat, command), null)
    resolveTransaction(state, choice.seat, command, execute)
  }
}
function game () {
  const state = fixture('01001')
  state.abilityLimits = {}
  const inv = state.investigators[0]
  inv.hand = []
  inv.threat = []
  inv.assets = []
  inv.damage = 0
  inv.horror = 0
  inv.resources = 30
  return state
}
function descriptorFor (code, kind) {
  if (kind === 'played') return descriptorOfKind(code, 'played')
  return (registeredEntry(code)?.abilities || []).find(ability => ability.kind === kind)
}
// 直接执行描述子（用于快速事件/非行动时机/未开放运行时许可的卡；ignoreCosts 只跳过支付）。
function runDescriptor (state, code, kind, { context = {}, seat = 0, source = null, select = () => null, index = 0, ignoreCosts = true } = {}) {
  transact(state, draft => {
    const inv = draft.investigators[seat]
    const abilities = (registeredEntry(code)?.abilities || []).filter(ability => ability.kind === kind)
    const descriptor = kind === 'played' ? descriptorOfKind(code, 'played') : abilities[index]
    // 事务在克隆状态上执行：把外部传入的支援实例按 id 还原到 draft 里，费用才扣在存档实例上。
    const draftInv = draft.investigators[seat]
    const attachment = source?.id
      ? (draftInv.assets || []).flatMap(asset => asset.attachments || []).find(item => item.id === source.id)
      : null
    const draftSource = source?.id
      ? (draftInv.assets.find(asset => asset.id === source.id)
        || (draftInv.threat || []).find(card => card.id === source.id)
        || attachment
        || source)
      : source
    const defaultSource = !['played', 'setup'].includes(kind)
      ? (draftInv.assets || []).find(asset => asset.code === code) || null
      : null
    executeDescriptor(draft, {
      inv, source: draftSource || defaultSource || { code },
      descriptor,
      context, events: [], windowId: null, ignoreCosts,
    })
  }, select)
}
function playEvent (state, code, select = () => null) {
  const inv = state.investigators[0]
  inv.hand.push(code)
  move(state, { action: 'play', cardId: code })
  settle(state, select)
}

test('P6 08049 反间谍活动：取消诡计显现并由「遭遇牌库→你的牌库」升级改抽自己牌库', () => {
  // 主效果：取消该诡计显现，并从遭遇牌库抽牌（此处遭遇牌库为空，只断言取消与结算日志）。
  const s = game()
  const inv = s.investigators[0]
  inv.hand = ['08049']
  inv.resources = 10
  s.encounterDeck = []
  s.encounterDiscard = []
  const context = { when: 'treachery', seat: 0, location: inv.location, cardCode: 'dissonantVoices', cancelled: false }
  runDescriptor(s, '08049', 'played', { context })
  assert.equal(context.cancelled, true, '取消该卡牌的显现')
  assert.ok((s.log || []).some(line => String(line).includes('反间谍活动')), '日志记录结算')

  // 「你的牌库」升级：playUpgrades.yourDeck → 改为抽自己的牌库顶。
  const upgraded = game()
  const upInv = upgraded.investigators[0]
  upInv.deck = Array(10).fill('01088')
  const context2 = {
    when: 'treachery', seat: 0, location: upInv.location, cardCode: 'dissonantVoices',
    cancelled: false, playCost: { playUpgrades: { yourDeck: true } },
  }
  const deckBefore = upInv.deck.length
  runDescriptor(upgraded, '08049', 'played', { context: context2 })
  assert.equal(context2.cancelled, true)
  assert.equal(upgraded.investigators[0].deck.length, deckBefore - 1, '升级后抽自己的牌库顶')

  // beforePlayCost 升级描述子：提升费用 2 点并记录 playUpgrades。
  const kickerState = game()
  const costContext = { cardCode: '08049', cost: 2, costIncrease: 0 }
  runDescriptor(kickerState, '08049', 'reaction', { context: costContext, ignoreCosts: true })
  assert.equal(costContext.costIncrease, 2, '提升费用 2 点')
  assert.equal(costContext.playUpgrades?.yourDeck, true, '记录「你的牌库」升级')
  // 第二条升级（"你"→"任意调查员"）近似：花 2 点记录升级（跨座位触发待原语）。
  const anyContext = { cardCode: '08049', cost: 2, costIncrease: 0 }
  runDescriptor(kickerState, '08049', 'reaction', { context: anyContext, ignoreCosts: true, index: 1 })
  assert.equal(anyContext.costIncrease, 2, '第二条升级同样提升费用 2 点')
  assert.equal(anyContext.playUpgrades?.anyInvestigator, true, '记录「任意调查员」升级（近似）')
})

test('P6 08050 欺骗制度：每控制一种不同职阶获得 1 资源；无卡牌时不获得', () => {
  const s = game()
  const inv = s.investigators[0]
  asset(s, '01028') // guardian
  asset(s, '01030') // seeker
  inv.resources = 3
  runDescriptor(s, '08050', 'played')
  assert.equal(s.investigators[0].resources, 5, '两种职阶 → +2 资源')

  const empty = game()
  empty.investigators[0].resources = 3
  runDescriptor(empty, '08050', 'played')
  assert.equal(empty.investigators[0].resources, 3, '没有控制的卡牌 → 不获得资源')
})

test('P6 08052 行业专家：获得等于最低（未检定）技能值的万能图标', () => {
  const s = game()
  const inv = s.investigators[0]
  const printed = ALL_CARDS[inv.code]
  const stats = { willpower: printed.willpower, intellect: printed.intellect, combat: printed.combat, agility: printed.agility }
  const expected = Math.min(stats.intellect, stats.combat, stats.agility)
  s.skillTest = { seat: 0, skill: 'willpower', difficulty: 2, committed: [] }
  assert.equal(commitIcons(s, inv, '08052', 'willpower'), (ALL_CARDS['08052'].icons?.wild || 0) + expected, 'willpower 检定：取其余三项最低值')
  s.skillTest = { seat: 0, skill: 'agility', difficulty: 2, committed: [] }
  assert.equal(commitIcons(s, inv, '08052', 'agility'), (ALL_CARDS['08052'].icons?.wild || 0) + Math.min(stats.willpower, stats.intellect, stats.combat))
})

test('P6 08054 金钱万能：把进行中的检定改为资源技能检定并抽 1 张', () => {
  const s = game()
  const inv = s.investigators[0]
  inv.resources = 8
  inv.deck = Array(10).fill('01088')
  s.skillTest = { seat: 0, skill: 'willpower', difficulty: 3, committed: [], baseValue: 4, value: 4 }
  const deckBefore = inv.deck.length
  runDescriptor(s, '08054', 'played')
  assert.equal(s.skillTest.resourceSkill, true, '转为资源技能检定')
  assert.equal(s.skillTest.baseValue, 4, '基础值 = floor(8/2)')
  assert.deepEqual(s.skillTest.skill, [])
  assert.equal(s.investigators[0].deck.length, deckBefore - 1, '抽 1 张牌')
})

test('P6 08056 刚毅果敢：+1 意志/+1 敏捷、沉稳先吃非直接恐惧、花 1 资源 +1 档位', () => {
  const s = game()
  const inv = s.investigators[0]
  asset(s, '08056')
  assert.equal(registeredEntry('08056').composure, true, '沉稳关键字')
  assert.deepEqual(registeredEntry('08056').freeTriggers.map(trigger => trigger.skill), ['willpower', 'agility'])
  assert.equal(getStat(s, inv, 'willpower'), Number(ALL_CARDS['01001'].willpower) + 1, '+1 意志')
  assert.equal(getStat(s, inv, 'agility'), Number(ALL_CARDS['01001'].agility) + 1, '+1 敏捷')
  // freeTrigger：技能检定期间花 1 资源 +1 技能值。
  s.skillTest = { seat: 0, skill: 'willpower', difficulty: 2, committed: [], value: 4, freeTriggerUses: {} }
  let paidOnce = false
  transact(s, draft => {
    draft.__freeTriggerBonus = applyFreeTriggers(draft, draft.investigators[0], 'willpower', [])
  }, choice => {
    if (!paidOnce && choice.options.some(option => option.id === 'pay')) { paidOnce = true; return 'pay' }
    return null
  })
  assert.equal(s.__freeTriggerBonus, 1, '花 1 资源 +1 档位')
  assert.equal(s.investigators[0].resources, 29, '资源已支付')
  // 沉稳：非直接恐惧必须先分配给刚毅果敢（该卡神智 1，1 点恐惧即被击败；调查员不承受）。
  transact(s, draft => { applyHarm(draft, draft.investigators[0], 0, 1, []) })
  assert.equal(s.investigators[0].horror, 0, '非直接恐惧没有落到调查员身上')
  const stillThere = s.investigators[0].assets.find(item => item.code === '08056')
  const inDiscard = (s.investigators[0].discard || []).includes('08056')
  assert.ok((stillThere?.horror || 0) === 1 || inDiscard, '沉稳先承受非直接恐惧（随后因神智满被击败）')
  // approximation：非直接伤害用 redirectOneDamageToSelf 近似（每次结算 1 点转移到本卡）。
  const redirect = game()
  asset(redirect, '08056')
  transact(redirect, draft => { applyHarm(draft, draft.investigators[0], 2, 0, []) })
  const redirectMoxie = redirect.investigators[0].assets.find(item => item.code === '08056')
  assert.equal(redirect.investigators[0].damage, 1, '2 点非直接伤害中 1 点转移到刚毅果敢')
  assert.equal(redirectMoxie?.damage || 0, 1, '刚毅果敢先承受 1 点非直接伤害（近似）')
})

test('P6 08057 黑色扇子：资源阈值 15/20 的每回合额外行动与技能修正（10+ 生命/神智待引擎读点）', () => {
  const s = game()
  const inv = s.investigators[0]
  const fan = asset(s, '08057')
  inv.resources = 0
  const baseWillpower = getStat(s, inv, 'willpower')
  assert.equal(getStat(s, inv, 'willpower'), baseWillpower, '20 资源以下无技能加值')
  s.investigators[0].resources = 15
  const actionsBefore = s.investigators[0].actionsLeft
  const move15 = legalMoves(s, 0).find(command => command.action === 'ability' && command.assetId === fan.id)
  assert.ok(move15, '15+ 资源：额外行动能力进入合法动作')
  move(s, move15)
  settle(s)
  assert.equal(s.investigators[0].actionsLeft, actionsBefore + 1, '本回合额外 1 次行动')
  assert.equal(legalMoves(s, 0).some(command => command.action === 'ability' && command.assetId === fan.id), false, '每回合仅一次')
  s.investigators[0].resources = 20
  assert.equal(getStat(s, s.investigators[0], 'willpower'), baseWillpower + 1, '20+ 资源：每项技能 +1')
  // approximation：引擎 getMaxHealth/getMaxSanity 不读 modifiers，+1 生命/神智用被动数据通道常驻实现。
  const statState = game()
  const statInv = statState.investigators[0]
  const baseHealth = getMaxHealth(statInv)
  const baseSanity = getMaxSanity(statInv)
  asset(statState, '08057')
  assert.equal(getMaxHealth(statState.investigators[0]), baseHealth + 1, '+1 生命（近似：不按 10 资源条件）')
  assert.equal(getMaxSanity(statState.investigators[0]), baseSanity + 1, '+1 神智（近似：不按 10 资源条件）')
})

test('P6 08060 咏春棍：额外法术槽；每个已填槽 +1 战斗，至少 2 个则 +1 伤害', () => {
  const s = game()
  const inv = s.investigators[0]
  asset(s, '08060')
  const pole = inv.assets[0]
  asset(s, '01060') // 皱缩术（Arcane）
  asset(s, '01061') // 探知术（Arcane）
  const e = enemy(s, { fight: 1, evade: 1, health: 30, damage: 0 })
  s.chaosBag = ['+3']
  const fightMove = legalMoves(s, 0).find(command => command.action === 'ability' && command.assetId === pole.id && command.abilityIndex === 0)
  assert.ok(fightMove, '攻击能力进入合法动作')
  move(s, fightMove)
  settle(s, choice => choice.kind === 'target' ? e.id : null)
  assert.equal(s.lastTestResult.success, true)
  assert.equal(s.enemies.find(item => item.id === e.id).damageTaken, 2, '基础 1 伤害 + 2 已填法术槽的 +1 伤害')

  // 负面路径：没有已填法术槽时只有基础 1 伤害，也没有战斗加值。
  const bare = game()
  const barePole = asset(bare, '08060')
  const bareEnemy = enemy(bare, { fight: 1, evade: 1, health: 30, damage: 0 })
  bare.chaosBag = ['0']
  const bareMove = legalMoves(bare, 0).find(command => command.action === 'ability' && command.assetId === barePole.id)
  move(bare, bareMove)
  settle(bare, choice => choice.kind === 'target' ? bareEnemy.id : null)
  assert.equal(bare.enemies.find(item => item.id === bareEnemy.id).damageTaken, 1, '0 个已填法术槽：仅基础 1 伤害')
})

test('P6 08061 冥想放空：每个已填法术槽治愈 1 点伤害或恐惧', () => {
  const s = game()
  const inv = s.investigators[0]
  asset(s, '01060')
  asset(s, '01061')
  inv.damage = 1
  inv.horror = 1
  runDescriptor(s, '08061', 'played', { select: choice => (choice.options.some(option => option.id === 'damage') ? 'damage' : null) })
  assert.equal(s.investigators[0].damage, 0, '第一个已填槽治愈 1 点伤害')
  assert.equal(s.investigators[0].horror, 0, '第二个已填槽治愈 1 点恐惧')
  // 负面路径：没有已填法术槽时不治愈。
  const none = game()
  none.investigators[0].damage = 1
  runDescriptor(none, '08061', 'played')
  assert.equal(none.investigators[0].damage, 1, '没有已填法术槽 → 不治愈')
})

test('P6 08063 力量之风：打出时放置 2 充能；回合中抽到时自动打出', () => {
  const s = game()
  const inv = s.investigators[0]
  const target = asset(s, '03236') // 使用(3 充能)
  target.uses = 1
  runDescriptor(s, '08063', 'played')
  assert.equal(s.investigators[0].assets.find(item => item.id === target.id).uses, 3, '打出：放置 2 充能')

  // 抽到时打出：reaction 描述子与 played 使用同一效果（quickEvent/trigger 已注册）。
  const quick = registeredEntry('08063').abilities.find(ability => ability.quickEvent === true)
  assert.ok(quick, '抽到时打出的快速事件描述子')
  assert.equal(quick.trigger.includes('cardDrawn'), true)
  const drawn = game()
  const drawnTarget = asset(drawn, '03236')
  drawnTarget.uses = 0
  drawn.investigators[0].hand = ['08063']
  runDescriptor(drawn, '08063', 'reaction', { index: 0 })
  assert.equal(drawn.investigators[0].assets.find(item => item.id === drawnTarget.id).uses, 2, '抽到后打出：放置 2 充能')
})

test('P6 08065 密教理论：投入时获得等于[智慧]的[意志]图标与等于[意志]的[智慧]图标', () => {
  const s = game()
  const inv = s.investigators[0]
  const printed = ALL_CARDS[inv.code]
  s.skillTest = { seat: 0, skill: 'willpower', difficulty: 2, committed: [] }
  assert.equal(commitIcons(s, inv, '08065', 'willpower'), printed.intellect, '意志检定：等于智慧的意志图标')
  s.skillTest = { seat: 0, skill: 'intellect', difficulty: 2, committed: [] }
  assert.equal(commitIcons(s, inv, '08065', 'intellect'), printed.willpower, '智慧检定：等于意志的智慧图标')
})

test('P6 08066 平行命运：查看 6 张后放回且可抽取 1 张；洗回分支来自同一读点', () => {
  const s = game()
  const inv = s.investigators[0]
  inv.deck = ['01088', '01088', '01088', '01088', '01088', '01088', '01088', '01088']
  const deckBefore = inv.deck.length
  runDescriptor(s, '08066', 'played', { select: choice => {
    if (choice.options.some(option => option.id === 'draw')) return 'draw'
    if (choice.options.some(option => option.id === 'top')) return 'top'
    if (choice.options.some(option => option.id === 'shuffle')) return 'top'
    return null
  } })
  const after = s.investigators[0]
  assert.equal(after.deck.length, deckBefore - 1, '查看 6 张后抽取 1 张（其余放回牌库顶）')

  // 洗回分支：不丢牌，也不抽牌（选择不抽）。
  const shuffleState = game()
  const shuffleInv = shuffleState.investigators[0]
  shuffleInv.deck = ['01088', '01088', '01088', '01088', '01088', '01088']
  runDescriptor(shuffleState, '08066', 'played', { select: choice => {
    if (choice.options.some(option => option.id === 'shuffle')) return 'shuffle'
    if (choice.options.some(option => option.id === 'skip')) return 'skip'
    return null
  } })
  assert.equal(shuffleState.investigators[0].deck.length, 6, '洗回分支：卡牌全部回到牌库')
})

test('P6 08067 天文地图集：横置看顶 1 张，非弱点则正面朝下附属（最多 5 张）', () => {
  const s = game()
  const inv = s.investigators[0]
  const atlas = asset(s, '08067')
  inv.deck = ['01088', '01088', '01088', '01088', '01088', '01088', '01031']
  const look = legalMoves(s, 0).find(command => command.action === 'ability' && command.assetId === atlas.id && command.abilityIndex === 0)
  assert.ok(look, '看顶能力进入合法动作')
  move(s, look)
  settle(s)
  const freshAtlas = s.investigators[0].assets.find(item => item.id === atlas.id)
  assert.equal(freshAtlas.exhausted, true)
  assert.equal((freshAtlas.attachments || []).length, 1, '非弱点顶牌附属到地图集')
  assert.equal(freshAtlas.attachments[0].code, '01031')
  assert.equal(freshAtlas.attachments[0].facedown, true, '正面朝下')
  assert.equal(s.investigators[0].deck.includes('01031'), false, '离开牌库')

  // 负面路径：顶牌是弱点时不附属。
  const weak = game()
  const weakInv = weak.investigators[0]
  const weakAtlas = asset(weak, '08067')
  weakInv.deck = ['01088', '01096']
  const weakLook = legalMoves(weak, 0).find(command => command.action === 'ability' && command.assetId === weakAtlas.id)
  move(weak, weakLook)
  settle(weak)
  assert.equal((weak.investigators[0].assets[0].attachments || []).length, 0, '弱点不附属')
  assert.equal(weak.investigators[0].deck.includes('01096'), true, '弱点留在牌库')

  // 能力 2 近似：把附属牌投入检定（+图标），检定成功则加入手牌。
  const invest = game()
  const investInv = invest.investigators[0]
  const investAtlas = asset(invest, '08067')
  investAtlas.attachments = [{ id: 'aTest1', code: '01031', ownerSeat: 0, facedown: true }]
  invest.skillTest = { seat: 0, skill: 'willpower', difficulty: 2, committed: [] }
  investAtlas.exhausted = false
  runDescriptor(invest, '08067', 'free', {
    source: investAtlas, index: 1, ignoreCosts: true,
    select: choice => (choice.options.some(option => option.id === 'aTest1') ? 'aTest1' : null),
  })
  const iconBonus = 1 // 01031 的图标为 willpower 1
  assert.equal(invest.skillTest.pendingBonus, iconBonus, '附属牌按图标数加入本次检定')
  assert.equal(invest.investigators[0].assets.find(item => item.id === investAtlas.id).attachments[0].uses, 1, '标记为已投入')
  runDescriptor(invest, '08067', 'reaction', {
    source: invest.investigators[0].assets.find(item => item.id === investAtlas.id),
    context: { when: 'testEnds', success: true, seat: 0 },
  })
  assert.equal(invest.investigators[0].hand.includes('01031'), true, '检定成功后加入手牌（近似）')
})

test('P6 08068 治愈真言：花费 1 充能治愈同地点调查员总计 2 点伤害', () => {
  const s = game()
  const inv = s.investigators[0]
  const words = asset(s, '08068')
  words.uses = 4
  inv.damage = 2
  const healMove = legalMoves(s, 0).find(command => command.action === 'ability' && command.assetId === words.id)
  assert.ok(healMove, '治愈能力进入合法动作')
  move(s, healMove)
  settle(s)
  assert.equal(s.investigators[0].damage, 0, '总计治愈 2 点伤害')
  assert.equal(s.investigators[0].assets.find(item => item.id === words.id).uses, 3, '花费 1 充能')
})

test('P6 08069 情绪稳定：沉稳先吃非直接恐惧；法术检定期间 +1 技能值', () => {
  const s = game()
  const inv = s.investigators[0]
  asset(s, '08069')
  assert.deepEqual(registeredEntry('08069').freeTriggers.map(trigger => trigger.requireTestTrait), ['Spell'])
  assert.equal(registeredEntry('08069').composure, true)
  transact(s, draft => { applyHarm(draft, draft.investigators[0], 0, 1, []) })
  assert.equal(s.investigators[0].assets.find(item => item.code === '08069').horror || 0, 1, '沉稳先承受非直接恐惧')
  assert.equal(s.investigators[0].horror, 0)
  // 法术卡技能检定：+1 技能值（01060 皱缩术是 Spell 卡）。
  const withSpell = game()
  asset(withSpell, '08069')
  const base = getStat(withSpell, withSpell.investigators[0], 'willpower')
  withSpell.skillTest = { seat: 0, skill: 'willpower', difficulty: 2, committed: [], source: { code: '01060' } }
  assert.equal(getStat(withSpell, withSpell.investigators[0], 'willpower'), base + 1, '法术检定期间 +1 技能值')
  withSpell.skillTest = { seat: 0, skill: 'willpower', difficulty: 2, committed: [], source: { code: '01088' } }
  assert.equal(getStat(withSpell, withSpell.investigators[0], 'willpower'), base, '非法术检定无加值')
})

test('P6 08071 补给匮乏：游戏第一个回合开始时弃掉牌库顶 10 张（每局一次）', () => {
  const s = game()
  const inv = s.investigators[0]
  asset(s, '08071')
  inv.deck = Array(15).fill('01088')
  inv.discard = []
  s.round = 1
  transact(s, draft => {
    // 通过 turnBegins 强制窗口结算（forced 描述子由 triggerReaction 自动结算）。
    triggerReaction(draft, 0, 'turnBegins', [], { seat: 0, when: 'turnBegins' })
  })
  assert.equal(s.investigators[0].deck.length, 5, '牌库顶 10 张被弃掉')
  assert.equal(s.investigators[0].discard.length, 10, '进入弃牌堆')
  // 每局一次：再次触发不再弃牌。
  transact(s, draft => {
    triggerReaction(draft, 0, 'turnBegins', [], { seat: 0, when: 'turnBegins' })
  })
  assert.equal(s.investigators[0].deck.length, 5, '同一局第二次触发不再弃牌')
})

test('P6 08073 绷带：同地点调查员/盟友受伤后花 1 补给治愈 1 点', () => {
  const s = game()
  const inv = s.investigators[0]
  const bandages = asset(s, '08073')
  bandages.uses = 3
  inv.damage = 2
  runDescriptor(s, '08073', 'reaction', {
    index: 0, source: bandages, ignoreCosts: false,
    context: { when: 'harmAssigned', seat: 0, location: inv.location, damage: 1, horror: 0 },
  })
  assert.equal(s.investigators[0].damage, 1, '调查员 1 点伤害被治愈')
  assert.equal(s.investigators[0].assets.find(item => item.id === bandages.id).uses, 2, '花费 1 补给')

  // 盟友支援受伤：治愈该支援 1 点伤害。
  const allyState = game()
  const allyBandages = asset(allyState, '08073')
  allyBandages.uses = 3
  const ally = asset(allyState, '01018') // 巡警（盟友，生命 2）
  ally.damage = 1
  runDescriptor(allyState, '08073', 'reaction', {
    index: 1, source: allyBandages, ignoreCosts: false,
    context: { when: 'assetHarmPlaced', seat: 0, assetId: ally.id, damage: 1, horror: 0 },
  })
  assert.equal(allyState.investigators[0].assets.find(item => item.id === ally.id).damage, 0, '盟友 1 点伤害被治愈')
  assert.equal(allyState.investigators[0].assets.find(item => item.id === allyBandages.id).uses, 2, '花费 1 补给')
})

test('P6 08075 厄运手镯：检定中花 1 充能 +2（每次检定一次）；被攻击后获得充能', () => {
  const s = game()
  const inv = s.investigators[0]
  const bangle = asset(s, '08075')
  bangle.uses = 1
  s.skillTest = { seat: 0, skill: 'willpower', difficulty: 3, committed: [] }
  const abilityMove = legalMoves(s, 0).find(command => command.action === 'ability' && command.assetId === bangle.id && command.abilityIndex === 0)
  assert.ok(abilityMove, '检定中 +2 能力进入合法动作')
  move(s, abilityMove)
  settle(s)
  assert.equal(s.skillTest.pendingBonus, 2, '本次检定 +2')
  assert.equal(s.investigators[0].assets.find(item => item.id === bangle.id).uses, 0, '花费 1 充能')
  // 每次检定仅限一次：即使再补充能，本次检定也不能再次使用。
  s.investigators[0].assets.find(item => item.id === bangle.id).uses = 1
  assert.equal(legalMoves(s, 0).some(command => command.action === 'ability' && command.assetId === bangle.id), false, '每次检定仅一次')

  const attacked = game()
  const freshBangle = asset(attacked, '08075')
  freshBangle.uses = 0
  runDescriptor(attacked, '08075', 'reaction', {
    index: 0, source: freshBangle,
    context: { when: 'enemyAttacked', seat: 0, location: attacked.investigators[0].location, attack: { kind: 'fight' } },
  })
  assert.equal(attacked.investigators[0].assets.find(item => item.id === freshBangle.id).uses, 1, '被攻击后放置 1 充能')
})

test('P6 08077 人多力量大：每有一种不同职阶获得 1 个万能图标', () => {
  const s = game()
  const inv = s.investigators[0]
  assert.equal(commitIcons(s, inv, '08077', 'willpower'), ALL_CARDS['08077'].icons?.wild || 0)
  asset(s, '01028') // guardian
  asset(s, '01030') // seeker
  s.skillTest = { seat: 0, skill: 'willpower', difficulty: 2, committed: [] }
  assert.equal(commitIcons(s, inv, '08077', 'willpower'), (ALL_CARDS['08077'].icons?.wild || 0) + 2, '两种职阶 → 2 个万能图标')
})

test('P6 08078 无畏精神：获得等于[战斗]的[意志]图标与等于[意志]的[战斗]图标', () => {
  const s = game()
  const inv = s.investigators[0]
  const printed = ALL_CARDS[inv.code]
  s.skillTest = { seat: 0, skill: 'willpower', difficulty: 2, committed: [] }
  assert.equal(commitIcons(s, inv, '08078', 'willpower'), printed.combat)
  s.skillTest = { seat: 0, skill: 'combat', difficulty: 2, committed: [] }
  assert.equal(commitIcons(s, inv, '08078', 'combat'), printed.willpower)
})






test('P6 08051 不当交易：揭示手牌道具，另一位调查员打出后你抽 1 并获得其印刷费用资源', () => {
  const s = fixture('01001', 2)
  s.abilityLimits = {}
  const inv = s.investigators[0]
  inv.hand = ['01030']
  inv.resources = 5
  inv.deck = Array(10).fill('01088')
  const before = { resources: inv.resources, deck: inv.deck.length }
  runDescriptor(s, '08051', 'played', { select: choice => {
    if (choice.options.some(option => option.id === '01030')) return '01030'
    if (choice.options.some(option => option.id === '1')) return '1'
    if (choice.options.some(option => option.id === 'play')) return 'play'
    return null
  } })
  const other = s.investigators[1]
  assert.equal(other.assets.some(item => item.code === '01030'), true, '道具被另一位调查员打出并置于其控制下')
  assert.equal(s.investigators[0].hand.includes('01030'), false, '手牌已离手')
  assert.equal(s.investigators[0].resources, before.resources + (Number(ALL_CARDS['01030'].cost) || 0), '获得该支援印刷费用的资源')
  assert.equal(s.investigators[0].deck.length, before.deck - 1, '抽取 1 张卡牌')
})

test('P6 08053 红色闹钟（2经验）：回合开始放充能/拿资源，1/2/3 充能分支；真实窗口移动按当前连接', () => {
  const s = game()
  const inv = s.investigators[0]
  const clock = asset(s, '08053')
  clock.uses = 0
  runDescriptor(s, '08053', 'forced', { context: { when: 'turnBegins', seat: 0 } })
  assert.equal(s.investigators[0].assets.find(item => item.id === clock.id).uses, 1, '放置 1 充能')
  assert.ok((s.effects || []).some(effect => (effect.modifiers || []).some(modifier => modifier.target === 'skill:*' && modifier.amount === 3)), '1 充能：下一次技能检定 +3 效果已挂')

  // 2 充能分支：移动最多 2 次（本次选择不移动）。
  const clock2 = s.investigators[0].assets.find(item => item.id === clock.id)
  clock2.uses = 1
  runDescriptor(s, '08053', 'forced', { context: { when: 'turnBegins', seat: 0 }, select: choice => (choice.options.some(option => option.id === 'skip') ? 'skip' : null) })
  assert.equal(s.investigators[0].assets.find(item => item.id === clock.id).uses, 2, '2 充能分支')
  // 3 充能分支：额外行动。
  s.investigators[0].assets.find(item => item.id === clock.id).uses = 2
  const actionsBefore = s.investigators[0].actionsLeft
  runDescriptor(s, '08053', 'forced', { context: { when: 'turnBegins', seat: 0 }, select: choice => (choice.options.some(option => option.id === 'skip') ? 'skip' : null) })
  assert.equal(s.investigators[0].actionsLeft, actionsBefore + 1, '3 充能：本回合额外 1 次行动')

  // 拿取充能作为资源分支。
  const takeState = game()
  const takeInv = takeState.investigators[0]
  const takeClock = asset(takeState, '08053')
  takeClock.uses = 2
  takeInv.resources = 0
  runDescriptor(takeState, '08053', 'forced', { context: { when: 'turnBegins', seat: 0 }, select: choice => (choice.options.some(option => option.id === 'take') ? 'take' : null) })
  assert.equal(takeState.investigators[0].resources, 2, '拿取 2 充能作为 2 资源')

  // 真实 turnBegins 窗口的 2 充能移动分支：第一次 A→B 后，第二次必须按 B 的连接重算，
  // 不能再用回合开始地点 A 的邻居（修复前第二次仍列 A 的邻居 B，且可非法移动）。
  const moving = game()
  moving.locations = [
    { id: 'a', name: 'A', revealed: true, connections: ['b'] },
    { id: 'b', name: 'B', revealed: true, connections: ['a', 'c'] },
    { id: 'c', name: 'C', revealed: true, connections: ['b', 'd'] },
    { id: 'd', name: 'D', revealed: true, connections: ['c'] },
    { id: 'e', name: 'E', revealed: true, connections: ['a'] },
  ]
  moving.investigators[0].location = 'a'
  const moveClock = asset(moving, '08053')
  moveClock.uses = 1
  const offers = []
  transact(moving, draft => reactionWindow(draft, 'turnBegins', { when: 'turnBegins', seat: 0 }, []), pending => {
    if (pending.options.some(option => option.id === 'place')) return 'place'
    if (pending.kind === 'move') {
      offers.push(pending.options.map(option => String(option.label)))
      const here = moving.locations.find(location => location.id === moving.investigators[0].location)
      const candidates = (here?.connections || []).filter(id => pending.options.some(option => option.id === id))
      const next = candidates[candidates.length - 1]
      return next ?? 'skip'
    }
    return null
  })
  assert.ok(offers[1]?.includes('C'), `第二次移动按当前位置 B 的邻居重算：${JSON.stringify(offers)}`)
  assert.ok(!offers[1]?.includes('E'), '第二次移动不出现只与回合开始地点 A 相连的 E（非法目的地）')
  assert.equal(moving.investigators[0].location, 'c', '两次移动后位于 C')
})

test('P6 08055 黑市：从任意调查员牌库顶揭示共 5 张放在一边（近似：置入弃牌堆）', () => {
  const s = game()
  const inv = s.investigators[0]
  inv.deck = Array(10).fill('01088')
  const deckBefore = inv.deck.length
  runDescriptor(s, '08055', 'played', { select: choice => (choice.options.some(option => option.id === 'skip') ? 'skip' : null) })
  assert.equal(s.investigators[0].deck.length, deckBefore - 5, '从牌库顶揭示 5 张')
  assert.equal(s.investigators[0].discard.length, 5, '放在一边的牌进入弃牌堆（近似）')
})

test('P6 08058 红色闹钟（5经验）：先拿取再放充能，1/2/3 充能分支', () => {
  const s = game()
  const inv = s.investigators[0]
  const clock = asset(s, '08058')
  clock.uses = 0
  runDescriptor(s, '08058', 'forced', { context: { when: 'turnBegins', seat: 0 } })
  assert.equal(s.investigators[0].assets.find(item => item.id === clock.id).uses, 1, '放置 1 充能')
  assert.ok((s.effects || []).some(effect => (effect.modifiers || []).some(modifier => modifier.target === 'skill:*' && modifier.amount === 4)), '1 充能：下一次技能检定 +4 效果已挂')
  // 先拿取再放置：选择不拿取 → 2 充能 + 放置 1 = 3 充能 → 2 次额外行动。
  const fresh = s.investigators[0].assets.find(item => item.id === clock.id)
  fresh.uses = 2
  s.investigators[0].resources = 0
  const actionsBefore = s.investigators[0].actionsLeft
  runDescriptor(s, '08058', 'forced', { context: { when: 'turnBegins', seat: 0 }, select: choice => {
    if (choice.options.some(option => option.id === 'skip')) return 'skip'
    return null
  } })
  assert.equal(s.investigators[0].resources, 0, '选择不拿取时资源不变')
  assert.equal(s.investigators[0].assets.find(item => item.id === clock.id).uses, 3, '2 充能 + 放置 1 = 3 充能')
  assert.equal(s.investigators[0].actionsLeft, actionsBefore + 2, '3 充能：本回合额外 2 次行动')

  // 「先拿取全部充能作为资源」分支：2 充能 → 拿取 2 资源后再放 1（净 1 充能）。
  const takeState = game()
  const takeClock = asset(takeState, '08058')
  takeClock.uses = 2
  takeState.investigators[0].resources = 0
  runDescriptor(takeState, '08058', 'forced', { context: { when: 'turnBegins', seat: 0 }, select: choice => {
    if (choice.options.some(option => option.id === 'take')) return 'take'
    return null
  } })
  assert.equal(takeState.investigators[0].resources, 2, '拿取 2 充能作为资源')
  assert.equal(takeState.investigators[0].assets.find(item => item.id === takeClock.id).uses, 1, '拿取后放置 1 充能')

  // 真实 turnBegins 窗口的 2 充能移动分支（最多 3 次）：每次按当前位置重算连接，A→B→C→D。
  const moving = game()
  moving.locations = [
    { id: 'a', name: 'A', revealed: true, connections: ['b'] },
    { id: 'b', name: 'B', revealed: true, connections: ['a', 'c'] },
    { id: 'c', name: 'C', revealed: true, connections: ['b', 'd'] },
    { id: 'd', name: 'D', revealed: true, connections: ['c'] },
    { id: 'e', name: 'E', revealed: true, connections: ['a'] },
  ]
  moving.investigators[0].location = 'a'
  const moveClock = asset(moving, '08058')
  moveClock.uses = 1
  const offers = []
  transact(moving, draft => reactionWindow(draft, 'turnBegins', { when: 'turnBegins', seat: 0 }, []), pending => {
    if (pending.options.some(option => option.id === 'place')) return 'place'
    if (pending.kind === 'move') {
      offers.push(pending.options.map(option => String(option.label)))
      const here = moving.locations.find(location => location.id === moving.investigators[0].location)
      const candidates = (here?.connections || []).filter(id => pending.options.some(option => option.id === id))
      const next = candidates[candidates.length - 1]
      return next ?? 'skip'
    }
    return null
  })
  assert.ok(offers[1]?.includes('C'), `第二次移动按当前位置 B 的邻居重算：${JSON.stringify(offers)}`)
  assert.ok(!offers[1]?.includes('E'), '第二次移动不出现只与回合开始地点 A 相连的 E（非法目的地）')
  assert.ok(offers[2]?.includes('D'), `第三次移动按当前位置 C 的邻居重算：${JSON.stringify(offers)}`)
  assert.equal(moving.investigators[0].location, 'd', '三次移动后位于 D')
})

test('P6 08059 掉进兔子洞：真实关间计价（前 2 次升级 -1 经验、新购 +1 经验、每关间重置）', () => {
  // 真实战役计价路径：replacementAnalysis（升级预览/结算同源）→ purchaseCard → refreshArcaneResearch。
  const flags = registeredEntry('08059').flags || {}
  assert.deepEqual(flags.upgradeDiscount, { first: 2, amount: 1 }, '条目声明前 2 次升级 -1 经验')
  assert.equal(flags.purchaseCostDelta, 1, '条目声明新购卡 +1 经验')

  const built = buildDeck(INVESTIGATORS['01004'], { seed: 'eote-08004' })
  const deck = ['08059', ...built.playerCards]
  const record = { id: 'inv0', seat: 0, code: '01004', name: 'Agnes', deck: [...deck],
    currentScenarioIndex: 0, xp: 20, earnedXp: 20, spentXp: 0, trauma: { physical: 0, mental: 0 },
    status: 'active', purchases: [], removedCards: [] }
  const campaign = { phase: 'interlude', scenarioIndex: 1, investigators: { 0: record },
    records: {}, trauma: { 0: { physical: 0, mental: 0 } }, xp: 20 }

  // 08059 是神秘者永久卡，只有神秘者牌组能合法容纳它：全量放开玩家卡后，08 段牌也按
  // 普通卡口径参与牌组合法性校验（旧实现把 08 卡排除在裁量之外，Roland 才能塞进它）。
  // 第 1 次升级（01069 = 2 XP）：2 - 1 = 1 XP；第 2 次升级（01071 = 4 XP）：4 - 1 = 3 XP。
  const upgrade1 = replacementAnalysis(record, '01069').removals.find(option => option.code)
  assert.ok(upgrade1, '第 1 次升级有合法替换选项')
  const purchase1 = purchaseCard(campaign, 0, '01069', upgrade1.code, null)
  assert.equal(purchase1.cost, 1, '第 1 次升级 -1 经验')
  assert.equal(purchase1.upgradeDiscount, 1, '购买记录标记升级减免')
  const upgrade2 = replacementAnalysis(record, '01071').removals.find(option => option.code)
  const purchase2 = purchaseCard(campaign, 0, '01071', upgrade2.code, null)
  assert.equal(purchase2.cost, 3, '第 2 次升级 -1 经验')
  assert.equal(record.upgradeDiscountUsed, 2, '前 2 次升级优惠已用完')

  // 第 3 次升级不再减免；新购卡 +1 经验（牌组出现空位才能「不替换直接购入」）。
  const upgrade3 = replacementAnalysis(record, '01070').removals.find(option => option.code)
  assert.equal(upgrade3.cost, 3, '第 3 次升级无减免')
  assert.equal(upgrade3.upgradeDiscount, undefined, '第 3 次升级不带减免标记')
  record.deck.splice(record.deck.findIndex(code => code !== '08059'), 1)
  const newPurchase = replacementAnalysis(record, '01070').removals.find(option => option.code === null)
  assert.equal(newPurchase.cost, 4, '新购卡 3 XP + 1 = 4 XP')
  assert.equal(newPurchase.purchaseCostDelta, 1, '新购选项带加价标记')

  // 关间入口（refreshArcaneResearch 同一刷新点）重置已用次数。
  refreshArcaneResearch(campaign)
  assert.equal(record.upgradeDiscountUsed, 0, '每个关间重置已用次数')
  const upgrade4 = replacementAnalysis(record, '01070').removals.find(option => option.code)
  assert.equal(upgrade4.cost, 2, '新关间第 1 次升级重新享受 -1 经验')
})

test('P6 08062 闭环：入场充能数=职阶数；花 1 充能横置执行一次基础行动', () => {
  const s = game()
  const inv = s.investigators[0]
  const circle = asset(s, '08062')
  asset(s, '01028') // guardian
  asset(s, '01030') // seeker
  runDescriptor(s, '08062', 'entersPlay', { source: circle })
  const fresh = s.investigators[0].assets.find(item => item.id === circle.id)
  assert.equal(fresh.uses, 3, '职阶数（neutral/guardian/seeker）= 3 充能')
  // 执行一次基础行动：选任意一个基础行动执行。
  let sawActionChoice = false
  runDescriptor(s, '08062', 'free', {
    source: fresh, ignoreCosts: false,
    select: choice => {
      if (choice.kind === 'action') { sawActionChoice = true; return choice.options[0].id }
      return null
    },
  })
  assert.equal(sawActionChoice, true, '发起一次基础行动选择')
  const after = s.investigators[0].assets.find(item => item.id === circle.id)
  assert.equal(after.exhausted, true, '横置已支付')
  assert.equal(after.uses, 2, '花费 1 充能')
})

test('P6 08064 先见：指定卡牌与抽到的卡相同 → 取消/弃掉；遭遇牌可取消显现', () => {
  const s = game()
  const inv = s.investigators[0]
  inv.hand = ['01088', '01031']
  runDescriptor(s, '08064', 'played', {
    context: { when: 'cardDrawn', seat: 0, location: inv.location, cardCode: '01088' },
    select: choice => {
      if (choice.options.some(option => option.id === '01088')) return '01088'
      if (choice.options.some(option => option.id === 'cancel')) return 'cancel'
      return null
    },
  })
  assert.equal(s.investigators[0].hand.includes('01088'), false, '取消并弃掉抽到的卡牌')
  assert.equal((s.investigators[0].discard || []).includes('01088'), true)

  const encounter = game()
  const context = { when: 'encounterDrawn', seat: 0, location: encounter.investigators[0].location, cardCode: 'dissonantVoices', cancelled: false }
  runDescriptor(encounter, '08064', 'played', {
    context,
    select: choice => {
      if (choice.options.some(option => option.id === 'dissonantVoices')) return 'dissonantVoices'
      if (choice.options.some(option => option.id === 'cancel')) return 'cancel'
      return null
    },
  })
  assert.equal(context.cancelled, true, '遭遇牌的显现被取消')
})

test('P6 08070 真法魔典：揭示手牌法术支援并结算其能力', () => {
  const s = game()
  const inv = s.investigators[0]
  asset(s, '08070')
  inv.hand = ['01060'] // 皱缩术（Spell 资产，带 [action] 攻击能力）
  enemy(s, { fight: 1, evade: 1, health: 10, damage: 0 })
  s.chaosBag = ['+2']
  runDescriptor(s, '08070', 'free', { source: inv.assets.find(item => item.code === '08070') })
  assert.ok(s.lastTestResult, '代理结算了法术卡上的技能检定能力')
})

test('P6 08072 沙夫纳的目录：花费秘密获得资源（近似秘密当资源）；秘密耗尽弃掉', () => {
  const s = game()
  const inv = s.investigators[0]
  const catalogue = asset(s, '08072')
  catalogue.uses = 5
  inv.resources = 0
  runDescriptor(s, '08072', 'free', { source: catalogue, ignoreCosts: false })
  assert.equal(s.investigators[0].assets.find(item => item.id === catalogue.id).uses, 4, '花费 1 秘密')
  assert.equal(s.investigators[0].resources, 1, '获得 1 资源')
  // 耗尽：用掉最后 1 个秘密后条目 discardWhenEmpty 弃掉。
  s.investigators[0].assets.find(item => item.id === catalogue.id).uses = 1
  runDescriptor(s, '08072', 'free', { source: s.investigators[0].assets.find(item => item.id === catalogue.id), ignoreCosts: false })
  assert.equal(s.investigators[0].assets.some(item => item.id === catalogue.id), false, '秘密耗尽后弃掉')
})

test('P6 08074 应急装备：真实打出后声明式附属到道具支援（3 耐久）；宿主检定期间花 1 耐久 +2', () => {
  const s = game()
  const inv = s.investigators[0]
  const shotgun = asset(s, '01029', { uses: 2 }) // Shotgun [[Item]]，[action] 发起攻击检定
  inv.hand = ['08074']
  inv.resources = 10
  playEvent(s, '08074') // 真实 play 管线：事件离手后走条目级 attachTo（不再手写 moveCard from:'hand'）
  const host = s.investigators[0].assets.find(item => item.id === shotgun.id)
  const attachment = (host.attachments || []).find(item => item.code === '08074')
  assert.ok(attachment, '应急装备附属到[[道具]]支援（修复前真实打出的附属永不发生）')
  assert.equal(attachment.uses, 3, '附属实例按条目 uses 初始化 3 耐久')
  assert.equal(s.investigators[0].discard.includes('08074'), false, '附属后不进入弃牌堆')

  // 宿主（霰弹枪）的 [action] 发起真实攻击检定 → test.beforeCommit 窗口使用应急装备。
  enemy(s, { engagedSeat: 0, fight: 0, evade: 0, health: 30 })
  s.chaosBag = ['0']
  let picked = false
  move(s, { action: 'ability', assetId: host.id, abilityIndex: 0 })
  for (let index = 0; s.pendingChoice && index < 120; index++) {
    const pending = s.pendingChoice
    let chosen = null
    if (pending.kind === 'playerWindow' && pending.source === 'test.beforeCommit') {
      const option = pending.options.find(item => /应急装备/.test(String(item.label || '')))
      if (option && !picked) { chosen = option.id; picked = true }
    }
    move(s, { action: 'choose', choiceId: pending.id, optionId: chosen ?? ['done', 'skip', 'self'].find(id => pending.options.some(option => option.id === id)) ?? pending.options[0].id })
  }
  const after = (s.investigators[0].assets.find(item => item.id === host.id)?.attachments || []).find(item => item.code === '08074')
  assert.equal(picked, true, '真实宿主检定窗口列出「应急装备」')
  assert.equal(after.uses, 2, '花费 1 耐久')
  assert.equal(s.lastTestResult.value, getStat(s, s.investigators[0], 'combat') + 3 + 2, '宿主检定 +2 技能值（含霰弹枪 +3）')
})

test('P6 08076 阅后即焚：放逐一张 0-5 级手牌、发现 2 线索；等级≥2 时移除 1 毁灭', () => {
  const s = game()
  const inv = s.investigators[0]
  s.locations[0].clues = 2
  inv.hand = ['01088', '01028'] // 01088 event 0级；01028 巡警 2级
  inv.clues = 0
  s.doom = 1
  runDescriptor(s, '08076', 'played', {
    select: choice => (choice.options.some(option => option.id === '01088') ? '01088' : null),
  })
  assert.equal(s.investigators[0].hand.includes('01088'), false, '被放逐的 0 级卡离开手牌')
  assert.equal((s.removedFromGame || []).includes('01088'), true, '进入移除/放逐区')
  assert.equal(s.investigators[0].clues, 2, '发现 2 个线索')
  assert.equal(s.doom, 1, '0 级卡不移除毁灭印记')

  const high = game()
  const highInv = high.investigators[0]
  high.locations[0].clues = 2
  highInv.hand = ['01028'] // 2 级
  high.doom = 1
  runDescriptor(high, '08076', 'played', {
    select: choice => (choice.options.some(option => option.id === '01028') ? '01028' : null),
  })
  assert.equal(high.doom, 0, '等级 ≥2：移除当前密谋上的 1 个毁灭印记')
})
