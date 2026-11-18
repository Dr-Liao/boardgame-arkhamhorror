// P5 10009 亚历山德拉·佐兹（Alessandra Zorzi）及专属依赖（10010 哄骗 / 10011 萨马科纳）Node 验收。
//
// 建局：`fixture('10009')`（真实 buildDeck + 回合开始流程）；三个条目由 entries/index.js 注册，
// 这里仍保留「未注册则手动注册」的兜底，方便单卡文件在索引重建前后都能单独跑。
import entry10009 from '../src/cards/entries/10009.js'
import entry10010 from '../src/cards/entries/10010.js'
import entry10011 from '../src/cards/entries/10011.js'
import '../src/engine/engine.js'
import { enemy, fixture, move, settle, validateMove } from './core-fixture.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'
import { ALL_CARDS, INVESTIGATORS } from '../src/cards/cards-data.js'
import { deckCardLimit, validateDeckRules } from '../src/deck/deck-rules.js'
import { buildDeck, matchesDeckOptions } from '../src/deck/deckbuilding.js'
import { actionsAvailable, grantRestrictedAction, restrictedCount } from '../src/engine/restricted-actions.js'
import { investigatorRule } from '../src/cards/card-rules.js'
import { entityRuleActive } from '../src/engine/modifiers.js'
import { parleyForbidden } from '../src/engine/parley.js'
import { drawCards, elderSignEffect, enemyAttack, legalMoves, spawnEnemy } from '../src/engine/engine.js'
import { migrateState } from '../src/engine/save-migration.js'

const CODE = '10009'
const BEGUILE = '10010'
const ZAMACONA = '10011'
const copy = value => JSON.parse(JSON.stringify(value))

// 索引重建前后都能跑：条目已由 entries/index.js 注册时跳过（重复注册会报错）。
for (const entry of [entry10009, entry10010, entry10011]) {
  if (!registeredEntry(entry.code)) registerCardAbilities(entry)
}

// 「书房 → 阁楼（已揭示）→ 地窖（已揭示）」的小地图；阁楼/地窖都是无人地点。
function mapScene(state) {
  const study = state.locations[0]
  study.connections = ['attic']
  study.revealed = true
  state.locations.push({ id: 'attic', name: '阁楼', revealed: true, clues: 0, shroud: 1, connections: ['study', 'cellar'] })
  state.locations.push({ id: 'cellar', name: '地窖', revealed: true, clues: 0, shroud: 1, connections: ['attic'] })
  return state
}

// 把哄骗打到「同地点非精英敌人」身上，返回 { state, inv, enemy, attachment }。
function beguileAState(options = {}) {
  const state = mapScene(options.state ?? fixture(CODE))
  state.investigators[0].hand = [BEGUILE]
  state.chaosBag = options.chaosBag ?? ['0']
  for (const spec of options.enemies ?? [{ name: '测试敌人' }]) {
    enemy(state, { engagedSeat: 0, ...spec })
  }
  const target = state.enemies[0]
  move(state, { action: 'play', cardId: BEGUILE })
  settle(state)
  const inv = state.investigators[0]
  const attachment = state.enemies.find(item => item.id === target.id).attachments
    .find(item => item.code === BEGUILE)
  return { state, inv, enemy: target, attachment }
}

// 当前可用的「哄骗」谈判行动（entityAbility + actionKind parley）。
const parleyMove = state => legalMoves(state, 0)
  .find(item => item.action === 'entityAbility' && item.actionKind === 'parley')

// pendingChoice 选项选择器：命中给定 id / label 时选它，否则交回默认口径。
const pick = id => choice => (choice.options || []).some(option => option.id === id) ? id : null
const pickLabel = label => choice => (choice.options || []).find(option => option.label === label)?.id ?? null

test(`P5 ${CODE} 条目形状：调查员/事件/敌人弱点三条注册与读点声明`, () => {
  const investigator = registeredEntry(CODE)
  assert.ok(investigator, '必须注册调查员条目')
  assert.equal(investigator.kind, 'investigator')
  assert.equal(investigator.investigator.restrictedAction.kind, 'parley', '额外行动只能用于谈判')
  assert.equal(investigator.investigator.elderSign.bonus, 2, '旧印预估 +2')
  assert.ok(investigator.elderSign?.resolve, '旧印描述子必须带 resolve')
  assert.deepEqual(investigatorRule(CODE), { elderSign: { bonus: 2 }, restrictedAction: { kind: 'parley' } })

  const beguile = registeredEntry(BEGUILE)
  assert.equal(beguile.keepOnPlay, true, '附属到敌人的事件不按普通事件弃掉')
  const played = beguile.abilities.find(ability => ability.kind === 'played')
  assert.equal(played.fast, true, '快速')
  assert.equal(played.trigger.length, 0, '没有固定触发时机（自回合直接打出）')
  assert.equal(beguile.playCondition.length, 2, '自回合 + 同地点有非精英敌人')
  const parley = beguile.treacheryRule.attachmentAbilities[0]
  assert.equal(parley.kind, 'action')
  assert.equal(parley.actionKind, 'parley')
  assert.equal(parley.range, 'anywhere', '可以从任意地点激活')
  assert.equal(parley.code, BEGUILE)

  const zamacona = registeredEntry(ZAMACONA)
  assert.equal(zamacona.scope, 'enemy', '玩家牌库里的敌人型弱点走非玩家通道')
  assert.equal(zamacona.enemyRule.elusive, true, '逃逸关键词的唯一读点')
  assert.equal(zamacona.trackActionHistory, true, '每轮第一次谈判靠行动种类记录判定')
  assert.ok(zamacona.modifiers.some(modifier => modifier.target === 'cannot:parley'))
  const triggers = zamacona.abilities.flatMap(ability => ability.trigger).sort()
  assert.deepEqual(triggers, ['actionResolvedAtLocation', 'enemySpawn'])

  // 数据面：签名卡/弱点的印刷属性与构筑归属。
  assert.deepEqual(ALL_CARDS[BEGUILE].signatureFor, [CODE])
  assert.deepEqual(ALL_CARDS[ZAMACONA].signatureFor, [CODE])
  assert.equal(ALL_CARDS[ZAMACONA].type, 'enemy')
  assert.equal(ALL_CARDS[ZAMACONA].subtype, 'weakness')
})

test(`P5 ${CODE} 构筑：buildDeck 30 张 + 3 张哄骗 + 萨马科纳，且非法牌组报错`, () => {
  const def = INVESTIGATORS[CODE]
  assert.equal(def.deckRequirements.size, 30)
  assert.deepEqual([...def.deckRequirements.signatureCards].sort(), [BEGUILE, ZAMACONA])
  assert.equal(ALL_CARDS[BEGUILE].deckLimit, 3, '3 张哄骗不计入牌库张数')
  assert.equal(ALL_CARDS[ZAMACONA].deckLimit, 1)
  assert.equal(matchesDeckOptions(def, ALL_CARDS['04105']), true, '带谈判的卡牌可入牌组')
  assert.equal(matchesDeckOptions(def, ALL_CARDS['01030']), false, '非流浪者/中立卡不可入牌组')

  // 自动构筑：30 张玩家卡 + 3 张哄骗（签名卡）+ 萨马科纳（专属弱点）+ 1 张随机基础弱点。
  const built = buildDeck(def, { seed: 'p5-10009', xp: 0 })
  assert.equal(built.playerCards.length, 30)
  assert.deepEqual(built.signatureCards, [BEGUILE, BEGUILE, BEGUILE])
  assert.deepEqual(built.signatureWeaknesses, [ZAMACONA])
  assert.equal(built.basicWeaknesses.length, 1)
  assert.equal(built.deck.length, 30 + 3 + 1 + 1)
  assert.deepEqual(validateDeckRules(def, built.playerCards, ALL_CARDS).errors, [])
  // 建局即可用：座位就是亚历山德拉本人。
  const state = fixture(CODE)
  assert.equal(state.investigators[0].code, CODE)

  // 手工构筑：许可池凑 30 张合法牌组通过，越界/超限被拒。
  const pool = Object.values(ALL_CARDS).filter(card => card.code
    && matchesDeckOptions(def, card)
    && ['asset', 'event', 'skill'].includes(card.type)
    && !card.subtype && !card.signatureFor && !card.permanent
    && (card.xp || 0) === 0)
  assert.ok(pool.length >= 15, '0 经验许可池足够凑出 30 张')
  const deck = []
  for (const card of pool) {
    if (deck.length >= 30) break
    const add = Math.min(deckCardLimit(card), 30 - deck.length)
    for (let index = 0; index < add; index++) deck.push(card.code)
  }
  assert.equal(deck.length, 30)
  const legal = validateDeckRules(def, deck, ALL_CARDS)
  assert.deepEqual(legal.errors, [], '合法牌组不应有构筑错误')
  assert.deepEqual([legal.size, legal.count], [30, 30])

  const short = validateDeckRules(def, deck.slice(0, 29), ALL_CARDS)
  assert.equal(short.errors.length > 0, true, '29 张必须报牌组张数错误')
  assert.equal(short.count, 29)
  const offFaction = [...deck.slice(0, 29), '01030']
  assert.equal(validateDeckRules(def, offFaction, ALL_CARDS).errors.length > 0, true, '非许可卡必须被拒')
  const limited = deck.find(code => deckCardLimit(ALL_CARDS[code]) === 2)
  assert.ok(limited)
  const overLimit = [...deck.slice(0, 27), limited, limited, limited]
  assert.equal(validateDeckRules(def, overLimit, ALL_CARDS).errors.length > 0, true, '超过张数上限必须被拒')
})

test(`P5 ${CODE} 回合开始：获得 1 个只能用于谈判的额外行动，普通行动不受影响`, () => {
  const state = mapScene(fixture(CODE))
  // 建局后的第一个回合就已经授予（turn.js#turnBeginningWindow）。
  assert.equal(restrictedCount(state.investigators[0], 'parley'), 1, '建局即授予 1 个谈判专用额度')
  // 结束本回合 → 敌人阶段/重整阶段 → 下一轮调查阶段开始时再次授予。
  move(state, { action: 'endTurn' })
  settle(state)
  const inv = state.investigators[0]
  assert.equal(state.currentSeat, 0)
  assert.equal(state.phase, 'investigation')
  assert.equal(restrictedCount(inv, 'parley'), 1, '回合开始正好授予 1 个谈判专用额度')
  assert.equal(inv.parleyOnlyActions, 1)
  assert.equal(actionsAvailable(inv), 3, '普通行动仍是 3 个（受限额度是「最后 1 个行动」）')
  assert.equal(actionsAvailable(inv, 'parley'), actionsAvailable(inv) + 1)
  // 普通行动不能花这份额度：花掉 3 个普通行动后，谈判额度仍然在。
  for (let index = 0; index < 3; index++) {
    const option = legalMoves(state, 0).find(item => item.action === 'resource')
    assert.ok(option, '第 ' + (index + 1) + ' 个普通行动仍应可用')
    move(state, option)
    settle(state)
  }
  const spent = state.investigators[0]
  assert.equal(actionsAvailable(spent), 0)
  assert.equal(restrictedCount(spent, 'parley'), 1, '普通行动不消耗谈判额度')
  assert.ok(validateMove(state, 0, { action: 'resource' }), '剩下的谈判额度不能用于普通行动')
  assert.equal(actionsAvailable(spent, 'parley'), 1)
})

test(`P5 ${CODE} 谈判行动：只消费谈判额度，且不引发借机攻击`, () => {
  const { state, enemy: attached } = beguileAState()
  const guard = enemy(state, { name: '守卫', damage: 2, horror: 1, engagedSeat: 0 })
  const baseline = state.investigators[0]
  const normalBefore = actionsAvailable(baseline)
  const actionsLeftBefore = baseline.actionsLeft
  const creditBefore = restrictedCount(state.investigators[0], 'parley')
  assert.equal(creditBefore, 1, '建局已授予谈判额度')
  const option = parleyMove(state)
  assert.ok(option, '哄骗的谈判行动必须出现在合法行动里')
  assert.equal(option.actionKind, 'parley')
  move(state, option)
  settle(state, pick('investigate'))
  const after = state.investigators[0]
  assert.equal(restrictedCount(after, 'parley'), 0, '谈判花掉谈判专用额度')
  assert.equal(after.actionsLeft, actionsLeftBefore - 1, '只花掉 1 个行动点（来自谈判额度）')
  assert.equal(actionsAvailable(after), normalBefore, '普通行动额度不变')
  assert.equal(after.damage, 0, '谈判不引发借机攻击（守卫没有攻击）')
  assert.equal(after.horror, 0)
  assert.equal(Boolean(state.enemies.find(item => item.id === guard.id).exhausted), false)
  assert.equal(state.enemies.find(item => item.id === attached.id).name, '测试敌人')
})

test(`P5 ${CODE} 旧印：+2，成功后自动躲避所在地点或已揭示连接地点的非精英敌人`, () => {
  const state = mapScene(fixture(CODE))
  const inv = state.investigators[0]
  inv.intellect = 6
  state.locations[0].clues = 2
  state.locations[0].shroud = 1
  state.chaosBag = ['eldersign']
  enemy(state, { name: '近敌' })
  enemy(state, { name: '阁楼敌', location: 'attic', engagedSeat: null })
  enemy(state, { name: '精英敌', location: 'attic', engagedSeat: null, elite: true })

  const effect = elderSignEffect(state, state.investigators[0])
  assert.equal(effect.delta, 2, '旧印恒定 +2')
  assert.equal(investigatorRule(CODE).elderSign.bonus, 2)
  // 候选：同地点 + 已揭示连接地点的非精英敌人（精英不收）。
  const labels = effect.onSuccess.options.map(option => option.label)
  assert.deepEqual(labels, ['近敌', '阁楼敌'])
  assert.equal(labels.includes('精英敌'), false)

  move(state, { action: 'investigate' })
  settle(state, pickLabel('阁楼敌'))
  const result = state.lastTestResult
  const byName = name => state.enemies.find(item => item.name === name)
  assert.equal(result.success, true)
  assert.equal(result.value, 8, '智力 6 + 旧印 2')
  assert.equal(Boolean(byName('阁楼敌').exhausted), true, '连接地点的敌人被自动躲避')
  assert.equal(Boolean(byName('近敌').exhausted), false, '未选择的敌人不受影响')
  assert.equal(Boolean(byName('精英敌').exhausted), false, '精英敌人不是合法目标')

  // 没有候选时只给 +2（不会因为选择而失败）；未揭示的连接地点不计入候选。
  const empty = mapScene(fixture(CODE))
  assert.deepEqual(elderSignEffect(empty, empty.investigators[0]), { delta: 2 })
  const hidden = mapScene(fixture(CODE))
  hidden.locations.find(location => location.id === 'attic').revealed = false
  enemy(hidden, { name: '暗处敌', location: 'attic', engagedSeat: null })
  assert.deepEqual(elderSignEffect(hidden, hidden.investigators[0]), { delta: 2 }, '未揭示的连接地点不是候选')
})

test(`P5 ${CODE} / ${BEGUILE} 哄骗：只能在自回合附属到同地点非精英敌人（合法/非法）`, () => {
  const state = mapScene(fixture(CODE))
  state.investigators[0].hand = [BEGUILE]
  // 没有敌人 → 打出条件拒绝，legalMoves 里也没有这张牌的打出行动。
  assert.equal(validateMove(state, 0, { action: 'play', cardId: BEGUILE }), '你所在地点没有非精英敌人')
  assert.equal(legalMoves(state, 0).some(item => item.action === 'play' && item.cardId === BEGUILE), false)
  // 只有精英敌人 → 同样拒绝。
  const elite = enemy(state, { name: '精英', elite: true })
  assert.equal(validateMove(state, 0, { action: 'play', cardId: BEGUILE }), '你所在地点没有非精英敌人')
  // 非精英敌人 → 合法；打出后进敌人 attachments，不弃置（keepOnPlay），手牌清空。
  state.enemies.splice(state.enemies.indexOf(elite), 1)
  state.investigators[0].engaged = []
  const target = enemy(state, { name: '目标敌人' })
  assert.equal(validateMove(state, 0, { action: 'play', cardId: BEGUILE }), null)
  const option = legalMoves(state, 0).find(item => item.action === 'play' && item.cardId === BEGUILE)
  assert.ok(option, '合法时必须有打出行动')
  move(state, option)
  settle(state)
  const after = state.investigators[0]
  assert.deepEqual(after.hand, [])
  assert.deepEqual(after.discard, [], '哄骗留在敌人身上，不进弃牌堆')
  const host = state.enemies.find(item => item.id === target.id)
  assert.equal(host.attachments.length, 1)
  assert.equal(host.attachments[0].code, BEGUILE)
  assert.equal(host.attachments[0].ownerSeat, 0)
})

test(`P5 ${CODE} / ${BEGUILE} 哄骗：谈判移动模式（只到已揭示连接地点）与任意地点激活`, () => {
  const moved = beguileAState()
  moved.state.locations.find(location => location.id === 'cellar').revealed = false
  const option = parleyMove(moved.state)
  assert.ok(option, '哄骗的谈判行动必须可用')
  move(moved.state, option)
  settle(moved.state, pick('move'))
  const host = moved.state.enemies.find(item => item.id === moved.enemy.id)
  assert.equal(host.location, 'attic', '敌人在移动模式里被移到已揭示的连接地点')
  assert.equal(host.engagedSeat, null, '移动到无人地点后不再与调查员交战')
  assert.equal(moved.state.locations.find(location => location.id === 'cellar').revealed, false)

  // 印刷「你可以从任意地点激活本能力」：亚历山德拉走到别处后仍然可以激活，
  // 调查模式在被附属敌人的所在地点结算。
  const remote = beguileAState()
  remote.state.locations[0].clues = 2
  remote.state.locations[0].shroud = 1
  remote.state.investigators[0].location = 'attic'
  const remoteOption = parleyMove(remote.state)
  assert.ok(remoteOption, '在别的地点也必须能激活')
  move(remote.state, remoteOption)
  settle(remote.state, pick('investigate'))
  assert.equal(remote.state.investigators[0].clues, 1, '调查模式在敌人所在地点结算')
  assert.equal(remote.state.locations.find(location => location.id === 'attic').clues, 0, '不在地点本身的线索没有被取走')

  // 唯一连接地点未揭示时不给「移动」模式（只剩调查/躲避）。
  const second = beguileAState()
  second.state.locations.find(location => location.id === 'attic').revealed = false
  move(second.state, parleyMove(second.state))
  const modes = second.state.pendingChoice
  assert.ok(modes, '多种模式需要玩家选择')
  assert.equal(modes.options.some(item => item.id === 'move'), false, '未揭示的连接地点不能作为移动目标')
  settle(second.state, pick('investigate'))
  assert.equal(second.state.enemies[0].location, 'study', '调查模式不移动敌人')
})

test(`P5 ${CODE} / ${BEGUILE} 哄骗：在其地点调查/躲避；技能检定失败则弃掉`, () => {
  // 调查模式：线索在被附属敌人的地点被发现，成功不弃牌。
  const investigated = beguileAState()
  investigated.state.locations[0].clues = 2
  investigated.state.locations[0].shroud = 1
  move(investigated.state, parleyMove(investigated.state))
  settle(investigated.state, pick('investigate'))
  assert.equal(investigated.state.investigators[0].clues, 1, '调查模式在敌人所在地点发现线索')
  assert.equal(investigated.state.enemies[0].attachments.length, 1, '成功检定不移除哄骗')

  // 躲避模式：目标被横置并脱离交战。
  const evaded = beguileAState({ chaosBag: ['0'] })
  evaded.state.investigators[0].agility = 6
  move(evaded.state, parleyMove(evaded.state))
  settle(evaded.state, pick('evade'))
  const evadedEnemy = evaded.state.enemies[0]
  assert.equal(evadedEnemy.exhausted, true, '躲避模式横置敌人')
  assert.equal(evadedEnemy.engagedSeat, null, '躲避模式解除交战')
  assert.equal(evadedEnemy.attachments.length, 1, '成功躲避不移除哄骗')

  // 失败：技能检定失败 → 哄骗进所有者弃牌堆，敌人不再被附属。
  const failed = beguileAState({ chaosBag: ['-8'] })
  failed.state.locations[0].clues = 2
  failed.state.locations[0].shroud = 8
  failed.state.investigators[0].intellect = 2
  move(failed.state, parleyMove(failed.state))
  settle(failed.state, pick('investigate'))
  assert.equal(failed.state.lastTestResult.success, false)
  assert.equal(failed.state.enemies[0].attachments.length, 0, '失败后移除附属')
  assert.deepEqual(failed.state.investigators[0].discard, [BEGUILE], '失败后哄骗进弃牌堆')
})

test(`P5 ${CODE} / ${ZAMACONA} 萨马科纳：生成在最近的无人地点，逃逸，且不能与之谈判`, () => {
  const state = mapScene(fixture(CODE))
  state.investigators[0].deck = [ZAMACONA]
  drawCards(state, state.investigators[0], 1, [])
  const zamacona = state.enemies.find(item => item.code === ZAMACONA)
  assert.ok(zamacona, '抽到弱点必须生成敌人')
  assert.equal(zamacona.location, 'attic', '生成在最近的无人地点（书房→阁楼）')
  assert.equal(zamacona.location === state.investigators[0].location, false)
  assert.equal(zamacona.engagedSeat, null, '无人地点生成时不与调查员交战')
  assert.equal(zamacona.bearerSeat, 0, '弱点归属抽到它的座位')
  assert.equal(zamacona.health, 3)
  assert.equal(state.encounterDiscard.includes(ZAMACONA), false, '弱点不进遭遇弃牌堆')
  assert.equal(state.investigators[0].deck.includes(ZAMACONA), false)

  // 「不能与萨马科纳谈判」：实体规则读点（合法行动枚举与执行前校验共用）。
  assert.equal(entityRuleActive(state, zamacona, 'cannot:parley'), true)
  assert.equal(parleyForbidden(state, state.investigators[0], zamacona), true)
  const other = enemy(state, { name: '普通敌人' })
  assert.equal(parleyForbidden(state, state.investigators[0], other), false, '规则只作用于萨马科纳')

  // 逃逸：攻击结算后移动到无人连接地点并横置、脱离交战。
  const spawned = spawnEnemy(state, ZAMACONA, 'study', 0)
  assert.equal(state.enemies.filter(item => item.code === ZAMACONA).length, 2)
  // 生成能力同样把它挪到最近的无人地点。
  assert.equal(state.enemies.find(item => item.id === spawned.id).location, 'attic')
  // 把它放到亚历山德拉所在地点并交战（敌人阶段的常见状态），再结算一次攻击。
  state.enemies.find(item => item.id === spawned.id).location = 'study'
  move(state, { action: 'engage', enemyId: spawned.id })
  settle(state)
  const engaged = state.enemies.find(item => item.id === spawned.id)
  assert.equal(engaged.engagedSeat, 0)
  assert.equal(enemyAttack(state, engaged, state.investigators[0], []), true)
  const fled = state.enemies.find(item => item.id === spawned.id)
  assert.equal(fled.location, 'attic', '逃逸：移动到无人的连接地点')
  assert.equal(fled.exhausted, true, '逃逸后横置')
  assert.equal(fled.engagedSeat, null, '逃逸后解除交战')
})

test(`P5 ${CODE} / ${ZAMACONA} 萨马科纳：每轮第一次谈判放 1 毁灭，第二次不触发，下一轮再触发`, () => {
  const { state, enemy: attached } = beguileAState()
  state.investigators[0].deck = [ZAMACONA]
  drawCards(state, state.investigators[0], 1, [])
  const zamaconaAt = () => state.enemies.find(item => item.code === ZAMACONA)
  assert.ok(zamaconaAt())
  assert.equal(zamaconaAt().doom || 0, 0)

  const parley = () => {
    // 每轮第一次谈判：先补上本回合的谈判额度（真实流程由回合开始授予）。
    if (restrictedCount(state.investigators[0], 'parley') === 0) {
      grantRestrictedAction(state, state.investigators[0], 'parley')
    }
    const option = parleyMove(state)
    assert.ok(option, '哄骗的谈判行动必须可用')
    move(state, option)
    settle(state, pick('investigate'))
  }
  parley()
  assert.equal(zamaconaAt().doom, 1, '每轮第一次谈判：放 1 个毁灭')
  const firstDoom = zamaconaAt().doom
  parley()
  assert.equal(zamaconaAt().doom, firstDoom, '同一轮第二次谈判不再触发')
  // 下一轮：limit perRound 重新计数。
  state.round += 1
  parley()
  assert.equal(zamaconaAt().doom, firstDoom + 1, '新一轮第一次谈判再次触发')
  assert.equal(state.enemies.find(item => item.id === attached.id).name, '测试敌人')
})

test(`P5 ${CODE} 存档往返：附属、受限行动额度与毁灭标记都能继续读档`, () => {
  const { state, enemy: attached } = beguileAState()
  // 场上放一个萨马科纳（不经过弱点抽取），随存档一起校验实体规则与毁灭标记。
  const zamacona = spawnEnemy(state, ZAMACONA, 'study', null)
  assert.equal(restrictedCount(state.investigators[0], 'parley'), 1)
  const saved = copy(state)
  migrateState(saved)
  const inv = saved.investigators[0]
  assert.equal(inv.code, CODE)
  assert.equal(restrictedCount(inv, 'parley'), 1, '谈判额度随存档保留')
  assert.equal(actionsAvailable(inv, 'parley'), actionsAvailable(inv) + 1)
  const host = saved.enemies.find(item => item.id === attached.id)
  assert.equal(host.attachments[0].code, BEGUILE, '附属在敌人身上的哄骗随存档保留')
  const savedZamacona = saved.enemies.find(item => item.id === zamacona.id)
  assert.equal(savedZamacona.code, ZAMACONA)
  assert.equal(entityRuleActive(saved, savedZamacona, 'cannot:parley'), true, '实体规则读档后仍生效')
  // 读档后继续谈判：每轮第一次仍然触发 1 个毁灭。
  const option = parleyMove(saved)
  assert.ok(option, '读档后哄骗的谈判仍然可激活')
  move(saved, option)
  settle(saved, pick('investigate'))
  assert.equal(saved.enemies.find(item => item.id === zamacona.id).doom, 1)
})
