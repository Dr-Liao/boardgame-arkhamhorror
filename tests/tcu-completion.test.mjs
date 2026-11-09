import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture, asset, enemy, move, settle } from './core-fixture.mjs'
import { executeDescriptor, performTest, playerWindow, legalMoves, eliminateInvestigator, scenarioRuntime, endCampaign, enemyFightValue } from '../src/engine/engine.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { availableResources } from '../src/engine/resource-bank.js'
import { createTreacheryTokens } from '../src/engine/treachery-tokens.js'
import { BASIC_WEAKNESSES } from '../src/cards/cards-data.js'
import { migrateState } from '../src/engine/save-migration.js'
import { registeredEntry } from '../src/engine/ability.js'
import * as fgg from '../content/campaigns/theCircleUndone/scenarios/forTheGreaterGood/index.js'
import * as uad from '../content/campaigns/theCircleUndone/scenarios/unionAndDisillusion/index.js'
import * as bbt from '../content/campaigns/theCircleUndone/scenarios/beforeTheBlackThrone/index.js'
import { setEmptySpace, setLocationPosition, refreshConnections } from '../content/campaigns/theCircleUndone/scenarios/beforeTheBlackThrone/cosmos.js'

function run(state, execute, choose = () => null) {
  resolveTransaction(state, state.currentSeat, { action: 'completion-test' }, execute)
  for (let guard = 0; state.pendingChoice; guard++) {
    assert.ok(guard < 200, JSON.stringify(state.pendingChoice))
    const pending = state.pendingChoice
    const optionId = choose(pending) ?? ['done', 'skip', 'self'].find(id => pending.options.some(o => o.id === id)) ?? pending.options[0].id
    resolveTransaction(state, pending.seat, { action: 'choose', choiceId: pending.id, optionId }, execute)
  }
}
const effect = (state, resolve, seat = 0) => executeDescriptor(state, {
  inv: state.investigators[seat], source: null, events: [],
  descriptor: { code: '01016', label: '规则验证', resolve },
})

test('TCU 05003/05011 分离资源池：资源损失不扣卡上资源，费用可选择全从资源池支付', () => {
  const state = fixture('05003')
  state.investigators[0].resources = 2
  asset(state, '05011', { resources: 4 })
  run(state, s => effect(s, ({ api }) => api.loseResources(0, 2)))
  assert.equal(state.investigators[0].resources, 0)
  assert.equal(availableResources(state.investigators[0]), 4)
  state.investigators[0].resources = 3
  run(state, s => effect(s, ({ api }) => api.spendResources(0, 2)), pending => pending.kind === 'payment' ? '0' : null)
  assert.equal(state.investigators[0].resources, 1)
  assert.equal(state.investigators[0].assets[0].resources, 4)
})

test('TCU 05011 旧合并资源存档只迁移一次，读取后仍可支付并续玩', () => {
  const state = fixture('05003')
  asset(state, '05011', { resources: 4 })
  state.investigators[0].resources = 7
  delete state.investigators[0].resourceBankModel
  const first = migrateState(JSON.parse(JSON.stringify(state)))
  const migrated = first.state || first
  assert.equal(migrated.investigators[0].resources, 3)
  const second = migrateState(migrated)
  assert.equal((second.state || second).investigators[0].resources, 3)
})

test('TCU 05341 旧版共享虚空位置存档迁移为各副本独立位置，保留原状态报告的格位', () => {
  const state = fixture('01001')
  enemy(state, { id: 'legacy-a', code: '05341', engagedSeat: null })
  enemy(state, { id: 'legacy-b', code: '05341', engagedSeat: null })
  state.scenarioFlags.dancerVoidCell = { x: 2, y: 0 }
  state.scenarioFlags.dancerVoidRound = state.round
  const migrated = migrateState(JSON.parse(JSON.stringify(state))).state
  assert.deepEqual(migrated.enemies.map(e => e.cosmosCell), [{ x: 2, y: 0 }, { x: 2, y: 0 }])
  assert.notEqual(migrated.enemies[0].cosmosCell, migrated.enemies[1].cosmosCell)
  assert.ok(migrated.enemies.every(e => e.location === 'cosmosVoid:2:0' && e.dancerVoidRound === state.round))
  assert.equal(migrated.scenarioFlags.dancerVoidCell, undefined)
})

test('TCU 05156 他人行动之间打出，立即执行一次行动并恢复座位与普通行动数；待决选择可 JSON 往返', () => {
  const state = fixture('01001', 2)
  state.humanSeats = [0, 1]
  state.investigators[1].hand = ['05156']
  state.investigators[1].resources = 5
  const before = state.investigators.map(inv => inv.actionsLeft)
  const serial = state.turnSerial
  let offered = false, acted = false
  const execute = s => playerWindow(s, 'investigation.afterAction', [], null, { fastCards: true, betweenActions: true })
  resolveTransaction(state, 0, { action: 'completion-test' }, execute)
  for (let guard = 0; state.pendingChoice; guard++) {
    assert.ok(guard < 100)
    const pending = state.pendingChoice
    let optionId = 'skip'
    if (pending.seat === 1 && pending.kind === 'playerWindow') {
      const option = pending.options.find(o => o.id === 'fast-card:05156')
      if (option) { offered = true; optionId = option.id }
    }
    if (pending.kind === 'action') {
      optionId = pending.options.find(o => /获得 1 资源/.test(o.label))?.id
      assert.ok(optionId)
      acted = true
    }
    const restored = JSON.parse(JSON.stringify(state))
    Object.assign(state, restored)
    resolveTransaction(state, pending.seat, { action: 'choose', choiceId: pending.id, optionId }, execute)
  }
  assert.ok(offered && acted)
  assert.equal(state.currentSeat, 0)
  assert.equal(state.turnSerial, serial)
  assert.deepEqual(state.investigators.map(inv => inv.actionsLeft), before)
  assert.equal(state.investigators[1].resources, 4, '支付2，再执行资源行动获得1')
  assert.equal(state.immediateAction, undefined)
})

test('TCU 05156 反应灵敏 只在「行动之间」窗口提供：技能检定/神话/敌人窗口不出现', () => {
  const state = fixture('01001', 2)
  state.humanSeats = [0, 1]
  state.investigators[1].hand = ['05156']
  state.investigators[1].resources = 5
  for (const [timing, options] of [
    ['test.beforeCommit', {}],
    ['mythos.afterEncounter', {}],
    ['enemy.afterAttacks', {}],
    ['upkeep.end', {}],
  ]) {
    let offered = false
    const execute = s => playerWindow(s, timing, [], null, options)
    resolveTransaction(state, 0, { action: `05156-window-${timing}` }, execute)
    for (let guard = 0; state.pendingChoice && guard < 20; guard++) {
      const pending = state.pendingChoice
      if (pending.options.some(option => option.id === 'fast-card:05156')) offered = true
      const optionId = pending.options.find(option => ['skip', 'done'].includes(String(option.id)))?.id ?? pending.options[0].id
      resolveTransaction(state, pending.seat, { action: 'choose', choiceId: pending.id, optionId }, execute)
    }
    assert.equal(offered, false, `${timing} 窗口不应提供 05156`)
  }
})

for (const token of ['-8', 'autofail', 'tablet']) {
  test(`TCU 05324 ${token} 取消后结算旧印，保留原混乱袋且不结算原标记效果`, () => {
    const state = fixture('01001')
    state.investigators[0].hand = ['05324']
    state.chaosBag = [token]
    state.locations[0].clues = 2
    state.investigators[0].willpower = token === 'tablet' ? 0 : 3
    run(state, s => performTest(s, 0, 'willpower', 2, { resolve: result => { s.testResult = result } }),
      pending => pending.kind === 'reaction' ? pending.options.find(o => o.cardCode === '05324')?.id : null)
    assert.ok(state.testResult.cancelledTokens.includes(token))
    assert.ok(state.testResult.drawn.includes('eldersign'))
    assert.equal(state.testResult.autoFail, false)
    assert.equal(state.testResult.success, true)
    assert.deepEqual(state.chaosBag, [token])
  })
}

test('TCU 05324 无手牌副本时也可通过温蒂的护身符从弃牌堆顶替换自动失败', () => {
  const state = fixture('01005')
  state.investigators[0].hand = []
  state.investigators[0].discard = ['05324']
  asset(state, '01014')
  state.chaosBag = ['autofail']
  let offered = false
  run(state, s => performTest(s, 0, 'agility', 3, { resolve: result => { s.testResult = result } }), pending => {
    const option = pending.kind === 'reaction' && pending.options.find(o => o.cardCode === '05324')
    if (option) { offered = true; return option.id }
    return null
  })
  assert.ok(offered)
  assert.ok(state.testResult.cancelledTokens.includes('autofail'))
  assert.ok(state.testResult.drawn.includes('eldersign'))
  assert.equal(state.testResult.success, true)
  assert.ok(!state.investigators[0].discard.includes('05324'))
})

test('TCU 05228 机关盒跨章节熄灭火盆、团队限次、被击败转交保持同一实例', () => {
  const state = fixture('01001', 2)
  state.humanSeats = [0, 1]
  const box = asset(state, '05228')
  const location = state.locations[0]
  location.markers = ['brazier']; location.flags = { brazier: true }
  const action = legalMoves(state).find(m => m.action === 'ability' && m.assetId === box.id)
  assert.ok(action, '核心章节也能使用机关盒')
  move(state, action); settle(state)
  assert.equal(state.locations[0].markers.includes('brazier'), false)
  assert.equal(state.locations[0].flags.brazier, undefined)
  state.locations[0].markers = ['brazier']; state.locations[0].flags.brazier = true
  assert.ok(!legalMoves(state).some(m => m.action === 'ability' && m.assetId === box.id))
  run(state, s => { s.investigators[0].defeated = true; eliminateInvestigator(s, s.investigators[0], []) })
  assert.equal(state.investigators[0].assets.some(a => a.id === box.id), false)
  assert.equal(state.investigators[1].assets.find(a => a.id === box.id)?.code, '05228')
})

test('TCU 05231 从手牌揭示纯effect法术，忽略充能与行动费用并可保留原卡', () => {
  const state = fixture('01001')
  state.investigators[0].hand = ['05231', '01060']
  const target = enemy(state, { health: 8 })
  const before = state.investigators[0].actionsLeft
  move(state, { action: 'play', cardId: '05231' }); settle(state)
  assert.equal(state.enemies.find(e => e.id === target.id).damageTaken, 2)
  assert.ok(state.investigators[0].hand.includes('01060'))
  assert.equal(state.investigators[0].actionsLeft, before)
  assert.equal(state.investigators[0].assets.length, 0)
})

test('TCU 05231 从手牌揭示有目标法术，只在本能力期间结算其符号条件子句', () => {
  const state = fixture('01001')
  state.investigators[0].hand = ['05231', '05157']
  state.chaosBag = ['skull']
  const target = enemy(state, { fight: 2, health: 8 })
  move(state, { action: 'play', cardId: '05231' })
  settle(state, pending => pending.kind === 'reaction' ? pending.options.find(o => o.cardCode === '05157')?.id : null)
  assert.equal(enemyFightValue(state, state.enemies.find(e => e.id === target.id)), 1)
  assert.ok(state.investigators[0].hand.includes('05157'))
  assert.equal(state._revealedAbility, undefined)
  const original = registeredEntry('05157')
  assert.equal(original.abilities[1].partOfAbility, 0)
})

test('TCU 05231 借用手牌中的升级凋零术，附属强制子句只结算一次', () => {
  const state = fixture('01001')
  state.investigators[0].hand = ['05231', '05321']
  state.investigators[0].willpower = 5
  state.chaosBag = ['skull']
  const target = enemy(state, { fight: 3, health: 10 })
  move(state, { action: 'play', cardId: '05231' }); settle(state)
  assert.equal(enemyFightValue(state, state.enemies.find(e => e.id === target.id)), 2)
  assert.equal(state._revealedAbility, undefined)
})

test('TCU 05228 机关盒能力只豁免幽灵看守人的借机攻击', () => {
  assert.deepEqual(registeredEntry('05228').abilities[0].noOpportunityAttackFrom, ['05086'])
  const state = fixture('01001')
  const box = asset(state, '05228')
  const watcher = enemy(state, { code: '05086', originalCode: '05086', damage: 2 })
  enemy(state, { code: 'ghoulMinion', damage: 1 })
  move(state, legalMoves(state).find(m => m.action === 'ability' && m.assetId === box.id)); settle(state)
  assert.equal(state.investigators[0].damage, 1, '其他敌人仍进行借机攻击')
  assert.equal(state.enemies.find(e => e.id === watcher.id).exhausted, true)
})

test('TCU 05228 崇高利益中只因被击败交接，撤退不交接，跨层处理保持唯一实例与剧情归属', () => {
  for (const defeated of [false, true]) {
    const state = fixture('01001', 2)
    state.scenario = structuredClone(fgg.scenario)
    state.scenarioFlags.puzzleBox = { holder: 'seat', seat: 0 }
    const box = asset(state, '05228')
    run(state, s => {
      s.investigators[0].defeated = defeated
      s.investigators[0].resigned = !defeated
      eliminateInvestigator(s, s.investigators[0], [])
    })
    const expectedSeat = defeated ? 1 : 0
    assert.equal(state.investigators.flatMap(inv => inv.assets).filter(a => a.code === '05228').length, 1)
    assert.ok(state.investigators[expectedSeat].assets.some(a => a.id === box.id))
    assert.equal(state.scenarioFlags.puzzleBox.seat, expectedSeat)
  }
})

test('TCU 05052 征兆/诅咒从完整已实现收藏抽取，包括卡尔克萨与失落的时代弱点', () => {
  const drawn = new Set()
  const engine = createTreacheryTokens({ BASIC_WEAKNESSES, info() {}, shuffle: x => x,
    randomValue: state => state.testRandom })
  for (let n = 0; n < 100; n++) {
    const state = fixture('01001'); state.testRandom = n / 100
    state.investigators[0].deck = []; state.investigators[0].discard = []
    drawn.add(engine.addBasicWeakness(state, state.investigators[0], [], ['omen', 'curse']))
  }
  assert.ok(drawn.has('03042'))
  assert.ok(drawn.has('04040'))
})

test('TCU 黑色王座 driveInsane 设置精神创伤、战役状态与记录', () => {
  const state = fixture('01001')
  scenarioRuntime(state, []).driveInsane(0)
  assert.equal(state.campaign.investigators[0].status, 'insane')
  assert.equal(state.campaign.trauma[0].mental, state.investigators[0].sanity)
  assert.ok(state.campaign.records.drivenInsaneInvestigators.includes('01001'))
})

test('TCU 05052 收藏弱点厄运降临跨章节升级并永久替换，不进入弃牌堆', () => {
  const state = fixture('01001')
  state.investigators[0].sanity = 30
  state.investigators[0].baseSanity = 30
  state.investigators[0].maxSanity = 30
  state.campaign.investigators[0].deck.push('04040')
  const draw = code => {
    state.investigators[0].deck = [code]
    run(state, s => effect(s, ({ api }) => api.drawCards(0, 1)))
  }
  draw('04040')
  assert.ok(state.campaign.investigators[0].storyRecords.doomApproaches)
  draw('04040')
  assert.ok(state.campaign.investigators[0].deck.includes('04041'))
  assert.ok(!state.campaign.investigators[0].deck.includes('04040'))
  assert.ok(!state.investigators[0].discard.includes('04040'))
  draw('04041'); draw('04041')
  assert.ok(state.campaign.investigators[0].deck.includes('04042'))
  assert.ok(!state.campaign.investigators[0].deck.includes('04041'))
  assert.ok(!state.investigators[0].discard.includes('04041'))
})

test('TCU 崇高利益与聚合幻灭完整加入核心遭遇组，成员分支移除正确的四个敌人', () => {
  const count = (deck, code) => deck.filter(c => c === code).length
  for (const members of [false, true]) {
    const state = { campaign: { records: { theInvestigatorsAreMembersOfTheLodge: members } } }
    const deck = fgg.behavior.modifyDeck(state, fgg.scenario.encounterDeck)
    for (const [code, n] of [['01166', 3], ['01171', 2], ['01174', 2], ['01169', members ? 0 : 3], ['01170', members ? 0 : 1], ['05095', members ? 3 : 0], ['05096', members ? 1 : 0]]) {
      assert.equal(count(deck, code), n, `${members ? '成员' : '非成员'} ${code}`)
    }
  }
  for (const [code, n] of [['01166', 3], ['01167', 2], ['01168', 2]]) assert.equal(count(uad.scenario.encounterDeck, code), n)
})

test('TCU 05323 诱敌深入也替换敌军阶段由剧本发起的移动', () => {
  const state = fixture('01001')
  state.phase = 'enemy'
  state.locations = [
    { id: 'start', connections: ['lure', 'other'] },
    { id: 'lure', connections: ['start'] },
    { id: 'other', connections: ['start'] },
  ]
  state.playerLocationAttachments = [{ code: '05323', ownerSeat: 0, location: 'lure', extra: { round: state.round } }]
  const target = enemy(state, { location: 'start', engagedSeat: null })
  scenarioRuntime(state, []).moveEnemy(target, 'other')
  assert.equal(target.location, 'lure')
})

test('TCU 05323/05341 诱饵与虚空舞者同时在场时按宇宙网格朝诱饵移动', () => {
  const state = fixture('01001')
  state.scenario = structuredClone(bbt.scenario)
  state.phase = 'enemy'
  state.scenarioFlags.cosmos = { cells: {}, posOf: {}, scene: 'scene1' }
  state.locations = ['cosmicIngress', 'courtOfTheGreatOldOnes'].map(id => ({
    ...state.scenario.locations[id], id, connections: [], revealed: true, clues: 0, maxClues: 0,
  }))
  setLocationPosition(state, 'cosmicIngress', 0, 0)
  setLocationPosition(state, 'courtOfTheGreatOldOnes', 3, 0)
  setEmptySpace(state, 1, 0); setEmptySpace(state, 2, 0); refreshConnections(state)
  state.investigators[0].location = 'courtOfTheGreatOldOnes'
  const dancer = enemy(state, { code: '05341', originalCode: '05341', location: 'cosmosVoid:1:0', cosmosCell: { x: 1, y: 0 }, hunter: true, exhausted: false, engagedSeat: null })
  state.playerLocationAttachments = [{ code: '05323', ownerSeat: 0, location: 'cosmicIngress' }]
  bbt.behavior.hunterMove(state, dancer, scenarioRuntime(state, []))
  assert.equal(dancer.location, 'cosmicIngress', '朝诱饵移动，而非朝右侧调查员移动')
  assert.equal(dancer.cosmosCell, undefined)
})

test('TCU 尾声划掉守望者之拥记录，已读正文快照经过JSON存档仍保留', () => {
  const state = fixture('05001', 1, { campaignId: 'theCircleUndone' })
  state.campaign.records.theInvestigatorsSurvivedTheWatchersEmbrace = true
  endCampaign(state, [])
  assert.equal(state.campaign.records.theInvestigatorsSurvivedTheWatchersEmbrace, undefined)
  assert.ok(state.campaign.crossedOutRecords.includes('theInvestigatorsSurvivedTheWatchersEmbrace'))
  const restored = JSON.parse(JSON.stringify(state))
  assert.equal(restored.campaign.epilogueRecords.theInvestigatorsSurvivedTheWatchersEmbrace, true)
  endCampaign(restored, [])
  assert.equal(restored.campaign.crossedOutRecords.length, 1)
})
