// P6 TSK 玩家卡 M2-3 分片（09075–09101）Node 验收。
// 条目直接 import + registerCardAbilities（不依赖索引），用 core-fixture 驱动真实引擎，
// 断言真实状态变化（费用/槽位/使用次数/目标/窗口/持续/负面路径）。
import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture, asset, enemy, move } from './core-fixture.mjs'
import { registeredEntry, registerCardAbilities } from '../src/engine/ability.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { executeDescriptor, getStat, commitIcons, playerWindow } from '../src/engine/engine.js'
import { slotBonus } from '../src/engine/modifiers.js'
import { beneathCards, storeBeneath } from '../src/engine/commit-origins.js'
import entries09075 from '../src/cards/entries/09075.js'
import entries09076 from '../src/cards/entries/09076.js'
import entries09077 from '../src/cards/entries/09077.js'
import entries09078 from '../src/cards/entries/09078.js'
import entries09079 from '../src/cards/entries/09079.js'
import entries09080 from '../src/cards/entries/09080.js'
import entries09081 from '../src/cards/entries/09081.js'
import entries09082 from '../src/cards/entries/09082.js'
import entries09083 from '../src/cards/entries/09083.js'
import entries09084 from '../src/cards/entries/09084.js'
import entries09085 from '../src/cards/entries/09085.js'
import entries09086 from '../src/cards/entries/09086.js'
import entries09087 from '../src/cards/entries/09087.js'
import entries09088 from '../src/cards/entries/09088.js'
import entries09089 from '../src/cards/entries/09089.js'
import entries09090 from '../src/cards/entries/09090.js'
import entries09091 from '../src/cards/entries/09091.js'
import entries09092 from '../src/cards/entries/09092.js'
import entries09093 from '../src/cards/entries/09093.js'
import entries09094 from '../src/cards/entries/09094.js'
import entries09095 from '../src/cards/entries/09095.js'
import entries09096 from '../src/cards/entries/09096.js'
import entries09097 from '../src/cards/entries/09097.js'
import entries09098 from '../src/cards/entries/09098.js'
import entries09099 from '../src/cards/entries/09099.js'
import entries09100 from '../src/cards/entries/09100.js'
import entries09101 from '../src/cards/entries/09101.js'

const ALL_ENTRIES = [entries09075, entries09076, entries09077, entries09078, entries09079, entries09080,
  entries09081, entries09082, entries09083, entries09084, entries09085, entries09086, entries09087,
  entries09088, entries09089, entries09090, entries09091, entries09092, entries09093, entries09094,
  entries09095, entries09096, entries09097, entries09098, entries09099, entries09100, entries09101]
for (const entry of ALL_ENTRIES) if (!registeredEntry(entry.code)) registerCardAbilities([entry])

const inv = (s, seat = 0) => s.investigators[seat]
// 规则事务用动态状态克隆重放，跨事务的实例引用会失效；断言前按 id 重新取实体。
const assetById = (s, id) => s.investigators.flatMap(owner => owner.assets || []).find(card => card.id === id)
const enemyById = (s, id) => s.enemies.find(card => card.id === id)
const descriptors = (code, kind) => (registeredEntry(code).abilities || []).filter(descriptor => descriptor.kind === kind)
const labelsOf = pending => (pending?.options || []).map(option => String(option.label || option.id))
const optionIdByLabel = (pending, pattern) => pending.options.find(option => pattern.test(String(option.label || '')))?.id
const defaultChoice = pending => ['done', 'skip', 'self'].find(id => pending.options.some(option => option.id === id))
  ?? pending.options[0]?.id

function transact(state, run, select = () => null) {
  const execute = draft => run(draft)
  resolveTransaction(state, 0, { action: 'tskPlayerTest' }, execute)
  for (let i = 0; state.pendingChoice; i++) {
    assert.ok(i < 160, `选择循环 ${JSON.stringify(state.pendingChoice)}`)
    const pending = state.pendingChoice
    const id = select(pending) ?? defaultChoice(pending)
    resolveTransaction(state, pending.seat, { action: 'choose', choiceId: pending.id, optionId: id }, execute)
  }
}
function fire(state, code, descriptor, { context = {}, source = null, seat = 0 } = {}, select = () => null) {
  const sourceId = source?.id ?? null
  const alreadyPaid = ['played', 'entersPlay', 'elderSign'].includes(descriptor.kind)
  transact(state, draft => {
    const holder = draft.investigators[seat]
    const resolved = sourceId
      ? holder.assets.find(card => card.id === sourceId)
      : holder.assets.find(card => card.code === code) ?? { code }
    executeDescriptor(draft, { inv: holder, source: resolved, descriptor, alreadyPaid, events: [], context })
  }, select)
}
function link(state, from, id) {
  state.locations.push({ id, name: id, connections: [from], revealed: true, clues: 0, shroud: 1 })
  state.locations.find(location => location.id === from).connections.push(id)
  return id
}
function customize(state, code, checked, seat = 0) {
  state.campaign.tsk ||= { version: 1 }
  state.campaign.tsk.customizations ||= { version: 1, bySeat: {} }
  state.campaign.tsk.customizations.bySeat[seat] ||= {}
  state.campaign.tsk.customizations.bySeat[seat][code] = checked
}
const locationOf = state => state.locations.find(location => location.id === inv(state).location)

// ---------------------------------------------------------------------------
// 09075 扒手行窃工具
// ---------------------------------------------------------------------------
test('P6 09075 扒手行窃工具：花 1 补给用敏捷调查，成功按差值获得 1~2 资源', () => {
  const s = fixture('01001')
  const kit = asset(s, '09075')
  locationOf(s).clues = 2
  const before = { resources: inv(s).resources, clues: inv(s).clues, uses: kit.uses }
  s.chaosBag = ['0']
  fire(s, '09075', descriptors('09075', 'action')[0], {}, pending => {
    if (pending.options.some(option => option.id === 'agility')) return 'agility'
    return null
  })
  const result = s.lastTestResult
  assert.equal(result.skill, 'agility', '本次调查改用敏捷')
  assert.equal(assetById(s, kit.id).uses, before.uses - 1, '花费 1 补给')
  assert.equal(inv(s).clues, before.clues + 1, '成功后获得线索')
  const expected = result.value - result.difficulty >= 2 ? 2 : 1
  assert.equal(inv(s).resources, before.resources + expected, '按成功差值获得资源')
  assert.equal(locationOf(s).clues, 1)
})

// ---------------------------------------------------------------------------
// 09076 职业枪手
// ---------------------------------------------------------------------------
test('P6 09076 职业枪手：入场后把手中违法支援附属到场，并能免费结算其攻击行动', () => {
  const s = fixture('01001')
  const triggerman = asset(s, '09076')
  inv(s).hand = ['09075']
  fire(s, '09076', descriptors('09076', 'entersPlay')[0], { source: triggerman })
  const kit = inv(s).assets.find(card => card.code === '09075')
  assert.ok(kit, '违法支援被放置入场')
  assert.equal(kit.attachedToAsset, assetById(s, triggerman.id).id, '违法支援附属到职业枪手')

  // 第二能力：真实结算附属支援的 action 能力（用 01029 的射击验证伤害与不付行动费）。
  inv(s).assets = inv(s).assets.filter(card => card.code !== '09075')
  const gun = asset(s, '01029', { uses: 2 })
  gun.attachedToAsset = assetById(s, triggerman.id).id
  const foe = enemy(s, { fight: 0, evade: 0, health: 20, engagedSeat: 0 })
  s.chaosBag = ['0']
  const actionsBefore = inv(s).actionsLeft
  fire(s, '09076', descriptors('09076', 'free')[0], { source: assetById(s, triggerman.id) })
  assert.equal(enemyById(s, foe.id).damageTaken, 5, '无行动费结算附属攻击（霰弹枪按超过难度造成 5 点）')
  assert.equal(inv(s).actionsLeft, actionsBefore, '不支付附属能力的[action]费用')
  assert.equal(assetById(s, triggerman.id).exhausted, true, '横置职业枪手')
  assert.equal(inv(s).resources, 29, '花费 1 资源')
})

// ---------------------------------------------------------------------------
// 09077 地下市场
// ---------------------------------------------------------------------------
test('P6 09077 地下市场：牌库 +10；回合开始揭示 2 张，花 1 资源抽 1 张其余放底', () => {
  const s = fixture('01001')
  asset(s, '09077')
  assert.equal(registeredEntry('09077').deckConstruction.sizeBonus, 10, '牌库张数 +10')
  inv(s).deck = ['01060', '01029']
  const before = inv(s).resources
  fire(s, '09077', descriptors('09077', 'reaction')[0], { context: { seat: 0 } }, pending => {
    if (pending.options.some(option => option.id === 'spend')) return 'spend'
    if (pending.options.some(option => option.id === '0')) return '0'
    return null
  })
  assert.equal(inv(s).resources, before - 1, '花费 1 资源')
  assert.equal(inv(s).hand.length, 1, '抽取其中 1 张')
  assert.equal(inv(s).deck.length, 1, '另一张放回牌库底')
})

// ---------------------------------------------------------------------------
// 09078 全身而退
// ---------------------------------------------------------------------------
test('P6 09078 全身而退：每个横置的非蜂拥敌人给出一个不同选项', () => {
  const s = fixture('01001')
  const first = enemy(s, { engagedSeat: 0, exhausted: true, health: 10 })
  const second = enemy(s, { engagedSeat: 0, exhausted: true, health: 10 })
  const before = inv(s).resources
  fire(s, '09078', descriptors('09078', 'played')[0], {}, pending => {
    if (pending.options.some(option => option.id === 'resource')) return 'resource'
    if (pending.options.some(option => option.id === 'damage')) return 'damage'
    return null
  })
  assert.equal(inv(s).resources, before + 2, '第一个敌人选择获得 2 资源')
  assert.equal(enemyById(s, first.id).damageTaken, 0)
  assert.equal(enemyById(s, second.id).damageTaken, 2, '第二个敌人选择造成 2 点伤害')
})

// ---------------------------------------------------------------------------
// 09079 传神佳墨
// ---------------------------------------------------------------------------
test('P6 09079 传神佳墨：3 充能、回合开始移除 1 充能并在耗尽时弃掉；所选技能 +1', () => {
  const s = fixture('01001')
  const ink = asset(s, '09079')
  assert.equal(ink.uses, 3)
  assert.equal(getStat(s, inv(s), 'willpower'), 4, '所选技能（近似为意志）+1')
  for (let i = 0; i < 2; i++) fire(s, '09079', descriptors('09079', 'forced')[0], { context: { seat: 0 } })
  assert.equal(assetById(s, ink.id).uses, 1, '两个回合开始后剩 1 充能')
  fire(s, '09079', descriptors('09079', 'forced')[0], { context: { seat: 0 } })
  assert.equal(inv(s).assets.some(card => card.id === ink.id), false, '充能耗尽后弃掉')
  assert.ok(inv(s).discard.includes('09079'))
})

// ---------------------------------------------------------------------------
// 09080 召来的仆从
// ---------------------------------------------------------------------------
test('P6 09080 召来的仆从：行动把它移动到已揭示的连接地点；定制面板声明 8 项', () => {
  const s = fixture('01001')
  const servant = asset(s, '09080')
  const destination = link(s, inv(s).location, 'm23-servant')
  assert.equal(registeredEntry('09080').customizationOptions.length, 8, '定制选项原样声明')
  assert.equal(registeredEntry('09080').abilities[0].cost.discardControlledAsset, 1, '额外费用弃掉另一个支援')
  fire(s, '09080', descriptors('09080', 'action')[0], { source: servant, context: { targetId: destination } })
  const targetLocation = s.locations.find(location => location.id === destination)
  assert.equal((targetLocation.attachments || []).some(card => card.code === '09080'), true, '仆从移动到目标地点')
  assert.equal(inv(s).assets.some(card => card.id === servant.id), false, '不再作为支援留在场上')
})

// ---------------------------------------------------------------------------
// 09081 号令真言
// ---------------------------------------------------------------------------
test('P6 09081 号令真言：对同地点非精英敌人下「蹲下」命令使其横置', () => {
  const s = fixture('01001')
  const foe = enemy(s, { engagedSeat: 0, fight: 3, evade: 3, health: 10 })
  fire(s, '09081', descriptors('09081', 'played')[0], {}, pending => {
    if (pending.options.some(option => option.id === 'cower')) return 'cower'
    return null
  })
  assert.equal(enemyById(s, foe.id).exhausted, true, '“蹲下”使敌人横置')
  assert.equal(registeredEntry('09081').abilities[0].fast, true, '快速事件')
})

// ---------------------------------------------------------------------------
// 09082 仪式镰刀
// ---------------------------------------------------------------------------
test('P6 09082 仪式镰刀：横置放毁灭换 +1 技能值与 +1 伤害；击败敌人移除 1 毁灭', () => {
  const s = fixture('01001')
  const sickle = asset(s, '09082')
  const foe = enemy(s, { fight: 1, evade: 1, health: 10, engagedSeat: 0 })
  s.chaosBag = ['0']
  fire(s, '09082', descriptors('09082', 'action')[0], { source: sickle, context: { targetId: foe.id } }, pending => {
    if (pending.options.some(option => option.id === 'combat')) return 'combat'
    if (pending.options.some(option => option.id === 'doom')) return 'doom'
    return null
  })
  assert.equal(assetById(s, sickle.id).exhausted, true)
  assert.equal(assetById(s, sickle.id).doom, 1, '横置并放置 1 个毁灭')
  assert.equal(enemyById(s, foe.id).damageTaken, 2, '基础 1 伤害 + 1 额外伤害')

  const s2 = fixture('01001')
  const sickle2 = asset(s2, '09082', { doom: 1 })
  s2.chaosBag = ['0']
  const victim = enemy(s2, { fight: 0, evade: 0, health: 1, engagedSeat: 0 })
  fire(s2, '09082', descriptors('09082', 'action')[0], { source: sickle2, context: { targetId: victim.id } }, pending => {
    if (pending.options.some(option => option.id === 'willpower')) return 'willpower'
    if (pending.options.some(option => option.id === 'defeat')) return 'defeat'
    return null
  })
  assert.equal(s2.enemies.some(card => card.id === victim.id), false, '敌人被击败')
  assert.equal(assetById(s2, sickle2.id).doom, 0, '击败后移除 1 个毁灭')
})

// ---------------------------------------------------------------------------
// 09083 寻龙尺
// ---------------------------------------------------------------------------
test('P6 09083 寻龙尺：横置放毁灭移动到连接地点，发现最后线索时移除毁灭', () => {
  const s = fixture('01001')
  const rod = asset(s, '09083')
  const destination = link(s, inv(s).location, 'm23-dowsing')
  s.locations.find(location => location.id === destination).clues = 2
  s.chaosBag = ['0']
  fire(s, '09083', descriptors('09083', 'action')[0], { source: rod }, pending => {
    if (pending.options.some(option => option.id === 'move')) return 'move'
    if (pending.options.some(option => option.id === destination)) return destination
    if (pending.options.some(option => option.id === 'willpower')) return 'willpower'
    return null
  })
  assert.equal(inv(s).location, destination, '先移动到连接地点')
  assert.equal(assetById(s, rod.id).exhausted, true)
  assert.equal(assetById(s, rod.id).doom, 1)
  assert.equal(inv(s).clues, 1, '在新地点调查成功')

  const s2 = fixture('01001')
  const rod2 = asset(s2, '09083', { doom: 1 })
  locationOf(s2).clues = 1
  s2.chaosBag = ['0']
  fire(s2, '09083', descriptors('09083', 'action')[0], { source: rod2 }, pending => {
    if (pending.options.some(option => option.id === 'lastClue')) return 'lastClue'
    if (pending.options.some(option => option.id === 'willpower')) return 'willpower'
    return null
  })
  assert.equal(assetById(s2, rod2.id).doom, 0, '发现最后一个线索后移除 1 个毁灭')
})

// ---------------------------------------------------------------------------
// 09084 圣杯
// ---------------------------------------------------------------------------
test('P6 09084 圣杯：横置放毁灭治疗 2 点；治疗 1 点完全治愈时移除毁灭', () => {
  const s = fixture('01001')
  const chalice = asset(s, '09084')
  inv(s).damage = 2
  fire(s, '09084', descriptors('09084', 'action')[0], { source: chalice, context: { targetId: '0' } }, pending => {
    if (pending.options.some(option => option.id === 'greater')) return 'greater'
    if (pending.options.some(option => option.id === 'damage')) return 'damage'
    return null
  })
  assert.equal(inv(s).damage, 0, '治疗 2 点伤害')
  assert.equal(assetById(s, chalice.id).doom, 1)
  assert.equal(assetById(s, chalice.id).exhausted, true)

  const s2 = fixture('01001')
  const chalice2 = asset(s2, '09084', { doom: 1 })
  inv(s2).damage = 1
  fire(s2, '09084', descriptors('09084', 'action')[0], { source: chalice2, context: { targetId: '0' } }, pending => {
    if (pending.options.some(option => option.id === 'lesser')) return 'lesser'
    if (pending.options.some(option => option.id === 'damage')) return 'damage'
    return null
  })
  assert.equal(inv(s2).damage, 0)
  assert.equal(assetById(s2, chalice2.id).doom, 0, '完全治愈后移除 1 个毁灭')
})

// ---------------------------------------------------------------------------
// 09085 缟玛瑙五芒星
// ---------------------------------------------------------------------------
test('P6 09085 缟玛瑙五芒星：横置放毁灭可躲避连接地点敌人；成功 2 点移除毁灭', () => {
  const s = fixture('01001')
  const pentacle = asset(s, '09085')
  const far = link(s, inv(s).location, 'm23-pentacle')
  const foe = enemy(s, { location: far, engagedSeat: null, fight: 3, evade: 0, health: 10 })
  s.chaosBag = ['0']
  fire(s, '09085', descriptors('09085', 'action')[0], { source: pentacle }, pending => {
    if (pending.options.some(option => option.id === 'doom')) return 'doom'
    if (pending.options.some(option => option.id === 'willpower')) return 'willpower'
    return null
  })
  assert.equal(enemyById(s, foe.id).exhausted, true, '连接地点的敌人被躲避')
  assert.equal(assetById(s, pentacle.id).doom, 1)
  assert.equal(assetById(s, pentacle.id).exhausted, true)

  const s2 = fixture('01001')
  const pentacle2 = asset(s2, '09085', { doom: 1 })
  const near = enemy(s2, { engagedSeat: 0, fight: 0, evade: 0, health: 10 })
  s2.chaosBag = ['0']
  fire(s2, '09085', descriptors('09085', 'action')[0], { source: pentacle2 }, pending => {
    if (pending.options.some(option => option.id === 'rider')) return 'rider'
    if (pending.options.some(option => option.id === 'agility')) return 'agility'
    return null
  })
  assert.equal(enemyById(s2, near.id).exhausted, true)
  assert.equal(assetById(s2, pentacle2.id).doom, 0, '成功超过 2 点移除 1 个毁灭')
})

// ---------------------------------------------------------------------------
// 09086 惊悚皈依
// ---------------------------------------------------------------------------
test('P6 09086 惊悚皈依：每个法术槽抽 1 张；每个被占用的法术槽弃 1 张手牌', () => {
  const s = fixture('01001')
  asset(s, '01061') // Arcane 槽位
  inv(s).hand = ['01029', '01060']
  inv(s).deck = Array(10).fill('01088')
  fire(s, '09086', descriptors('09086', 'played')[0], {}, pending => {
    if (pending.kind === 'discard') return pending.options[0]?.id
    return null
  })
  assert.equal(inv(s).hand.length, 3, '抽 2 张、弃 1 张手牌')
  assert.equal(inv(s).discard.length, 1, '被占用的法术槽位要求弃 1 张')
})

// ---------------------------------------------------------------------------
// 09087 爆炸结界
// ---------------------------------------------------------------------------
test('P6 09087 爆炸结界：X 对交战的非精英敌人造成伤害，X 受空法术槽限制', () => {
  const s = fixture('01001')
  const foe = enemy(s, { engagedSeat: 0, fight: 0, evade: 0, health: 20 })
  fire(s, '09087', descriptors('09087', 'played')[0], { context: { playCost: { cost: 2 } } })
  assert.equal(enemyById(s, foe.id).damageTaken, 2, '造成 X=2 点伤害')

  const capped = fixture('01001')
  asset(capped, '01061')
  asset(capped, '01060')
  const target = enemy(capped, { engagedSeat: 0, fight: 0, evade: 0, health: 20 })
  fire(capped, '09087', descriptors('09087', 'played')[0], { context: { playCost: { cost: 2 } } })
  assert.equal(enemyById(capped, target.id).damageTaken, 0, '没有空法术槽时 X 被钳制为 0')
  assert.equal(registeredEntry('09087').chooseResourceCostOnPlay, true, 'X 费用卡')
})

// ---------------------------------------------------------------------------
// 09088 诅咒连连
// ---------------------------------------------------------------------------
test('P6 09088 诅咒连连：按毁灭标记击败敌人并获得等量资源；或自动躲避并发现线索', () => {
  const s = fixture('01001')
  const cursed = enemy(s, { engagedSeat: 0, fight: 1, evade: 1, health: 10, doom: 2 })
  const before = inv(s).resources
  fire(s, '09088', descriptors('09088', 'played')[0], {}, pending => {
    if (pending.options.some(option => option.id === 'defeat')) return 'defeat'
    return null
  })
  assert.equal(s.enemies.some(card => card.id === cursed.id), false, '有毁灭的敌人被击败')
  assert.equal(inv(s).resources, before + 2, '每个毁灭获得 1 资源')

  const s2 = fixture('01001')
  locationOf(s2).clues = 1
  const other = enemy(s2, { engagedSeat: 0, fight: 1, evade: 1, health: 10 })
  fire(s2, '09088', descriptors('09088', 'played')[0], {}, pending => {
    if (pending.options.some(option => option.id === 'evade')) return 'evade'
    return null
  })
  assert.equal(enemyById(s2, other.id).exhausted, true, '自动躲避敌人')
  assert.equal(enemyById(s2, other.id).doom, 1, '放置 1 个毁灭')
  assert.equal(inv(s2).clues, 1, '发现 1 个线索')
})

// ---------------------------------------------------------------------------
// 09089 束敌宝罐
// ---------------------------------------------------------------------------
test('P6 09089 束敌宝罐：罐底每个敌人 +1 法术槽；可取消有相同特性敌人的攻击', () => {
  const s = fixture('01001')
  const jar = asset(s, '09089', { markers: { hollow: 1 } })
  inv(s).hand = ['01160']
  assert.ok(storeBeneath(s, 0, jar.id, '01160'), '把食尸鬼爪牙放在罐底')
  assert.equal(slotBonus(inv(s), 'arcane'), 1, '罐底 1 个敌人 → +1 法术槽位')

  const attacker = { code: '01161', name: '饥饿的食尸鬼', location: inv(s).location, elite: false }
  const context = { seat: 0, enemy: attacker }
  fire(s, '09089', descriptors('09089', 'reaction')[1], { source: assetById(s, jar.id), context })
  assert.equal(context.cancelled, true, '取消这次攻击')
  assert.equal(beneathCards(s, 0, jar.id).length, 0, '弃掉罐底与攻击敌人同特性的敌人')
  assert.equal(assetById(s, jar.id).markers?.hollow || 0, 0, '罐底计数减少')

  const s2 = fixture('01001')
  const jar2 = asset(s2, '09089')
  s2.encounterDiscard.push('01160')
  fire(s2, '09089', descriptors('09089', 'reaction')[0], {
    source: jar2,
    context: { enemy: { code: '01160', name: '食尸鬼爪牙', location: inv(s2).location, elite: false } },
  })
  assert.deepEqual(beneathCards(s2, 0, jar2.id), ['01160'], '被击败的非精英敌人被压在罐底')
  assert.equal(assetById(s2, jar2.id).markers?.hollow, 1, '罐底计数 1')
})

// ---------------------------------------------------------------------------
// 09090 恐灵附身
// ---------------------------------------------------------------------------
test('P6 09090 恐灵附身：投入后放毁灭换 2 图标，或移除毁灭/补半使用', () => {
  const s = fixture('01001')
  const assetUnderTest = asset(s, '01061', { doom: 1 })
  s.skillTest = { seat: 0, skill: 'willpower', source: { assetId: assetUnderTest.id }, committed: [] }
  fire(s, '09090', descriptors('09090', 'reaction')[0], { context: { cardCode: '09090' } }, pending => {
    if (pending.options.some(option => option.id === 'settle')) return 'settle'
    return null
  })
  assert.equal(assetById(s, assetUnderTest.id).doom, 0, '移除 1 个毁灭标记')

  const s2 = fixture('01001')
  const asset2 = asset(s2, '01061')
  s2.skillTest = { seat: 0, skill: 'willpower', source: { assetId: asset2.id }, committed: [] }
  fire(s2, '09090', descriptors('09090', 'reaction')[0], { context: { cardCode: '09090' } }, pending => {
    if (pending.options.some(option => option.id === 'doom')) return 'doom'
    return null
  })
  assert.equal(assetById(s2, asset2.id).doom, 1)
  assert.equal(s2.skillTest.extraCommittedIcons, 2, '本次检定 +2 图标')
})

// ---------------------------------------------------------------------------
// 09091 星界映射
// ---------------------------------------------------------------------------
test('P6 09091 星界映射：每个空法术槽 +1 手槽；额外行动打出手中手部槽位支援', () => {
  const s = fixture('01001')
  asset(s, '09091')
  assert.equal(slotBonus(inv(s), 'hand'), 2, '2 个空法术槽 → +2 手部槽位')
  const arcane = asset(s, '01061')
  assert.equal(slotBonus(inv(s), 'hand'), 1, '占用 1 个法术槽后只剩 +1 手槽')
  inv(s).assets = inv(s).assets.filter(card => card.id !== arcane.id)
  inv(s).hand = ['01029']
  inv(s).resources = 10
  const actions = inv(s).actionsLeft
  fire(s, '09091', descriptors('09091', 'action')[0])
  assert.equal(inv(s).assets.some(card => card.code === '01029'), true, '额外行动打出手部槽位支援')
  assert.equal(inv(s).actionsLeft, actions, '不消耗行动点')
  assert.equal(inv(s).resources, 5, '仍支付资源费用 5')
})

test('P6 09091 星界映射：不是自己的回合时玩家窗口不提供额外行动', () => {
  // 卡面「你在自己回合期间可以执行一个行动」：免费能力窗口会向所有调查员询问，
  // 漏 criteria 时额外行动在别人的回合里也会被列出来。
  const s = fixture('01001', 2)
  asset(s, '09091')
  const openWindow = draft => playerWindow(draft, 'investigation.afterAction', [], null, {})
  s.currentSeat = 1
  resolveTransaction(s, 1, { action: 'tskP6OtherTurn' }, openWindow)
  const offTurnLabels = (s.pendingChoice?.options || []).map(option => String(option.label))
  assert.equal(offTurnLabels.some(label => label.includes('星界映射')), false, '不是自己的回合不能触发额外行动')
  // 自己回合的同一窗口仍然提供（只由 criteria 开关，回合内可用性不变）。
  s.currentSeat = 0
  resolveTransaction(s, 0, { action: 'tskP6OwnTurn' }, openWindow)
  const ownTurnLabels = (s.pendingChoice?.options || []).map(option => String(option.label))
  assert.ok(ownTurnLabels.some(label => label.includes('星界映射')), '自己的回合仍然可以触发额外行动')
})

// ---------------------------------------------------------------------------
// 09092 艾勒·鲁巴什
// ---------------------------------------------------------------------------
test('P6 09092 艾勒·鲁巴什：把带毁灭支援附属到自身，并在其技能检定上 +1', () => {
  const s = fixture('01001')
  const elle = asset(s, '09092')
  const orb = asset(s, '01061', { doom: 1 })
  const baseWillpower = getStat(s, inv(s), 'willpower')
  fire(s, '09092', descriptors('09092', 'free')[0], { source: elle })
  assert.equal(assetById(s, orb.id).attachedToAsset, elle.id, '带毁灭支援附属到艾勒')
  assert.equal(assetById(s, elle.id).exhausted, true, '横置支付费用')
  s.skillTest = { seat: 0, skill: 'willpower', source: { assetId: orb.id }, committed: [] }
  assert.equal(getStat(s, inv(s), 'willpower'), baseWillpower + 1, '结算附属支援的技能检定 +1')
})

// ---------------------------------------------------------------------------
// 09093 月光仪式
// ---------------------------------------------------------------------------
test('P6 09093 月光仪式：移除同地点非精英卡牌上所有毁灭标记', () => {
  const s = fixture('01001')
  const foe = enemy(s, { engagedSeat: 0, fight: 1, evade: 1, health: 10, doom: 2 })
  fire(s, '09093', descriptors('09093', 'played')[0])
  assert.equal(enemyById(s, foe.id).doom || 0, 0, '移除全部毁灭标记')
  assert.equal(registeredEntry('09093').abilities[0].fast, true, '快速')
})

// ---------------------------------------------------------------------------
// 09094 食罪者
// ---------------------------------------------------------------------------
test('P6 09094 食罪者：把支援上的 1 毁灭移到自身并重整它；行动清空自身毁灭', () => {
  const s = fixture('01001')
  const eater = asset(s, '09094')
  const relic = asset(s, '01061', { doom: 1, exhausted: true })
  fire(s, '09094', descriptors('09094', 'free')[0], { source: eater }, pending => {
    if (pending.options.some(option => option.id === 'ready')) return 'ready'
    return null
  })
  assert.equal(assetById(s, relic.id).doom, 0)
  assert.equal(assetById(s, eater.id).doom, 1, '毁灭移动到食罪者')
  assert.equal(assetById(s, relic.id).exhausted, false, '重整该支援')
  fire(s, '09094', descriptors('09094', 'action')[0], { source: assetById(s, eater.id) })
  assert.equal(assetById(s, eater.id).doom, 0, '行动移除自身所有毁灭')
})

// ---------------------------------------------------------------------------
// 09095 解锢灵魂
// ---------------------------------------------------------------------------
test('P6 09095 解锢灵魂：弃掉法术支援，从手牌打出法术卡并减 3 费', () => {
  const s = fixture('01001')
  const consumed = asset(s, '01061')
  inv(s).hand = ['01060']
  inv(s).resources = 10
  fire(s, '09095', descriptors('09095', 'played')[0], {}, pending => {
    if (pending.options.some(option => option.id === consumed.id)) return consumed.id
    return null
  })
  assert.equal(inv(s).discard.includes('01061'), true, '弃掉法术支援')
  assert.equal(inv(s).assets.some(card => card.code === '01060'), true, '打出 3 费法术支援')
  assert.equal(inv(s).resources, 10, '费用减少 3（3 → 0）')
})

// ---------------------------------------------------------------------------
// 09096 仪式镰刀（4 级）
// ---------------------------------------------------------------------------
test('P6 09096 仪式镰刀（4 级）：击败敌人后重整并移除所有毁灭', () => {
  const s = fixture('01001')
  const sickle = asset(s, '09096', { doom: 2, exhausted: true })
  s.chaosBag = ['0']
  const victim = enemy(s, { fight: 0, evade: 0, health: 1, engagedSeat: 0 })
  fire(s, '09096', descriptors('09096', 'action')[0], { source: sickle, context: { targetId: victim.id } }, pending => {
    if (pending.options.some(option => option.id === 'combat')) return 'combat'
    if (pending.options.some(option => option.id === 'defeat')) return 'defeat'
    return null
  })
  assert.equal(s.enemies.some(card => card.id === victim.id), false)
  assert.equal(assetById(s, sickle.id).exhausted, false, '重整仪式镰刀')
  assert.equal(assetById(s, sickle.id).doom, 0, '移除所有毁灭标记')
})

// ---------------------------------------------------------------------------
// 09097 寻龙尺（4 级）
// ---------------------------------------------------------------------------
test('P6 09097 寻龙尺（4 级）：移动并 +2 技能值；发现最后线索后重整清毁灭', () => {
  const s = fixture('01001')
  const rod = asset(s, '09097')
  const destination = link(s, inv(s).location, 'm23-dowsing4')
  s.locations.find(location => location.id === destination).clues = 2
  s.chaosBag = ['0']
  const willpowerBase = getStat(s, inv(s), 'willpower')
  fire(s, '09097', descriptors('09097', 'action')[0], { source: rod }, pending => {
    if (pending.options.some(option => option.id === 'move')) return 'move'
    if (pending.options.some(option => option.id === destination)) return destination
    if (pending.options.some(option => option.id === 'willpower')) return 'willpower'
    return null
  })
  assert.equal(inv(s).location, destination)
  assert.equal(s.lastTestResult.value, willpowerBase + 2, '本次调查 +2 技能值')
  assert.equal(assetById(s, rod.id).doom, 1)
  assert.equal(assetById(s, rod.id).exhausted, true)

  const s2 = fixture('01001')
  const rod2 = asset(s2, '09097', { doom: 2, exhausted: true })
  locationOf(s2).clues = 1
  s2.chaosBag = ['0']
  fire(s2, '09097', descriptors('09097', 'action')[0], { source: rod2 }, pending => {
    if (pending.options.some(option => option.id === 'lastClue')) return 'lastClue'
    if (pending.options.some(option => option.id === 'willpower')) return 'willpower'
    return null
  })
  assert.equal(assetById(s2, rod2.id).exhausted, false)
  assert.equal(assetById(s2, rod2.id).doom, 0)
})

// ---------------------------------------------------------------------------
// 09098 缟玛瑙五芒星（4 级）
// ---------------------------------------------------------------------------
test('P6 09098 缟玛瑙五芒星（4 级）：躲避连接地点敌人；成功 2 点重整清毁灭', () => {
  const s = fixture('01001')
  const pentacle = asset(s, '09098')
  const far = link(s, inv(s).location, 'm23-pentacle4')
  const foe = enemy(s, { location: far, engagedSeat: null, fight: 3, evade: 0, health: 10 })
  s.chaosBag = ['0']
  fire(s, '09098', descriptors('09098', 'action')[0], { source: pentacle }, pending => {
    if (pending.options.some(option => option.id === 'doom')) return 'doom'
    if (pending.options.some(option => option.id === 'willpower')) return 'willpower'
    return null
  })
  assert.equal(enemyById(s, foe.id).exhausted, true)
  assert.equal(assetById(s, pentacle.id).doom, 1)

  const s2 = fixture('01001')
  const pentacle2 = asset(s2, '09098', { doom: 2, exhausted: true })
  enemy(s2, { engagedSeat: 0, fight: 0, evade: 0, health: 10 })
  s2.chaosBag = ['0']
  s2.investigators[0].assets = s2.investigators[0].assets.filter(card => card.code !== '09098' || card.id === pentacle2.id)
  fire(s2, '09098', descriptors('09098', 'action')[0], { source: pentacle2 }, pending => {
    if (pending.options.some(option => option.id === 'rider')) return 'rider'
    if (pending.options.some(option => option.id === 'agility')) return 'agility'
    return null
  })
  assert.equal(assetById(s2, pentacle2.id).exhausted, false, '重整')
  assert.equal(assetById(s2, pentacle2.id).doom, 0, '移除所有毁灭')
})

// ---------------------------------------------------------------------------
// 09099 便携万能工具
// ---------------------------------------------------------------------------
test('P6 09099 便携万能工具：真实攻击检定窗口横置 +1 技能值；勾选尖刀再 +1', () => {
  const runFight = (state, select) => {
    const foe = enemy(state, { engagedSeat: 0, fight: 0, evade: 0, health: 30 })
    state.chaosBag = ['0']
    state.investigators[0].hand = []
    move(state, { action: 'fight', enemyId: foe.id })
    for (let index = 0; state.pendingChoice && index < 120; index++) {
      const pending = state.pendingChoice
      const chosen = select(pending, state) ?? defaultChoice(pending)
      move(state, { action: 'choose', choiceId: pending.id, optionId: chosen })
    }
    return state.lastTestResult
  }
  const s = fixture('01001')
  asset(s, '09099')
  const result = runFight(s, pending => {
    if (pending.kind === 'playerWindow' && pending.source === 'test.beforeCommit'
      && labelsOf(pending).some(label => /便携万能工具/.test(label))) {
      return optionIdByLabel(pending, /便携万能工具/)
    }
    return null
  })
  assert.equal(result.value, inv(s).combat + 1, '基础 +1 技能值')
  assert.equal(inv(s).assets.find(card => card.code === '09099').exhausted, true)

  const s2 = fixture('01001')
  customize(s2, '09099', [2])
  asset(s2, '09099')
  const result2 = runFight(s2, pending => {
    if (pending.kind === 'playerWindow' && pending.source === 'test.beforeCommit'
      && labelsOf(pending).some(label => /便携万能工具/.test(label))) {
      return optionIdByLabel(pending, /便携万能工具/)
    }
    return null
  })
  assert.equal(result2.value, inv(s2).combat + 2, '勾选尖刀后攻击 +2 技能值')
})

// ---------------------------------------------------------------------------
// 09100 简易陷阱
// ---------------------------------------------------------------------------
test('P6 09100 简易陷阱：以 2 计时入场，每轮结束移除 1 计时，耗尽后弃掉', () => {
  const s = fixture('01001')
  fire(s, '09100', descriptors('09100', 'played')[0])
  const trap = inv(s).assets.find(card => card.code === '09100')
  assert.ok(trap, '事件变成场上卡')
  assert.equal(assetById(s, trap.id).uses, 2, '使用 2 计时')
  assert.equal(assetById(s, trap.id).usesType, 'time')
  fire(s, '09100', descriptors('09100', 'forced')[0], { source: assetById(s, trap.id) })
  assert.equal(assetById(s, trap.id).uses, 1, '一轮结束移除 1 计时')
  fire(s, '09100', descriptors('09100', 'forced')[0], { source: assetById(s, trap.id) })
  assert.equal(inv(s).assets.some(card => card.id === trap.id), false, '没有计时后弃掉')
  assert.ok(inv(s).discard.includes('09100'))
})

// ---------------------------------------------------------------------------
// 09101 饱经风霜
// ---------------------------------------------------------------------------
test('P6 09101 饱经风霜：对遭遇卡的检定每个匹配的所选特性获得双百搭图标', () => {
  const s = fixture('01001')
  const foe = enemy(s, { engagedSeat: 0, fight: 1, evade: 1, health: 10 })
  foe.traits = ['Monster', 'Humanoid']
  s.skillTest = { seat: 0, skill: 'combat', source: { enemyId: foe.id }, committed: [] }
  const icons = commitIcons(s, inv(s), '09101', 'combat')
  assert.equal(icons, 5, '基础 1 百搭 + 2 个匹配特性 × 2')
  assert.equal(registeredEntry('09101').customizationOptions.length, 5)
})
