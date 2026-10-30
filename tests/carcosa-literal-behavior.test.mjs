import test from 'node:test'
import assert from 'node:assert/strict'
import { encounterRules } from '../content/campaigns/thePathToCarcosa/encounter-rules.js'
import { behavior as oathBehavior } from '../content/campaigns/thePathToCarcosa/scenarios/theUnspeakableOath/behavior.js'
import { behavior as blackStarsBehavior } from '../content/campaigns/thePathToCarcosa/scenarios/blackStarsRise/behavior.js'
import { behavior as dimBehavior } from '../content/campaigns/thePathToCarcosa/scenarios/dimCarcosa/behavior.js'
import { behavior as maskBehavior } from '../content/campaigns/thePathToCarcosa/scenarios/thePallidMask/behavior.js'

const investigator = extra => ({
  seat: 0, name: '调查员', location: 'hall', clues: 1, actionsLeft: 3,
  assets: [], threat: [], hand: [], discard: [], horror: 0, ...extra,
})

test('03185 约束衣进入威胁区、占槽且提供双行动弃除能力', () => {
  const inv = investigator({
    assets: [{ id: 'gun', code: '01016' }, { id: 'coat', code: '01072' }],
  })
  // 第 114 轮：03185 的显现结算迁到遭遇条目后，共享解析器会先读所在地点（here）。
  const state = { investigators: [inv], locations: [{ id: 'hall', name: '大厅' }] }
  const returned = []
  let threat = null
  const resolved = oathBehavior.resolveEncounter(state, inv, { code: '03185' }, {
    removeAsset(_seat, id) {
      const index = inv.assets.findIndex(asset => asset.id === id)
      returned.push(inv.assets.splice(index, 1)[0].code)
    },
    threat(_seat, code, extra) {
      threat = { id: 'straitjacket', code, ...extra }
      inv.threat.push(threat)
    },
  })
  assert.equal(resolved, true)
  assert.deepEqual(returned.sort(), ['01016', '01072'])
  assert.deepEqual(inv.hand.sort(), ['01016', '01072'])
  assert.deepEqual(threat.slots, ['Body', 'Hand x2'])
  assert.equal(threat.cannotLeavePlay, true)
  assert.deepEqual(threat.threatEffect.discardCost, { action: 2 })
  assert.equal(threat.threatEffect.sameLocationAction, true)
})

test('03185 约束衣把双手武器（Hand x2）也返回手牌', () => {
  const inv = investigator({
    assets: [
      { id: 'shotgun', code: '01029' },   // 猎枪：Hand x2
      { id: 'bat', code: '01074' },       // 球棒：Hand x2
      { id: 'pistol', code: '01016' },    // .45自动手枪：Hand
      { id: 'coat', code: '01072' },      // 皮大衣：Body
      { id: 'amulet', code: '01095' },    // 远古印记护身符：Accessory
      { id: 'training', code: '01017' },  // 体能训练：无槽位
    ],
  })
  const state = { investigators: [inv], locations: [{ id: 'hall', name: '大厅' }] }
  const returned = []
  let threat = null
  const resolved = oathBehavior.resolveEncounter(state, inv, { code: '03185' }, {
    removeAsset(_seat, id) {
      const index = inv.assets.findIndex(asset => asset.id === id)
      if (index < 0) return
      returned.push(inv.assets.splice(index, 1)[0].code)
    },
    threat(_seat, code, extra) {
      threat = { id: 'straitjacket', code, ...extra }
      inv.threat.push(threat)
    },
  })
  assert.equal(resolved, true)
  // 双手武器写成 "Hand x2"，同样是手部槽位里的支援，必须一起返回手牌。
  assert.deepEqual(returned.sort(), ['01016', '01029', '01072', '01074'])
  assert.deepEqual(inv.hand.sort(), ['01016', '01029', '01072', '01074'])
  // 配件与无槽位支援不在身体/手部槽位里，不应被返回。
  assert.deepEqual(inv.assets.map(asset => asset.code).sort(), ['01017', '01095'])
  assert.deepEqual(threat.slots, ['Body', 'Hand x2'])
})

test('03091 与 03094 的地点附属行动和离开地点强制效果按卡面结算', () => {
  const inv = investigator()
  const location = {
    id: 'hall', name: '大厅', shroud: 2, shroudMod: 0, clues: 0, doom: 1,
    attachments: [{ id: 'spires', code: '03091', originalCode: '03091' }],
  }
  const state = {
    round: 1, moveCount: 1, fogMod: 0, investigators: [inv],
    locations: [location], enemies: [], encounterDiscard: [],
  }
  const spires = encounterRules.encounterActions(state, inv)
    .find(move => move.rule === 'clearSpiresOfCarcosa')
  assert.ok(spires)
  assert.equal(spires.actionKind, 'investigate')
  // 地点没有线索时，基础放大镜不会出现；尖柱自己的调查仍然要能做，而且不发现线索。
  assert.equal(location.clues, 0)
  encounterRules.performEncounterAction(state, inv, spires, {
    investigate(_seat, options) {
      assert.equal(options.allowNoClues, true)
      assert.equal(options.noClueDiscovery, true)
      options.onInvestigateSuccess({ success: false })
      assert.equal(location.doom, 1)
      options.onInvestigateSuccess({ success: true })
    },
  })
  assert.equal(location.doom, 0)
  assert.equal(location.clues, 0)
  assert.deepEqual(location.attachments, [])
  assert.deepEqual(state.encounterDiscard, ['03091'])

  location.attachments = [{ id: 'torment', code: '03094', originalCode: '03094' }]
  location.haunted = true
  const torment = encounterRules.encounterActions(state, inv)
    .find(move => move.rule === 'discardSpiritsTorment')
  assert.ok(torment)
  encounterRules.performEncounterAction(state, inv, torment, {
    spendClues(_seat, amount) { inv.clues -= amount },
  })
  assert.equal(inv.clues, 0)
  assert.equal(location.clues, 1)
  assert.deepEqual(location.attachments, [])
  assert.equal(location.haunted, undefined)
  assert.deepEqual(state.encounterDiscard, ['03091', '03094'])

  location.attachments = [{ id: 'torment-2', code: '03094', originalCode: '03094' }]
  encounterRules.locationLeft(state, inv, location, {
    choose: () => 'action',
    loseActions(_seat, amount) { inv.actionsLeft -= amount },
    horror() { assert.fail('选择失去行动后不应受到恐惧') },
  })
  assert.equal(inv.actionsLeft, 2)
})

test('03059 苍白面具下的男子在共享遭遇规则中提供调查行动', () => {
  const inv = investigator()
  const enemy = { id: 'stranger', code: '03059', originalCode: '03059', location: 'hall', health: 3 }
  const state = {
    fogMod: 1, investigators: [inv],
    locations: [{ id: 'hall', shroud: 2, shroudMod: 1 }],
    enemies: [enemy],
  }
  const move = encounterRules.encounterActions(state, inv)
    .find(candidate => candidate.rule === 'investigatePallidMask')
  assert.ok(move)
  let damage = null
  encounterRules.performEncounterAction(state, inv, move, {
    test(_seat, skill, difficulty, resolve) {
      assert.equal(skill, 'intellect')
      assert.equal(difficulty, 6)
      resolve({ success: true })
    },
    damageEnemy(id, amount, seat, source) { damage = { id, amount, seat, source } },
  })
  assert.deepEqual(damage, { id: 'stranger', amount: 99, seat: 0, source: '03059' })
  assert.equal(dimBehavior.enemyCanBeDefeated({
    actIndex: 1, scenarioFlags: { actTwoVersion: 2 },
  }, enemy, null), false)
  assert.equal(dimBehavior.enemyCanBeDefeated({
    actIndex: 1, scenarioFlags: { actTwoVersion: 2 },
  }, enemy, '03059'), true)
  enemy.cannotBeDefeatedByAction = true
  assert.equal(maskBehavior.enemyCanBeDefeated({}, enemy, '03059'), false)
})

test('03301 裂缝探求者提供谈判，并在攻击后执行印刷强制效果', () => {
  const inv = investigator({ horror: 0, damage: 0 })
  const enemy = { id: 'rift', code: '03301', originalCode: '03301', location: 'hall' }
  const state = {
    doom: 0, agendaIndex: 0, numInvestigators: 1, investigators: [inv],
    locations: [{ id: 'hall' }], enemies: [enemy], encounterDiscard: [],
    scenarioFlags: {
      route: 'below',
      agendaDecks: {
        a: { id: 'a', index: 0, doom: 0, cards: ['03275', '03276a', '03277'] },
        c: { id: 'c', index: 0, doom: 0, cards: ['03278', '03279b', '03280'] },
      },
    },
  }
  const move = blackStarsBehavior.encounterActions(state, inv)
    .find(candidate => candidate.rule === 'parleyRiftSeeker')
  assert.ok(move)
  blackStarsBehavior.performEncounterAction(state, inv, move, {
    horror(_seat, amount) { inv.horror += amount },
    discardEnemy(target) {
      state.enemies.splice(state.enemies.indexOf(target), 1)
      state.encounterDiscard.push(target.code)
    },
  })
  assert.equal(inv.horror, 2)
  assert.equal(state.scenarioFlags.agendaDecks.a.doom, 1)
  assert.equal(state.scenarioFlags.agendaDecks.c.doom, 1)
  assert.deepEqual(state.encounterDiscard, ['03301'])

  state.enemies = [enemy]
  blackStarsBehavior.enemyAttackResolved(state, enemy, inv, {
    choose: () => 'harm',
    damage(_seat, amount) { inv.damage += amount },
    horror(_seat, amount) { inv.horror += amount },
  })
  assert.equal(inv.damage, 1)
  assert.equal(inv.horror, 3)
})

test('03332 黄衣之王哈斯塔允许任意地点调查员检定意志并将其横置', () => {
  const inv = investigator({ location: 'remote' })
  const enemy = { id: 'hastur', code: '03332', fight: 4, exhausted: false, location: 'palace' }
  const state = {
    agendaIndex: 1, actIndex: 2, investigators: [inv],
    locations: [{ id: 'remote', revealed: true, clues: 1 }],
    enemies: [enemy], campaign: { records: {} }, scenarioFlags: {},
  }
  const move = dimBehavior.encounterActions(state, inv)
    .find(candidate => candidate.rule === 'exhaustKingInYellow')
  assert.ok(move)
  dimBehavior.performEncounterAction(state, inv, move, {
    enemyFight: () => 5,
    test(_seat, skill, difficulty, resolve) {
      assert.equal(skill, 'willpower')
      assert.equal(difficulty, 5)
      resolve({ success: true })
    },
  })
  assert.equal(enemy.exhausted, true)
})

test('卡城幽影：击败苍白面具下的男子跳过默认弃牌结算，并把 03059 记为移出游戏', () => {
  const inv = investigator()
  const state = {
    actIndex: 1, investigators: [inv], enemies: [],
    scenarioFlags: {}, removedFromGame: [], encounterDiscard: [],
    campaign: { records: {} },
  }
  const man = { id: 'stranger', code: '03059', originalCode: '03059', name: '苍白面具下的男子' }
  // 返回 true = 已由剧本接管，引擎不再把弱点牌放进弃牌堆/胜利区。
  assert.equal(dimBehavior.enemyDefeated(state, man, {}), true)
  assert.equal(state.scenarioFlags.strangerDefeated, true)
  assert.deepEqual(state.removedFromGame, ['03059'])
  assert.ok(!state.encounterDiscard.includes('03059'))
  // 普通敌人仍然走默认结算。
  assert.equal(dimBehavior.enemyDefeated(state, { code: '03088' }, {}), false)
})
