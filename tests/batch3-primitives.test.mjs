// 批次 3 原语回归：批 A（共享窗口/字段）。
// 覆盖：assetPlayed 监听者派发、entersAttachedLocation 敌人/调查员进入、damagePlacedOnSelf、
// preventEnemyReadyNextUpkeep、grantEnemyAloofUntilRoundEnd、locationShroudModUntilRoundEnd。
// 测试条目借用「无行为条目的基础支援卡号」注册，保证引擎能按真实卡数据枚举来源。
import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture, asset, enemy, move, settle, use } from './core-fixture.mjs'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { applyHarm, spawnEnemy, relocateInvestigator, removeThreat, legalMoves, lookAt, enemyAttack } from '../src/engine/engine.js'
import { enemyEffectAllowed } from '../src/engine/effect-provenance.js'
import { availablePlayResources } from '../src/engine/play-payment.js'
import { useCostSources } from '../src/engine/use-transfer.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { withEffectSource } from '../src/engine/effect-provenance.js'

const pick = () => null

// 引擎事务包装：驱动真实引擎动作与反应窗口。
function transact(state, run, select = pick) {
  const execute = draft => run(draft)
  resolveTransaction(state, 0, { action: 'batch3PrimitivesTest' }, execute)
  for (let i = 0; state.pendingChoice; i++) {
    assert.ok(i < 100, `选择循环 ${JSON.stringify(state.pendingChoice)}`)
    const choice = state.pendingChoice
    const id = select(choice, state)
      ?? ['done', 'skip', 'self'].find(option => choice.options.some(item => item.id === option))
      ?? choice.options[0]?.id
    resolveTransaction(state, choice.seat, { action: 'choose', choiceId: choice.id, optionId: id }, execute)
  }
}

// 在无行为条目的真实基础卡号上注册测试条目；已注册则跳过（入口统一重建后仍可复用）。
function register(entry) {
  if (!registeredEntry(entry.code)) registerCardAbilities([entry])
}

// 1) assetPlayed：监听者不必是「被打出的那张支援」自己，也能收到窗口。
test('批次 3 原语：assetPlayed 窗口向任意监听者派发', () => {
  let fired = 0
  register({
    code: '01072', kind: 'asset',
    abilities: [{ kind: 'reaction', trigger: 'assetPlayed', label: '监听打出支援', limit: 'oncePerPhase', resolve: () => { fired += 1 } }],
    modifiers: [],
  })
  const state = fixture('01001')
  state.investigators[0].assets = []
  asset(state, '01072')
  state.investigators[0].hand.push('01516')
  move(state, { action: 'play', cardId: '01516' })
  settle(state, choice => choice.options.find(option => option.cardCode === '01072')?.id)
  assert.equal(fired, 1, 'assetPlayed 监听者应收到 1 次窗口')
})

// 2) entersAttachedLocation：敌人入场进入带玩家地点附属的地点后开窗。
test('批次 3 原语：敌人进入附属地点后触发 entersAttachedLocation', () => {
  let enemyEntries = 0
  register({
    code: '01516', kind: 'asset',
    assetRule: { ownerLocationAttachmentAbility: true },
    abilities: [{
      kind: 'forced', trigger: 'entersAttachedLocation', label: '敌人进入附属地点',
      criteria: [({ source, context }) => Boolean(context?.enemy && source?.location === context.location)],
      resolve: () => { enemyEntries += 1 },
    }],
    modifiers: [],
  })
  const state = fixture('01001')
  const location = state.investigators[0].location
  state.playerLocationAttachments = [{ id: 'batch3-trap-1', code: '01516', location, ownerSeat: 0 }]
  transact(state, draft => spawnEnemy(draft, '01160', location, null, true))
  assert.equal(enemyEntries, 1, '敌人 spawn 进入附属地点应开窗一次')
})

// 3) entersAttachedLocation：调查员移动进入带附属地点后开窗。
test('批次 3 原语：调查员进入附属地点后触发 entersAttachedLocation', () => {
  let investigatorEntries = 0
  register({
    code: '01517', kind: 'asset',
    assetRule: { ownerLocationAttachmentAbility: true },
    abilities: [{
      kind: 'forced', trigger: 'entersAttachedLocation', label: '调查员进入附属地点',
      criteria: [({ source, context }) => Boolean(context?.investigator && source?.location === context.location)],
      resolve: () => { investigatorEntries += 1 },
    }],
    modifiers: [],
  })
  const state = fixture('01001')
  const study = state.locations.find(location => location.id === state.investigators[0].location)
  state.locations.push({ id: 'batch3-hallway', name: '测试走廊', connections: [study.id], revealed: true, clues: 0, shroud: 1 })
  study.connections.push('batch3-hallway')
  state.playerLocationAttachments = [{ id: 'batch3-trap-2', code: '01517', location: 'batch3-hallway', ownerSeat: 0 }]
  transact(state, draft => relocateInvestigator(draft, 0, 'batch3-hallway', []))
  assert.equal(investigatorEntries, 1, '调查员移动进入附属地点应开窗一次')
})

// 4) damagePlacedOnSelf：伤害放置到调查员本人后开反应窗（区别于放置前的 harmDealt）。
test('批次 3 原语：伤害放置到调查员后触发 damagePlacedOnSelf', () => {
  let placed = null
  register({
    code: '01520', kind: 'asset',
    abilities: [{
      kind: 'reaction', trigger: 'damagePlacedOnSelf', label: '受到伤害后', limit: 'oncePerPhase',
      criteria: [({ context }) => Number(context?.damage) > 0],
      resolve: ({ context }) => { placed = { damage: context.damage, horror: context.horror } },
    }],
    modifiers: [],
  })
  const state = fixture('01001')
  const inv = state.investigators[0]
  inv.assets = []
  asset(state, '01520')
  const before = inv.damage || 0
  // 与 tests/card-fidelity-p0.test.mjs 相同的事务重放写法：execute 在每次 choose 时重放同一伤害结算。
  const execute = draft => applyHarm(draft, draft.investigators[0], 2, 0, [])
  resolveTransaction(state, 0, { action: 'batch3Harm' }, execute)
  for (let guard = 0; state.pendingChoice && guard < 20; guard++) {
    const choice = state.pendingChoice
    const choiceId = choice.options.find(option => option.cardCode === '01520')?.id
      ?? (choice.kind?.includes('assign') ? 'self' : null)
      ?? ['done', 'skip', 'self'].find(option => choice.options.some(item => item.id === option))
      ?? choice.options[0]?.id
    resolveTransaction(state, choice.seat, { action: 'choose', choiceId: choice.id, optionId: choiceId }, execute)
  }
  assert.deepEqual(placed, { damage: 2, horror: 0 })
  assert.equal(state.investigators[0].damage, before + 2)
})

// 5) 批 A 新 API：下一个补给阶段不重整 / 冷漠到轮末 / 地点隐藏值到轮末。
test('批次 3 原语：preventEnemyReadyNextUpkeep / grantEnemyAloofUntilRoundEnd / locationShroudModUntilRoundEnd', () => {
  const calls = []
  register({
    code: '01519', kind: 'asset',
    abilities: [
      { kind: 'action', label: '不重整', resolve: ({ api, state }) => {
        const enemy = state.enemies.find(item => item.code === '01160')
        calls.push(api.preventEnemyReadyNextUpkeep(enemy))
      } },
      { kind: 'action', label: '冷漠', resolve: ({ api, state }) => {
        const enemy = state.enemies.find(item => item.code === '01160')
        calls.push(api.grantEnemyAloofUntilRoundEnd(enemy))
      } },
      { kind: 'action', label: '隐藏值', resolve: ({ api, state }) => {
        calls.push(api.locationShroudModUntilRoundEnd(state.investigators[0].location, -2))
      } },
    ],
    modifiers: [],
  })
  const state = fixture('01001')
  const inv = state.investigators[0]
  inv.assets = []
  asset(state, '01519')
  transact(state, draft => spawnEnemy(draft, '01160', draft.investigators[0].location, null, true))
  const enemy = state.enemies.find(item => item.code === '01160')
  assert.ok(enemy, '测试敌人已生成')
  for (let index = 0; index < 3; index++) {
    const assetNow = state.investigators[0].assets.find(card => card.code === '01519')
    assert.ok(assetNow, '测试支援在场')
    use(state, assetNow, { abilityIndex: index })
    settle(state)
  }
  assert.deepEqual(calls, [true, true, true])
  const current = state.enemies.find(item => item.code === '01160')
  assert.ok(current, '事务后敌人仍在场')
  assert.equal(current.skipNextUpkeepReady, true)
  assert.equal(current.aloof, true)
  assert.equal(current.aloofUntilRound, state.round)
  assert.deepEqual(state.locations.find(location => location.id === 'study')?.roundShroudMod,
    { round: state.round, amount: -2 })
})

// 6) 批 B2：威胁区「不能离场」+ force 例外。
test('批次 3 原语 B2：cannotLeavePlay 阻止威胁区卡离场，force 可移除', () => {
  register({ code: '01531', kind: 'asset', cannotLeavePlay: true, abilities: [], modifiers: [] })
  const state = fixture('01001')
  const inv = state.investigators[0]
  inv.threat.push({ id: 'batch3-threat-1', code: '01531' })
  const blocked = removeThreat(state, inv, state.investigators[0].threat[0], [])
  assert.equal(blocked, false, '未声明 force 时应拒绝离场')
  assert.equal(state.investigators[0].threat.length, 1)
  const removed = removeThreat(state, inv, state.investigators[0].threat[0], [], { force: true })
  assert.equal(removed, true, 'force 应允许强制离场')
  assert.equal(state.investigators[0].threat.length, 0)
})

// 7) 批 B2：卡上伤害计数 + 不能触发其它支援能力。
test('批次 3 原语 B2：addCardDamage/cardDamage 与 cannotTriggerOtherAssetAbilities', () => {
  register({
    code: '01521', kind: 'asset',
    abilities: [{ kind: 'action', label: '记伤害', resolve: ({ api, state }) => {
      api.addCardDamage(state.investigators[0].threat[0], 2)
    } }], modifiers: [],
  })
  register({
    code: '01530', kind: 'asset',
    cannotTriggerOtherAssetAbilities: true,
    abilities: [{ kind: 'action', label: '阻断者', resolve: () => {} }], modifiers: [],
  })
  const state = fixture('01001')
  const inv = state.investigators[0]
  inv.assets = []
  inv.threat = []
  inv.threat.push({ id: 'batch3-threat-2', code: '01521' })
  const recorder = asset(state, '01521')
  const blocker = asset(state, '01530')
  const abilityOf = assetId => legalMoves(state).find(move => move.action === 'ability' && move.assetId === assetId)
  assert.equal(abilityOf(recorder.id), undefined, '阻断者在场时其它支援行动不应可用')
  assert.ok(abilityOf(blocker.id), '阻断者自身行动仍可用')
  inv.assets = inv.assets.filter(item => item !== blocker)
  const move = abilityOf(recorder.id)
  assert.ok(move, '移除阻断者后支援行动恢复')
  transact(state, draft => { draft.investigators[0].actionsLeft = 5 })
  use(state, recorder, { abilityIndex: 0 })
  settle(state)
  assert.equal(state.investigators[0].threat[0].damage, 2, '卡上伤害应累计为 2')
})

// 8) 批次 3 原语 C：重复调查阶段（60480）。
test('批次 3 原语 C：repeatInvestigationPhase 在回合结束时重开调查阶段并结算击败', () => {
  register({
    code: '01532', kind: 'asset',
    abilities: [{ kind: 'action', label: '重复阶段', resolve: ({ api, inv }) => {
      api.repeatInvestigationPhase({ seat: inv.seat, physicalTrauma: 1 })
    } }], modifiers: [],
  })
  const state = fixture('01001', 2)
  const inv = state.investigators[0]
  inv.assets = []
  asset(state, '01532')
  inv.actionsLeft = 5
  const probe = inv.assets.find(card => card.code === '01532')
  use(state, probe, { abilityIndex: 0 })
  settle(state)
  assert.equal(state.investigationRepeat?.seat, 0, '回合结束前应保留重复阶段请求')
  // 两人局：本回合结束 -> 交给队友；队友结束 -> 阶段交界消费请求并重开调查阶段。
  for (let i = 0; i < 8 && !state.investigators[0].defeated; i++) {
    move(state, { action: 'endTurn' })
    settle(state)
  }
  assert.equal(state.investigators[0].defeated, true, '重复阶段结束应被击败')
})

// 9) 批次 3 原语 C：受伤害敌人本轮不能攻击（60483）。
test('批次 3 原语 C：protectFromEnemyAttack 阻止指定敌人本轮攻击', () => {
  register({
    code: '01534', kind: 'asset',
    abilities: [{ kind: 'action', label: '保护', resolve: ({ api, state, inv }) => {
      const enemy = state.enemies.find(item => item.code === '01160')
      api.protectFromEnemyAttack(enemy, inv.seat)
    } }], modifiers: [],
  })
  const state = fixture('01001')
  const inv = state.investigators[0]
  inv.assets = []
  asset(state, '01534')
  transact(state, draft => spawnEnemy(draft, '01160', draft.investigators[0].location, null, true))
  const probe = state.investigators[0].assets.find(card => card.code === '01534')
  use(state, probe, { abilityIndex: 0 })
  settle(state)
  const enemy = state.enemies.find(item => item.code === '01160')
  const before = inv.damage || 0
  let attacked
  transact(state, draft => { attacked = enemyAttack(draft, draft.enemies.find(item => item.code === '01160'), draft.investigators[0], []) })
  assert.equal(attacked, false, '受保护敌人本轮不能攻击')
  assert.equal(state.investigators[0].damage, before)
  state.round += 1
  transact(state, draft => { attacked = enemyAttack(draft, draft.enemies.find(item => item.code === '01160'), draft.investigators[0], []) })
  assert.equal(attacked, true, '下一轮恢复攻击')
})

// 10) 批次 3 原语 C：lookAt discardOne（60279）。
test('批次 3 原语 C：lookAt discardOne 看牌后弃掉指定张数', () => {
  const state = fixture('01001')
  const inv = state.investigators[0]
  inv.deck = ['01020', '01021', '01030', '01031']
  inv.discard = []
  let taken
  transact(state, draft => {
    taken = lookAt(draft, 0, { zone: 'deck', count: 3, choose: 0, returnStrategy: 'shuffle', arrange: false, source: '60279',
      discardOne: { count: 1, filter: { type: 'asset' } } }, [])
  }, choice => choice.options.find(option => option.cardCode === '01021')?.id)
  assert.ok(state.investigators[0].discard.includes('01021'), '选中的卡应进弃牌堆')
  assert.ok(!state.investigators[0].deck.includes('01021'))
  assert.equal(taken?.length, 1)
})

// 11) 批次 3 原语 C：topAndBottom 放回（12043）。
test('批次 3 原语 C：lookAt topAndBottom 逐张选顶/底', () => {
  const state = fixture('01001')
  const inv = state.investigators[0]
  inv.deck = ['01020', '01021', '01030', '01031']
  let sequence = 0
  transact(state, draft => {
    lookAt(draft, 0, { zone: 'deck', count: 3, choose: 0, returnStrategy: 'topAndBottom', arrange: false, source: '12043' }, [])
  }, choice => (sequence++ === 0 ? 'top' : 'bottom'))
  const deck = state.investigators[0].deck
  assert.ok(deck.length >= 4)
  assert.equal(deck[deck.length - 1], '01031', '未看的牌留在牌库顶')
})

// 12) 批次 3 原语 C：敌人免疫玩家卡效果（60553）。
test('批次 3 原语 C：playerCardEffectImmune 只拒绝玩家卡来源', () => {
  const state = fixture('01001')
  const enemy = { id: 'immune-1', code: '01160', originalCode: '01160' }
  const deps = { entryOf: () => ({ enemyRule: { playerCardEffectImmune: true } }), cardDef: () => ({ type: 'enemy' }) }
  const asPlayer = withEffectSource(state, { kind: 'playerCard', code: '01020' }, () => enemyEffectAllowed(state, enemy, 'damage', deps))
  const asScenario = withEffectSource(state, { kind: 'scenarioRule' }, () => enemyEffectAllowed(state, enemy, 'damage', deps))
  assert.equal(asPlayer, false)
  assert.equal(asScenario, true)
})

// 13) 批次 3 原语 C2：补给作为资源支付事件费用（60561）与打字机秘密代付（60272）。
test('批次 3 原语 C2：playCostUses 补给代付与 lendUsesAs 秘密代付', () => {
  const state = fixture('01001')
  const inv = state.investigators[0]
  inv.assets = []
  inv.resources = 0
  const supplies = asset(state, '60561')
  supplies.uses = 5
  supplies.usesType = 'supplies'
  const eventDef = ALL_CARDS['01088']
  assert.ok(eventDef?.type === 'event', '测试事件卡存在')
  assert.equal(availablePlayResources(state, inv, eventDef), 5, '5 个补给应可当作 5 资源')
  // 60272 秘密代付：Tome 的秘密费用可以花打字机上的秘密。
  const typewriter = asset(state, '60272')
  typewriter.uses = 3
  typewriter.usesType = 'secrets'
  const tome = { id: 'tome-1', code: '01030', uses: 0, usesType: 'secrets' }
  inv.assets.push(tome)
  const sources = useCostSources(state, tome, registeredEntry)
  assert.ok(sources.includes(typewriter), '打字机的秘密应可作为 Tome 秘密费用的来源')
})

// 14) 批次 3 原语 C3：发现线索可被替换（60253 不灭之网）。
test('批次 3 原语 C3：discoverClue 可被条目替换', () => {
  register({
    code: '01544', kind: 'asset',
    abilities: [{ kind: 'action', label: '发现线索', resolve: ({ api, inv }) => api.discoverClue(inv.seat, 1) }], modifiers: [],
  })
  const state = fixture('01001')
  const inv = state.investigators[0]
  inv.assets = []
  inv.threat = []
  inv.threat.push({ id: 'web-1', code: '60253', counters: 0 })
  const here = state.locations.find(location => location.id === inv.location)
  here.clues = 2
  asset(state, '01544')
  inv.actionsLeft = 5
  const probe = inv.assets.find(card => card.code === '01544')
  move(state, { action: 'ability', assetId: probe.id, abilityIndex: 0 })
  settle(state, choice => choice.options.find(option => option.cardCode === '60253')?.id)
  assert.equal(state.locations.find(location => location.id === here.id).clues, 2, '线索发现应被替换而非正常发现')
  assert.equal(state.investigators[0].clues || 0, 0)
  const web = state.investigators[0].threat.find(card => card.code === '60253')
  assert.equal(web?.counters || 0, 1, '不灭之网应累计 1 点恐惧计数')
})

// 15) 批次 3 原语 C4：事件「如同在连接地点打出」（60552）。
test('批次 3 原语 C4：playEventAsIfAtLocation 切换事件结算地点', () => {
  const state = fixture('01001')
  const inv = state.investigators[0]
  inv.assets = []
  inv.hand = []
  inv.resources = 20
  inv.actionsLeft = 5
  const study = state.locations.find(location => location.id === inv.location)
  state.locations.push({ id: 'test-hall', name: '测试走廊', connections: [study.id], revealed: true, clues: 0, shroud: 1 })
  study.connections.push('test-hall')
  asset(state, '60552')
  inv.hand.push('01038')
  move(state, { action: 'play', cardId: '01038' })
  settle(state, choice => {
    const backpack = choice.options.find(option => option.cardCode === '60552' || String(option.label).includes('背包'))
    if (backpack) return backpack.id
    const connected = choice.options.find(option => option.id === 'loc:test-hall')
    if (connected) return connected.id
    return null
  })
  const hall = state.locations.find(location => location.id === 'test-hall')
  assert.equal((hall.barricades || []).length, 1, '护栏应附属到连接地点')
  assert.equal((state.locations.find(location => location.id === study.id).barricades || []).length, 0, '原地点不应有护栏')
  assert.equal(state.investigators[0].location, study.id, '结算后调查员位置应恢复')
})

// 16) 批次 3 原语 C4：目标感知可变费用（60365）。
test('批次 3 原语 C4：60365 可变费用按选定 X 支付并结算效果', () => {
  const state = fixture('01001')
  const inv = state.investigators[0]
  inv.assets = []
  inv.hand = []
  inv.resources = 10
  inv.actionsLeft = 5
  const enemyCard = enemy(state, { health: 2, damageTaken: 0, horror: 0, engagedSeat: 0 })
  const here = state.locations.find(location => location.id === inv.location)
  here.clues = 1
  inv.hand.push('60365')
  move(state, { action: 'play', cardId: '60365' })
  settle(state, choice => {
    if (choice.kind === 'resource' && choice.options.some(option => option.id === '2')) return '2'
    const target = choice.options.find(option => option.id === enemyCard.id)
    if (target) return target.id
    return null
  })
  assert.equal(state.investigators[0].resources, 8, '应支付 X=2 资源')
  assert.equal(state.enemies.find(item => item.id === enemyCard.id)?.engagedSeat ?? null, null, '敌人应解除交战')
  assert.equal(state.enemies.find(item => item.id === enemyCard.id)?.aloof, true, '敌人应获得冷漠')
  assert.equal(state.investigators[0].clues || 0, 1, '应发现 1 个线索')
})

// 17) 批次 3 原语 C4：攻击重定向 API（60472/60473 的重定向入口）。
test('批次 3 原语 C4：redirectEnemyAttack 在 enemyAttack 窗口设置重定向目标', () => {
  const state = fixture('01001', 2)
  const inv = state.investigators[0]
  inv.assets = []
  let redirected = null
  let accepted = null
  register({
    code: '01545', kind: 'asset',
    abilities: [{ kind: 'action', label: '重定向攻击', resolve: ({ api }) => {
      const context = { when: 'enemyAttack', seat: 0, redirectToSeat: null }
      accepted = api.redirectEnemyAttack(context, 1)
      redirected = context.redirectToSeat
    } }],
    modifiers: [],
  })
  asset(state, '01545')
  inv.actionsLeft = 5
  const probe = inv.assets.find(card => card.code === '01545')
  use(state, probe, { abilityIndex: 0 })
  settle(state)
  assert.equal(accepted, true, '重定向 API 应接受合法目标')
  assert.equal(redirected, 1, '窗口 context 应记录重定向座位')
})
