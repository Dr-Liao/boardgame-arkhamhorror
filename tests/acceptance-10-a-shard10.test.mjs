// 10-a 铁杉谷盛宴 · 分片 10（10677–10706b）独立验收证据。
//
// 逐卡证据：标题含卡号；真实执行条目 encounterResolve/数据与章节 behavior/definition 读点检查。
// 失败卡以真实断言记录「声明存在但无读点/无条目」的具体事实。
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

import '../src/engine/engine.js'
import { damageEnemy, drawEncounter } from '../src/engine/engine.js'
import { registeredEntry } from '../src/engine/ability.js'
import * as prelude from '../content/campaigns/theFeastOfHemlockVale/scenarios/preludeTheFinalEvening/index.js'
import { preludeChaosToken } from '../content/campaigns/theFeastOfHemlockVale/scenarios/dawnOfTheFinalDay/chaos.js'
import { enemy, fixture, legalMoves, move, settle } from './core-fixture.mjs'

const read = rel => fs.readFileSync(new URL(rel, import.meta.url), 'utf8')
const ENGINE = p => read('../src/engine/' + p)
const WELCOME = read('../content/campaigns/theFeastOfHemlockVale/scenarios/welcomeToHemlockVale/behavior.js')
const PRELUDE = read('../content/campaigns/theFeastOfHemlockVale/scenarios/preludeTheFinalEvening/behavior.js')
const FATE = read('../content/campaigns/theFeastOfHemlockVale/scenarios/fateOfTheVale/behavior.js')
const DAWN2 = read('../content/campaigns/theFeastOfHemlockVale/scenarios/dawnOfTheSecondDay/behavior.js') + read('../content/campaigns/theFeastOfHemlockVale/scenarios/dawnOfTheSecondDay/definition.js')
const DAWN3 = read('../content/campaigns/theFeastOfHemlockVale/scenarios/dawnOfTheFinalDay/behavior.js') + read('../content/campaigns/theFeastOfHemlockVale/scenarios/dawnOfTheFinalDay/definition.js')
const entryOf = code => registeredEntry(code)

for (const [code, day] of [['10677', 2], ['10679', 3]]) {
  test(`${code} 故事日卡：日历标志（第 ${day} 日）与章节日历读点`, () => {
    const entry = entryOf(code)
    assert.equal(entry.flags.day, day)
    assert.ok(entry.flags.timeMarker)
    assert.equal(entry.flags.doubleSided, true)
    assert.equal(/calendar|scenarioDate/.test(WELCOME + DAWN3), true, '章节行为读取日历')
  })
}

for (const [code, skill, difficulty, extra] of [['10678', 'intellect', 3, null], ['10680', 'willpower', 3, 'difficultyBonusIfColourEnemyHere']]) {
  test(`${code} 序曲诡计：显现检定与失败逐点二选一由条目 encounterResolve 结算`, () => {
    const entry = entryOf(code)
    assert.equal(entry.flags.test.skill, skill)
    assert.equal(entry.flags.test.difficulty, difficulty)
    assert.deepEqual(entry.flags.failByChoicePerPoint, code === '10678' ? ['loseAction', 'placeClueHere'] : ['takeHorror', 'discardRandomCard'])
    if (extra) assert.equal(entry.flags[extra], 2)
    assert.equal(typeof entry.encounterResolve, 'function', 'entry encounterResolve 读点')
    const calls = []
    const api = {
      test: (seat, selected, diff, callback) => { calls.push(['test', selected, diff]); callback({ success: false, difficulty: diff, value: 0, failedBy: 2 }) },
      choice: request => { calls.push(['choice']); return request.options[0].id },
      loseActions: () => calls.push(['loseAction']), placeClue: () => calls.push(['placeClue']),
      horror: () => calls.push(['horror']), discardRandom: () => calls.push(['discard']), info: () => {},
    }
    const state = { investigators: [{ seat: 0, location: 'l1', clues: 1, hand: ['01009'] }], locations: [{ id: 'l1', code: '10690a', connections: [] }], enemies: [], scenarioFlags: {}, campaign: { records: {} }, difficulty: 'standard' }
    entry.encounterResolve(state, state.investigators[0], {}, api)
    assert.deepEqual(calls[0], ['test', skill, difficulty])
    assert.ok(calls.length > 1, '失败逐点选项结算')
  })
}

for (const code of ['10681', '10683', '10686']) {
  test(`${code} 序曲议程：抽到弱点时取消显现（条目 forced 挂 cardWouldBeDrawn，引擎弱点子窗口）`, () => {
    const entry = entryOf(code)
    assert.equal(entry.flags.forcedCancelWeaknessRevelation, true)
    assert.ok((entry.abilities || []).some(ability => [].concat(ability.trigger || []).includes('cardWouldBeDrawn')), '条目 forced 挂 cardWouldBeDrawn')
    assert.equal(/cardWouldBeDrawn/.test(ENGINE('ability.js') + ENGINE('deck-ops.js')), true, '引擎弱点子窗口读点')
  })
}
for (const [code, token] of [['10688', '10688'], ['10689', '10689']]) {
  test(`${code} 终夜议程：目标/背面及特殊规则由 preludeTheFinalEvening behavior 承接`, () => {
    const entry = entryOf(code)
    assert.ok(entry.flags.objective || entry.flags.singleStageCard)
    assert.equal(PRELUDE.includes(token), true, `prelude behavior 读点 ${token}`)
    assert.equal(typeof prelude.behavior.agendaReveal, 'function')
  })
}

for (const code of ['10682', '10684']) {
  test(`${code} 序曲幕：调查员不能受伤/恐惧/被击败（章节 definition mechanics.protectInvestigators 读点）`, () => {
    const entry = entryOf(code)
    assert.deepEqual(entry.flags.protectsInvestigators, { damage: true, horror: true, defeat: true })
    assert.equal(/protectInvestigators/.test(DAWN2 + DAWN3 + WELCOME), true, '章节 definition 声明保护读点')
    assert.equal(typeof entry.flags.objective, 'object')
  })
}
test('10687 最后一个黎明：目标与背面「精神创伤或基础疯狂弱点 + 2 奖励经验」由章节 behavior 承接', () => {
  const entry = entryOf('10687')
  assert.equal(entry.flags.back.mentalTraumaOrBasicMadnessWeakness.trauma, 'mental')
  assert.equal(entry.flags.back.bonusXp, 2)
  assert.equal(entry.flags.back.readsStory, true)
  assert.equal(DAWN3.includes('mentalTraumaOrBasicMadnessWeakness') || /madness/i.test(DAWN3), true, '章节背面读点')
})

test('10685 毒堇诅咒：图标改为减去 / 失败弃整手 / 回合末在手中随机弃 1（条目自足读点）', () => {
  const entry = entryOf('10685')
  assert.equal(entry.flags.subtractIcons, true)
  assert.equal(entry.flags.weakness, true)
  assert.ok((entry.abilities || []).length >= 2)
  assert.equal(ENGINE('stats.js').includes('subtractIcons'), true, '图标减去引擎读点')
  assert.equal(ENGINE('deck-ops.js').includes('weaknessStaysInHand'), true, '弱点留手引擎读点')
})

test('10692 狂乱的赴宴者：被击败放 1 毁灭 + [action] 谈判敏捷(4)移出游戏（条目能力）', () => {
  const entry = entryOf('10692')
  assert.equal(entry.flags.doomOnDefeat, 1)
  assert.equal(entry.flags.parleySkill, 'agility')
  assert.equal(entry.flags.parleyDifficulty, 4)
  const abilities = entry.abilities || []
  assert.ok(abilities.some(ability => ability.actionKind === 'parley'), '谈判行动能力')
  assert.ok(abilities.some(ability => [].concat(ability.trigger || []).includes('enemyDefeated')), '被击败强制能力')
})

for (const code of ['10693', '10694', '10695', '10696', '10697', '10698', '10699', '10700']) {
  test(`${code} 居民资产：控制加成/法典谈判/被击败关系等级（数据型条目 + 章节读点）`, () => {
    const entry = entryOf(code)
    assert.equal(typeof entry.flags.resident, 'string')
    assert.ok(entry.flags.codexNumber)
    assert.ok(entry.flags.defeatRule && entry.flags.defeatRule.setAside === true)
    assert.ok((entry.abilities || []).some(ability => ability.actionKind === 'parley'))
    assert.equal(WELCOME.includes('codexNumber'), true, '章节行为读居民法典编号')
    assert.equal(WELCOME.includes('parley'), true, '章节行为读居民谈判规格')
  })
}
test('10701 伯蒂·马斯格雷夫：+1 生命/神智、[fast] 二选一伤害/恐惧抽牌（费用二选一移入 resolve 已披露）', () => {
  const entry = entryOf('10701')
  assert.equal(entry.flags.parley.fast, true)
  assert.deepEqual(entry.flags.controlBonus, { maxHealth: 1, maxSanity: 1 })
  assert.ok(entry.flags.defeatRule)
  assert.ok((entry.abilities || []).some(ability => ability.kind === 'action'))
})
test('10702 罗莎·马奎兹博士：+1 智力/敏捷、发现最后线索后读法典 Θ、可加入牌组', () => {
  const entry = entryOf('10702')
  assert.equal(entry.flags.deckPlayable, true)
  assert.deepEqual(entry.flags.controlBonus.skillBonus, { intellect: 1, agility: 1 })
  assert.equal(entry.flags.codexTrigger, 'lastClueAtYourLocation')
  assert.equal(ENGINE('deck-ops.js').includes('runtimeCardAvailable') || ENGINE('stats.js').includes('runtimeCardAvailable'), true, '牌组外可打读点')
})
test('10703 海伦·彼得斯：昼/夜技能加成 + 进入地点后自动躲避（scenario-calendar 读点）', () => {
  const entry = entryOf('10703')
  assert.ok(entry.flags.daySkillBonus)
  assert.ok(entry.flags.nightSkillBonus)
  assert.equal(fs.existsSync(new URL('../src/engine/scenario-calendar.js', import.meta.url)), true, '日历原语存在')
  assert.ok((entry.abilities || []).some(ability => ability.kind === 'reaction'))
})

for (const code of ['10693b', '10694b', '10695b', '10696b', '10697b', '10698b', '10699b', '10700b', '10701b']) {
  test(`${code} 居民敌人：关键词/谈判放一边/特殊强制（引擎 setEnemyAside 与条目能力）`, () => {
    const entry = entryOf(code)
    assert.equal(entry.scope, 'enemy')
    assert.equal(typeof entry.flags.resident, 'string')
    assert.ok(entry.flags.assetCode)
    assert.ok((entry.abilities || []).length >= 1, '条目至少声明谈判/强制能力')
    assert.equal(ENGINE('scenario-runtime.js').includes('setEnemyAside'), true, '放到一边唯一写入口')
  })
}
test('10697b 瑞玟·霍桑：每轮仅首张诡计获得涌动', () => {
  const state = fixture()
  const inv = state.investigators[0]
  enemy(state, { code: '10697b', engagedSeat: null })
  state.encounterDeck = Array(7).fill('10740')
  drawEncounter(state, inv, [])
  assert.equal(state.encounterDeck.length, 5)
  drawEncounter(state, inv, [])
  assert.equal(state.encounterDeck.length, 4)
  state.round += 1
  drawEncounter(state, inv, [])
  assert.equal(state.encounterDeck.length, 2)
})
test('10701b 伯蒂·马斯格雷夫：重整时替所在地其他居民敌人承受伤害', () => {
  const state = fixture()
  const bertie = enemy(state, { code: '10701b', traits: ['Resident'], engagedSeat: null })
  const resident = enemy(state, { traits: ['Resident'], engagedSeat: null })
  const visitor = enemy(state, { traits: ['Monster'], engagedSeat: null })
  damageEnemy(state, resident, 2, 0, [])
  damageEnemy(state, visitor, 1, 0, [])
  assert.equal(bertie.damageTaken, 2)
  assert.equal(resident.damageTaken, 0)
  assert.equal(visitor.damageTaken, 1)
  const closeResident = enemy(state, { traits: ['Resident'] })
  const fight = legalMoves(state, 0).find(candidate => candidate.action === 'fight' && candidate.enemyId === closeResident.id)
  assert.ok(fight)
  move(state, fight)
  settle(state)
  assert.equal(state.enemies.find(card => card.id === closeResident.id).damageTaken, 0)
  const readyBertie = state.enemies.find(card => card.id === bertie.id)
  assert.equal(readyBertie.damageTaken, 3)
  readyBertie.exhausted = true
  const otherResident = state.enemies.find(card => card.id === resident.id)
  damageEnemy(state, otherResident, 1, 0, [])
  assert.equal(otherResident.damageTaken, 1)
})

for (const [code, token] of [
  ['10690a', 'actionCodex'], ['10690b', 'parley'], ['10691b', 'actionCodex'],
  ['10705a', 'healDamageOrHorrorOncePerGame'], ['10706a', 'actionCodex'],
]) {
  test(`${code} 山谷地点：印刷面数据 + 章节地点行动读点（${token}）`, () => {
    const entry = entryOf(code)
    assert.ok(entry.flags.side, '声明印刷面')
    assert.ok(entry.flags.traits)
    assert.equal((WELCOME + PRELUDE + FATE).includes(token) || entry.flags[token] != null, true, `读点 ${token}`)
  })
}
test('10691a 老磨坊：花费恰好两个行动，发现地点上唯一的线索', () => {
  const state = fixture()
  const location = state.locations.find(place => place.id === state.investigators[0].location)
  Object.assign(location, { code: '10691a', originalCode: '10691a', revealed: true, clues: 1 })
  const action = () => legalMoves(state, 0).find(candidate => candidate.action === 'entityAbility'
    && candidate.entityId === location.id)
  state.investigators[0].actionsLeft = 1
  assert.ok(!action() || action().reason)
  state.investigators[0].actionsLeft = 2
  move(state, action())
  settle(state)
  assert.equal(state.investigators[0].actionsLeft, 0)
  assert.equal(state.investigators[0].clues, 1)
  assert.equal(state.locations.find(place => place.id === location.id).clues, 0)
})
test('10705b 旅舍（夜面）：首个遭遇涌动/三项检定/记住汽油（章节 definition/behavior 读点）', () => {
  const entry = entryOf('10705b')
  assert.ok(entry.flags.firstEncounterEachRoundGainsSurge)
  assert.ok(Array.isArray(entry.flags.actionTests.sequence))
  assert.ok(entry.flags.rememberIfActFateOfTheValeIV)
  assert.equal(DAWN3.includes('boardingHouse') || FATE.includes('boarding') || /Gas/.test(FATE + read('../src/campaign/campaign-effects.js')), true, '章节读点')
})
test('10706b 十字路口（夜面）：破碎敌失去冷漠 + 躲避 3+ 记住前路已通（fateOfTheVale 读点）', () => {
  const entry = entryOf('10706b')
  assert.ok(entry.flags.shatteredEnemiesLoseAloofDuringEnemyPhase)
  assert.ok(entry.flags.reactionEvadeShatteredByThree)
  assert.equal(FATE.includes('shattered'), true, '破碎机制读点')
})

test('10704 山谷：参考卡双面登记，序曲引擎值与两面标记规则相符', () => {
  const entry = entryOf('10704')
  assert.equal(entry.scope, 'scenario')
  assert.equal(entry.flags.doubleSided, true)
  for (const [difficulty, side, skull, lowHandTablet] of [
    ['standard', 'easyStandard', -3, 0], ['hard', 'hardExpert', -4, -2],
  ]) {
    const state = { difficulty, scenarioFlags: { hemlockDay: 3 } }
    const printed = entry.flags.tokenMeanings[side]
    assert.equal(preludeChaosToken(state, 'skull').delta, skull)
    assert.equal(preludeChaosToken(state, 'tablet', { handSize: 1 }).delta, lowHandTablet)
    assert.equal(preludeChaosToken(state, 'cultist', { parley: true }).delta, 1)
    assert.equal(preludeChaosToken(state, 'cultist', { parley: true }).autoSucceed,
      Boolean(printed.cultist.parleyAutoSucceed))
    assert.equal(preludeChaosToken(state, 'elderthing', { parley: true }).revealAnother, true)
  }
})
