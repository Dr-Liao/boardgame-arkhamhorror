// w4 · TIC middle 剩余卡：07164b / 07165b（魔鬼礁石的骇物）、07185（伏兵出水）、
// 07199 / 07200 / 07201（追逐议程三张同文正面的不同背面）、07202（油门踩死）。
//
// 全部走真实引擎入口：章节夹具用开发态 chapterFixture 开局，条目用「直接注册 +
// registeredEntry 判空」让本 Wave 新增文件在索引重建前可见。
//
// 读点速查：
//   · 07164b/07165b 生成点 = 条目级 `spawnAtStoryAsset: '07178'`（enemies.js#spawnEnemy，
//     取 state.storyAssets 里 07178 实例的 location）；API 入口必须是 ignoreSpawn=false 的
//     `api.spawnEngaged(code, null, null)`（`api.spawn` 固定忽略印刷生成点）。
//   · 生命值 = `modifiers target:'enemyHealth'`（modifiers.js#enemyHealthDelta）。
//   · 不能进入洞穴 = `enemyRule.cannotEnterTraits`（enemy-entry.js#enemyCanEnterLocation）。
//   · 07165b 击败替代 = `enemyWouldBeDefeated` 打断窗口 + api.enemyOutcomes.replace。
//   · 07185 显现/旁置 = api.putNextToAgenda（scenarioRuntime）；轮末弃 1 张 =
//     `treacheryRule.discardOneAtRoundEnd`；额外混乱标记 =
//     `treacheryRule.extraTokenOnAttackAtFlooded`（tests.js#floodedAttackExtraTokenRule）。
//   · 07202 调查阶段末 = forced descriptor + `investigationPhaseEnds` 窗口；
//     载具读 api.mechanics.vehicles.record / move。
//   · 07199–07201 正面同文 = _shared.js#chaseAgendaEntry（movementActionSurcharge +
//     agendaRule.onRoundEnd 道路清理）；背面 = 各文件自己的 onReveal。

import test from 'node:test'
import assert from 'node:assert/strict'
import { chapterFixture } from './tic-chapter-fixture.mjs'
import { enemy, move, settle } from './core-fixture.mjs'
import { checkAct, enemyHealth, legalMoves, reactionWindow, scenarioRuntime } from '../src/engine/engine.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'
import e07164b from '../src/cards/encounter-entries/theInnsmouthConspiracy/devilReef/07164b.js'
import e07165b from '../src/cards/encounter-entries/theInnsmouthConspiracy/devilReef/07165b.js'
import e07166 from '../src/cards/encounter-entries/theInnsmouthConspiracy/devilReef/07166.js'
import e07185 from '../src/cards/encounter-entries/theInnsmouthConspiracy/devilReef/07185.js'
import e07199 from '../src/cards/encounter-entries/theInnsmouthConspiracy/horrorInHighGear/07199.js'
import e07200 from '../src/cards/encounter-entries/theInnsmouthConspiracy/horrorInHighGear/07200.js'
import e07201 from '../src/cards/encounter-entries/theInnsmouthConspiracy/horrorInHighGear/07201.js'
import e07202 from '../src/cards/encounter-entries/theInnsmouthConspiracy/horrorInHighGear/07202.js'

const entries = [e07164b, e07165b, e07166, e07185, e07199, e07200, e07201, e07202]
for (const entry of entries) if (!registeredEntry(entry.code)) registerCardAbilities([entry])

function transaction(s, execute, select = () => null) {
  resolveTransaction(s, 0, { action: 'testTicMiddleRemaining' }, execute)
  for (let guard = 0; s.pendingChoice; guard++) {
    assert.ok(guard < 80, `choice loop ${s.pendingChoice.kind}`)
    const choice = s.pendingChoice
    const id = select(choice, s) ?? ['done', 'skip', 'self'].find(optionId => choice.options.some(option => option.id === optionId))
      ?? choice.options[0].id
    resolveTransaction(s, choice.seat, { action: 'choose', choiceId: choice.id, optionId: id }, execute)
  }
}

// 结局流程用 api.finish：finishScenario 会以 ScenarioEnded 正常收束剧本结算，
// 测试按 tests/tic-chapter-resolutions.test.mjs 的写法只吞这个控制流异常。
function finishTransaction(s, execute, select = () => null) {
  const guarded = draft => {
    try { execute(draft) } catch (error) { if (error.constructor.name !== 'ScenarioEnded') throw error }
  }
  resolveTransaction(s, 0, { action: 'testTicMiddleFinish' }, guarded)
  for (let guard = 0; s.pendingChoice; guard++) {
    assert.ok(guard < 80, `choice loop ${s.pendingChoice.kind}`)
    const choice = s.pendingChoice
    const id = select(choice, s) ?? ['done', 'skip', 'self'].find(optionId => choice.options.some(option => option.id === optionId))
      ?? choice.options[0].id
    resolveTransaction(s, choice.seat, { action: 'choose', choiceId: choice.id, optionId: id }, guarded)
  }
}

const codeOf = card => card?.originalCode || card?.code
const boatOf = s => (s.storyAssets || []).find(asset => codeOf(asset) === '07178') || null
const roadColumns = s => s.scenarioFlags.mechanics.road?.columns || {}
const columnOf = (s, id) => Number(roadColumns(s)[id])

function spawnTerror(s, code) {
  let id = null
  transaction(s, draft => {
    const spawned = scenarioRuntime(draft, []).spawnEngaged(code, null, null)
    id = spawned?.id || null
  })
  return s.enemies.find(enemy => enemy.id === id) || null
}

function endRound(s) {
  for (let guard = 0; guard < 12 && s.status === 'playing'; guard++) {
    for (const inv of s.investigators) inv.actionsLeft = 0
    const command = legalMoves(s).find(item => item.action === 'endTurn')
    if (!command) return
    const round = s.round
    move(s, command)
    settle(s)
    if (s.round !== round) return
  }
}

// ---------------------------------------------------------------------------
// 07164b / 07165b 魔鬼礁石的骇物
// ---------------------------------------------------------------------------

test('07164b/07165b：声明了渔船生成点、[[洞穴]]禁入与 +3[每调查员]生命值读点', () => {
  for (const code of ['07164b', '07165b']) {
    const entry = registeredEntry(code)
    assert.equal(entry.implemented, true, `${code} implemented`)
    assert.equal(entry.spawnAtStoryAsset, '07178')
    assert.deepEqual(entry.enemyRule.cannotEnterTraits, ['Cave'])
    assert.equal(entry.modifiers.length, 1)
    assert.equal(entry.modifiers[0].target, 'enemyHealth')
  }
  // 07165b 多一条「将要被击败时」的强制替代；07164b 没有。
  assert.deepEqual(registeredEntry('07164b').abilities, [])
  assert.equal(registeredEntry('07165b').abilities.length, 1)
  assert.ok(registeredEntry('07165b').abilities[0].trigger.includes('enemyWouldBeDefeated'))
})

test('07164b：按「渔船所在地点」生成，生命值 = 印刷 6 + 3 × 人数', () => {
  const s = chapterFixture('devilReef', 2)
  const boat = boatOf(s)
  assert.ok(boat, '魔鬼礁石开局有渔船剧情资产')
  const terror = spawnTerror(s, '07164b')
  assert.ok(terror, '生成成功')
  assert.equal(terror.location, boat.location, '生成在渔船所在地点')
  assert.equal(terror.engagedSeat ?? null, null, '印刷没有「与你交战」')
  assert.equal(terror.health, 6, '实例生命值是印刷值')
  assert.equal(enemyHealth(s, terror), 6 + 3 * s.numInvestigators, '+3[每调查员]生命值')
})

test('07164b/07165b：不能进入[[洞穴]]地点，普通地点不受限制', () => {
  const s = chapterFixture('devilReef', 1)
  s.locations.push({ id: 'w4-cave', code: '07102', originalCode: '07102', name: '测试洞穴',
    traits: ['Cave'], revealed: true, connections: [], clues: 0, shroud: 1 })
  const api = scenarioRuntime(s, [])
  for (const code of ['07164b', '07165b']) {
    const terror = spawnTerror(s, code)
    assert.equal(api.canEnemyEnterLocation(terror, 'w4-cave'), false, `${code} 不能进入洞穴`)
    assert.equal(api.canEnemyEnterLocation(terror, s.scenario.startLocation), true, `${code} 可以进入普通地点`)
  }
})

test('07164b：被击败后正常进胜利区（印刷 Victory 1）', () => {
  const s = chapterFixture('devilReef', 1)
  s.enemies = []
  const terror = spawnTerror(s, '07164b')
  transaction(s, draft => {
    const target = draft.enemies.find(enemy => enemy.id === terror.id)
    target.damageTaken = 100
    scenarioRuntime(draft, []).defeatEnemy(target, { seat: 0 })
  })
  assert.equal(s.enemies.some(enemy => enemy.id === terror.id), false, '离场')
  assert.ok(s.victoryDisplay.some(card => codeOf(card) === '07164b'), '加入胜利区')
})

test('07165b：将要被击败时改为移除所有伤害、横置并本轮不能重整', () => {
  const s = chapterFixture('devilReef', 1)
  s.enemies = []
  const terror = spawnTerror(s, '07165b')
  transaction(s, draft => {
    const target = draft.enemies.find(enemy => enemy.id === terror.id)
    target.damageTaken = 100
    scenarioRuntime(draft, []).defeatEnemy(target, { seat: 0 })
  })
  const after = s.enemies.find(enemy => enemy.id === terror.id)
  assert.ok(after, '没有被击败')
  assert.equal(after.damageTaken, 0, '移除所有伤害')
  assert.equal(after.exhausted, true, '横置')
  assert.deepEqual(after.preventReady, { from: s.round, rounds: 1 }, '本轮剩余时间不能重整')
  assert.equal(s.victoryDisplay.some(card => codeOf(card) === '07165b'), false)
})

// 末日礁石议程 1b（07164/07165 的背面）：生成对应的「魔鬼礁石的骇物」到渔船所在地点。
// 剧本记录决定用版本一还是版本二（middle-setup.js#middleSetupLocations）。
for (const [record, version, agendaCode, terrorCode] of [
  ['ABattleWithAHorrifyingDevil', 'I', '07164', '07164b'],
  [null, 'II', '07165', '07165b'],
]) {
  test(`${agendaCode} 大海的秘密（版本${version}）：背面把 ${terrorCode} 生成在渔船所在地点`, () => {
    const s = chapterFixture('devilReef', 1, record ? { memoriesRecovered: [record] } : {})
    assert.equal(codeOf(s.agendas[s.agendaIndex]), agendaCode, '选择了对应的议程版本')
    const boat = boatOf(s)
    assert.ok(boat, '开局有渔船剧情资产')
    transaction(s, draft => {
      registeredEntry(agendaCode).agendaRule.onReveal(draft, draft.agendas[draft.agendaIndex], scenarioRuntime(draft, []))
    })
    const terror = s.enemies.find(item => codeOf(item) === terrorCode)
    assert.ok(terror, `生成 ${terrorCode}`)
    assert.equal(terror.location, boat.location, '生成在渔船所在地点')
    assert.equal(terror.engagedSeat ?? null, null, '印刷没有「与你交战」')
  })
}

test('07164/07165：渔船不在场时背面回退 api.spawn(线索) 不抛错', () => {
  const s = chapterFixture('devilReef', 1)
  s.storyAssets = (s.storyAssets || []).filter(asset => codeOf(asset) !== '07178')
  transaction(s, draft => {
    registeredEntry('07165').agendaRule.onReveal(draft, draft.agendas[draft.agendaIndex], scenarioRuntime(draft, []))
  })
  assert.equal(s.enemies.some(item => codeOf(item) === '07165b'), false, '没有生成点时不落敌人')
})

test('07166 深海的魔鬼：背面记录「浪潮愈烈」并进入结局 1', () => {
  const s = chapterFixture('devilReef', 1)
  assert.deepEqual(s.agendas.map(codeOf), ['07165', '07166'], '第二张议程是深海的魔鬼')
  const entry = registeredEntry('07166')
  assert.equal(typeof entry.agendaRule.onReveal, 'function', '背面 onReveal 已接线（审计要求）')
  assert.deepEqual(entry.agendaRule.movementActionSurcharge, { amount: 2, betweenTraits: ['Ocean'] }, '正面规则保留')
  finishTransaction(s, draft => {
    entry.agendaRule.onReveal(draft, draft.agendas.find(agenda => codeOf(agenda) === '07166'), scenarioRuntime(draft, []))
  })
  assert.equal(s.campaign.records.TheTideHasGrownStronger, true, '在剧本日志记录「浪潮愈烈」')
  assert.equal(s.campaign.scenarioResults.at(-1)?.resolution, 'resolution1', '背面 (→结局1)')
})

// ---------------------------------------------------------------------------
// 07185 伏兵出水
// ---------------------------------------------------------------------------

function revealAquaticAmbush(s, seat = 0) {
  const entry = registeredEntry('07185')
  transaction(s, draft => entry.encounterResolve(draft, draft.investigators[seat], { code: '07185', name: '伏兵出水' },
    scenarioRuntime(draft, [], { type: 'encounter', label: '诡计检定', code: '07185' })))
}

test('07185：显现把本体放到密谋牌库旁，且不进入遭遇弃牌堆；两句强制读点已接线', () => {
  const s = chapterFixture('devilReef', 1)
  const discardBefore = s.encounterDiscard.filter(code => code === '07185').length
  revealAquaticAmbush(s)
  assert.deepEqual((s.agendaAside || []).map(codeOf), ['07185'], '放到密谋牌库旁的真实旁置实例')
  assert.equal(s.encounterDiscard.filter(code => code === '07185').length, discardBefore, '已入场的卡不进遭遇弃牌堆')
  assert.equal(registeredEntry('07185').treacheryRule.discardOneAtRoundEnd, true)
  assert.equal(registeredEntry('07185').treacheryRule.extraTokenOnAttackAtFlooded, true)
})

test('07185：每轮结束时只从场上弃掉 1 张同名副本，下一轮再弃下一张', () => {
  const s = chapterFixture('devilReef', 1)
  const runtime = scenarioRuntime(s, [])
  runtime.putNextToAgenda('07185')
  runtime.putNextToAgenda('07185')
  endRound(s)
  assert.deepEqual((s.agendaAside || []).map(codeOf), ['07185'], '第一轮只弃 1 张')
  assert.equal(s.encounterDiscard.filter(code => code === '07185').length, 1)
  endRound(s)
  assert.deepEqual((s.agendaAside || []).map(codeOf), [], '第二轮弃掉最后一张')
  assert.equal(s.encounterDiscard.filter(code => code === '07185').length, 2)
})

test('07185：攻击淹没地点的敌人时，本次检定额外揭示 1 个混乱标记（每次检定最多一次）', () => {
  const attack = { aside: true, flood: 2, bag: ['-5', '-5', '-5'] }
  const s = chapterFixture('devilReef', 1)
  const api = scenarioRuntime(s, [])
  if (attack.aside) api.putNextToAgenda('07185')
  api.mechanics.water.set(s.investigators[0].location, attack.flood, { ignoreRestrictions: true })
  s.chaosBag = [...attack.bag]
  s.investigators[0].combat = 10
  const target = enemy(s, { location: s.investigators[0].location, engagedSeat: 0, fight: 1, health: 40 })
  move(s, { action: 'fight', enemyId: target.id })
  settle(s)
  assert.equal(s.lastTestResult.drawn.length, 2, '额外揭示 1 个（不是 2 个以上）')
  assert.equal(s.lastTestResult.value, 10 - 10, '两个标记都计入本次检定')

  // 对照 1：不在淹没地点攻击 → 只揭示 1 个。
  const dry = chapterFixture('devilReef', 1)
  const dryApi = scenarioRuntime(dry, [])
  dryApi.putNextToAgenda('07185')
  dryApi.mechanics.water.set(dry.investigators[0].location, 0, { ignoreRestrictions: true })
  dry.chaosBag = ['-5', '-5', '-5']
  dry.investigators[0].combat = 10
  const dryTarget = enemy(dry, { location: dry.investigators[0].location, engagedSeat: 0, fight: 1, health: 40 })
  move(dry, { action: 'fight', enemyId: dryTarget.id })
  settle(dry)
  assert.equal(dry.lastTestResult.drawn.length, 1, '干燥地点不额外揭示')
  assert.equal(dry.lastTestResult.value, 10 - 5)

  // 对照 2：没有「伏兵出水」在密谋旁 → 淹没地点也只揭示 1 个。
  const bare = chapterFixture('devilReef', 1)
  const bareApi = scenarioRuntime(bare, [])
  bareApi.mechanics.water.set(bare.investigators[0].location, 2, { ignoreRestrictions: true })
  bare.chaosBag = ['-5', '-5', '-5']
  bare.investigators[0].combat = 10
  const bareTarget = enemy(bare, { location: bare.investigators[0].location, engagedSeat: 0, fight: 1, health: 40 })
  move(bare, { action: 'fight', enemyId: bareTarget.id })
  settle(bare)
  assert.equal(bare.lastTestResult.drawn.length, 1, '没有伏兵出水时不额外揭示')
})

// ---------------------------------------------------------------------------
// 07199 / 07200 / 07201 追逐议程
// ---------------------------------------------------------------------------

test('07199/07200/07201：三张同文议程共用工厂（步行 +2 行动、轮末清理、背面 onReveal）', () => {
  for (const code of ['07199', '07200', '07201']) {
    const entry = registeredEntry(code)
    assert.equal(entry.implemented, true, `${code} implemented`)
    assert.equal(entry.scope, 'agenda')
    assert.deepEqual(entry.agendaRule.movementActionSurcharge, { amount: 2 })
    assert.equal(typeof entry.agendaRule.onReveal, 'function', `${code} 背面`)
    assert.equal(typeof entry.agendaRule.onRoundEnd, 'function', `${code} 轮末道路清理`)
    assert.deepEqual(entry.abilities, [])
  }
})

test('07199：背面在最后方地点生成「魔鬼礁石的骇物」07199b，且不与调查员交战', () => {
  const s = chapterFixture('horrorInHighGear', 2)
  s.enemies = []
  const agenda = s.agendas[s.agendaIndex]
  transaction(s, draft => {
    registeredEntry('07199').agendaRule.onReveal(draft, draft.agendas[draft.agendaIndex], scenarioRuntime(draft, []))
  })
  const terror = s.enemies.find(item => codeOf(item) === '07199b')
  assert.ok(terror, '生成 07199b')
  const columns = Object.values(roadColumns(s)).map(Number)
  assert.equal(columnOf(s, terror.location), Math.min(...columns), '生成在最后方的地点')
  assert.equal(terror.engagedSeat ?? null, null, '印刷没有「与你交战」')
})

test('07201：背面「燃料耗尽」击败所有调查员并各承受 1 点肉体创伤', () => {
  const s = chapterFixture('horrorInHighGear', 2)
  const before = s.investigators.map(inv => ({ ...(s.campaign.investigators[inv.seat].trauma || {}) }))
  transaction(s, draft => {
    registeredEntry('07201').agendaRule.onReveal(draft, draft.agendas[draft.agendaIndex], scenarioRuntime(draft, []))
  })
  for (const inv of s.investigators) {
    assert.equal(inv.defeated, true, `座位 ${inv.seat} 被击败`)
    const trauma = s.campaign.investigators[inv.seat].trauma || {}
    assert.equal(Number(trauma.physical || 0), Number(before[inv.seat].physical || 0) + 1, '1 点肉体创伤')
  }
})

test('07200：背面翻转载具为停止面，并把遭遇弃牌堆混洗回遭遇牌库', () => {
  const s = chapterFixture('horrorInHighGear', 2)
  const api = scenarioRuntime(s, [])
  const cars = Object.entries(s.scenarioFlags.mechanics.vehicles).filter(([, car]) => car.running)
  assert.ok(cars.length > 0, '开局有运行中的载具')
  const codes = new Map(cars.map(([id]) => [id, codeOf(s.storyAssets.find(asset => asset.id === id))]))
  assert.ok([...codes.values()].every(code => ['07211a', '07212a'].includes(code)), '运行面卡号')
  s.encounterDiscard = ['01166']
  const deckBefore = s.encounterDeck.length
  transaction(s, draft => {
    registeredEntry('07200').agendaRule.onReveal(draft, draft.agendas[draft.agendaIndex], scenarioRuntime(draft, []))
  })
  for (const [id] of cars) {
    assert.equal(s.scenarioFlags.mechanics.vehicles[id].running, false, '载具停止')
    assert.equal(['07211b', '07212b'].includes(codeOf(s.storyAssets.find(asset => asset.id === id))), true, '翻到停止面')
  }
  assert.equal(s.encounterDiscard.length, 0, '遭遇弃牌堆已洗入牌库')
  assert.equal(s.encounterDeck.length, deckBefore + 1, '洗入的牌在遭遇牌库')
  assert.ok(s.encounterDeck.includes('01166'))
})

test('07200：3 人局弃遭遇牌库顶直到[[载具]]敌人或机械故障诡计，队长抽取该卡', () => {
  const s = chapterFixture('horrorInHighGear', 3)
  s.enemies = []
  s.encounterDiscard = []
  s.encounterDeck = ['01166', '01166', '01166', '01166', '07213']
  transaction(s, draft => {
    registeredEntry('07200').agendaRule.onReveal(draft, draft.agendas[draft.agendaIndex], scenarioRuntime(draft, []))
  })
  assert.ok(s.enemies.some(item => codeOf(item) === '07213'), '抽到的[[载具]]敌人生成入场')
  assert.ok(s.encounterDiscard.filter(code => code === '01166').length >= 1, '抽到之前弃掉了非匹配牌')
})

test('07200：2 人局不执行「弃到载具敌人/机械故障」分支', () => {
  const s = chapterFixture('horrorInHighGear', 2)
  s.encounterDiscard = []
  s.encounterDeck = ['01166', '01166', '07213']
  transaction(s, draft => {
    registeredEntry('07200').agendaRule.onReveal(draft, draft.agendas[draft.agendaIndex], scenarioRuntime(draft, []))
  })
  assert.equal(s.enemies.some(item => codeOf(item) === '07213'), false, '不弃牌也不抽牌')
  assert.equal(s.encounterDeck.length, 3, '遭遇牌库张数不变（只洗牌）')
})

test('07199 轮末道路清理：后方空地点移出游戏；停机列保留；被敌人占用的地点保留', () => {
  const s = chapterFixture('horrorInHighGear', 1)
  s.enemies = []
  const columns = Object.values(roadColumns(s)).map(Number)
  const rearColumn = Math.min(...columns)
  const rearIds = s.locations.filter(location => columnOf(s, location.id) === rearColumn).map(location => location.id)
  // 参考实现 advanceRoad：`stopColumn = 最后方调查员列 - 1`，该列停下并保留。
  const investigatorColumn = columnOf(s, s.investigators[0].location)
  const stopColumn = investigatorColumn - 1
  const stopColumnIds = s.locations.filter(location => columnOf(s, location.id) === stopColumn).map(location => location.id)
  assert.ok(rearIds.length > 0, '最后方有地点')
  assert.ok(stopColumnIds.length > 0, `停机列 ${stopColumn} 上应有地点`)
  transaction(s, draft => {
    registeredEntry('07199').agendaRule.onRoundEnd(draft, draft.agendas[draft.agendaIndex], scenarioRuntime(draft, []))
  })
  assert.equal(s.locations.some(location => rearIds.includes(location.id)), false, '最后方的空地点离开地图')
  for (const id of stopColumnIds) assert.ok(s.locations.some(location => location.id === id), '停机列（最后方调查员后一列）保留')
  assert.ok(s.locations.some(location => location.id === s.investigators[0].location), '调查员所在地点保留')

  // 同一个最后方地点放一个敌人：清理在遇到被占地点时停下。
  const occupied = chapterFixture('horrorInHighGear', 1)
  occupied.enemies = []
  const occupiedRearColumn = Math.min(...Object.values(roadColumns(occupied)).map(Number))
  const occupiedRear = occupied.locations.find(location => columnOf(occupied, location.id) === occupiedRearColumn)
  enemy(occupied, { location: occupiedRear.id, engagedSeat: null, code: 'ghoulMinion' })
  transaction(occupied, draft => {
    registeredEntry('07199').agendaRule.onRoundEnd(draft, draft.agendas[draft.agendaIndex], scenarioRuntime(draft, []))
  })
  assert.ok(occupied.locations.some(location => location.id === occupiedRear.id), '被占地点保留')
})

// ---------------------------------------------------------------------------
// 07202 油门踩死
// ---------------------------------------------------------------------------

test('07202：声明「每个敌人获得猎手」「调查阶段末载具移动」「剧情指示型目标」与背面结局1', () => {
  const entry = registeredEntry('07202')
  assert.equal(entry.implemented, true)
  assert.equal(entry.scope, 'act')
  assert.equal(entry.actRule.enemiesGainHunter, true, '每个敌人获得猎手的读点声明')
  assert.equal(typeof entry.actRule.objective, 'function', '印刷含目标 → 必须有 actRule.objective（审计要求）')
  assert.equal(typeof entry.actRule.onReveal, 'function', '背面 (→结局1)')
  assert.equal(entry.abilities.length, 1)
  assert.ok(entry.abilities[0].trigger.includes('investigationPhaseEnds'))
})

test('07202：「尽快开到猎鹰岬」是剧情指示型目标——objective 恒 false，不自动推进幕', () => {
  const s = chapterFixture('horrorInHighGear', 1)
  s.enemies = []
  const entry = registeredEntry('07202')
  const act = s.acts[s.actIndex]
  assert.equal(codeOf(act), '07202')
  const api = scenarioRuntime(s, [])
  assert.equal(entry.actRule.objective(s, act, api), false, '没有剧情指示时恒 false')
  // 即使把所有调查员视为「已到最前方」，actRule.objective 也不判定推进（推进由 07203 的地点目标承担）。
  for (const inv of s.investigators) {
    const front = s.locations.find(location => columnOf(s, location.id) === Math.max(...Object.values(roadColumns(s)).map(Number)))
    api.moveInvestigator(inv.seat, front.id)
  }
  assert.equal(entry.actRule.objective(s, act, api), false, '全员到最前方也恒 false')
  const before = s.actIndex
  transaction(s, draft => { checkAct(draft, []) })
  assert.equal(s.actIndex, before, '幕不会被 07202 的 objective 误推进')
  assert.equal(s.status, 'playing')
})

test('07202：全局猎手读点让未印猎手的敌人在敌人阶段获得猎手行为', () => {
  const s = chapterFixture('horrorInHighGear', 1)
  s.enemies = []
  const here = s.investigators[0].location
  const rear = s.locations.find(location => columnOf(s, location.id) === 1)
  const hunter = enemy(s, { code: 'ghoulMinion', location: rear.id, engagedSeat: null, exhausted: false })
  hunter.hunter = false
  s.currentSeat = 0
  s.phase = 'enemy'
  // 猎手行为判定读 turn.js#enemyHasHunter：当前幕 07202 的 actRule.enemiesGainHunter 为 true。
  const { resolveHunterMoves } = scenarioRuntime(s, [])
  const moved = resolveHunterMoves({})
  assert.ok(moved != null, 'resolved')
  const after = s.enemies.find(item => item.id === hunter.id)
  assert.notEqual(after.location, rear.id, '未印猎手的敌人按幕规则向调查员移动')
})

function driveAtPhaseEnd(s, select = () => null) {
  transaction(s, draft => {
    reactionWindow(draft, 'investigationPhaseEnds',
      { when: 'investigationPhaseEnds', phase: 'investigation', round: draft.round }, [])
  }, select)
}

test('07202：调查阶段结束时每辆运行中的载具由司机选择移动到连接的[[道路]]地点', () => {
  const s = chapterFixture('horrorInHighGear', 2)
  const cars = Object.entries(s.scenarioFlags.mechanics.vehicles)
    .filter(([, vehicle]) => vehicle.running && vehicle.driver != null)
  assert.ok(cars.length > 0, '开局有运行中的汽车与司机')
  const before = new Map(cars.map(([id, vehicle]) => [id, vehicle.location]))
  const driverOf = new Map(cars.map(([id, vehicle]) => [id, vehicle.driver]))
  const choices = []
  driveAtPhaseEnd(s, choice => {
    if (choice.kind !== 'location') return null
    choices.push({ seat: choice.seat, options: choice.options.map(option => option.id) })
    return choice.options[0].id
  })
  assert.equal(choices.length, cars.length, '每辆运行中的载具各问一次')
  for (const [id] of cars) {
    assert.equal(choices.some(choice => choice.seat === driverOf.get(id)), true, '由司机选择')
    const after = s.scenarioFlags.mechanics.vehicles[id]
    assert.notEqual(after.location, before.get(id), '载具移动了')
    const origin = s.locations.find(location => location.id === before.get(id))
    assert.ok(origin.connections.includes(after.location), '目标是与出发地连接的载具可达地点')
    assert.equal(s.locations.find(location => location.id === after.location).traits.includes('Road'), true, '目标是[[道路]]地点')
    for (const seat of after.passengers) assert.equal(s.investigators[seat].location, after.location, '乘客随载具移动')
  }
})

test('07202：停止的载具在调查阶段结束时不会移动', () => {
  const s = chapterFixture('horrorInHighGear', 2)
  const api = scenarioRuntime(s, [])
  const [id, vehicle] = Object.entries(s.scenarioFlags.mechanics.vehicles)
    .find(([, car]) => car.running && car.driver != null)
  api.mechanics.vehicles.running(id, false)
  const before = vehicle.location
  let asked = 0
  driveAtPhaseEnd(s, choice => {
    if (choice.kind === 'location') asked += 1
    return null
  })
  assert.equal(asked, 0, '停止的载具不询问移动')
  assert.equal(s.scenarioFlags.mechanics.vehicles[id].location, before, '位置不变')
})
