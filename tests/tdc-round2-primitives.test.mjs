// TDC P7 第二轮：Lead 落地的引擎原语单测（内容侧接线在各章测试里）。
// 每个原语一条用例，覆盖「读点生效 / 存档往返 / 过期或离场恢复」三类断言。
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  enemyKeywordOverride, setEnemyKeywords, validateEnemyKeywords,
} from '../src/engine/enemy-keyword-movement.js'
import { canDamageEnemy, damageEnemy, getStat, legalMoves as engineLegalMoves, resolveHunterMoves, scenarioRuntime, applyMove } from '../src/engine/engine.js'
import { CHAOS_NUMERIC_TOKENS, lowerChaosToken, replaceChaosTokens } from '../src/engine/chaos-bag.js'
import { enemyIsImmobile, normalizePatrolTarget, resolvePatrol } from '../src/engine/enemy-keyword-movement.js'
import { relocateEnemy } from '../src/engine/engine.js'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'
import * as cardsData from '../src/cards/cards-data.js'
import { assetTextBlanked } from '../src/engine/card-text.js'
import { storyAssetEnemyOverride, ignoredEnemyAttackOffer, markIgnoredEnemyAttack } from '../src/engine/story-asset-rules.js'
import { enemyCanEnterLocation } from '../src/engine/enemy-entry.js'
import { effectiveFloodLevel, setFloodLevel } from '../src/engine/flood.js'
import { enemy, fixture, legalMoves, move, settle, validateMove, answer } from './core-fixture.mjs'

const addLocations = (state, pairs) => {
  for (const [id, connections] of pairs) {
    state.locations.push({ id, code: id, name: id, revealed: true, clues: 0, shroud: 1, connections })
  }
}

test('P7 原语：hunter 可被内容层授予/取消，过期后恢复印刷值（11724）', () => {
  const state = fixture('01001', 2)
  addLocations(state, [['tdcA', ['tdcB']], ['tdcB', ['tdcA']]])
  state.investigators[0].location = 'tdcB'
  state.investigators[1].location = 'study'
  const beast = enemy(state, { code: 'ghoulMinion', location: 'tdcA', engagedSeat: null, exhausted: false })
  beast.hunter = false

  // 印刷值没有猎手：不会自己移动。
  const before = beast.location
  resolveHunterMoves(state)
  assert.equal(beast.location, before)

  // 内容层授予猎手（throughRound = 当前轮）。
  assert.equal(setEnemyKeywords(state, beast, ['hunter'], { enabled: true, throughRound: state.round }), true)
  assert.equal(enemyKeywordOverride(state, beast, 'hunter'), true)
  resolveHunterMoves(state)
  assert.equal(beast.location, 'tdcB', '获得猎手后应向最近调查员移动')

  // 存档往返：关键词覆盖是实例字段，校验器接受。
  const restored = JSON.parse(JSON.stringify(state))
  validateEnemyKeywords(restored)

  // 过期：轮次推进后覆盖失效，恢复印刷值（没有猎手）。
  beast.location = 'tdcA'
  beast.engagedSeat = null
  state.round += 1
  assert.equal(enemyKeywordOverride(state, beast, 'hunter'), null)
  resolveHunterMoves(state)
  assert.equal(beast.location, 'tdcA', '覆盖过期后不再按猎手移动')
})

test('P7 原语：威胁区按特性禁止触发卡牌能力，forced 不受影响（11752）', () => {
  registerCardAbilities([
    { code: 'tdcFixtureThreat', scope: 'treachery', threatEffect: { cannotTriggerAbilityTraits: ['Glyph', 'Artifact'] }, abilities: [] },
    { code: 'tdcFixtureArtifact', scope: 'card', abilities: [{ kind: 'action', label: '测试神器行动', resolve: () => {} }] },
    { code: 'tdcFixturePlain', scope: 'card', abilities: [{ kind: 'action', label: '测试普通行动', resolve: () => {} }] },
  ])
  const state = fixture('01001', 1)
  const inv = state.investigators[0]
  inv.hand = []; inv.assets = []
  const artifact = { id: 'assetArtifact', code: 'tdcFixtureArtifact', exhausted: false, traits: ['Artifact'] }
  const plain = { id: 'assetPlain', code: 'tdcFixturePlain', exhausted: false, traits: ['Item'] }
  inv.assets.push(artifact, plain)
  const abilitiesFor = () => {
    state.legalMoves = legalMoves(state, 0)
    return new Set(state.legalMoves.filter(move => move.action === 'ability').map(move => move.assetId))
  }
  assert(abilitiesFor().has(artifact.id), '未受威胁区影响时神器行动可用')
  assert(abilitiesFor().has(plain.id), '普通卡行动可用')

  inv.threat.push({ code: 'tdcFixtureThreat' })
  const blocked = abilitiesFor()
  assert.equal(blocked.has(artifact.id), false, '带 Artifact 特性的卡行动被禁止')
  assert(blocked.has(plain.id), true, '无该特性的卡不受影响')

  inv.threat.length = 0
  assert(abilitiesFor().has(artifact.id), '移出威胁区后恢复')
})

test('P7 原语：地点附属的 modifiers 对同地点调查员生效（11731）', () => {
  registerCardAbilities([{
    code: 'tdcFixtureMist', scope: 'treachery',
    modifiers: [{ target: 'skill:willpower', amount: -1, audience: 'here' }],
  }])
  const state = fixture('01001', 2)
  addLocations(state, [['mistLoc', ['study']], ['otherLoc', []]])
  state.investigators[0].location = 'mistLoc'
  state.investigators[1].location = 'otherLoc'
  const location = state.locations.find(item => item.id === 'mistLoc')
  const baseline = getStat(state, state.investigators[0], 'willpower')
  location.attachments = [{ code: 'tdcFixtureMist' }]
  assert.equal(getStat(state, state.investigators[0], 'willpower'), baseline - 1, '同地点调查员 -1')
  assert.equal(getStat(state, state.investigators[1], 'willpower'),
    getStat(state, state.investigators[1], 'willpower'), '异地点调查员不受影响')
  assert.equal(getStat(state, state.investigators[1], 'willpower'),
    getStat(state, state.investigators[1], 'willpower'))
  location.attachments = []
  assert.equal(getStat(state, state.investigators[0], 'willpower'), baseline, '移除附属后恢复')
})

test('P7 原语：混乱袋降档（replaceChaosTokens/lowerChaosToken）', () => {
  assert.equal(lowerChaosToken('+1', 2), '-1')
  assert.equal(lowerChaosToken('0', 2), '-2')
  assert.equal(lowerChaosToken('-6', 2), '-8')
  assert.equal(lowerChaosToken('-7', 2), null, '-7 已是最低档，保留')
  assert.equal(lowerChaosToken('skull', 2), null, '符号标记不变')
  const state = { chaosBag: ['-1', 'skull', '-2'], campaign: { chaosBag: ['-1', 'skull', '-2'] } }
  const replaced = replaceChaosTokens(state, 2, token => lowerChaosToken(token, 2), { tokens: ['-1', '-2'] })
  assert.equal(replaced, 2)
  assert.deepEqual([...state.chaosBag].sort(), ['-3', '-4', 'skull'])
  assert.deepEqual([...state.campaign.chaosBag].sort(), ['-3', '-4', 'skull'], 'permanent 同步战役袋')
  assert.equal(CHAOS_NUMERIC_TOKENS.length, 10)
})

test('P7 原语：敌人不可伤害/不可横置按当前面条目动态生效（11702–11704）', () => {
  registerCardAbilities([
    { code: 'tdcFixtureStone', scope: 'enemy', enemyRule: { cannotBeDamaged: true, cannotBeExhausted: true } },
  ])
  const state = fixture('01001', 1)
  const stone = enemy(state, { code: 'tdcFixtureStone', engagedSeat: null, exhausted: false })
  state.legalMoves = legalMoves(state, 0)
  assert.equal(canDamageEnemy(state, stone), false, '不可伤害面拒绝伤害')
  assert.equal(scenarioRuntime(state, []).exhaustEnemy(stone), false, '不可横置面拒绝横置')
  assert.equal(stone.exhausted, false)
  // 换面到没有限制的面（普通敌人）后恢复可伤害/可横置。
  stone.code = 'ghoulMinion'
  stone.originalCode = 'ghoulMinion'
  assert.equal(canDamageEnemy(state, stone), true, '换面后解除伤害限制')
  assert.equal(scenarioRuntime(state, []).exhaustEnemy(stone), true, '换面后解除横置限制')
})

test('P7 原语：屋顶地点可攻击连接地点的敌人（11699/11700）', () => {
  registerCardAbilities([
    { code: 'tdcFixtureRoof', scope: 'location', locationRule: { reachConnectingEnemies: true } },
    { code: 'tdcFixtureHall', scope: 'location', locationRule: {} },
  ])
  const state = fixture('01001', 1)
  addLocations(state, [['roof', ['hall']], ['hall', ['roof']]])
  state.locations.find(item => item.id === 'roof').code = 'tdcFixtureRoof'
  state.investigators[0].location = 'roof'
  const upstairs = enemy(state, { code: '01169', location: 'hall', engagedSeat: null, exhausted: true })
  const fightIds = () => {
    state.legalMoves = engineLegalMoves(state, 0)
    return state.legalMoves.filter(move => move.action === 'fight').map(move => move.enemyId)
  }
  assert(fightIds().includes(upstairs.id), '屋顶可攻击连接地点的敌人')
  state.locations.find(item => item.id === 'roof').code = 'tdcFixtureHall'
  assert.equal(fightIds().includes(upstairs.id), false, '普通地点不能攻击连接地点的敌人')
})

test('P7 原语：受控剧情资产可声明 action/free 能力并进入行动窗口（11550/11581/11582/11611/11612 系列）', () => {
  let resolved = 0
  registerCardAbilities([{
    code: 'tdcFixtureControlledRelic', scope: 'storyAsset', controlledAsset: true,
    abilities: [{ kind: 'action', label: '测试翻面', cost: { exhaust: true }, resolve: () => { resolved += 1 } }],
  }])
  const state = fixture('01001', 1)
  const relic = { id: 'relicControlled', code: 'tdcFixtureControlledRelic', exhausted: false }
  state.investigators[0].assets.push(relic)
  state.legalMoves = engineLegalMoves(state, 0)
  const abilityMove = state.legalMoves.find(move => move.action === 'ability' && move.assetId === relic.id)
  assert(abilityMove, '受控剧情资产的行动能力出现在合法动作里')
  move(state, { action: 'ability', assetId: relic.id, abilityIndex: abilityMove.abilityIndex })
  assert.equal(resolved, 1, '能力真实结算')
  // 未声明 controlledAsset 的 storyAsset 仍不允许 action（防止声明出永不结算的条目）。
  assert.throws(() => registerCardAbilities([{
    code: 'tdcFixtureUncontrolledRelic', scope: 'storyAsset',
    abilities: [{ kind: 'action', label: '非法行动', resolve: () => {} }],
  }]), /不能声明 action/)
})

test('P7 原语：攻击期间支付线索 +1 伤害（11690/11691a 幕牌）', () => {
  registerCardAbilities([{ code: 'tdcFixtureActClueBonus', scope: 'act', attackRule: { clueDamageBonus: { cost: 1, amount: 1 } } }])
  const state = fixture('01001', 1)
  const inv = state.investigators[0]
  inv.clues = 2
  state.acts = [{ id: 'actClue', code: 'tdcFixtureActClueBonus' }]
  state.actIndex = 0
  const ghoul = enemy(state, { code: '01169', location: inv.location, engagedSeat: 0, exhausted: false, health: 30, fight: 1 })
  state.legalMoves = engineLegalMoves(state, 0)
  const fightMoves = state.legalMoves.filter(move => move.action === 'fight')
  assert(fightMoves.some(move => move.clueDamageBonus === true), '有线索时出现支付线索加伤的合法攻击')
  move(state, fightMoves.find(move => move.clueDamageBonus === true))
  settle(state)
  // 事务会把 state 的实例数组换成结算后的副本，断言要重新取。
  const afterInv = state.investigators[0]
  const afterGhoul = state.enemies.find(item => item.id === ghoul.id)
  assert.equal(afterInv.clues, 1, '攻击支付了 1 个线索')
  assert.equal(afterGhoul.damageTaken, 2, '本次攻击伤害 +1（基础 1 + 线索 1）')
  // 无线索时该变体不再出现；直接提交也非法。
  afterInv.clues = 0
  state.legalMoves = engineLegalMoves(state, 0)
  assert.equal(state.legalMoves.some(move => move.action === 'fight' && move.clueDamageBonus), false)
  assert.match(validateMove(state, 0, { action: 'fight', enemyId: ghoul.id, clueDamageBonus: true }) ?? '', /线索不足/)
})

test('P7 原语：从酸性体腔移动到养育场入口的额外费用（11571）', () => {
  registerCardAbilities([{
    code: 'tdcFixtureAcidChamber', scope: 'location',
    locationRule: { movementExtraCost: { toOriginalCodes: ['tdcFixtureEntrance'], cost: { kind: 'damage', amount: 1 } } },
  }, { code: 'tdcFixtureEntrance', scope: 'location', locationRule: {} }])
  const state = fixture('01001', 1)
  addLocations(state, [['acid', ['entrance']], ['entrance', ['acid']], ['elsewhere', ['acid']]])
  state.locations.find(location => location.id === 'acid').code = 'tdcFixtureAcidChamber'
  state.locations.find(location => location.id === 'entrance').code = 'tdcFixtureEntrance'
  state.locations.find(location => location.id === 'elsewhere').code = 'study'
  state.investigators[0].location = 'acid'
  move(state, { action: 'move', locationId: 'entrance' })
  assert.equal(state.investigators[0].location, 'entrance')
  assert.equal(state.investigators[0].damage, 1, '移动到养育场入口必须受到 1 点伤害')
  // 从别处进入入口不收费。
  state.investigators[0].location = 'elsewhere'
  state.investigators[0].damage = 0
  move(state, { action: 'move', locationId: 'acid' })
  assert.equal(state.investigators[0].damage, 0, '非酸性体腔出发不收费')
})

test('P7 原语：附属于地点的诡计在离开时强制检定并弃置（11576）', () => {
  const failures = []
  registerCardAbilities([{
    code: 'tdcFixtureHungryWalls', scope: 'treachery',
    treacheryRule: {
      onLeave: {
        test: { skills: ['agility', 'combat'], difficulty: 4 },
        cancelOnFail: false,
        discardOnResolve: true,
        onFail: (state, location, api, inv, context) => { failures.push({ seat: inv.seat, skill: context.skill }) },
      },
    },
  }])
  const state = fixture('01001', 1)
  addLocations(state, [['host', ['exit']], ['exit', ['host']]])
  state.investigators[0].location = 'host'
  state.locations.find(location => location.id === 'host').attachments = [{ id: 'hungry', code: 'tdcFixtureHungryWalls' }]
  state.chaosBag = ['0']
  applyMove(state, 0, { action: 'move', locationId: 'exit' })
  answer(state, 'agility')
  settle(state)
  assert.equal(state.investigators[0].location, 'exit', '失败不取消移动（cancelOnFail:false）')
  assert.deepEqual(failures, [{ seat: 0, skill: 'agility' }], '失败按所选技能结算')
  assert.equal(state.locations.find(location => location.id === 'host').attachments.length, 0, '结算后弃置附属')
  assert(state.encounterDiscard.includes('tdcFixtureHungryWalls'), '附属进入遭遇弃牌堆')
})

test('P7 原语：进入古代祭坛的共同线索费用（11623）', () => {
  registerCardAbilities([{ code: 'tdcFixtureAncientAltar', scope: 'location', locationRule: { entryCost: { kind: 'groupClues', perInvestigator: 1 } } }])
  const state = fixture('01001', 2)
  addLocations(state, [['antechamber', ['altar']], ['altar', ['antechamber']]])
  state.locations.find(location => location.id === 'altar').code = 'tdcFixtureAncientAltar'
  state.investigators[0].location = 'antechamber'
  state.investigators[1].location = 'antechamber'
  state.investigators[0].clues = 0
  state.investigators[1].clues = 0
  assert.match(validateMove(state, 0, { action: 'move', locationId: 'altar' }) ?? '', /共同支付/)
  state.investigators[0].clues = 1
  state.investigators[1].clues = 1
  move(state, { action: 'move', locationId: 'altar' })
  settle(state)
  assert.equal(state.investigators[0].location, 'altar')
  assert.equal((state.investigators[0].clues || 0) + (state.investigators[1].clues || 0), 0, '共同支付 2 个线索（每人 1）')
})

test('P7 原语：受控剧情资产改写星之眷族关键词/猎物，并可空白文本直到本轮结束（11688）', () => {
  registerCardAbilities([{
    code: 'tdcFixtureClayTerror', scope: 'storyAsset', controlledAsset: true,
    storyAssetRule: { enemyOverride: { trait: 'Star Spawn', lose: ['patrol', 'prey'], gain: ['hunter'], prey: 'controller' } },
    abilities: [{ kind: 'free', label: '空白文本', resolve: () => {} }],
  }])
  const state = fixture('01001', 1)
  addLocations(state, [['lair', ['hall']], ['hall', ['lair']]])
  state.investigators[0].location = 'hall'
  const clay = { id: 'clay', code: 'tdcFixtureClayTerror', exhausted: false }
  state.investigators[0].assets.push(clay)
  const spawn = enemy(state, { code: '11725', location: 'lair', engagedSeat: null, exhausted: false })
  spawn.hunter = false
  // 猎物覆盖：控制者座位由受控剧情资产提供。
  const override = storyAssetEnemyOverride(state, spawn)
  assert.equal(override?.rule.prey, 'controller')
  assert.equal(override?.controllerSeat, 0)
  // 获得猎手：星之眷族在敌人阶段会向 11688 控制者移动。
  resolveHunterMoves(state)
  assert.equal(spawn.location, 'hall', '获得猎手后向控制者移动')
  // 文本空白直到本轮结束。
  scenarioRuntime(state, []).blankStoryAssetText(clay, { untilRoundEnd: true })
  assert.equal(assetTextBlanked(clay, state.investigators[0]), true, '空白文本按读点生效')
  assert.equal(clay.textBlankRound, state.round)
  state.legalMoves = engineLegalMoves(state, 0)
  assert.equal(state.legalMoves.some(move => move.action === 'ability' && move.assetId === clay.id), false,
    '空白化后该支援的能力不再出现在合法动作里')
})

test('P7 原语：敌人「不能移动」声明与遭遇牌库顶弃牌反应窗口', () => {
  registerCardAbilities([{
    code: 'tdcFixtureImmovableBrute', scope: 'enemy', enemyRule: { immobile: true },
  }, {
    code: 'tdcFixtureDiscardListener', scope: 'treachery',
    abilities: [{ kind: 'forced', trigger: 'encounterCardsDiscardedFromTop', label: '弃顶响应', resolve: () => { discardedHits += 1 } }],
  }])
  let discardedHits = 0
  const state = fixture('01001', 1)
  addLocations(state, [['square', ['alley']], ['alley', ['square']]])
  // 条目 enemyRule.immobile 让任何移动来源都被拦下（11635）。
  const brute = enemy(state, { code: 'tdcFixtureImmovableBrute', location: 'square', engagedSeat: null })
  assert.equal(enemyIsImmobile(state, brute), true)
  relocateEnemy(state, brute, 'alley', [])
  assert.equal(brute.location, 'square', '不能移动的敌人不会被挪动')
  // 遭遇牌库顶弃牌后打开反应/强制窗口（11624/11625/11627）。
  state.investigators[0].threat.push({ id: 'discard-listener', code: 'tdcFixtureDiscardListener' })
  state.encounterDeck = ['01170', '01171', '01172']
  state.encounterDiscard = []
  scenarioRuntime(state, []).discardEncounterTop(2)
  assert.equal(discardedHits, 1, '弃牌窗口派发一次')
  assert.equal(state.encounterDiscard.length, 2)
})

test('P7 原语：异教徒敌人伤害改道到受控剧情资产（11568）', () => {
  registerCardAbilities([{
    code: 'tdcFixtureMaria', scope: 'storyAsset', controlledAsset: true,
    storyAssetRule: { redirectEnemyDamage: { traits: ['Cultist'] } },
  }])
  const state = fixture('01001', 1)
  addLocations(state, [['shore', ['deep']], ['deep', ['shore']]])
  state.investigators[0].location = 'shore'
  const maria = { id: 'maria', code: 'tdcFixtureMaria', exhausted: false, damage: 0 }
  state.investigators[0].assets.push(maria)
  const cultist = enemy(state, { code: '11723', location: 'shore', engagedSeat: 0, health: 30 })
  damageEnemy(state, cultist, 2, 0, [])
  assert.equal(cultist.damageTaken || 0, 0, '异教徒敌人不受伤')
  assert.equal(maria.damage, 2, '伤害改放到玛莉亚身上')
  // 控制器不在同一地点时不改道。
  state.investigators[0].location = 'deep'
  damageEnemy(state, cultist, 1, 0, [])
  assert.equal(cultist.damageTaken, 1, '非同地点不改道')
})

test('P7 原语：地点不能被移动/离场，巡逻最近空特性地点（11648–11652/11670）', () => {
  registerCardAbilities([{
    code: 'tdcFixtureUnmovableStreet', scope: 'location', locationRule: { cannotLeavePlay: true, cannotBeMoved: true },
  }, {
    code: 'tdcFixtureSummitHunter', scope: 'enemy', enemyRule: { patrolTarget: { kind: 'nearestEmptyTrait', trait: 'Summit' } },
  }])
  const state = fixture('01001', 1)
  addLocations(state, [['rlyehStreets', ['summitA']], ['summitA', ['rlyehStreets', 'summitB']], ['summitB', ['summitA']]])
  state.locations.find(location => location.id === 'rlyehStreets').code = 'tdcFixtureUnmovableStreet'
  const runtime = scenarioRuntime(state, [])
  assert.equal(runtime.removeLocationFromGame('rlyehStreets'), null, '不能离场的地点拒绝移出')
  assert(state.locations.some(location => location.id === 'rlyehStreets'), '地点仍在场')
  assert.equal(runtime.swapLocation('rlyehStreets', 'summitB'), null, '不能移动的地点拒绝交换')
  // 巡逻目标：最近的、无调查员/敌人、带 Summit 特性的地点。
  const patrolSpec = normalizePatrolTarget({ kind: 'nearestEmptyTrait', trait: 'Summit' })
  assert.equal(patrolSpec.kind, 'nearestEmptyTrait')
  const hunter = enemy(state, { code: 'tdcFixtureSummitHunter', location: 'rlyehStreets', engagedSeat: null })
  state.locations.find(location => location.id === 'summitA').traits = ['Summit']
  state.locations.find(location => location.id === 'summitB').traits = ['Summit']
  state.investigators[0].location = 'summitB'
  let movedTo = null
  const result = resolvePatrol(state, hunter, { kind: 'nearestEmptyTrait', trait: 'Summit' },
    { blanked: () => false, choice: spec => spec?.options?.[0]?.id, move: (item, to) => { movedTo = to; return true } })
  assert.equal(result, true, '巡逻到最近的无调查员 Summit 地点')
  assert.equal(movedTo, 'summitA', '跳过有调查员的 Summit 地点')
})

test('P7 原语：弱点敌人不能进入开阔天空、遭遇附属不能离场、额外巡逻与放一边接管（11641/11531/11706/11549）', () => {
  registerCardAbilities([{
    code: 'tdcFixtureOpenSky', scope: 'location',
    locationRule: { weaknessEnemiesCannotEnter: true },
  }, {
    code: 'tdcFixtureFrieze', scope: 'treachery', cannotLeavePlay: true,
  }, {
    code: 'tdcFixturePatroller', scope: 'enemy',
    enemyRule: { patrolTarget: { kind: 'named', locationId: 'skyA' } },
  }])
  const state = fixture('01001', 1)
  addLocations(state, [['ground', ['skyA']], ['skyA', ['ground']]])
  state.locations.find(location => location.id === 'skyA').code = 'tdcFixtureOpenSky'
  const weakness = enemy(state, { code: '10011', location: 'ground', engagedSeat: null })
  const ordinary = enemy(state, { code: '01169', location: 'ground', engagedSeat: null })
  assert.equal(enemyCanEnterLocation(state, weakness, 'skyA'), false, '弱点敌人不能进开阔天空')
  assert.equal(enemyCanEnterLocation(state, ordinary, 'skyA'), true, '普通敌人可进入')
  // 11531：附属「不能离场」——detach/discard 均被拒绝且仍在宿主上。
  const runtime = scenarioRuntime(state, [])
  const frieze = runtime.attachToLocation('ground', { code: 'tdcFixtureFrieze' })
  assert(frieze, '附属建立')
  const host = state.locations.find(location => location.id === 'ground')
  assert.equal(runtime.detachEncounterAttachment(frieze), false, '不能离场的附属拒绝摘除')
  assert(host.attachments.includes(frieze), '附属仍在宿主上')
  // 11706：额外执行一次巡逻（与敌人阶段同一实现），成功后记录 lastPatrolRound。
  const patroller = enemy(state, { code: 'tdcFixturePatroller', location: 'ground', engagedSeat: null })
  assert.equal(runtime.runEnemyPatrol(patroller), true, '额外巡逻执行成功')
  assert.equal(patroller.location, 'skyA')
  assert.equal(patroller.lastPatrolRound, state.round, '记录本轮已巡逻')
})

test('P7 原语：磁性尖塔禁用枪械能力、遭遇附属离场去向（11661/11662-64）', () => {
  const { ALL_CARDS } = cardsData
  const firearmCode = Object.values(ALL_CARDS).find(card => card.type === 'asset'
    && (card.traits || []).includes('Firearm') && !registeredEntry(card.code))?.code
  assert(firearmCode, '找到一张未注册的[[枪械]]支援卡')
  registerCardAbilities([{
    code: 'tdcFixtureMagneticSpires', scope: 'location',
    locationRule: { cannotTriggerAbilityTraits: ['Firearm'] },
  }, {
    code: 'tdcFixtureFriezeToSetAside', scope: 'treachery', leavesPlayTo: 'setAside',
  }, {
    code: firearmCode, scope: 'card', abilities: [{ kind: 'action', label: '开枪', resolve: () => {} }],
  }])
  const state = fixture('01001', 1)
  addLocations(state, [['magnetic', ['plain']], ['plain', ['magnetic']]])
  state.locations.find(location => location.id === 'magnetic').code = 'tdcFixtureMagneticSpires'
  state.investigators[0].assets.push({ id: 'gun', code: firearmCode, exhausted: false })
  state.investigators[0].location = 'magnetic'
  state.legalMoves = engineLegalMoves(state, 0)
  const atSpires = state.legalMoves.filter(move => move.action === 'ability' && move.assetId === 'gun')
  assert.equal(atSpires.length, 0, '磁性尖塔禁止触发枪械能力')
  state.investigators[0].location = 'plain'
  state.legalMoves = engineLegalMoves(state, 0)
  assert(state.legalMoves.some(move => move.action === 'ability' && move.assetId === 'gun'), '离开后恢复可用')
  // 11662/63/64：附属「将离场」路由到放一边。
  const runtime = scenarioRuntime(state, [])
  const attachment = runtime.attachToLocation('plain', { code: 'tdcFixtureFriezeToSetAside' })
  runtime.detachEncounterAttachment(attachment)
  assert(state.scenarioZones?.setAside?.includes('tdcFixtureFriezeToSetAside'), '附属离场进入放一边区')
})

test('P7 原语：完全淹没视为部分淹没（11764）', () => {
  registerCardAbilities([{
    code: 'tdcFixtureDivingSuit', scope: 'card',
    assetRule: { effectiveFloodLevelCap: 1 },
  }])
  const state = fixture('01001', 1)
  addLocations(state, [['deep', []]])
  state.investigators[0].location = 'deep'
  setFloodLevel(state, 'deep', 2)
  assert.equal(effectiveFloodLevel(state, 0), 2, '无潜水服时完全淹没')
  state.investigators[0].assets.push({ id: 'suit', code: 'tdcFixtureDivingSuit', exhausted: false })
  assert.equal(effectiveFloodLevel(state, 0), 1, '控制潜水服后视为部分淹没')
})

test('P7 原语：进入地点的声明式费用（11662 entryToll）', () => {
  registerCardAbilities([{
    code: 'tdcFixtureGlyphOrrery', scope: 'location',
    locationRule: { entryToll: { unlessControls: 'tdcFixtureClaw', cost: { clues: 1 }, test: { skill: 'agility', difficulty: 2 }, cancelOnFail: true } },
  }])
  const state = fixture('01001', 1)
  addLocations(state, [['street', ['orrery']], ['orrery', ['street']]])
  state.locations.find(location => location.id === 'orrery').code = 'tdcFixtureGlyphOrrery'
  state.investigators[0].location = 'street'
  state.investigators[0].clues = 1
  // 花 1 线索进入。
  move(state, { action: 'move', locationId: 'orrery' })
  answer(state, 'pay')
  settle(state)
  assert.equal(state.investigators[0].location, 'orrery', '支付费用后进入')
  assert.equal(state.investigators[0].clues, 0, '支付了 1 线索')
  // 不控制尖爪且买不起：只剩检定；失败取消移动。
  state.investigators[0].location = 'street'
  state.chaosBag = ['autofail']
  move(state, { action: 'move', locationId: 'orrery' })
  settle(state)
  assert.equal(state.investigators[0].location, 'street', '检定失败取消移动')
  // 控制黑曜石之爪时免收：直接进入。
  state.investigators[0].assets.push({ id: 'claw', code: 'tdcFixtureClaw', exhausted: false })
  move(state, { action: 'move', locationId: 'orrery' })
  settle(state)
  assert.equal(state.investigators[0].location, 'orrery', '控制指定卡后免收进入费用')
})

test('P7 原语：搜索遭遇牌并生成交战（11658）', () => {
  const state = fixture('01001', 1)
  addLocations(state, [['cave', ['tunnel']], ['tunnel', ['cave']]])
  state.investigators[0].location = 'cave'
  state.encounterDeck = ['01170', '01169']
  state.encounterDiscard = []
  const found = scenarioRuntime(state, []).searchEncounterCard({
    traits: ['Humanoid'], type: 'enemy', spawn: 'engaged', seat: 0,
  })
  assert.equal(found, '01169', '从遭遇牌库顶向下找到匹配特性的敌人')
  assert.equal(state.encounterDeck.includes('01169'), false, '找到的牌离开遭遇牌库')
  const spawned = state.enemies.find(item => String(item.originalCode || item.code) === '01169')
  assert(spawned, '敌人已生成')
  assert.equal(spawned.engagedSeat, 0, '生成并与调查员交战')
  assert.equal(state.encounterDiscard.includes('01170'), false)
})

test('P7 原语：受控剧情资产每轮可忽略首次敌人攻击，且敌人不能进入未淹没地点（11638/11605）', () => {
  registerCardAbilities([{
    code: 'tdcFixtureIchtacaShard', scope: 'storyAsset', controlledAsset: true,
    storyAssetRule: { ignoreFirstAttack: { traits: ['Star Spawn'] } },
  }, {
    code: 'tdcFixtureDeepOne', scope: 'enemy', enemyRule: { enterOnlyFlooded: true },
  }])
  const state = fixture('01001', 1)
  addLocations(state, [['shore', ['deep']], ['deep', ['shore']]])
  state.investigators[0].location = 'shore'
  const shard = { id: 'shard', code: 'tdcFixtureIchtacaShard', exhausted: false }
  state.investigators[0].assets.push(shard)
  const spawn = enemy(state, { code: '11725', location: 'shore', engagedSeat: 0 })
  const offer = ignoredEnemyAttackOffer(state, spawn, state.investigators[0])
  assert.equal(offer?.asset, shard, '星之眷族的首次攻击给出可忽略声明')
  markIgnoredEnemyAttack(offer, state)
  assert.equal(ignoredEnemyAttackOffer(state, spawn, state.investigators[0]), null, '每轮只提供一次')
  state.round += 1
  assert(ignoredEnemyAttackOffer(state, spawn, state.investigators[0]), '新回合恢复')
  // 11605：不能进入/生成在未淹没地点，淹没后允许。
  const deepOne = enemy(state, { code: 'tdcFixtureDeepOne', location: 'deep', engagedSeat: null })
  assert.equal(enemyCanEnterLocation(state, deepOne, 'shore'), false, '未淹没地点不可进入')
  setFloodLevel(state, 'shore', 1)
  assert.equal(enemyCanEnterLocation(state, deepOne, 'shore'), true, '淹没后可进入')
})
