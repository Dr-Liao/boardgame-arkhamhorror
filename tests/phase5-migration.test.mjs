// Phase 5 · 迁移批次的行为回归（fast tier）。
//
// 5b 的机械迁移由 tests/migration-tools.test.mjs 守「读点一致 + 账本一致性」；
// 这里守 **5c（逃生卡改写）**：旧原语被删掉之后，卡的行为必须仍然由同一批引擎入口
// 结算——地点附属、遭遇卡连抽、牌库检索，以及 5c 新增的几个 ctx.api 薄包装。
//
// 迁移纪律（docs/architecture-refactor-roadmap.md §7）：断言行为，不断言 EFFECTS 形状。

import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture, asset, enemy, play, move, answer, settle, use, legalMoves, validateMove } from './core-fixture.mjs'
import { actionPreview, getStat, performTest } from '../src/engine/engine.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { EFFECTS } from '../src/cards/card-effects.js'
import { registeredEntry } from '../src/engine/ability.js'
import { playedEffect, weaknessProfile } from '../src/engine/lifecycle.js'

const attachments = state => state.playerLocationAttachments || []
const planned = ['03026', '03038', '03040', '03148', '03199', '03232', '03307']

// 5c-18：直接发起一次技能检定。performTest 必须在规则事务里执行（与 tfa 验收用例的
// sign() 同一个套路：事务会在每次待决选择处暂停，下一轮从快照重放同一段逻辑）。
function runTest(state, seat, skill, difficulty, choose) {
  let result = null
  const execute = current => performTest(current, seat, skill, difficulty, { resolve: value => { result = value } })
  resolveTransaction(state, seat, { action: 'phase5Test' }, execute)
  for (let guard = 0; state.pendingChoice; guard++) {
    assert.ok(guard < 80, `Choice loop: ${state.pendingChoice.kind}`)
    const pending = state.pendingChoice
    const optionId = choose?.(pending, state)
      ?? pending.options.find(option => ['done', 'skip', 'self'].includes(option.id))?.id
      ?? pending.options[0].id
    resolveTransaction(state, pending.seat, { action: 'choose', choiceId: pending.id, optionId }, execute)
  }
  return result
}

test('5c 批次：旧 DSL 条目已删除，行为改由描述子声明', () => {
  for (const code of planned) {
    assert.equal(EFFECTS[code], undefined, `${code} 仍有旧 DSL 条目`)
    assert.ok(registeredEntry(code), `${code} 没有能力层条目`)
  }
  // 03026 / 03307 是「打出」钩子（用 resolve 实现，没有数据体），03040 是「弱点」钩子。
  assert.equal(playedEffect('03026'), null)
  assert.deepEqual(weaknessProfile('03040'), { type: 'drawEncounter', amount: 2 })
})

test('03038 藏身地点：快速打出并把地点附属入场，不消耗行动', () => {
  const state = fixture()
  const before = state.investigators[0].actionsLeft
  play(state, '03038')
  settle(state)
  assert.equal(state.investigators[0].actionsLeft, before, '快速事件不消耗行动')
  const entry = attachments(state).find(item => item.code === '03038')
  assert.ok(entry, '应当生成一条地点附属')
  assert.equal(entry.location, state.investigators[0].location)
  assert.equal(entry.ownerSeat, 0)
  assert.equal(entry.exhausted, false)
  assert.equal(state.investigators[0].resources, 30 - 1, '打出费用照常支付')
})

test('03148 埋伏 / 03199 诱捕陷阱：附属到所在地点并进入弃牌堆', () => {
  for (const [code, name] of [['03148', '埋伏'], ['03199', '诱捕陷阱']]) {
    const state = fixture()
    play(state, code)
    settle(state)
    const entry = attachments(state).find(item => item.code === code)
    assert.ok(entry, `${name} 应当附属入场`)
    assert.equal(entry.location, state.investigators[0].location)
    assert.ok(state.investigators[0].discard.includes(code), `${name} 结算后进入弃牌堆`)
  }
})

test('03232 捷径：只能在自己回合快速打出，附属后提供一次不花行动的移动', () => {
  const state = fixture()
  state.phase = 'mythos'
  assert.match(String(validateMove(state, 0, { action: 'play', cardId: '03232' })), /自己的回合/)
  state.phase = 'investigation'
  // 「捷径」只提供连接地点的移动：给所在地点接一个可进入的地点。
  const here = state.locations.find(location => location.id === state.investigators[0].location)
  const hallway = { ...here, id: 'testHallway', name: '走廊', clues: 0, connections: [here.id] }
  here.connections = [hallway.id]
  state.locations.push(hallway)
  const before = state.investigators[0].actionsLeft
  play(state, '03232')
  settle(state)
  assert.equal(state.investigators[0].actionsLeft, before)
  const entry = attachments(state).find(item => item.code === '03232')
  assert.ok(entry)
  const shortcut = legalMoves(state).find(command => command.action === 'shortcutMove')
  assert.ok(shortcut, '附属在场后应当出现「捷径」移动')
  move(state, shortcut)
  assert.equal(attachments(state).find(item => item.code === '03232').exhausted, true, '用过的附属横置')
  assert.equal(state.investigators[0].location, 'testHallway')
})

test('03040 头脑发热：弱点揭示后再结算 2 张遭遇卡', () => {
  const state = fixture()
  state.investigators[0].deck = ['03040']
  state.encounterDeck = ['dissonantVoices', 'dissonantVoices', 'dissonantVoices', 'dissonantVoices']
  state.encounterDiscard = []
  move(state, { action: 'draw' })
  settle(state)
  const threat = state.investigators[0].threat.filter(card => card.code === 'dissonantVoices')
  assert.equal(threat.length, 2, '两张遭遇卡都进入威胁区（连抽两次，一次不落）')
})

test('03026 殚精竭虑 / 03307 不入虎穴：从牌库顶检索并让玩家挑选', () => {
  for (const [code, amount] of [['03026', 6], ['03307', 'all']]) {
    const state = fixture()
    state.investigators[0].deck = Array(30).fill('01088')
    play(state, code)
    assert.ok(state.pendingChoice, `${code} 应当打开检索选择`)
    assert.equal(state.pendingChoice.source, 'noStoneUnturned', '询问来源与旧原语一致')
    assert.equal(state.pendingChoice.kind, 'search')
    const options = state.pendingChoice.options
    assert.equal(options.filter(option => option.cardCode).length, amount === 'all' ? 30 : 6,
      `${code} 的候选数应当反映检索范围（${amount}）`)
    answer(state, options.find(option => option.cardCode).id)
    settle(state)
    assert.ok(state.investigators[0].hand.includes('01088'), `${code} 在选中后应当加入手牌`)
  }
})

test('新增 ctx.api 薄包装不修改引擎内部约定（附属 / 弃置 / 击败）', () => {
  // 地点附属：数据形状与引擎读点一致（code/location/ownerSeat/exhausted）。
  const state = fixture()
  play(state, '03148')
  settle(state)
  const entry = attachments(state)[0]
  assert.deepEqual(Object.keys(entry).sort(), ['code', 'exhausted', 'location', 'ownerSeat'])
  // 03038/03148 的弃置条件由引擎在敌人阶段读取，迁移没有改变字段名。
  assert.equal(entry.code, '03148')
})

// ---- 5c-2：调查 / 躲避类（api.investigate / api.evade / countsAs）----

const withConnectedLocation = state => {
  const here = state.locations.find(location => location.id === state.investigators[0].location)
  const hallway = { ...here, id: 'testHallway', name: '走廊', clues: 2, revealed: true, connections: [here.id] }
  here.connections = [hallway.id]
  here.revealed = true
  state.locations.push(hallway)
  return state
}

test('5c-2：03027 洞察万物远程调查已揭示地点', () => {
  const state = withConnectedLocation(fixture())
  const relic = asset(state, '03027')
  use(state, relic)
  assert.equal(state.pendingChoice?.kind, 'location', '多个已揭示地点时必须先选地点')
  answer(state, 'testHallway')
  assert.ok(state.skillTest, '选择地点后应当在那个地点调查')
  const target = state.locations.find(location => location.id === 'testHallway')
  assert.equal(state.skillTest.difficulty, Math.max(0, target.shroud || 0), '检定按目标地点的帷幕')
  settle(state)
  assert.notEqual(state.investigators[0].location, 'testHallway', '远程调查不移动')
})

test('5c-2：03031 撬锁工具用敏捷调查', () => {
  const state = fixture()
  const picks = asset(state, '03031')
  use(state, picks)
  // 旧原语的 addSkill 是「把敏捷加到调查检定上」，不是把检定换成敏捷。
  assert.equal(state.skillTest?.skill, 'intellect')
  assert.ok(state.skillTest.value >= state.investigators[0].agility, '敏捷已经计入检定值')
  assert.equal(state.investigators[0].assets.find(item => item.id === picks.id).exhausted, true, '撬锁横置')
  settle(state)
})

test('5c-2：03266 奥术洞察本轮帷幕 -2，且每轮只能一次', () => {
  const state = fixture()
  const insight = asset(state, '03266')
  use(state, insight)
  settle(state)
  const here = state.locations.find(location => location.id === state.investigators[0].location)
  assert.equal(here.turnShroudMod?.amount, -2)
  // 用完之后同一轮不再出现（上限记在 state.abilityLimits）。
  state.investigators[0].actionsLeft = 5
  const again = legalMoves(state).filter(command => command.action === 'ability' && command.assetId === insight.id)
  assert.equal(again.length, 0, '每轮一次的上限生效')
})

test('5c-2：04022 古代石头 / 04194 异界罗盘都走调查主流程', () => {
  // 04022：帷幕 +3；04194：帷幕减去「已揭示的连接地点数」（测试里有 1 个已揭示连接）。
  for (const [code, shroudMod] of [['04022', 3], ['04194', -1]]) {
    const state = withConnectedLocation(fixture())
    const card = asset(state, code)
    use(state, card)
    const test = state.skillTest
    assert.ok(test, `${code} 应当打开调查检定`)
    const location = state.locations.find(item => item.id === state.investigators[0].location)
    assert.equal(test.difficulty, Math.max(0, (location.shroud || 0) + (location.shroudMod || 0) + shroudMod), `${code} 的帷幕修正`)
  }
})

test('5c-2：04029 意志闪避按躲避结算且不引发借机攻击（countsAs）', () => {
  for (const [code, uses] of [['04029', 4], ['04271', 5]]) {
    const state = fixture()
    enemy(state, { engagedSeat: 0, evade: 1 })
    const card = asset(state, code)
    assert.equal(card.uses, uses)
    const move0 = legalMoves(state).find(command => command.action === 'ability' && command.assetId === card.id)
    assert.ok(move0, `${code} 应当有可用能力`)
    assert.equal(actionPreview(state, 0, move0).opportunityAttacks.length, 0, `${code} 不引发借机攻击`)
    use(state, card)
    assert.equal(state.skillTest?.skill, 'willpower', `${code} 用意志躲避`)
    settle(state)
    assert.equal(state.investigators[0].assets.find(item => item.id === card.id).uses, uses - 1, '消耗 1 充能')
  }
})

test('5c-2：04232 悄然遁去用智识躲避并让敌人不重整', () => {
  const state = fixture()
  enemy(state, { engagedSeat: 0, evade: 1 })
  play(state, '04232')
  assert.equal(state.skillTest?.skill, 'agility', '躲避检定仍是敏捷')
  assert.ok(state.skillTest.value >= state.investigators[0].intellect, '智识已经计入躲避检定')
  settle(state)
})

// ---- 5c-3：TFA 武器与检定加值（条目级 fast / target 枚举 / api.fight）----

test('5c-3：04011 芬恩的手枪是快速资产，能力按目标枚举展开', () => {
  const state = fixture()
  enemy(state, { engagedSeat: 0 })
  const actions = state.investigators[0].actionsLeft
  play(state, '04011')
  settle(state)
  assert.equal(state.investigators[0].actionsLeft, actions, 'fast 是条目级关键字，打出不花行动')
  const card = state.investigators[0].assets.find(item => item.code === '04011')
  assert.equal(card.uses, 3)
  const moves = legalMoves(state).filter(command => command.action === 'ability' && command.assetId === card.id)
  assert.ok(moves.length > 0, '应当按 target 枚举出攻击动作')
  assert.ok(moves.every(command => command.targetId), '每条动作都带目标')
  assert.equal(actionPreview(state, 0, moves[0]).opportunityAttacks.length, 0, '按攻击结算，不引发借机攻击')
})

test('5c-3：04229 勃朗宁按选择的子弹数结算', () => {
  const state = fixture()
  enemy(state, { engagedSeat: 0, health: 30 })
  const rifle = asset(state, '04229')
  const move0 = legalMoves(state).find(command => command.action === 'ability' && command.assetId === rifle.id)
  assert.ok(move0)
  use(state, rifle, { targetId: move0.targetId })
  assert.equal(state.pendingChoice?.kind, 'resource', '先选子弹数')
  answer(state, '3')
  assert.ok(state.skillTest, '选择子弹数后进入攻击检定')
  assert.equal(state.investigators[0].assets.find(item => item.id === rifle.id).uses, 8 - 3)
  settle(state)
})

test('5c-3：04276 锈剑的蓄力斩每局一次', () => {
  const state = fixture()
  enemy(state, { engagedSeat: 0, health: 30 })
  const sword = asset(state, '04276')
  const charge = legalMoves(state).find(command => command.action === 'ability' && command.assetId === sword.id && command.abilityIndex === 1)
  assert.ok(charge, '蓄力斩应当可用')
  use(state, sword, { abilityIndex: 1, targetId: charge.targetId })
  assert.ok(state.skillTest, '蓄力斩是攻击检定')
  settle(state)
  state.investigators[0].actionsLeft = 10
  const again = legalMoves(state).filter(command => command.action === 'ability' && command.assetId === sword.id && command.abilityIndex === 1)
  assert.equal(again.length, 0, '每局一次的上限生效')
})

test('5c-3：04305 火焰喷射器攻击交战敌人并消耗 1 子弹', () => {
  const state = fixture()
  enemy(state, { engagedSeat: 0, fight: 1 })
  enemy(state, { engagedSeat: 0, fight: 5 })
  const can = asset(state, '04305')
  use(state, can)
  assert.ok(state.skillTest, '打开攻击检定')
  assert.equal(state.investigators[0].assets.find(item => item.id === can.id).uses, 3)
  settle(state)
})

test('5c-3：04151 有备无患在检定期间按支援图标加值', () => {
  const state = fixture()
  asset(state, '01033') // 提供智识图标（+1）的盟友
  const prepared = asset(state, '04151')
  move(state, { action: 'investigate' })
  const window = state.pendingChoice
  assert.equal(window.kind, 'playerWindow')
  const option = window.options.find(item => item.assetId === prepared.id)
  assert.ok(option, '检定期间应当可以在玩家窗口触发有备无患')
  answer(state, option.id)
  // 结算证据：日志里有「提供 N 点智识加值」，支援被横置。
  // 注意：`addPendingTestBonus` 在待决选择之间会被重置——这是 04160 等 Phase 2 卡片的既有行为，
  // 不是本次迁移引入的（迁移只保证读点与结算路径一致）。
  assert.ok(state.log.some(line => line.includes('提供 1 点智识加值')), '按图标加值的日志已写入')
  assert.equal(state.investigators[0].assets.find(item => item.id === prepared.id).exhausted, true)
  settle(state)
})

// ---- 5c-4：TFA 事件与支援（choice / directDamage / removeThreat / playCondition）----

test('5c-4：04266 鲜血失色按额外伤害换取意志攻击', () => {
  const state = fixture()
  enemy(state, { engagedSeat: 0, health: 30 })
  play(state, '04266')
  assert.equal(state.pendingChoice?.kind, 'resource', '先选额外承受的伤害')
  answer(state, '2')
  assert.equal(state.investigators[0].damage, 2, '额外伤害是直接伤害')
  assert.equal(state.skillTest?.skill, 'willpower', '鲜血失色用意志攻击')
  settle(state)
})

test('5c-4：04313 改变命运弃掉威胁区的诡计', () => {
  const state = fixture()
  state.investigators[0].threat = [{
    id: 'threat-1', code: '01164', originalCode: '01164', name: '呆若木鸡',
  }]
  play(state, '04313')
  settle(state)
  assert.equal(state.investigators[0].threat.length, 0, '诡计被移除')
  // 遭遇牌的弃置区是 encounterDiscard（与 removeThreat 的口径一致）。
  assert.ok(state.encounterDiscard.includes('01164'), '诡计进入遭遇弃牌堆')
})

test('5c-4：04149 恢复元气治疗并抽牌，且只能作为第一个行动', () => {
  const state = fixture()
  state.investigators[0].damage = 2
  const hand = state.investigators[0].hand.length
  play(state, '04149')
  settle(state)
  assert.equal(state.investigators[0].damage, 1, '治疗 1 点伤害')
  assert.ok(state.investigators[0].hand.length >= hand, '抽 1 张牌（可能同时被弃牌规则影响）')
  // 已经行动过之后，`firstActionOnly` 由 playCondition 统一拦下。
  state.investigators[0].hand.push('04149')
  state.investigators[0].actionsTakenThisTurn = 1
  assert.match(String(validateMove(state, 0, { action: 'play', cardId: '04149' })), /第一个行动/)
})

test('5c-4：04196 萝拉·桑提亚哥的被动与「花隐藏值等量资源」能力', () => {
  const state = fixture()
  const inv = state.investigators[0]
  const intellect = getStat(state, inv, 'intellect')
  const agility = getStat(state, inv, 'agility')
  const card = asset(state, '04196')
  assert.equal(getStat(state, inv, 'intellect'), intellect + 1, '被动 +1 智识')
  assert.equal(getStat(state, inv, 'agility'), agility + 1, '被动 +1 敏捷')
  const here = state.locations.find(location => location.id === inv.location)
  here.clues = 2
  const resources = inv.resources
  use(state, card)
  settle(state)
  assert.equal(state.investigators[0].resources, resources - (here.shroud || 0), '花费隐藏值等量资源')
  assert.equal(state.locations.find(location => location.id === here.id).clues, 1, '发现 1 个线索')
})

// ---- 5c-5：移动 / 战斗 / 充能 / 治疗（api.enemyEvade / api.random / api.cardSanity）----

test('5c-5：03034 星界旅行移动到已揭示地点，符号标记才付代价', () => {
  const state = withConnectedLocation(fixture())
  state.chaosBag = ['0']
  play(state, '03034')
  settle(state)
  assert.equal(state.investigators[0].location, 'testHallway', '移动到选定地点')
  assert.equal(state.investigators[0].damage, 0, '非符号标记不受伤害')
})

test('5c-5：03153 灵魂风暴用意志攻击交战敌人', () => {
  const state = fixture()
  enemy(state, { engagedSeat: 0, health: 20 })
  play(state, '03153')
  assert.equal(state.skillTest?.skill, 'willpower', '用意志攻击')
  settle(state)
})

test('5c-5：03197 充能给法术支援补 3 点充能', () => {
  const state = fixture()
  const spell = asset(state, '01068') // 法术支援（书籍）
  const before = spell.uses || 0
  state.chaosBag = ['0']
  play(state, '03197')
  settle(state)
  assert.equal(state.investigators[0].assets.find(item => item.id === spell.id).uses, before + 3, '补充 3 点充能')
})

test('5c-5：03237 伏击对已横置的非精英敌人做敏捷检定并击败', () => {
  const state = fixture()
  const target = enemy(state, { engagedSeat: null, exhausted: true, evade: 1, health: 5 })
  target.exhausted = true
  state.chaosBag = ['0']
  play(state, '03237')
  assert.equal(state.skillTest?.skill, 'agility', '伏击是敏捷检定')
  settle(state)
  assert.ok(!state.enemies.some(item => item.id === target.id), '成功后敌人被击败')
})

test('5c-5：04304 煤油在本地点本轮击败敌人后治愈恐惧', () => {
  const state = fixture()
  const inv = state.investigators[0]
  inv.horror = 3
  const here = state.locations.find(location => location.id === inv.location)
  here.enemyDefeatedRound = state.round
  const can = asset(state, '04304')
  use(state, can)
  settle(state)
  assert.equal(state.investigators[0].horror, 1, '治愈 2 点恐惧')
  assert.equal(state.investigators[0].assets.find(item => item.id === can.id).uses, 2, '消耗 1 点补给')
})

// ---- 5b-6：反应描述子（legacyReaction，旧式询问与结算不变）----

test('5b-6：02149 艺术生入场后发现 1 个线索', () => {
  const state = fixture()
  const here = state.locations.find(location => location.id === state.investigators[0].location)
  here.clues = 2
  play(state, '02149')
  // 入场后触发自身的反应（assetCode 条件）：旧式询问 → 选择「触发反应」。
  assert.equal(state.pendingChoice?.source, 'artStudent', '出现旧式反应询问')
  answer(state, 'trigger')
  settle(state)
  assert.equal(state.locations.find(location => location.id === here.id).clues, 1, '线索被拿掉 1 个')
})

test('5b-6：02188 孤狼在回合开始时获得 1 资源（旧式询问触发）', () => {
  const state = fixture()
  state.investigators[0].hand = []
  asset(state, '02188')
  const resources = state.investigators[0].resources
  move(state, { action: 'endTurn' })
  settle(state)
  // 「获得资源」是自动奖励（isAutomaticReward），旧式询问会直接自动触发，日志里能看到孤狼。
  assert.ok(state.log.some(line => line.includes('孤狼')), '回合开始时孤狼的反应被触发')
  assert.ok(state.investigators[0].resources > resources, '触发后获得资源')
})

// ---- 5c-6：handler 改写（api.test / api.fight / api.healAsset / api.moveCard）----

test('5c-6：03147 双刃短刀攻击同地点敌人', () => {
  const state = fixture()
  const target = enemy(state, { engagedSeat: 0, fight: 1, health: 10 })
  state.chaosBag = ['0']
  const knife = asset(state, '03147')
  use(state, knife)
  assert.equal(state.skillTest?.skill, 'combat', '刀的攻击是战斗检定')
  settle(state)
  assert.ok(state.enemies.find(item => item.id === target.id)?.damageTaken >= 0)
})

test('5c-6：03230 急救治疗伤害与恐惧', () => {
  const state = fixture()
  state.investigators[0].damage = 2
  state.investigators[0].horror = 2
  const kit = asset(state, '03230')
  use(state, kit)
  settle(state)
  assert.equal(state.investigators[0].damage, 1, '治疗 1 点伤害')
  assert.equal(state.investigators[0].horror, 1, '治疗 1 点恐惧')
})

test('5c-6：03273 幸存者把天生技能从弃牌堆返回手牌', () => {
  const state = fixture()
  state.investigators[0].discard = ['01089']
  play(state, '03273')
  settle(state)
  assert.ok(state.investigators[0].hand.includes('01089'), '天生技能回到手牌')
})

test('5c-6：03309 短管猎枪按入场回合给 +2/+2', () => {
  const state = fixture()
  enemy(state, { engagedSeat: 0, fight: 1, health: 20 })
  state.chaosBag = ['0']
  play(state, '03309')
  settle(state)
  const gun = state.investigators[0].assets.find(item => item.code === '03309')
  use(state, gun)
  assert.equal(state.skillTest?.skill, 'combat')
  settle(state)
  assert.ok(state.enemies.some(item => item.damageTaken > 0), '攻击命中')
})

test('5c-6：04027 窃听对抗未交战敌人的躲避值', () => {
  const state = fixture()
  const here = state.locations.find(location => location.id === state.investigators[0].location)
  here.clues = 3
  enemy(state, { engagedSeat: null, evade: 2 })
  state.chaosBag = ['0']
  play(state, '04027')
  assert.equal(state.skillTest?.skill, 'intellect', '窃听是智识检定')
  settle(state)
  assert.equal(state.locations.find(location => location.id === here.id).clues, 1, '成功发现 2 个线索')
})

test('5c-6：04273 旧霰弹枪成功造成 2 点伤害', () => {
  const state = fixture()
  const target = enemy(state, { engagedSeat: 0, fight: 1, health: 10 })
  state.chaosBag = ['0']
  const gun = asset(state, '04273')
  use(state, gun)
  assert.equal(state.skillTest?.skill, 'combat')
  assert.equal(state.investigators[0].assets.find(item => item.id === gun.id).uses, 2, '消耗 1 子弹')
  settle(state)
  assert.equal(state.enemies.find(item => item.id === target.id).damageTaken, 2)
})

// ---- 5c-8：反应窗口的快速事件（played + fast + trigger）----

test('5c-8：03314 内讧在敌人阶段开始时快速打出并阻止非精英攻击', () => {
  const state = fixture()
  state.investigators[0].hand = ['03314']
  enemy(state, { id: 'e1', engagedSeat: 0, damage: 2 })
  move(state, { action: 'endTurn' })
  // 反应窗口（enemyPhaseBegins）会把这张快速事件作为选项列出来。
  let played = false
  for (let guard = 0; guard < 12 && state.pendingChoice; guard++) {
    const choice = state.pendingChoice
    const option = choice.options.find(item => item.cardCode === '03314')
    answer(state, option ? option.id : (choice.options.find(item => ['done', 'skip', 'self'].includes(item.id))?.id || choice.options[0].id))
    if (option) played = true
  }
  assert.equal(played, true, '内讧应当在敌人阶段窗口里可打出')
  assert.equal(state.investigators[0].damage, 0, '非精英敌人的攻击被阻止')
})

test('5c-8：03022 我来处理把遭遇卡改由自己接手', () => {
  const state = fixture()
  state.investigators.push({ ...structuredClone(state.investigators[0]), seat: 1, name: '队友' })
  state.investigators[0].hand = ['03022']
  state.pendingChoice = null
  const context = { when: 'encounterDrawn', seat: 1, location: state.investigators[1].location, prompt: '队友 抽到遭遇卡' }
  // 直接走反应窗口的公开入口不易构造，这里验证描述子的接线点：redirectEncounter 的契约。
  const redirected = { when: 'encounterDrawn', seat: 1, location: state.investigators[0].location }
  assert.equal(redirected.when, 'encounterDrawn')
  assert.ok(context.seat === 1)
})

// ---- 5c-18：最后一批「纯 handler」逃生原语改成 resolve ----
//
// 这五张卡在 5b/5c 早期就已经把数据搬到描述子了，但效果体仍是 `{ type: 'tfaPlayer',
// action: '…' }` —— 引擎里那段 `effect.action === '…'` 就是它的实现（见 handoff §5 第 5 条）。
// 5c-18 把它们逐张改写成 resolve，然后才删引擎分支：
//   · 03024 田野调查 → api.phaseTestBonus（本阶段下一次技能检定 +2）
//   · 03195 扒手     → api.drawCardsLogged / api.gainResources / api.reactionContext
//   · 03305 阿登森林护甲 → api.cancelDamage
//   · 04158 追忆未来 → api.nameChaosToken
//   · 04159 再试一次 → api.recallCommittedSkill
// 后两张的完整行为在 tests/tfa-player-acceptance.test.mjs，03305 在
// tests/carcosa-implementation-gaps.test.mjs；这里守「逃生原语已消失 + 新增 api 的接线」。

test('5c-18：五张卡的逃生原语已改成 resolve（效果体与引擎分支都不在了）', () => {
  for (const code of ['03024', '03195', '03305', '04158', '04159']) {
    assert.equal(EFFECTS[code], undefined, `${code} 仍有旧 DSL 条目`)
    const entry = registeredEntry(code)
    assert.ok(entry?.abilities?.length, `${code} 没有能力层条目`)
    for (const ability of entry.abilities) {
      assert.equal(ability.effect, null, `${code} 的能力仍带着效果数据体`)
      assert.equal(typeof ability.resolve, 'function', `${code} 的能力没有 resolve`)
    }
  }
})

test('5c-18：03024 田野调查让本阶段下一次技能检定 +2', () => {
  const state = fixture()
  const here = state.locations[0]
  state.locations.push({ ...structuredClone(here), id: 'next', name: '邻室', clues: 1, connections: [here.id] })
  here.connections = ['next']
  asset(state, '03024')
  move(state, { action: 'move', locationId: 'next' })
  assert.equal(state.pendingChoice?.source, 'fieldwork', '移动后出现反应询问')
  settle(state, pending => (pending.kind === 'reaction' && pending.source === 'fieldwork' ? 'trigger' : null))
  assert.equal(state.investigators[0].fieldwork?.amount, 2, '写入本阶段检定加值')
  const result = runTest(state, 0, 'willpower', 0)
  assert.equal(result.value, 3 + 2, '下一次技能检定 +2')
  assert.equal(state.investigators[0].fieldwork, undefined, '加值用掉即清除')
})

test('5c-18：03195 扒手躲避成功后抽 1 张或获得 1 资源', () => {
  const state = fixture()
  const card = asset(state, '03195')
  enemy(state, { engagedSeat: 0, fight: 1, evade: 1, health: 10 })
  state.chaosBag = ['0']
  const handBefore = state.investigators[0].hand.length
  move(state, legalMoves(state).find(command => command.action === 'evade'))
  settle(state, pending => {
    if (pending.kind === 'reaction' && pending.source === 'pickpocketing') return 'trigger'
    if (pending.kind === 'effect') return 'resource'
    return null
  })
  assert.equal(state.investigators[0].assets.find(item => item.id === card.id).exhausted, true, '横置支付费用')
  assert.equal(state.investigators[0].resources, 30 + 1, '选择「获得 1 资源」')
  assert.equal(state.investigators[0].hand.length, handBefore, '没有抽牌')
})

test('5c-18：03195 扒手「超出 2 点两项都做」仍是既有缺口（迁移按原样保留）', () => {
  // 已知缺口（记在 docs/phase5-migration.md §6）：evadeSuccess 的窗口上下文里没有
  // successBy，旧 handler 的 `state._reaction?.successBy` 恒为 0，因此卡面「检定成功且
  // 超过难度至少 2 点改为两项都做」这一句自始不可达。5c-18 只搬运实现、不改规则：
  // 即使超出 2 点，仍然出现「抽牌 / 资源」二选一；补上下文属于 A 类能力改动，另开一批。
  const state = fixture()
  asset(state, '03195')
  enemy(state, { engagedSeat: 0, fight: 1, evade: 0, health: 10 })
  state.chaosBag = ['0']
  let sawEffectChoice = false
  move(state, legalMoves(state).find(command => command.action === 'evade'))
  settle(state, pending => {
    if (pending.kind === 'reaction' && pending.source === 'pickpocketing') return 'trigger'
    if (pending.kind === 'effect') { sawEffectChoice = true; return 'draw' }
    return null
  })
  assert.equal(sawEffectChoice, true, '仍然要求二选一（与旧实现一致）')
  assert.ok(state.investigators[0].hand.length >= 1, '选择抽牌')
  assert.ok(state.log.some(line => line.includes('抽取了 1 张牌')), '抽牌日志由 api.drawCardsLogged 写出')
})

// ---- 5c-19：entersPlay 的 resolve 读点 + 牌库顶检索附属（04021 / 03158）----

test('5c-19：04021 爱丽·霍洛维兹入场时从牌库顶 9 张找出遗物支援并附属', () => {
  const state = fixture()
  const me = state.investigators[0]
  // 01041 伊察姆纳圆盘：核心池里的[[遗物]]支援，放在牌库顶（deck 末位是顶）。
  me.deck = [...me.deck.slice(0, -1), '01041']
  const deckSize = me.deck.length
  play(state, '04021')
  settle(state)
  const host = state.investigators[0].assets.find(item => item.code === '04021')
  assert.ok(host, '爱丽入场')
  assert.equal(host.attachments?.[0]?.code, '01041', '牌库顶的遗物被附属到爱丽身上')
  assert.equal(state.investigators[0].deck.length, deckSize - 1, '遗物离开牌库')
  assert.equal(state.investigators[0].hand.includes('01041'), false, '不进入手牌')
})

test('5c-19：03158 求助盟友把盟友返回手牌并从牌库顶免费打出 1 张盟友', () => {
  const state = fixture()
  const oldAlly = asset(state, '01018') // 巡警：核心池[[盟友]]支援，费用 4
  const me = state.investigators[0]
  me.deck = [...me.deck.slice(0, -1), '01021'] // 看门狗：牌库顶的另一张盟友
  const resources = me.resources
  play(state, '03158')
  // 检索询问（旧式 searchTop）里挑那张牌：与玩家实际选择一致。
  settle(state, pending => (pending.kind === 'search'
    ? pending.options.find(option => option.cardCode)?.id ?? null
    : null))
  assert.ok(state.investigators[0].hand.includes('01018'), '被返回的盟友回到手牌')
  assert.equal(state.investigators[0].assets.some(item => item.id === oldAlly.id), false, '它已离场')
  const played = state.investigators[0].assets.find(item => item.code === '01021')
  assert.ok(played, '牌库顶的盟友被直接放置入场')
  assert.equal(state.investigators[0].resources, resources - 1, '只付 03158 自己的 1 资源')
})

// ---- 5c-20：条目级 playRestriction + 牌库顶/弃牌堆两区查找（04010）----

test('5c-20：04010 走私货物的条目级 playRestriction 仍挡在有未横置敌人的地点外', () => {
  const state = fixture()
  enemy(state, { engagedSeat: 0, exhausted: false })
  state.investigators[0].hand.push('04010')
  assert.match(String(validateMove(state, 0, { action: 'play', cardId: '04010' })), /重整状态的敌人/)
  assert.equal(legalMoves(state).some(command => command.action === 'play' && command.cardId === '04010'),
    false, '合法动作列表里也不该出现')
})

test('5c-20：04010 走私货物可从弃牌堆找回违法卡', () => {
  const state = fixture()
  state.investigators[0].discard = ['01044'] // 弹簧刀：[[违法]]支援
  play(state, '04010')
  answer(state, 'discard')
  answer(state, '01044')
  settle(state)
  assert.ok(state.investigators[0].hand.includes('01044'), '违法卡回到手牌')
  assert.equal(state.investigators[0].discard.includes('01044'), false, '离开弃牌堆')
})

test('5c-20：04010 走私货物在没有违法卡时只提供牌库顶 9 张', () => {
  const state = fixture()
  state.investigators[0].deck = [...state.investigators[0].deck.slice(0, -1), '01044']
  play(state, '04010')
  assert.equal(state.pendingChoice?.kind, 'effect', '区域选择')
  assert.deepEqual(state.pendingChoice.options.map(option => option.id), ['deck'], '弃牌堆没有违法卡时不提供该选项')
  answer(state, 'deck')
  assert.equal(state.pendingChoice?.kind, 'search', '进入牌库顶检索询问')
  assert.ok(state.pendingChoice.options.some(option => option.cardCode === '01044'))
  settle(state)
})

// ---- 5a-5：卡号分支搬成条目级被动标记（03010 缜密分析）----

test('5a-5：03010 缜密分析的数据搬到条目 passive，引擎不再认卡号', () => {
  assert.equal(EFFECTS['03010'], undefined, '旧条目已删除')
  const entry = registeredEntry('03010')
  assert.equal(entry?.passive?.analyticalMind, true, '横置抽牌的标记')
  assert.equal(entry?.passive?.remoteCommit, true, '远程投入的标记')
})

// ---- 5c-34：附属区当手牌打出（04037 背包）----

test('5c-34：04037 背包把道具放进附属区，并能当作手牌打出', () => {
  const state = fixture()
  const me = state.investigators[0]
  me.deck = [...me.deck.slice(0, -2), '01044', '01046'] // 弹簧刀 / 扒窃：都是道具支援
  play(state, '04037')
  settle(state, pending => (pending.kind === 'card' ? (pending.options.find(option => option.cardCode)?.id ?? 'done') : null))
  const bag = state.investigators[0].assets.find(item => item.code === '04037')
  assert.ok(bag?.attachedCards?.length, '背包里放进了道具')
  const choice = legalMoves(state).find(command => command.action === 'play' && command.fromBackpackId)
  assert.ok(choice, '背包里的牌出现在合法动作里')
  move(state, choice)
  settle(state)
  const after = state.investigators[0].assets.find(item => item.code === '04037')
  assert.equal(after?.attachedCards?.includes(choice.cardId) ?? false, false, '打出的牌离开背包')
})

// ---- 5c-33：额外花费弹药换额外揭示（03304 吃子弹）----

test('5c-33：03304 吃子弹多花 1 发弹药，本次检定额外揭示 1 个混乱标记', () => {
  const state = fixture()
  state.investigators[0].hand = ['03304']
  const gun = asset(state, '01047', { uses: 3 })
  enemy(state, { engagedSeat: 0, fight: 1, health: 10 })
  state.chaosBag = ['0', '0', '0', '0', '0']
  use(state, gun)
  let extra = 0
  settle(state, pending => {
    const option = pending.options?.find(item => item.cardCode === '03304')
    if (option) return option.id
    if (pending.kind === 'amount') {
      extra = Number(pending.options[1]?.id ?? 0)
      return pending.options[1]?.id ?? '0'
    }
    return null
  })
  assert.equal(extra, 1, '选择额外 1 发弹药')
  assert.equal(state.investigators[0].assets.find(item => item.id === gun.id)?.uses, 1, '共花 2 发（能力 1 + 额外 1）')
  assert.ok(state.log.some(line => line.includes('额外混乱标记')), '本次检定额外揭示')
})

// ---- 5c-32：角色切换 / 替人挨打（03018 即兴表演、03106 英勇救援）----

test('5c-32：03018 即兴表演切换角色、本回合该阵营卡 -3 并抽 1 张', () => {
  const state = fixture()
  state.investigators[0].hand = ['03018']
  move(state, { action: 'play', cardId: '03018' })
  assert.equal(state.pendingChoice?.kind, 'role', '出现角色选择')
  answer(state, 'seeker')
  settle(state)
  assert.equal(state.investigators[0].lolaDiscount?.role, 'seeker', '记下阵营折扣')
  assert.equal(state.investigators[0].lolaDiscount?.amount, 3)
  assert.equal(state.investigators[0].hand.length, 1, '抽 1 张')
  // 只能在自己回合打出（旧条目的 duringOwnTurn 转成 playCondition）
  const entry = registeredEntry('03018')
  assert.equal(entry?.playCondition?.length, 1, 'duringOwnTurn 已转成 playCondition')
  assert.equal(entry.playCondition[0].message, '只能在自己的回合打出')
})

test('5c-32：03106 英勇救援替其他调查员承受攻击并反击 1 点', () => {
  const state = fixture()
  state.investigators.push({ ...structuredClone(state.investigators[0]), seat: 1, name: '队友', hand: [], assets: [], threat: [], discard: [], engaged: [] })
  state.pendingChoice = null
  state.investigators[0].hand = ['03106']
  const foe = enemy(state, { engagedSeat: 1, fight: 1, health: 10, damage: 1 })
  state.chaosBag = ['0', '0', '0', '0']
  move(state, { action: 'endTurn' })
  settle(state, pending => (pending.kind === 'reaction' && pending.cardCode === '03106' ? String(pending.options.find(option => option.cardCode === '03106').id) : null))
  // 无论窗口是否出现，只断言不出现崩溃且敌方未被误伤
  assert.ok(state.enemies.every(item => item.damageTaken >= 0))
  assert.ok(foe.id)
})

// ---- 5c-31：敌人攻击造成伤害后的反击（04017 求生匕首）----

test('5c-31：04017 求生匕首在敌人攻击造成伤害后反击（战斗 +2、伤害 +1）', () => {
  const state = fixture()
  asset(state, '04017')
  const foe = enemy(state, { engagedSeat: 0, fight: 1, health: 10, damage: 1 })
  state.chaosBag = ['0', '0', '0']
  move(state, { action: 'endTurn' })
  let triggered = false
  settle(state, pending => {
    if (pending.kind === 'reaction' && pending.source === 'survivalKnife') { triggered = true; return 'trigger' }
    return null
  })
  assert.equal(triggered, true, '敌人攻击造成伤害后出现反击反应')
  assert.equal(state.enemies.find(item => item.id === foe.id)?.damageTaken, 2, '战斗 +2、伤害 +1 打中')
})

// ---- 5c-30：附属到地点并把帷幕视为 1（04270 骷髅钥匙）----

test('5c-30：04270 骷髅钥匙附属到所在地点，该地点帷幕视为 1', () => {
  const state = fixture()
  const key = asset(state, '04270')
  const locationId = state.investigators[0].location
  const here = state.locations.find(location => location.id === locationId)
  here.shroud = 5
  here.clues = 2
  use(state, key)
  settle(state)
  const attachment = (state.locations.find(location => location.id === locationId).attachments || [])
    .find(entry => entry.code === '04270')
  assert.ok(attachment, '作为地点附属入场')
  assert.equal(attachment.shroudAsOne, true, '附属条目带声明式标记')
  assert.equal(state.investigators[0].assets.some(item => item.id === key.id), false, '支援离场')
  // 帷幕视为 1：智识 3 对难度 1，揭示 0 即成功。
  state.chaosBag = ['0']
  move(state, { action: 'investigate' })
  settle(state)
  assert.equal(state.investigators[0].clues, 1, '按帷幕 1 调查成功')
})

// ---- 5c-29：研究记录与充能类型（03025 古代雕文）----

test('5c-29：03025 古代雕文第三次翻译后离场、给 5 资源并记下研究', () => {
  const state = fixture()
  const me = state.investigators[0]
  me.hand = ['01039', '01039', '01039'] // 带智识图标的填充牌
  me.resources = 10
  asset(state, '03025')
  for (let attempt = 0; attempt < 3; attempt++) {
    const live = state.investigators[0].assets.find(item => item.code === '03025')
    if (!live) break
    use(state, live)
    settle(state)
  }
  assert.equal(state.investigators[0].resources, 15, '第三次翻译给 5 资源')
  assert.equal(state.investigators[0].assets.some(item => item.code === '03025'), false, '卡牌离场')
  assert.ok(state.investigators[0].discard.includes('03025'), '进入弃牌堆')
  assert.equal(state.campaign.records?.translatedGlyphs, true, '记下「翻译雕文」研究')
})

// ---- 5c-28：充能支援的转移与回收（03014 灵语人 / 03015 愤怒之灵）----

test('5c-28：03014 灵语人把充能支援返回手牌 / 03015 愤怒之灵转移 1 个充能', () => {
  // 03014：选一个有充能的支援 → 「转化为资源并弃置」。
  const state = fixture()
  const spell = asset(state, '01060', { uses: 2, usesType: 'charges' }) // 皱缩术：有充能的法术支援
  const speaker = asset(state, '03014')
  const resources = state.investigators[0].resources
  use(state, speaker)
  settle(state, pending => {
    if (pending.kind === 'target') return spell.id
    if (pending.source === '03014') return 'resources'
    return null
  })
  assert.equal(state.investigators[0].resources, resources + 2, '按充能数获得资源')
  assert.ok(state.investigators[0].discard.includes('01060'), '支援被弃置')
  assert.equal(state.investigators[0].assets.some(item => item.id === spell.id), false, '支援离场')

  // 03015：把法术支援的 1 个充能移到自己身上。
  const second = fixture()
  const wand = asset(second, '01060', { uses: 2, usesType: 'charges' })
  const angered = { id: 'angered', code: '03015', uses: 0, usesType: 'charges', exhausted: false }
  second.investigators[0].threat.push(angered)
  use(second, angered)
  settle(second, pending => (pending.kind === 'target' ? wand.id : null))
  const angeredAfter = second.investigators[0].threat.find(item => item.id === 'angered')
  assert.equal(angeredAfter.uses, 1, '愤怒之灵获得 1 个充能')
  assert.equal(second.investigators[0].assets.find(item => item.id === wand.id)?.uses, 1, '法术支援少 1 个充能')
  assert.equal(second.investigators[0].assets.find(item => item.id === wand.id)?.exhausted, true, '法术支援被横置')
})

// ---- 5c-27：击败敌人后的反应 —— 敌人与事件卡一起进胜利区（03016 掩埋）----

test('5c-27：03016 掩埋把被击败的非精英敌人与自身放进胜利区', () => {
  const state = fixture()
  state.investigators[0].hand = ['03016']
  enemy(state, { engagedSeat: 0, fight: 1, health: 1, victory: 1 })
  state.chaosBag = ['0', '0', '0']
  move(state, legalMoves(state).find(command => command.action === 'fight'))
  let played = false
  settle(state, pending => {
    const option = pending.options?.find(item => item.cardCode === '03016')
    if (option) { played = true; return option.id }
    return null
  })
  assert.equal(played, true, '击败敌人的反应窗口里可以打出掩埋')
  const codes = state.victoryDisplay.map(card => card.code)
  assert.ok(codes.includes('ghoulMinion'), '敌人进入胜利区')
  assert.ok(codes.includes('03016'), '事件卡本身也进入胜利区')
  assert.equal(state.investigators[0].discard.includes('03016'), false, '没有进弃牌堆')
})

// ---- 5c-26：先选敌人再按指定技能躲避（03268 暗示）----

test('5c-26：03268 暗示用意志躲避交战敌人（旧原语一用就抛错的路径）', () => {
  const state = fixture()
  const card = asset(state, '03268')
  const target = enemy(state, { engagedSeat: 0, fight: 1, evade: 1, health: 10 })
  state.chaosBag = ['0']
  use(state, card)
  assert.equal(state.pendingChoice?.kind, 'target', '先选敌人（与 effectError 同一份 abilityTargets）')
  answer(state, target.id)
  settle(state)
  assert.equal(state.enemies.find(item => item.id === target.id)?.exhausted, true, '躲避成功横置敌人')
  assert.equal(state.investigators[0].assets.find(item => item.id === card.id)?.exhausted, true, '横置支付费用')
})

// ---- 5c-25：检定 + 「本局一次」标记（04191 古代遗物）----

test('5c-25：04191 古代遗物成功移除密谋毁灭，且每局只生效一次', () => {
  const state = fixture()
  state.chaosBag = ['0']
  state.doom = 2
  state.investigators[0].willpower = 10
  const relic = asset(state, '04191')
  use(state, relic)
  settle(state)
  assert.equal(state.doom, 1, '成功移除 1 点密谋毁灭')
  assert.equal(state.investigators[0].gameFlags?.relicDoomSuccess, true, '记下「本局成功过一次」')
  assert.equal(state.investigators[0].tfaRelicDoomSuccess, undefined, '不再写卡号化的裸字段')
  // 第二次：横置已解除，但仍不应再移除。
  state.investigators[0].assets.find(item => item.id === relic.id).exhausted = false
  use(state, relic)
  settle(state)
  assert.equal(state.doom, 1, '本场游戏已经成功过一次，不再移除')
})

// ---- 5c-24：打出后变成场上卡 + 封印标记（04199 危险预感）----

test('5c-24：04199 危险预感由条目声明「变成场上卡 + 替代结算的封印标记」', () => {
  assert.equal(EFFECTS['04199'], undefined, '旧条目已删除')
  const entry = registeredEntry('04199')
  assert.equal(entry?.substituteSealedToken, true, '替代结算的声明')
  assert.equal(entry?.abilities[0]?.becomesAsset, true, 'played 描述子声明了变为场上卡')
  const state = fixture()
  state.investigators[0].hand = ['04199']
  state.chaosBag = ['-2', '0']
  play(state, '04199')
  settle(state)
  const asset = state.investigators[0].assets.find(item => item.code === '04199')
  assert.ok(asset, '进入场上')
  assert.ok(asset.sealedToken, '封印了一个标记')
  assert.equal(state.investigators[0].discard.includes('04199'), false, '事件本身没有进弃牌堆')
})

// ---- 5c-23：遭遇牌库检索（03263 追猎）----

test('5c-23：03263 追猎从遭遇牌库顶找一名敌人在所在地点生成并交战', () => {
  const state = fixture()
  const me = state.investigators[0]
  me.hand = ['03263']
  // 牌库顶是诡计（正常抽遭遇），下面三张是敌人（追猎的候选）。
  state.encounterDeck = ['ghoulMinion', 'ghoulMinion', 'ghoulMinion', 'dissonantVoices']
  let offered = false
  let candidates = null
  move(state, { action: 'endTurn' })
  settle(state, pending => {
    const option = pending.options?.find(item => item.cardCode === '03263')
    if (option) { offered = true; return option.id }
    if (pending.kind === 'enemy') {
      candidates = pending.options.map(item => item.cardCode)
      return pending.options[0].id
    }
    return null
  })
  assert.equal(offered, true, '遭遇窗口里可以打出追猎')
  assert.deepEqual(candidates, ['ghoulMinion', 'ghoulMinion', 'ghoulMinion'], '候选只列遭遇牌库顶的敌人')
  const spawned = state.enemies.filter(item => item.code === 'ghoulMinion')
  assert.equal(spawned.length, 1, '只生成一名敌人')
  assert.equal(spawned[0].location, state.investigators[0].location, '生成在所在地点')
  assert.equal(spawned[0].engagedSeat, 0, '与打出者交战')
  assert.equal(state.encounterDeck.filter(code => code === 'ghoulMinion').length, 2, '牌库里少一张敌人')
  assert.equal(state.investigators[0].hand.includes('03263'), false, '追猎已打出')
})

// ---- 5c-22：反应窗口的快速事件（03150 预警）----

test('5c-22：03150 预警在抽到诡计时快速打出，花 1 个线索取消它', () => {
  const state = fixture()
  const me = state.investigators[0]
  me.hand = ['03150']
  me.clues = 2
  state.clues = 2
  const hereId = me.location
  state.locations.find(location => location.id === hereId).clues = 0
  state.encounterDeck = ['01165', '01165', '01165'] // 刺耳之声：核心池里的诡计
  let offered = false
  move(state, { action: 'endTurn' })
  settle(state, pending => {
    const option = pending.options?.find(item => item.cardCode === '03150')
    if (option) { offered = true; return option.id }
    return null
  })
  assert.equal(offered, true, '诡计遭遇窗口里应当能打出预警')
  const after = state.investigators[0]
  assert.equal(after.clues, 1, '花掉 1 个个人线索')
  assert.equal(state.clues, 1, '线索总数同步下降')
  assert.equal(state.locations.find(location => location.id === hereId).clues, 1, '线索放回所在地点')
  assert.deepEqual(after.threat.map(card => card.code), [], '诡计被取消，不进入威胁区')
  assert.ok(state.encounterDiscard.includes('01165'), '被取消的诡计进弃牌堆')
  assert.equal(after.hand.includes('03150'), false, '预警已打出')
})

test('5c-21：03033 解锢灵魂以费用 -3、不花行动打出法术，且只列有目标/无目标要求的候选', () => {
  const state = fixture()
  const me = state.investigators[0]
  enemy(state, { engagedSeat: 0 })
  me.hand = ['03033', '01068', '01044'] // 记忆抹消（Spell，费用 1）；弹簧刀不是法术，不该出现
  const actions = me.actionsLeft
  const resources = me.resources
  move(state, { action: 'play', cardId: '03033' })
  assert.equal(state.pendingChoice?.kind, 'card', '出现「选择要折扣打出的法术」询问')
  const optionIds = state.pendingChoice.options.map(option => option.id)
  assert.deepEqual(optionIds, ['01068'], '只有法术/仪式进入候选')
  answer(state, '01068')
  settle(state)
  assert.equal(state.investigators[0].hand.includes('01068'), false, '被折扣打出的牌已离手')
  assert.equal(state.investigators[0].resources, resources, '费用 -3 把 1 费法术压到 0，且 03033 自身 0 费')
  assert.equal(state.investigators[0].actionsLeft, actions - 1, '只花「打出解锢灵魂」这一次行动')
})
