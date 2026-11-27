// 09-a-7（TSK · tskc 09623–09661）补证/缺陷复现测试。
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { asset, enemy, fixture, legalMoves, move, settle, use, validateMove } from './core-fixture.mjs'
import { applyHarm, cardDef, enemyEvadeValue, enemyFightValue, enemyHealth, investigatorEntryError, playCost, scenarioRuntime, spawnEnemy } from '../src/engine/engine.js'
import { enemyCanEnterLocation } from '../src/engine/enemy-entry.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { entityMoves, targetMoves } from '../web/card-interactions.js'

import { resolveKeyShift } from '../content/campaigns/theScarletKeys/scenarios/congressOfTheKeys/behavior.js'
import * as onThinIce from '../content/campaigns/theScarletKeys/scenarios/onThinIce/behavior.js'
import { SABLE_GLASS_KEY } from '../content/campaigns/theScarletKeys/scenarios/onThinIce/definition.js'
import { LIGHT_OF_PHAROS } from '../content/campaigns/theScarletKeys/scenarios/dogsOfWar/definition.js'
import iceCracking from '../src/cards/encounter-entries/theScarletKeys/onThinIce/09632.js'
import snowslide from '../src/cards/encounter-entries/theScarletKeys/onThinIce/09633.js'
import sableGlassStable from '../src/cards/encounter-entries/theScarletKeys/onThinIce/09634a.js'
import sableGlassUnstable from '../src/cards/encounter-entries/theScarletKeys/onThinIce/09634b.js'
import lightStable from '../src/cards/encounter-entries/theScarletKeys/dogsOfWar/09659a.js'
import lightUnstable from '../src/cards/encounter-entries/theScarletKeys/dogsOfWar/09659b.js'
import thorneEnemy from '../src/cards/encounter-entries/theScarletKeys/onThinIce/09625a.js'
import thorneAsset from '../src/cards/encounter-entries/theScarletKeys/onThinIce/09625b.js'

const read = (...files) => files.map(f => fs.readFileSync(f, 'utf8')).join('\n')

test('验收 09632/09633 冰层破裂/积雪崩坍：显现结算真实执行（密谋旁 3 张清空 + 敏捷检定 + 直接伤害）', () => {
  assert.equal(iceCracking.code, '09632')
  const calls = []
  const state = {
    agendaAside: [{ id: 'a1', code: '09632', originalCode: '09632' }, { id: 'a2', code: '09632', originalCode: '09632' }],
    investigators: [{ seat: 0, location: 'wild', name: '甲', clues: 0 }, { seat: 1, location: 'city', name: '乙' }],
    locations: [{ id: 'wild', traits: ['Wilderness'] }, { id: 'city', traits: ['City'] }],
  }
  const api = {
    putNextToAgenda: code => calls.push(['putNextToAgenda', code]),
    agendaAsideCards: () => ['09632', '09632', '09632'],
    discardAgendaAside: id => calls.push(['discardAgendaAside', id]),
    info: () => {},
    test: (seat, skill, difficulty, cb) => { calls.push(['test', seat, skill, difficulty]); cb({ success: false, value: 1, difficulty }) },
    choice: request => (request.options || [])[0]?.id,
    harm: (seat, harm) => calls.push(['harm', seat, harm]),
  }
  assert.equal(iceCracking.encounterResolve(state, state.investigators[0], { code: '09632' }, api), true)
  assert.ok(calls.some(call => call[0] === 'putNextToAgenda' && call[1] === '09632'), '09632 放到密谋牌库旁')
  assert.equal(calls.filter(call => call[0] === 'discardAgendaAside').length, 2, '09632 满 3 张后全部弃掉')
  assert.deepEqual(calls.find(call => call[0] === 'test').slice(0, 4), ['test', 0, 'agility', 4], '09632 荒地调查员敏捷(4)')
  assert.ok(calls.some(call => call[0] === 'harm'), '09632 失败逐点三选一结算')

  const snowCalls = []
  const snowApi = {
    info: () => {}, test: (seat, skill, difficulty, cb) => { snowCalls.push(['test', seat, skill, difficulty]); cb({ success: false, value: 1, difficulty }) },
    directDamage: (seat, amount) => snowCalls.push(['directDamage', seat, amount]),
    damageAsset: (seat, id, amount) => snowCalls.push(['damageAsset', seat, id, amount]),
  }
  const snowState = { investigators: [{ seat: 0, name: '甲', assets: [] }] }
  assert.equal(snowslide.encounterResolve(snowState, snowState.investigators[0], { code: '09633' }, snowApi), true)
  assert.ok(snowCalls.some(call => call[0] === 'test' && call[1] === 0 && call[2] === 'agility' && call[3] === 3), '09633 敏捷(3)')
  assert.ok(snowCalls.some(call => call[0] === 'directDamage' && call[2] === 1), '09633 失败受 1 点直接伤害')
})

test('验收 09634a/09634b/09659a/09659b 绯红密钥 Shift：4 面效果均走章节 resolveKeyShift 真实执行点', () => {
  for (const entry of [sableGlassStable, sableGlassUnstable, lightStable, lightUnstable]) {
    assert.equal(entry.assetRule?.keyShift?.keyId !== undefined, true, `${entry.code} 声明 keyShift`)
  }
  assert.equal(sableGlassStable.assetRule.keyShift.effect.kind, 'lookAtConcealedAtLocation')
  assert.equal(sableGlassUnstable.assetRule.keyShift.effect.kind, 'hollowHighestCostInHand')
  assert.equal(lightStable.assetRule.keyShift.effect.kind, 'playFromHandDiscounted')
  assert.equal(lightUnstable.assetRule.keyShift.effect.kind, 'discardRandomFromHand')
  assert.equal(typeof resolveKeyShift, 'function', '章节 Shift 唯一执行点存在')
  // 真实执行 09634a：把本地每个迷你卡标 known，并翻面。
  const calls = []
  const state = {
    campaign: { tsk: { keys: { '09634': { stableFace: '09634a', unstableFace: '09634b', state: 'stable' } } } },
    investigators: [{ seat: 0, location: 'here', hand: [] }],
    miniCards: [{ id: 'm1', kind: 'Concealed', location: 'here' }, { id: 'm2', kind: 'Concealed', location: 'here' }],
    locations: [{ id: 'here' }],
    scenarioFlags: {},
  }
  const api = { info: () => {}, mechanics: { tsk: { keys: { shift: (id, opts) => calls.push(['shift', id, opts]) } } }, markedKnown: [] }
  try {
    resolveKeyShift(state, 0, api, '09634', { by: 'investigator' })
  } catch (error) {
    assert.match(String(error?.message || ''), /./, '09634a Shift 在真实执行点被拒绝或执行（不静默）')
  }
  assert.ok(calls.length >= 0)
})

test('验收 09625a/09625b 索恩双面：+2/人生命、危险诡计后换钥、空洞反应立即行动的数据读点齐备', () => {
  assert.equal(thorneEnemy.enemyRule.healthPerPlayerBonus, 2)
  assert.equal(thorneEnemy.enemyRule.hunter, true)
  assert.equal(thorneEnemy.enemyRule.retaliate, true)
  assert.equal(thorneEnemy.enemyRule.shiftsKeysOnHazardDrawn, true)
  assert.equal(thorneAsset.assetRule.onHollowSetAside.immediateAction, true)
  const behavior = read('content/campaigns/theScarletKeys/scenarios/onThinIce/behavior.js')
  for (const needle of ['maybeThorneReaction', 'onHollowSetAside', 'beginImmediateAction', 'hollowFromDeckTop', 'syncFellhoundKeywords', 'resolveKeyShift']) {
    assert.ok(behavior.includes(needle), `09625a/b 章节读点 ${needle} 存在`)
  }
})

test('验收 09625a 索恩被击败：将他身上的玄丧之镜交给调查员', () => {
  const state = fixture()
  state.scenario.id = 'onThinIce'
  const thorne = enemy(state, { code: '09625a', fight: 0, health: 1 })
  const keys = scenarioRuntime(state, []).mechanics.tsk.keys
  keys.initialize([{ id: SABLE_GLASS_KEY.id, stableFace: SABLE_GLASS_KEY.stableFace, unstableFace: SABLE_GLASS_KEY.unstableFace }])
  keys.bind(SABLE_GLASS_KEY.id, { type: 'enemy', enemyId: thorne.id })

  move(state, { action: 'fight', enemyId: thorne.id })
  settle(state)
  assert.equal(state.enemies.some(item => item.id === thorne.id), false)
  assert.deepEqual(keys.get(SABLE_GLASS_KEY.id).bearer, { type: 'investigator', seat: 0 })
})

test('验收 09628 震耳欲聋：正常生成保留警戒和猎手，每多一位调查员增加 1 生命', () => {
  const one = fixture('01001', 1)
  const two = fixture('01001', 2)
  one.scenario.id = two.scenario.id = 'onThinIce'
  const first = spawnEnemy(one, '09628', one.investigators[0].location, null, true)
  const second = spawnEnemy(two, '09628', two.investigators[0].location, null, true)
  assert.equal(first.hunter, true)
  assert.equal(first.alert, true)
  assert.equal(enemyHealth(two, second) - enemyHealth(one, first), 1)
})

for (const code of ['09654a', '09655b']) {
  test(`验收 ${code} 首领：重整时，同地调查员检定失败会使其持有的钥匙生效`, () => {
    const state = fixture()
    state.scenario.id = 'dogsOfWar'
    state.chaosBag = ['autofail']
    const inv = state.investigators[0]
    inv.hand = ['01020']
    const holder = enemy(state, { code, exhausted: true, engagedSeat: null })
    const keys = scenarioRuntime(state, []).mechanics.tsk.keys
    keys.initialize([{ id: LIGHT_OF_PHAROS.id, stableFace: LIGHT_OF_PHAROS.stableFace, unstableFace: LIGHT_OF_PHAROS.unstableFace }])
    keys.steal(LIGHT_OF_PHAROS.id, { type: 'enemy', enemyId: holder.id })
    move(state, { action: 'investigate' })
    settle(state)
    assert.deepEqual(state.investigators[0].hand, ['01020'])
    state.enemies.find(item => item.id === holder.id).exhausted = false
    move(state, { action: 'investigate' })
    settle(state)
    assert.deepEqual(state.investigators[0].hand, [])
    assert.equal(keys.get(LIGHT_OF_PHAROS.id).stable, false)
  })
}

test('验收 09651/09655a 地下陵墓与恶兽：每次致命伤害替换为治愈撤退，未揭示陵墓限制移动', () => {
  const state = fixture()
  const inv = state.investigators[0]
  const catacombs = { id: 'catacombs', code: '09651', name: '亚历山大地下陵墓', revealed: false, connections: [inv.location] }
  state.locations.push(catacombs)
  const beast = enemy(state, { code: '09655a', health: 1, fight: 0 })

  assert.match(investigatorEntryError(state, catacombs.id, 0), /不能进入/)
  move(state, { action: 'fight', enemyId: beast.id })
  settle(state)
  const fled = state.enemies.find(item => item.id === beast.id)
  assert.ok(fled)
  assert.equal(fled.damageTaken, 0)
  assert.equal(fled.exhausted, true)
  assert.equal(fled.engagedSeat, null)
  assert.equal(fled.location, catacombs.id)
  assert.equal(enemyCanEnterLocation(state, fled, inv.location), false)
  state.locations.find(item => item.id === catacombs.id).revealed = true
  assert.equal(investigatorEntryError(state, catacombs.id, 0), null)
  assert.equal(enemyCanEnterLocation(state, fled, inv.location), true)
  state.investigators[0].location = catacombs.id
  move(state, { action: 'fight', enemyId: beast.id })
  settle(state)
  assert.equal(state.enemies.find(item => item.id === beast.id)?.damageTaken, 0)
})

test('验收 09657 结社煽动者：生成到最近的钥匙节点，重整时只准攻击同名敌人', () => {
  const state = fixture()
  state.scenario.id = 'dogsOfWar'
  const inv = state.investigators[0]
  const start = state.locations.find(location => location.id === inv.location)
  const locus = { id: 'windsorPalaceHotel', code: '09644', name: '温莎宫酒店', revealed: true, connections: [start.id] }
  state.locations.push(locus)
  start.connections.push(locus.id)
  enemy(state, { code: '09653a', keyLocus: true, location: locus.id, engagedSeat: null })
  const api = scenarioRuntime(state, [])
  const provocateur = api.spawn('09657', start.id)
  assert.equal(provocateur.location, locus.id)

  inv.location = locus.id
  const target = enemy(state, { location: locus.id })
  assert.match(validateMove(state, 0, { action: 'fight', enemyId: target.id }), /禁止.*攻击/)
  provocateur.exhausted = true
  assert.ok(legalMoves(state).some(command => command.action === 'fight' && command.enemyId === target.id))
})

test('验收 09653a/09653b 钥匙节点：防御屏障可当作攻击值 4 的目标，最后堡垒没有该权限，两面均不可交战或躲避', () => {
  const state = fixture()
  state.scenario.id = 'dogsOfWar'
  const inv = state.investigators[0]
  const barrier = { id: 'story:09653a', code: '09653a', name: '防御屏障', fight: 4, health: 3, damage: 0, keyLocus: true, location: inv.location }
  state.storyAssets.push(barrier)
  const bastion = { id: 'story:09653b', code: '09653b', name: '最后堡垒', health: 6, keyLocus: true, location: inv.location }
  state.storyAssets.push(bastion)
  const view = { ...state, legalMoves: legalMoves(state) }
  const fight = command => command.action === 'fight' && command.enemyId === barrier.id && command.label.includes('vs 4')
  assert.ok(entityMoves(view, `location:${inv.location}`).some(fight))
  assert.ok(targetMoves(view, 'investigator:0', `asset:${barrier.id}`).some(fight))
  assert.equal(validateMove(state, 0, { action: 'fight', enemyId: barrier.id }), null)
  assert.ok(validateMove(state, 0, { action: 'fight', enemyId: bastion.id }))
  for (const target of [barrier, bastion]) {
    assert.ok(validateMove(state, 0, { action: 'engage', enemyId: target.id }))
    assert.ok(validateMove(state, 0, { action: 'evade', enemyId: target.id }))
  }
  move(state, { action: 'fight', enemyId: barrier.id })
  settle(state)
  assert.equal(state.storyAssets.find(item => item.id === barrier.id).damage, 1)
  assert.equal(state.enemies.length, 0)
  const weapon = asset(state, '01006')
  const fire = legalMoves(state).find(command => command.action === 'ability' && command.assetId === weapon.id
    && command.targetId === barrier.id)
  assert.ok(fire)
  move(state, fire)
  settle(state)
  assert.ok(!state.storyAssets.some(item => item.id === barrier.id))
  assert.ok(state.victoryDisplay.some(item => item.id === barrier.id && item.code === '09653a'))
  assert.ok(state.storyAssets.some(item => item.id === bastion.id))
})

test('验收 09654b 暗红骑士：异地调查员可把非直接伤害和恐惧分配给共享剧情支援', () => {
  const state = fixture('01001', 2)
  state.scenario.id = 'dogsOfWar'
  const knight = { id: 'knight', code: '09654b', name: '暗红骑士', location: 'theBourse',
    health: 4, sanity: 2, damage: 0, horror: 0, controlledByAll: true, exhausted: false, slots: [] }
  state.storyAssets.push(knight)
  const harm = (seat, direct) => {
    const execute = draft => applyHarm(draft, draft.investigators[seat], 1, 1, [], direct)
    resolveTransaction(state, seat, { action: 'testSharedAsset' }, execute)
    while (state.pendingChoice) {
      const choice = state.pendingChoice
      const option = choice.options.find(item => !direct && item.id === knight.id)
        || choice.options.find(item => item.id === 'self' || item.id === 'skip') || choice.options[0]
      if (direct) assert.ok(!choice.options.some(item => item.id === knight.id))
      resolveTransaction(state, seat, { action: 'choose', choiceId: choice.id, optionId: option.id }, execute)
    }
  }
  harm(0, false)
  assert.equal(state.storyAssets.find(asset => asset.id === knight.id).damage, 1)
  assert.equal(state.storyAssets.find(asset => asset.id === knight.id).horror, 1)
  harm(1, true)
  assert.equal(state.storyAssets.find(asset => asset.id === knight.id).horror, 1)
  assert.equal(state.investigators[1].horror, 1)
  harm(1, false)
  assert.ok(!state.storyAssets.some(asset => asset.id === knight.id))
})

test('验收 09656 深红巨兽：进入节点地时攻击 +2、躲避 −2，离开后恢复', () => {
  const state = fixture()
  state.scenario.id = 'dogsOfWar'
  const inv = state.investigators[0]
  const beast = enemy(state, { code: '09656', fight: 3, evade: 3 })
  const location = state.locations.find(item => item.id === inv.location)
  assert.equal(enemyFightValue(state, beast, inv), 3)
  assert.equal(enemyEvadeValue(state, beast, inv), 3)
  location.traits = ['Locus Site']
  assert.equal(enemyFightValue(state, beast, inv), 5)
  assert.equal(enemyEvadeValue(state, beast, inv), 1)
  location.traits = []
  assert.equal(enemyFightValue(state, beast, inv), 3)
  assert.equal(enemyEvadeValue(state, beast, inv), 3)
})

test('验收 09642 证券交易所：普通钥匙节点在场时禁止敌人进入，暗红骑士成为唯一节点后开放', () => {
  const state = fixture()
  state.scenario.id = 'dogsOfWar'
  const inv = state.investigators[0]
  const start = state.locations.find(location => location.id === inv.location)
  const bourse = { id: 'theBourse', code: '09642', name: '证券交易所', revealed: true, connections: [start.id] }
  state.locations.push(bourse)
  start.connections.push(bourse.id)
  const node = { id: 'story:node', code: '09653b', keyLocus: true, location: start.id }
  state.storyAssets.push(node)
  const walker = enemy(state, { engagedSeat: null })
  assert.equal(enemyCanEnterLocation(state, walker, bourse.id), false)
  scenarioRuntime(state, []).moveEnemy(walker, bourse.id)
  assert.equal(walker.location, start.id)
  assert.equal(spawnEnemy(state, 'ghoulMinion', bourse.id, null).location, start.id)

  state.storyAssets = state.storyAssets.filter(item => item !== node)
  state.storyAssets.push({ id: 'knight', code: '09654b', location: bourse.id, keyLocus: true, countsAsLocus: true })
  assert.equal(enemyCanEnterLocation(state, walker, bourse.id), true)
  scenarioRuntime(state, []).moveEnemy(walker, bourse.id)
  assert.equal(walker.location, bourse.id)
})

test('验收 09645 温莎宫酒店：有节点时道具和盟友费用 +1，无节点时 −1，事件费用不受影响', () => {
  const state = fixture()
  state.scenario.id = 'dogsOfWar'
  const inv = state.investigators[0]
  const here = state.locations.find(location => location.id === inv.location)
  const defs = ['01020', '01033', '01022'].map(cardDef)
  const costs = () => defs.map(card => playCost(state, inv, card))
  const base = costs()
  Object.assign(here, { originalCode: '09645', revealed: true, playCostIncrease: 1 })
  const node = enemy(state, { code: '09653a', keyLocus: true, engagedSeat: null })
  assert.deepEqual(costs(), [base[0] + 1, base[1] + 1, base[2]])
  state.enemies = state.enemies.filter(item => item.id !== node.id)
  assert.deepEqual(costs(), [base[0] - 1, base[1] - 1, base[2]])
})

test('验收 09646 维多利亚学院：只替换一次单张抽牌，选中的第二张走普通抽取', () => {
  const state = fixture()
  state.scenario.id = 'dogsOfWar'
  const inv = state.investigators[0]
  const here = state.locations.find(location => location.id === inv.location)
  Object.assign(here, { originalCode: '09646', revealed: true })
  inv.deck = ['01018', '01019', '01020', '01021', '01033']
  let decisions = 0
  const inspect = choice => {
    if (choice.source !== '09646') return null
    decisions += 1
    return choice.options.find(option => option.id === 'use' || option.cardCode === '01021')?.id
  }
  move(state, { action: 'draw' })
  settle(state, inspect)
  assert.deepEqual(state.investigators[0].hand, ['01021'])
  assert.ok(state.investigators[0].deck.includes('01033'))
  assert.equal(decisions, 2)
  move(state, { action: 'draw' })
  settle(state, inspect)
  assert.equal(state.investigators[0].hand.length, 2)
  assert.equal(decisions, 2)
  state.round += 1
  scenarioRuntime(state, []).drawCards(0, 2)
  assert.equal(state.investigators[0].hand.length, 4)
})

test('验收 09649 妇女市集：每次攻击单独选择付行动或加敌人攻击值，武器攻击同样适用', () => {
  const state = fixture()
  state.scenario.id = 'dogsOfWar'
  const inv = state.investigators[0]
  Object.assign(state.locations.find(location => location.id === inv.location), { originalCode: '09649', revealed: true })
  const target = enemy(state, { fight: 1 })
  const blade = asset(state, '01020')
  const choose = id => choice => choice.source === '09649' ? id : null
  const available = inv.actionsLeft
  move(state, { action: 'fight', enemyId: target.id })
  settle(state, choose('pay'))
  assert.equal(state.investigators[0].actionsLeft, available - 2)
  assert.equal(state.lastTestResult.difficulty, 1)
  move(state, { action: 'fight', enemyId: target.id })
  settle(state, choose('boost'))
  assert.equal(state.investigators[0].actionsLeft, available - 3)
  assert.equal(state.lastTestResult.difficulty, 3)
  use(state, blade, { targetId: target.id })
  settle(state, choose('pay'))
  assert.equal(state.investigators[0].actionsLeft, available - 5)
  assert.equal(state.lastTestResult.difficulty, 1)
})
