import test from 'node:test'
import assert from 'node:assert/strict'
import { createGameState, applyMove, decisionSeat, validateMove, legalMoves, performTest } from '../src/engine/engine.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { campaignGraph, walkCampaign, enterCampaignNode, validateCampaignGraph } from '../src/campaign/campaign-flow.js'
import { initializeChaosBag, beginChaosTest, drawChaosToken, endChaosTest, sealChaosToken, releaseChaosTokens, changeChaosBag } from '../src/engine/chaos-bag.js'
import { registerDeckRules, validateDeckRules, upgradeQuote } from '../src/deck/deck-rules.js'
import { stagePurchase, finishUpgradeDraft, recommendUpgrade, availablePurchases, replacementOptions } from '../src/campaign/campaign.js'
import { viewState } from '../src/integration/observation.js'
import { buildDeck, buildDeckFromList } from '../src/deck/deckbuilding.js'
import { ALL_CARDS, INVESTIGATORS } from '../src/cards/cards-data.js'
import { contentRegistry, registerContentBundle } from '../content/registered.js'
import * as gathering from '../content/campaigns/nightOfTheZealot/scenarios/theGathering/index.js'

const clone = state => JSON.parse(JSON.stringify(state))
function move(state, command) {
  assert.equal(validateMove(state, decisionSeat(state), command), null)
  applyMove(state, decisionSeat(state), command)
}
function answer(state, optionId) { move(state, { action: 'choose', choiceId: state.pendingChoice.id, optionId }) }
function settle(state) {
  for (let i = 0; state.pendingChoice; i++) {
    assert.ok(i < 120)
    const options = state.pendingChoice.options
    answer(state, options.find(o => ['done', 'skip', 'self'].includes(o.id))?.id || options[0].id)
  }
}
function game(code = '01004', count = 1) {
  const state = createGameState({ playerInvestigator: code, seed: 'n5-rules' }, Array.from({ length: count }, (_, seat) => ({ seat })))
  settle(state)
  for (const inv of state.investigators) { inv.hand = []; inv.deck = Array(20).fill('01088'); inv.resources = 15; inv.actionsLeft = 10 }
  state.chaosBag = ['0']; state.encounterDeck = Array(12).fill('dissonantVoices')
  return state
}
function addAsset(state, code, id = code) { state.investigators[0].assets.push({ id, code, exhausted: false, uses: 3 }); return id }

test('N5 地点首次揭示与再次进入效果产生独立演出，伤害选择恢复不重播', () => {
  const s=game('01001'), inv=s.investigators[0]
  s.locations=['hallway','cellar'].map(id=>({...gathering.scenario.locations[id],revealed:id==='hallway',clues:0,maxClues:2}))
  inv.location='hallway'
  const first=applyMove(s,0,{action:'move',locationId:'cellar'})
  const reveal=first.filter(e=>e.presentation?.kind==='location')
  assert.equal(reveal.length,1)
  assert.equal(reveal[0].presentation.code,'01114')
  assert.equal(reveal[0].presentation.flip,true)
  assert.equal(reveal[0].presentation.clues,2)
  assert.match(reveal[0].presentation.text,/伤害/)
  assert.equal(s.locations.find(l=>l.id==='cellar').revealed,true)
  if(s.pendingChoice){
    const restored=clone(s)
    const option=s.pendingChoice.options.find(o=>o.id==='self') || s.pendingChoice.options[0]
    const resolution=applyMove(s,0,{action:'choose',choiceId:s.pendingChoice.id,optionId:option.id})
    applyMove(restored,0,{action:'choose',choiceId:restored.pendingChoice.id,optionId:option.id})
    assert.deepEqual(clone(s),restored)
    assert.equal(resolution.filter(e=>e.presentation?.kind==='location').length,0)
  }
  settle(s)
  assert.equal(s.investigators[0].damage,1)
  applyMove(s,0,{action:'move',locationId:'hallway'});settle(s)
  const again=applyMove(s,0,{action:'move',locationId:'cellar'})
  assert.equal(again.filter(e=>e.presentation?.kind==='location').length,1)
  assert.equal(again.find(e=>e.presentation?.kind==='location').presentation.flip,false)
  settle(s)
  assert.equal(s.investigators[0].damage,2)
})
function enemy(state, id, seat = 0) {
  const inv = state.investigators[seat]
  const result = { id, code: 'ghoulMinion', name: id, location: inv.location, engagedSeat: seat, fight: 2, evade: 2,
    health: 10, damageTaken: 0, damage: 1, horror: 0, exhausted: false }
  state.enemies.push(result); inv.engaged.push(id); return result
}

test('N5 双法术槽、满槽替换选择与恢复只支付一次', () => {
  const s = game(); addAsset(s, '01060'); s.investigators[0].hand = ['01061']
  move(s, { action: 'play', cardId: '01061' })
  assert.equal(s.investigators[0].assets.length, 2)
  s.investigators[0].hand = ['01060']
  const before = s.investigators[0].resources
  move(s, { action: 'play', cardId: '01060' })
  assert.equal(s.pendingChoice.kind, 'assetReplacement')
  const recovered = clone(s); const id = s.pendingChoice.options[0].id
  answer(s, id); answer(recovered, id)
  assert.deepEqual(clone(s), recovered)
  assert.equal(s.investigators[0].assets.length, 2)
  assert.equal(s.investigators[0].resources, before - ALL_CARDS['01060'].cost)
  assert.ok(s.investigators[0].discard.length)
})

test('N5 双手资产可选择弃置两个单手资产，旧资产在确认完成前保留', () => {
  const s = game('01001'); addAsset(s, '01086', 'knife'); addAsset(s, '01087', 'light')
  s.investigators[0].hand = ['01029']; move(s, { action: 'play', cardId: '01029' })
  assert.equal(s.pendingChoice.kind, 'assetReplacement')
  answer(s, 'knife'); assert.equal(s.investigators[0].assets.length, 2)
  answer(s, 'light'); assert.deepEqual(s.investigators[0].assets.map(a => a.code), ['01029'])
})

test('N5 玩家点击开始后先行动，AI 随机顺序可恢复且不会重复行动', () => {
  const s = createGameState({ seed: 'turn-order' }, [{ seat: 0 }, { seat: 1 }, { seat: 2 }])
  while (s.pendingChoice?.kind === 'mulligan') answer(s, 'done')
  assert.equal(s.pendingChoice.kind, 'turnOrder')
  assert.deepEqual(s.pendingChoice.options.map(option => option.id), ['0', '1', '2'])
  assert.equal(s.pendingChoice.options[0].label, '开始行动')
  answer(s, '0')
  assert.equal(s.currentSeat, 0)
  while (s.pendingChoice?.kind === 'reaction') answer(s, 'skip')
  for(const inv of s.investigators)inv.hand=[]
  const copy = clone(s)
  move(s, { action: 'endTurn' })
  move(copy, { action: 'endTurn' })
  assert.deepEqual(clone(s),copy)
  assert.equal(s.pendingChoice,null)
  assert.deepEqual([...s.aiTurnOrder].sort(),[1,2])
  assert.equal(s.currentSeat,s.aiTurnOrder[0])
  move(s,{action:'endTurn'})
  assert.equal(s.currentSeat,s.aiTurnOrder[1])
  assert.deepEqual(s.turnsTaken,[0,s.aiTurnOrder[0]])
})

function mixedTable(seed) {
  const s=createGameState({seed},[
    {seat:0,role:'human'},{seat:1,role:'ai'},{seat:2,role:'human'},{seat:3,role:'ai'},
  ])
  while(s.pendingChoice?.kind!=='turnOrder') {
    const options=s.pendingChoice.options
    const seat=s.pendingChoice.seat
    applyMove(s,seat,{action:'choose',choiceId:s.pendingChoice.id,optionId:options.find(option=>['done','skip'].includes(option.id))?.id||options[0].id})
  }
  return s
}
const choose=(s,seat,optionId)=>applyMove(s,seat,{action:'choose',choiceId:s.pendingChoice.id,optionId})
const turnOptions=(s,seat)=>legalMoves(s,seat).map(m=>m.optionId)

test('N5 队长可指定尚能行动的 AI 先行动，其他真人只能开始自己的行动',()=>{
  const s=mixedTable('lead-picks-ai')
  assert.equal(s.pendingChoice.seat,0)
  assert.deepEqual(s.pendingChoice.seats,[0,2])
  assert.deepEqual(turnOptions(s,0),['0','1','3'])
  assert.deepEqual(turnOptions(s,2),['2'])
  assert.match(s.pendingChoice.options.find(option=>option.id==='3').label,/先行动/)
  assert.match(validateMove(s,2,{action:'choose',choiceId:s.pendingChoice.id,optionId:'1'}),/其他玩家/)

  choose(s,0,'1')
  assert.equal(s.currentSeat,1)
  while(s.pendingChoice?.kind==='reaction')answer(s,'skip')
  for(const inv of s.investigators)inv.hand=[]
  s.investigators[3].defeated=true
  move(s,{action:'endTurn'})

  assert.equal(s.pendingChoice.kind,'turnOrder')
  assert.deepEqual(s.pendingChoice.seats,[0,2])
  assert.deepEqual(turnOptions(s,0),['0'])
  choose(s,0,'0')
  while(s.pendingChoice?.kind==='reaction')answer(s,'skip')
  move(s,{action:'endTurn'})

  assert.equal(s.pendingChoice.kind,'turnOrder')
  assert.equal(s.pendingChoice.seat,2)
  assert.equal(s.pendingChoice.seats,undefined)
  assert.deepEqual(turnOptions(s,2),['2'])
})

test('N5 多名真人谁先点击开始行动谁先走，回放结果一致',()=>{
  const s=mixedTable('human-race')
  assert.equal(validateMove(s,1,{action:'choose',choiceId:s.pendingChoice.id,optionId:'2'}),'现在不是你的应答时机')
  assert.match(validateMove(s,2,{action:'choose',choiceId:s.pendingChoice.id,optionId:'0'}),/其他玩家/)

  const host=viewState(s,0), guest=viewState(s,2), ai=viewState(s,1)
  assert.deepEqual(host.pendingChoice.options.map(option=>option.id),['0','1','3'])
  assert.deepEqual(guest.pendingChoice.options,[{id:'2',label:'开始行动'}])
  assert.deepEqual(guest.legalMoves.map(m=>m.optionId),['2'])
  assert.deepEqual(ai.pendingChoice.options,[])

  const replay=clone(s)
  choose(s,2,'2'); choose(replay,2,'2')
  assert.deepEqual(clone(s),replay)
  assert.equal(s.currentSeat,2)
  while(s.pendingChoice?.kind==='reaction')choose(s,s.pendingChoice.seat,'skip')
  for(const inv of s.investigators)inv.hand=[]
  applyMove(s,2,{action:'endTurn'})

  assert.equal(s.pendingChoice.kind,'turnOrder')
  assert.equal(s.pendingChoice.seat,0)
  assert.equal(s.pendingChoice.seats,undefined)
  assert.deepEqual(turnOptions(s,0),['0','1','3'])
})

test('N5 随机 AI 顺序不会固定为席位顺序',()=>{
  const orders=new Set()
  for(let i=0;i<8;i++) {
    const s=createGameState({seed:'random-turn-'+i},Array.from({length:4},(_,seat)=>({seat})))
    settle(s);for(const inv of s.investigators)inv.hand=[]
    move(s,{action:'endTurn'})
    orders.add(s.aiTurnOrder.join(','))
    assert.equal(s.aiTurnOrder.length,3)
  }
  assert.ok(orders.size>1)
})

test('N5 默认不询问盟友投入，主动求助后才进入同地点盟友窗口且可恢复',()=>{
  const s=game('01001',3)
  for(const inv of s.investigators)inv.assets=[]
  s.investigators[1].hand=['01090'];s.investigators[2].hand=['01090']
  s.investigators[2].location='hallway'
  move(s,{action:'investigate'})
  assert.equal(s.pendingChoice.kind,'commit');assert.equal(s.pendingChoice.seat,0)
  assert.ok(s.pendingChoice.options.some(o=>o.id==='help'))
  const alone=clone(s);answer(alone,'done')
  assert.equal(alone.pendingChoice,null)
  assert.deepEqual(alone.investigators[1].hand,['01090'])
  answer(s,'help')
  assert.equal(s.pendingChoice.seat,1);assert.equal(s.skillTest.helpRequested,true)
  assert.ok(!s.pendingChoice.options.some(o=>o.id==='help'))
  const restored=clone(s);answer(s,'0');answer(restored,'0')
  assert.deepEqual(clone(s),restored)
  assert.equal(s.pendingChoice,null)
  assert.ok(s.investigators[1].discard.includes('01090'))
  assert.deepEqual(s.investigators[2].hand,['01090'])
})

test('N5 危机检定不提供求助入口',()=>{
  const s=game('01001',2);s.investigators[1].hand=['01090']
  resolveTransaction(s,0,{action:'peril-check'},draft=>performTest(draft,0,'intellect',3,{peril:true}))
  assert.equal(s.pendingChoice.kind,'commit')
  assert.ok(!s.pendingChoice.options.some(o=>o.id==='help'))
})

test('N5 借机攻击由被攻击者选择顺序，恢复不重复伤害', () => {
  const s = game(); enemy(s, 'first'); enemy(s, 'second')
  move(s, { action: 'resource' }); assert.equal(s.pendingChoice.kind, 'attackOrder')
  const copy = clone(s); answer(s, 'second'); settle(s); answer(copy, 'second'); settle(copy)
  assert.deepEqual(clone(s), copy)
  assert.equal(s.investigators[0].damage, 2)
  assert.ok(s.log.findIndex(t => t.includes('second 发动借机攻击')) < s.log.findIndex(t => t.includes('first 发动借机攻击')))
})

test('N5 敌人阶段顺序选择后各攻击一次', () => {
  const s = game(); enemy(s, 'one'); enemy(s, 'two')
  move(s, { action: 'endTurn' }); assert.equal(s.pendingChoice.kind, 'attackOrder')
  assert.equal(s.pendingChoice.source, 'enemyPhase'); answer(s, 'two'); settle(s)
  assert.equal(s.investigators[0].damage, 2); assert.equal(s.round, 2)
})

test('N5 投入后的付费窗口保留投入区，抽袋之前可以加值', () => {
  const s = game('01002'); addAsset(s, '01034'); s.investigators[0].hand = ['01090']
  move(s, { action: 'investigate' }); assert.equal(s.pendingChoice.kind, 'boost'); answer(s, 'skip')
  assert.equal(s.pendingChoice.kind, 'commit'); answer(s, '0'); answer(s, 'done')
  assert.equal(s.pendingChoice.kind, 'boost')
  assert.equal(s.investigators[0].discard.includes('01090'), false)
  assert.deepEqual(s.skillTest.committed, [{ seat: 0, code: '01090', icons: 2 }])
  assert.deepEqual(s.chaosBag, ['0'])
  const valueBeforePayment = s.skillTest.value
  answer(s, 'pay')
  assert.equal(s.pendingChoice.kind, 'boost')
  assert.equal(s.skillTest.value, valueBeforePayment + 1)
  answer(s, 'skip'); settle(s)
  assert.ok(s.investigators[0].discard.includes('01090')); assert.equal(s.skillTest, null)
})

test('N5 混乱标记不放回抽取、封印与永久变更跨关保留', () => {
  const s = { rngState: 7, campaign: {} }
  initializeChaosBag(s, ['0', '-1', 'bless'])
  sealChaosToken(s, '-1', 'asset'); beginChaosTest(s)
  const drawn = [drawChaosToken(s), drawChaosToken(s)]
  assert.equal(new Set(drawn).size, 2); assert.equal(s.chaosBag.length, 0)
  const copy = clone(s); endChaosTest(s, drawn); endChaosTest(copy, drawn)
  assert.deepEqual(s, copy); assert.deepEqual(s.chaosBag, ['0'])
  releaseChaosTokens(s, 'asset'); changeChaosBag(s, 'frost', 1, { permanent: true })
  initializeChaosBag(s, ['autofail'])
  assert.deepEqual(s.chaosBag, ['0', '-1', 'frost'])
})

test('N5 重复符号是不同实物标记，空袋不会伪造零', () => {
  const s = { rngState: 3, campaign: {} }; initializeChaosBag(s, ['-1', '-1'])
  beginChaosTest(s); assert.equal(drawChaosToken(s), '-1'); assert.equal(drawChaosToken(s), '-1')
  assert.throws(() => drawChaosToken(s), /为空/); endChaosTest(s)
  assert.deepEqual(s.chaosBag, ['-1', '-1'])
})

test('N5 构筑规则支持特性、限额、多职业与可变尺寸，不重复扣限额', () => {
  const inv = { code: 'test-investigator', traits: ['Scholar'] }
  registerDeckRules(inv.code, { size: 3, options: [
    { factions: ['guardian'], level: { max: 2 } }, { traits: ['Tome'], limit: 1, level: { max: 0 } },
  ] })
  const cards = {
    a: { code: 'a', name: 'a', klass: 'guardian', type: 'asset', traits: ['Tome'] },
    b: { code: 'b', name: 'b', klass: 'seeker', type: 'asset', traits: ['Tome'] },
    c: { code: 'c', name: 'c', factions: ['guardian', 'mystic'], type: 'asset' },
    d: { code: 'd', name: 'd', klass: 'seeker', type: 'asset', traits: ['Tome'] },
  }
  assert.deepEqual(validateDeckRules(inv, ['a', 'b', 'c'], cards).errors, [])
  assert.ok(validateDeckRules(inv, ['a', 'b', 'd'], cards).errors.some(e => e.includes('限额')))
  assert.ok(validateDeckRules(inv, ['a', 'b'], cards).errors.some(e => e.includes('3 张')))
})

test('N5 同名不同等级共用上限，永久卡不占尺寸，卓越抵扣按实际经验计算', () => {
  const inv = { code: 'limits' }; registerDeckRules(inv.code, { size: 2, options: [{}] })
  const cards = { a: { code: 'a', name: 'same', type: 'asset' }, b: { code: 'b', name: 'same', type: 'asset', xp: 1 }, p: { code: 'p', name: 'permanent', permanent: true, type: 'asset' } }
  assert.deepEqual(validateDeckRules(inv, ['a', 'b', 'p'], cards).errors, [])
  assert.ok(validateDeckRules(inv, ['a', 'a', 'b'], cards).errors.some(e => e.includes('上限')))
  assert.equal(upgradeQuote({ name: 'x', xp: 3, exceptional: true }, { name: 'x', xp: 2 }).cost, 4)
})

test('N5 升级草稿可撤销、确认一次、观察者看不到其他座位草稿', () => {
  const s = game('01001', 2); const cp = s.campaign; cp.phase = 'interlude'
  cp.investigators[0].xp = 10
  const record = clone(cp.investigators[0]); const added = availablePurchases(record)[0]
  const removed = replacementOptions(record, added)[0].code
  stagePurchase(cp, 0, added, removed)
  assert.equal(cp.investigators[0].xp, 10)
  assert.deepEqual(cp.investigators[0].deck, record.deck)
  assert.equal(viewState(s, 1).campaign.investigators[0].upgradeDraft, undefined)
  finishUpgradeDraft(cp, 0, false); assert.deepEqual(cp.investigators[0], record)
  stagePurchase(cp, 0, added, removed); finishUpgradeDraft(cp, 0, true)
  assert.equal(cp.investigators[0].purchases.length, 1)
  assert.throws(() => finishUpgradeDraft(cp, 0, true), /没有/)
  assert.ok(recommendUpgrade(cp.investigators[0]).reason)
})

test('N5 升级界面：换不掉的牌组卡保留在列表里，并给出与合法动作一致的原因', () => {
  // 关间升级的真实状态：牌组 = 普通卡 + 签名卡 + 弱点；升级列表只列合法组合，
  // 其余牌组卡由观察投影补上「为什么不能替换」，两者必须覆盖整副牌组且不重叠。
  const s = createGameState({ playerInvestigator: '01001', campaignId: 'thePathToCarcosa', seed: 'upgrade-blockers' },
    [{ seat: 0, role: 'human' }, { seat: 1, role: 'ai' }])
  Object.assign(s, { hubFlow: true, uiState: 'interlude', phase: 'interlude', currentSeat: 0, humanSeats: [],
    pendingChoice: null, continuation: null, hubReady: false, hubUpgradedSeats: {}, hubSeatDone: {} })
  Object.assign(s.campaign, { phase: 'interlude', flowStage: 'interlude', upgradesAllowed: true, scenarioIndex: 1,
    scenarioResults: [{ scenarioId: 'curtainCall', investigators: [] }] })
  Object.assign(s.campaign.investigators[0], { xp: 10, currentScenarioIndex: 0, startingDeckReady: true })
  s.legalMoves = legalMoves(s)
  const view = viewState(s, 0)
  const purchases = view.legalMoves.filter(move => move.action === 'hubPurchase')
  const record = s.campaign.investigators[0]
  const deck = [...new Set(record.deck)]
  for (const added of new Set(purchases.map(move => move.added))) {
    const legal = new Set(purchases.filter(move => move.added === added).map(move => move.removed))
    const blocked = new Map((view.upgradeBlocked?.[added] || []).map(item => [item.code, item.reason]))
    for (const code of deck) assert.ok(legal.has(code) || blocked.has(code), `${added} 少了 ${code} 的去向`)
    for (const code of legal) assert.ok(!blocked.has(code), `${added} 误标 ${code} 不可替换`)
  }
  const added = purchases[0].added
  const blocked = new Map((view.upgradeBlocked[added] || []).map(item => [item.code, item.reason]))
  const signature = deck.find(code => ALL_CARDS[code]?.signatureFor)
  const weakness = deck.find(code => ['weakness', 'basicweakness'].includes(ALL_CARDS[code]?.subtype))
  assert.ok(signature && weakness, '测试调查员的牌组必须含签名卡与弱点')
  assert.match(blocked.get(signature), /专属卡牌/)
  assert.match(blocked.get(weakness), /弱点/)
  // 永久卡不占牌组槽位：换走普通卡会让牌组少一张，只能直接加入。
  const permanent = purchases.find(move => move.removed == null && ALL_CARDS[move.added]?.permanent)
  assert.ok(permanent, '当前卡池必须提供永久卡升级')
  const ordinaryBlockers = (view.upgradeBlocked[permanent.added] || [])
    .filter(item => !ALL_CARDS[item.code]?.signatureFor && !ALL_CARDS[item.code]?.subtype)
  assert.ok(ordinaryBlockers.length)
  for (const item of ordinaryBlockers) assert.match(item.reason, /永久卡不占牌组槽位/)
  // 只有关间升级才投影；开局准备阶段不重复下发这份规则。
  const outside = clone(s)
  outside.uiState = 'scenarioSetup'
  outside.legalMoves = legalMoves(outside)
  assert.equal(viewState(outside, 0).upgradeBlocked, undefined)
})

test('N5 战役图支持条件分支、记录、检查点和重访；坏引用拒绝', () => {
  const manifest = { scenarioIds: ['s'], flow: { start: 'pick', nodes: {
    pick: { type: 'choice', options: [{ id: 'yes', label: '探索', when: { record: 'keys', atLeast: 1 }, effects: [{ type: 'increment', key: 'keys', amount: -1 }], next: 's' }] },
    s: { type: 'scenario', scenarioId: 's', next: 'checkpoint' },
    checkpoint: { type: 'checkpoint', next: 's' },
  } } }
  const cp = { records: { keys: 1 }, scenarioResults: [] }
  assert.equal(walkCampaign(cp, manifest, () => 'yes').type, 'scenario'); assert.equal(cp.records.keys, 0)
  enterCampaignNode(cp, manifest, 'checkpoint'); assert.equal(walkCampaign(cp, manifest).type, 'checkpoint')
  const restored = clone(cp); enterCampaignNode(restored, manifest, 's'); assert.equal(restored.flow.visits.s, 2)
  const bad = clone(manifest); bad.flow.nodes.s.next = 'absent'; assert.throws(() => validateCampaignGraph(bad), /不存在/)
})

test('N5 第二战役由注册表驱动，开场分支JSON恢复进入所选关卡', () => {
  const original = contentRegistry.getCampaign('nightOfTheZealot')
  const scenarios = ['branchAlpha', 'branchBeta'].map(id => ({
    manifest: { ...gathering.manifest, id, campaignId: 'branchCampaign', behaviorIds: [id] },
    scenario: { ...gathering.scenario, id }, behavior: { ...gathering.behavior, id },
  }))
  const manifest = { ...original, id: 'branchCampaign', name: '分支测试战役', scenarioIds: scenarios.map(s => s.manifest.id), unlock: { branchAlpha: [], branchBeta: [] },
    flow: { start: 'choice', nodes: {
      choice: { type: 'choice', prompt: '选择路线', options: [{ id: 'a', label: '甲', next: 'a' }, { id: 'b', label: '乙', next: 'b' }] },
      a: { type: 'scenario', scenarioId: 'branchAlpha', next: 'end' }, b: { type: 'scenario', scenarioId: 'branchBeta', next: 'end' }, end: { type: 'end' },
    } } }
  registerContentBundle({ campaigns: [manifest], scenarios })
  const s = createGameState({ campaignId: manifest.id, seed: 'branch' }, [{ seat: 0 }])
  assert.equal(s.pendingChoice.kind, 'campaignBranch'); const restored = clone(s)
  answer(s, 'b'); answer(restored, 'b'); assert.deepEqual(clone(s), restored)
  assert.equal(s.scenario.id, 'branchBeta'); assert.equal(s.pendingChoice.kind, 'mulligan')
  settle(s); assert.ok(legalMoves(s).length)
})


test('N5 ST.7 惩罚待决时投入牌和标记仍在检定区，恢复后仅清理一次', () => {
  const s = game('01001'); const inv = s.investigators[0]
  inv.maxHealth = 20; inv.maxSanity = 20; inv.hand = ['01089', '01088']; inv.discard = []
  s.encounterDeck = ['umordhothsWrath']; s.encounterDiscard = []; s.chaosBag = ['autofail']
  move(s, { action: 'endTurn' }); answer(s, '0'); answer(s, 'done')
  assert.equal(s.pendingChoice.kind, 'discard')
  assert.equal(s.skillTest.stage, 'ST.7')
  assert.equal(s.investigators[0].discard.includes('01089'), false)
  assert.deepEqual(s.chaosBag, [])
  assert.deepEqual(s.chaos.revealed, ['autofail'])
  const copy = clone(s); settle(s); settle(copy)
  assert.deepEqual(clone(s), copy)
  assert.equal(s.skillTest, null)
  assert.equal(s.investigators[0].discard.filter(code => code === '01089').length, 1)
  assert.deepEqual(s.chaosBag, ['autofail'])
})

test('N5 武器加值不降低真正难度，自动失败按敌人战斗值结算', () => {
  const s = game('01001'); const e = enemy(s, 'target'); e.fight = 4
  addAsset(s, '01016', 'gun'); s.chaosBag = ['autofail']
  const ability = legalMoves(s).find(m => m.action === 'ability' && m.assetId === 'gun')
  assert.ok(ability); move(s, ability)
  while (s.pendingChoice && s.pendingChoice.kind !== 'commit') answer(s, s.pendingChoice.options[0].id)
  assert.equal(s.skillTest.difficulty, 4)
  settle(s)
  assert.ok(s.log.some(text => text.includes('攻击失败') && text.includes('0 vs 4')))
})

test('N5 冰霜连抽自动失败，检定结束将实物标记全部归还', () => {
  const s = game('01002'); s.chaosBag = ['frost', 'frost']
  const events = applyMove(s, 0, { action: 'investigate' })
  assert.equal(s.skillTest.source.label, '调查')
  assert.equal(s.skillTest.source.name, s.locations.find(loc => loc.id === s.investigators[0].location).name)
  while (s.pendingChoice) {
    const c = s.pendingChoice
    events.push(...applyMove(s, c.seat, { action: 'choose', choiceId: c.id, optionId: c.options.find(o => ['done','skip','self'].includes(o.id))?.id || c.options[0].id }))
  }
  assert.deepEqual(events.filter(e => e.kind === 'chaos').map(e => e.token), ['frost', 'frost'])
  assert.ok(events.filter(e => e.kind === 'chaos').every(e => e.source.label === '调查'))
  assert.ok(s.log.some(text => text.includes('调查失败')))
  assert.deepEqual(s.chaosBag, ['frost', 'frost'])
  assert.deepEqual(s.chaos.revealed, [])
})

test('N5 资产离场释放封印，替换待决中保持封印', () => {
  const s = game('01001'); addAsset(s, '01086', 'knife'); addAsset(s, '01087', 'light')
  s.chaosBag = ['0', '-1']; sealChaosToken(s, '-1', 'knife')
  s.investigators[0].hand = ['01029']; move(s, { action: 'play', cardId: '01029' })
  assert.deepEqual(s.sealedTokens, ['-1']); answer(s, 'knife'); answer(s, 'light')
  assert.deepEqual(s.sealedTokens, []); assert.ok(s.chaosBag.includes('-1'))
})

test('N5 注册构筑配置被真实自动和手动构筑共同使用，原始签名依赖保留', () => {
  const inv = INVESTIGATORS['01001']
  try {
    registerDeckRules(inv.code, { size: 20, options: inv.deckOptions })
    const built = buildDeck(inv, { seed: 'variable-deck' })
    assert.equal(built.playerCards.length, 20)
    assert.equal(built.signatureCards.length, 1)
    assert.deepEqual(buildDeckFromList(inv, built.playerCards).errors, [])
    assert.ok(buildDeckFromList(inv, built.playerCards.slice(1)).errors.some(e => e.includes('20 张')))
  } finally {
    registerDeckRules(inv.code, { size: inv.deckRequirements.size, options: inv.deckOptions })
  }
})

test('N5 节点入口效果在重读检查点时不重复执行，重访才重新执行', () => {
  const manifest = { scenarioIds: [], flow: { start: 'rest', nodes: {
    rest: { type: 'checkpoint', next: 'end', effects: [{ type: 'increment', key: 'supply', amount: 2 }] }, end: { type: 'end' },
  } } }
  const cp = { records: {}, scenarioResults: [] }
  walkCampaign(cp, manifest); walkCampaign(cp, manifest)
  assert.equal(cp.records.supply, 2)
  const restored = clone(cp); walkCampaign(restored, manifest); assert.equal(restored.records.supply, 2)
  enterCampaignNode(restored, manifest, 'rest'); walkCampaign(restored, manifest); assert.equal(restored.records.supply, 4)
})
