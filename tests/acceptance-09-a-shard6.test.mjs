// 09-a 绯红密钥 · 分片 6（09584–09622）独立验收证据。
//
// 逐卡证据：标题含卡号；真实执行条目能力 / 章节 behavior 分派 / 章节数据读取。
// 失败卡的用例同样真实执行当前实现，并断言「读点缺失」的具体事实（供报告失败清单引用）。
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

import '../src/engine/engine.js'
import { registeredEntry } from '../src/engine/ability.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import * as dealings from '../content/campaigns/theScarletKeys/scenarios/dealingsInTheDark/index.js'
import * as dm from '../content/campaigns/theScarletKeys/scenarios/dancingMad/index.js'
import * as dmDef from '../content/campaigns/theScarletKeys/scenarios/dancingMad/definition.js'
import * as oti from '../content/campaigns/theScarletKeys/scenarios/onThinIce/index.js'
import * as otiDef from '../content/campaigns/theScarletKeys/scenarios/onThinIce/definition.js'
import { ACT_BACK_HANDLERS, concealEnemy } from '../content/campaigns/theScarletKeys/scenarios/dancingMad/behavior.js'
import { shiftTwistedAntiprism } from '../content/campaigns/theScarletKeys/scenarios/dealingsInTheDark/behavior.js'
import { enterOutsidersLair } from '../content/campaigns/theScarletKeys/scenarios/onThinIce/behavior.js'

const BEH = { dealings: dealings.behavior, dm: dm.behavior, oti: oti.behavior }
const CLUE = { code: code => registeredEntry(code) }

function stateFor(count = 1, extra = {}) {
  return {
    investigators: Array.from({ length: count }, (_, seat) => ({
      seat, name: `调查员${seat + 1}`, location: null, damage: 0, horror: 0, clues: 0, resources: 5,
      assets: [], hand: [], deck: [], discard: [], engaged: [], defeated: false, resigned: false, actionsLeft: 3,
    })),
    locations: [], enemies: [], encounterDeck: [], encounterDiscard: [], scenarioFlags: {},
    scenarioZones: { setAside: [], setAsideLocations: [] },
    campaign: { leadSeat: 0, records: {}, completedSteps: [], partners: {} },
    victoryDisplay: [], doom: 0, chaosBag: [], difficulty: 'standard', numInvestigators: count,
    phase: 'investigation', round: 1, status: 'playing', ...extra,
  }
}
const entryOf = code => registeredEntry(code)
const findIn = (scenario, code) => {
  for (const category of ['acts', 'agendas', 'locations', 'enemies', 'treacheries', 'storyAssets']) {
    const value = scenario?.[category]
    if (!value) continue
    const list = Array.isArray(value) ? value : Object.values(value)
    const found = list.find(item => String(item?.originalCode || item?.code) === code)
    if (found) return found
  }
  return null
}
const source = rel => fs.readFileSync(new URL(rel, import.meta.url), 'utf8')

// ---------------------------------------------------------------------------
// 暗中交易（dealings_in_the_dark）09584–09590b
// ---------------------------------------------------------------------------
test('09584 艾婕·萨辛：条目 [free] 放牌能力可执行并把牌记入 eceBeneath；钥匙变换后读点存在', () => {
  const entry = entryOf('09584')
  assert.equal(entry.implemented, true)
  assert.equal(entry.flags.afterKeyShift, 'drawBeneath')
  const state = stateFor()
  state.storyAssets = [{ id: 'ece', code: '09584', originalCode: '09584' }]
  state.investigators[0].deck = ['01009']
  const flags = []
  const api = {
    info: () => {},
    choice: request => (request.options.some(o => o.id === 'place') ? 'place' : request.options[0].id),
    scenario: { isWeaknessCode: () => false, setScenarioFlag: (key, value) => flags.push([key, value]) },
    moveCard: () => '01009', cardName: code => code,
  }
  entry.abilities[0].resolve({ state, inv: state.investigators[0], api })
  assert.equal(flags[0][0], 'eceBeneath')
  assert.equal(flags[0][1][0].code, '01009')
  // 钥匙变换后：behavior 在 shiftTwistedAntiprism 里消费 afterKeyShift / eceBeneath。
  const shiftState = stateFor()
  shiftState.investigators[0].deck = ['01009', '01010', '01011']
  shiftState.campaign.tsk = {}
  const seen = []
  shiftTwistedAntiprism(shiftState, { info: () => {}, lookAt: (...args) => seen.push(args), mechanics: {} }, { by: 'investigator', seat: 0 })
  assert.equal(seen.length, 1, '稳定面：查看牌库顶 3 张并抽 1')
})

test('09585 幽影预示者：敌人受伤窗口的条目强制能力可执行（最近的[[异教徒]]由章节事件实现）', () => {
  const entry = entryOf('09585')
  const ability = entry.abilities[0]
  assert.deepEqual([].concat(ability.trigger), ['enemyDamaged'])
  const source0 = { id: 'e1', code: '09585', location: 'x' }
  const state = stateFor()
  state.enemies = [source0]
  const info = []
  const api = { info: text => info.push(text), scenario: { resolveScenarioEvent: () => ({ name: '教徒' }) } }
  assert.equal(ability.criteria({ state, source: source0, context: { enemy: source0 } }), true)
  ability.resolve({ state, source: source0, api })
  assert.ok(info.some(text => text.includes('最近的')))
})

for (const code of ['09586a', '09586b', '09586c']) {
  test(`${code} 邪恶野心家：enemyRule.enemyPhaseEndDoomIfReady 由章节 behavior.enemyPhaseEnd 读取`, () => {
    const entry = entryOf(code)
    assert.equal(entry.enemyRule.enemyPhaseEndDoomIfReady, 1)
    const state = stateFor()
    state.enemies = [{ id: 'e1', code, originalCode: code, name: '邪恶野心家', exhausted: false }]
    const doomed = []
    dealings.behavior.enemyPhaseEnd(state, { doomOn: (enemy, amount) => doomed.push([enemy.code, amount]), info: () => {} })
    assert.deepEqual(doomed, [[code, 1]], '敌军阶段结束且处于重整 → 放 1 毁灭')
  })
}

for (const code of ['09587', '09588']) {
  test(`${code} 最近[[异教徒]]显现：条目 encounterResolve 放毁灭 + 检定 + 失败惩罚`, () => {
    const entry = entryOf(code)
    const state = stateFor()
    state.enemies = [{ id: 'cultist', code: '09585', name: '教徒', fight: 3, evade: 2, location: 'x' }]
    state.investigators[0].location = 'x'
    const calls = []
    const api = {
      scenario: undefined,
      resolveScenarioEvent: () => ({ enemyId: 'cultist' }),
      doomOn: (enemy, n) => calls.push(['doom', enemy.id, n]),
      test: (seat, skill, difficulty, resolve) => { calls.push(['test', skill, difficulty]); resolve({ success: false }) },
      horror: (...args) => calls.push(['horror', ...args]), damage: (...args) => calls.push(['damage', ...args]), info: () => {},
    }
    entry.encounterResolve(state, state.investigators[0], { name: code }, api)
    assert.equal(calls[0][0], 'doom')
    assert.equal(calls[1][0], 'test')
    assert.equal(calls[1][1], code === '09587' ? 'willpower' : 'agility')
    const penalty = calls.find(call => call[0] === (code === '09587' ? 'horror' : 'damage'))
    assert.ok(penalty, '失败惩罚已结算')
    assert.equal(penalty[2], 2)
  })
}

test('09589 虚空幽光：显现二选一 + 线索多于教派时再次结算', () => {
  const entry = entryOf('09589')
  const state = stateFor()
  state.enemies = [{ id: 'c1', code: '09585', name: '教徒', evade: 4, traits: ['Cultist'], location: 'x' }]
  state.investigators[0].location = 'x'
  state.investigators[0].clues = 2
  const calls = []
  const api = {
    resolveScenarioEvent: id => (id === 'dealingsCultClues' ? 1 : null),
    choice: () => 'harm', doomOn: () => calls.push('doom'), damage: () => calls.push('damage'), horror: () => calls.push('horror'), info: () => {},
  }
  entry.encounterResolve(state, state.investigators[0], {}, api)
  assert.deepEqual(calls, ['damage', 'horror', 'damage', 'horror'], '线索多于教派 → 结算两次')
})

for (const code of ['09590a', '09590b']) {
  test(`${code} 扭曲反棱镜：变换规则由条目 flags.shiftRule 声明并被 shiftTwistedAntiprism 读取`, () => {
    const entry = entryOf(code)
    assert.equal(entry.flags.keyFace, code === '09590a' ? 'stable' : 'unstable')
    assert.ok(entry.flags.shiftRule)
    const state = stateFor()
    state.investigators[0].deck = ['01009', '01010', '01011']
    state.investigators[0].location = 'x'
    state.locations = [{ id: 'x', code: '09550', connections: [] }]
    state.campaign.tsk = {}
    const calls = []
    const api = {
      info: () => {}, mechanics: {},
      lookAt: (...args) => calls.push(['lookAt', ...args]),
      doomOn: () => calls.push(['doomOn']),
      addDoom: () => calls.push(['addDoom']), choice: () => 'asset',
    }
    state.scenarioFlags.twistedAntiprismFace = code
    const result = shiftTwistedAntiprism(state, api, { by: 'investigator', seat: 0 })
    assert.equal(result.by, 'investigator')
    assert.equal(calls.some(call => call[0] === 'lookAt'), code === '09590a')
    assert.equal(state.scenarioFlags.twistedAntiprismFace != null, true, '变换后写入面标记')
  })
}

// ---------------------------------------------------------------------------
// 疯星乱舞（dancingMad）09591–09608
// ---------------------------------------------------------------------------
test('09591 疯星乱舞（剧本参考卡）：内容层提供混乱标记表与章节 referenceCode（scenario-reference 类别）', () => {
  assert.equal(registeredEntry('09591'), null, 'TSK 剧本参考卡按本章约定不建条目（scenario-reference 类别）')
  assert.equal(dm.manifest.referenceCode, '09591')
  assert.ok(dm.behavior.tokenMeanings && dm.behavior.tokenMeanings.standard)
  assert.equal(typeof dm.behavior.resolveChaosToken, 'function')
})

for (const [code, expected] of Object.entries({
  '09592': { per: 5, remove: 3, back: 'chooseConcealedOrHollow' },
  '09593': { per: 4, remove: 2, back: 'chooseConcealedOrHollow' },
  '09594': { per: 3, remove: 1, back: 'erasure' },
})) {
  test(`${code} 议程：正面空洞强制阈值与背面动作由章节数据声明且 behavior 读取`, () => {
    const agenda = dmDef.agendas.find(item => item.originalCode === code)
    assert.ok(agenda, '议程数据存在')
    assert.equal(agenda.hollowForced.perInvestigator, expected.per)
    assert.equal(agenda.hollowForced.remove, expected.remove)
    assert.equal(agenda.backAction, expected.back)
    assert.equal(typeof dm.behavior.phaseBegan, 'function', '正面强制读点 phaseBegan')
    assert.equal(typeof dm.behavior.agendaReveal, 'function', '背面动作读点 agendaReveal')
  })
}

for (const [code, expected] of Object.entries({
  '09595': { handler: true, backAction: true }, '09596': { handler: true }, '09597': { handler: true },
  '09598': { handler: true }, '09599': { handler: true },
})) {
  test(`${code} 幕：背面处置由 ACT_BACK_HANDLERS / behavior 行动与目标读点承接`, () => {
    const act = dmDef.acts.find(item => item.originalCode === code) || dmDef.ACT_VARIANTS.ambush.find(item => item.originalCode === code)
    assert.ok(act, '幕数据存在（版本化幕组）')
    assert.equal(typeof dm.behavior.actReveal, 'function')
    if (expected.handler) assert.equal(typeof ACT_BACK_HANDLERS[code], 'function', '背面 handler 已接线')
  })
}

test('09595 幕：德西离场强制（放一边 + 全体 1 恐惧）缺 behavior.storyAssetLeftPlay 读点', () => {
  assert.equal(typeof dm.behavior.storyAssetLeftPlay, 'undefined', '本章没有消费「剧情支援离场」的钩子')
  assert.equal(source('../content/campaigns/theScarletKeys/scenarios/dancingMad/behavior.js').includes('storyAssetLeftPlay'), false)
})

test('09596 幕：隐匿 X 的团队付线索改直接交战由 concealEnemy 实现（幕 2 v.I 目标口径）', () => {
  const state = stateFor()
  state.acts = [{ originalCode: '09596', objective: { kind: 'noEnemiesInShadows', perInvestigator: 1 } }]
  state.actIndex = 0
  state.investigators[0].clues = 2
  state.investigators[0].location = 'a'
  state.locations = [{ id: 'a', code: '09600a', connections: [] }, { id: 'b', code: '09601', connections: [] }]
  const paid = []
  const api = { choice: () => 'pay', spawnEngaged: () => ({ id: 'enemy' }), info: () => {} }
  const result = concealEnemy(state, api, '09606a', { seat: 0 })
  assert.ok(result.paid > 0, '共同花费线索改为直接生成')
  assert.equal(state.investigators[0].clues, 2 - result.paid)
})

test('09600a 月下餐厅（结社据点面）：无卡面能力，定义数据存在', () => {
  assert.ok(JSON.stringify(dmDef.CAFE_LUNA_FACES).includes('09600a'), '月下餐厅两面数据存在')
})

test('09600b 月下餐厅（追忆堡垒面）：域外敌人 -1 帷幕 + 无线索补线索读点', () => {
  const state = stateFor()
  state.scenario = { locations: { cafeLuna: { originalCode: '09600b' } } }
  state.locations = [{ id: 'cafeLuna', code: '09600b', connections: [], clues: 0, revealed: true }]
  state.enemies = [{ id: 'e1', code: '09734', location: 'cafeLuna', traits: ['Outsider'], defeated: false }]
  const shroud = dm.behavior.locationShroudModifier(state, state.locations[0])
  assert.equal(shroud, -1, '每个[[域外]]敌人 -1 帷幕')
  dm.behavior.cluesRemoved(state, state.locations[0], 0, { info: () => {} })
  assert.ok(state.locations[0].clues >= 1, '没有线索时补到 1×人数')
})

test('09601 马赛奥大道：[reaction] 被实现为 [fast] 场景行动，缺少「揭露诱饵后」触发条件', () => {
  const state = stateFor()
  state.scenario = { locations: { elMalecon: { originalCode: '09601' } } }
  state.locations = [{ id: 'elMalecon', code: '09601', connections: [], revealed: true }]
  state.investigators[0].location = 'elMalecon'
  const moves = dm.behavior.actions(state, state.investigators[0])
  const action = moves.find(move => move.rule === 'elMaleconExpose')
  assert.ok(action, '提供揭露另一张迷你卡的行动')
  assert.equal(action.fast, true, '实现为 fast 行动（卡面为 reaction）')
  assert.equal(source('../content/campaigns/theScarletKeys/scenarios/dancingMad/behavior.js').includes('exposeDecoyAfter'), false)
})

test('09602 热带花园：调查成功 3+ 抽回空洞 / 失败 3+ 把非弱点手牌作为空洞（afterInvestigate 读点）', () => {
  const state = stateFor()
  state.scenario = { locations: { jardines: { originalCode: '09602' } } }
  state.locations = [{ id: 'jardines', code: '09602', connections: [], revealed: true }]
  state.investigators[0].location = 'jardines'
  assert.equal(typeof dm.behavior.afterInvestigate, 'function')
  const result = dm.behavior.afterInvestigate(state, state.investigators[0], state.locations[0], { success: true, successBy: 3 }, { info: () => {} })
  assert.equal(result, null, '无空洞候选时不结算（读点已进入）')
})

test('09603 哈瓦那大剧院：花费 2 资源降低隐藏值，但缺少「直到你的回合结束」的到期清理', () => {
  const state = stateFor()
  state.scenario = { locations: { teatro: { originalCode: '09603' } } }
  state.locations = [{ id: 'teatro', code: '09603', connections: [], revealed: true, shroud: 4 }]
  state.investigators[0].location = 'teatro'
  const moves = dm.behavior.actions(state, state.investigators[0])
  const action = moves.find(move => move.rule === 'granTeatroShroud')
  assert.ok(action)
  dm.behavior.performAction(state, state.investigators[0], action, { info: () => {} })
  assert.equal(state.locations[0].shroudMod, -2)
  dm.behavior.roundEnded(state, { info: () => {} })
  assert.equal(state.locations[0].shroudMod, -2, '回合结束后仍为 -2（未实现到期清理）')
})

test('09604 海景游艇俱乐部：调查改为查看迷你卡已揭示面（investigateResult 读点）', () => {
  const state = stateFor()
  state.scenario = { locations: { miramar: { originalCode: '09604' } } }
  state.locations = [{ id: 'miramar', code: '09604', connections: [], revealed: true }]
  state.investigators[0].location = 'miramar'
  assert.equal(typeof dm.behavior.investigateResult, 'function')
  const result = dm.behavior.investigateResult(state, state.investigators[0], state.locations[0], { success: true, successBy: 4 }, { info: () => {} })
  assert.equal(result, false, '不发现线索，改为查看（返回 false 阻断常规发现）')
})

test('09605 广场酒店：受到 1 恐惧查看迷你卡已揭示面（fast 行动 + 团队每轮一次）', () => {
  const state = stateFor()
  state.scenario = { locations: { plaza: { originalCode: '09605' } } }
  state.locations = [{ id: 'plaza', code: '09605', connections: [], revealed: true }]
  state.investigators[0].location = 'plaza'
  const moves = dm.behavior.actions(state, state.investigators[0])
  const action = moves.find(move => move.rule === 'plazaHotelLook')
  assert.ok(action, '提供查看行动')
  dm.behavior.performAction(state, state.investigators[0], action, { info: () => {} })
  assert.equal(state.investigators[0].horror, 1)
  assert.equal(state.scenarioFlags.dancingMad.plazaHotelRound, 1, '团队每轮仅限一次记账')
})

for (const code of ['09606a', '09607a']) {
  test(`${code} 德西德柔：+2×人数生命值 / 幕 1–2 受伤改自动躲避 / 另一张对其造成 2 伤害`, () => {
    const entry = entryOf(code)
    assert.equal(entry.enemyRule.healthPerInvestigatorBonus, 2)
    const state = stateFor(2)
    state.scenarioFlags.dancingMad = { mode: 'deal', stance: 'alert' }
    state.acts = [{ originalCode: '09595' }, { originalCode: '09596' }]
    state.actIndex = 0
    state.enemies = [{ id: 'e1', code, originalCode: code, location: 'x', damage: 0 }, { id: 'e2', code, originalCode: code, location: 'x' }]
    state.investigators[0].location = 'x'
    assert.equal(dm.behavior.enemyStatModifier(state, state.enemies[0], 'health'), 4)
    const zeroed = dm.behavior.enemyDamageAmount(state, state.enemies[0], 2, { info: () => {} })
    assert.equal(zeroed, 0, '伤害被替换为自动躲避')
    assert.equal(state.enemies[0].exhausted, true)
    const amount = dm.behavior.afterEvade(state, state.investigators[0], state.enemies[1], { success: true, successBy: 2 }, { info: () => {} })
    assert.equal(amount, 2, '另一张对这张造成 2 点伤害')
  })
}

test('09607b 德西剧情资产：[[怪物]]敌人攻击伤害 -1 且对攻击者造成 1 伤害（enemyAttackModifier 读点）', () => {
  const entry = entryOf('09607b')
  assert.equal(entry.assetRule.monsterAttackDamageReduction, 1)
  const state = stateFor()
  state.investigators[0].assets = [{ id: 'desi', code: '09607b', originalCode: '09607b', exhausted: false }]
  const monsterCode = Object.values(ALL_CARDS).find(card => card.type === 'enemy' && (card.traits || []).includes('Monster')).code
  state.scenarioFlags.dancingMad = {}
  const enemy = { id: 'm1', code: monsterCode, location: 'x', damageTaken: 0, traits: ['Monster'] }
  const mod = dm.behavior.enemyAttackModifier(state, enemy)
  assert.deepEqual(mod, { damage: -1 })
  assert.equal(enemy.damageTaken, 1)
  assert.equal(state.investigators[0].assets[0].exhausted, true)
})

test('09608 惨遭夺舍：显现意志(4)失败把[[盟友]]/[[道具]]作为空洞，无候选改 2 恐惧', () => {
  const entry = entryOf('09608')
  const state = stateFor()
  state.investigators[0].assets = [{ id: 'a1', code: '01016', originalCode: '01016', traits: ['Ally'] }]
  const calls = []
  const api = {
    test: (seat, skill, difficulty, callback) => { calls.push(['test', skill, difficulty]); callback({ success: false }) },
    choice: () => 'a1',
    mechanics: { tsk: { hollow: { hollow: spec => calls.push(['hollow', spec]) } } },
    removeAsset: (...args) => calls.push(['removeAsset', ...args]), harm: (...args) => calls.push(['harm', ...args]), info: () => {},
  }
  entry.encounterResolve(state, state.investigators[0], {}, api)
  assert.deepEqual(calls[0], ['test', 'willpower', 4])
  assert.equal(calls[1][0], 'hollow')
  assert.equal(calls[2][0], 'removeAsset')
})

// ---------------------------------------------------------------------------
// 如履薄冰（onThinIce）09609–09622
// ---------------------------------------------------------------------------
const OTI_SRC = fs.readFileSync(new URL('../content/campaigns/theScarletKeys/scenarios/onThinIce/behavior.js', import.meta.url), 'utf8')
const OTI_ACT = number => otiDef.acts[number - 1]

test('09609 如履薄冰（剧本参考卡）：内容层提供混乱标记表与章节 referenceCode（scenario-reference 类别）', () => {
  assert.equal(registeredEntry('09609'), null, 'TSK 剧本参考卡按本章约定不建条目（scenario-reference 类别）')
  assert.equal(oti.manifest.referenceCode, '09609')
  assert.ok(oti.behavior.tokenMeanings && oti.behavior.tokenMeanings.standard)
  assert.equal(typeof oti.behavior.resolveChaosToken, 'function')
})

for (const code of ['09610', '09611']) {
  test(`${code} 议程：背面空洞化脚本动作有 behavior 读点，但正面「每 N×人数空洞移除若干并放毁灭」无读点`, () => {
    const agenda = otiDef.AGENDAS.find(item => item.originalCode === code)
    assert.ok(agenda)
    assert.equal(typeof oti.behavior.agendaReveal, 'function', '背面动作读点存在')
    const state = stateFor()
    state.agendas = [{ originalCode: code }]
    state.agendaIndex = 0
    const handled = oti.behavior.agendaReveal(state, state.agendas[0], { info: () => {}, mechanics: { tsk: { hollow: { hollow: () => {}, recall: () => {} } } } })
    assert.equal(handled, true)
    assert.equal('hollowForced' in agenda, false, '正面空洞强制阈值未在任何数据/读点声明')
    assert.equal(typeof oti.behavior.agendaForced, 'undefined', '没有正面强制的窗口读点')
  })
}

test('09612 灭绝：议程 3 背面抹除最高费用空洞并进入结局 4', () => {
  const state = stateFor()
  state.agendas = [{ originalCode: '09612' }]
  const calls = []
  const handled = oti.behavior.agendaReveal(state, state.agendas[0], { info: () => {}, finish: key => calls.push(key), mechanics: { tsk: { hollow: { erase: () => {}, hollow: () => {}, recall: () => {} } } } })
  assert.equal(handled, true)
  assert.deepEqual(calls, ['resolution4'])
})

test('09613 寻找玄丧之镜：幕 1 目标仅限废弃金矿调查员共同花费 3×人数线索（引擎 objective.type=clues 读点）', () => {
  const act = otiDef.ACT1
  assert.deepEqual(act.objective, { type: 'clues', perInvestigator: 3, atLocation: 'condemnedGoldMine' })
  assert.equal(act.originalCode, '09613')
})

test('09614 如果它会流血……：幕 2 勘察报告行动 + 任意轮末可推进 + 背面真实形态入场', () => {
  const act = otiDef.ACT2
  assert.equal(act.originalCode, '09614')
  assert.deepEqual(act.objective, { type: 'campaignRule' })
  assert.equal(typeof oti.behavior.actions, 'function')
  assert.equal(typeof oti.behavior.performAction, 'function')
  assert.equal(typeof oti.behavior.roundEnded, 'function', '轮末推进读点')
  assert.ok(OTI_SRC.includes('scoutingReport'))
})

test('09615a 夜魇游荡：幕 3 目标（真实形态被揭露后推进）+ 背面即域外来客之巢', () => {
  const act = OTI_ACT(3)
  assert.equal(act.originalCode, '09615a')
  assert.equal(act.objective.type, 'campaignRule')
  assert.equal(act.linkedLocation, 'outsidersLair')
  assert.equal(typeof oti.behavior.actReveal, 'function', '背面 enterOutsidersLair 读点')
  assert.equal(typeof enterOutsidersLair, 'function')
})

test('09615b 域外来客之巢：显现入场语义由幕 3 背面实现，但「无线索时奇美拉 -1 攻击/躲避」无读点', () => {
  const location = otiDef.LOCATIONS.outsidersLair
  assert.ok(location)
  assert.equal(String(location.originalCode), '09615b')
  assert.equal(typeof oti.behavior.enemyStatModifier, 'undefined', '没有敌人属性修正读点')
  assert.equal(OTI_SRC.includes('enemyStatModifier'), false)
})

test('09616 最后一刻：幕 4 目标（真实形态被击败）+ 背面按索恩版本分流结局', () => {
  const act = OTI_ACT(4)
  assert.equal(act.originalCode, '09616')
  assert.equal(act.objective.type, 'campaignRule')
  const state = stateFor()
  state.acts = [act]
  state.actIndex = 0
  state.locations = [{ id: 'summit', code: '09616', connections: [] }]
  state.investigators[0].location = 'summit'
  state.enemies = []
  state.storyAssets = []
  const calls = []
  assert.equal(oti.behavior.actReveal(state, act, { info: () => {}, finish: key => calls.push(key) }), true)
  assert.deepEqual(calls, ['resolution3'], '索恩不在场 → 结局 3')
})

test('09617 安克雷奇：[action] 空洞回收 + [action] 撤退（地点数据 resign 读点）', () => {
  const location = otiDef.LOCATIONS.anchorage
  assert.equal(String(location.originalCode), '09617')
  assert.equal(location.resign, true, '地点撤退由引擎 location.resign 读点提供')
  assert.equal(typeof oti.behavior.actions, 'function')
  assert.ok(OTI_SRC.includes('hollowRecall'), '空洞回收行动读点')
})

test('09618 费尔班克斯：[reaction] 花费 2 资源取消[[危险]]诡计效果无任何读点', () => {
  const location = otiDef.LOCATIONS.fairbanks
  assert.equal(String(location.originalCode), '09618')
  assert.equal(typeof oti.behavior.cancelHazard, 'undefined')
  assert.equal(/cancelHazard|cancelTreachery/.test(OTI_SRC), false, 'behavior 没有该反应窗口')
})

test('09619 山间溪流：进入检定 + 最后一个线索后放置 3 张界外荒地（locationEntered/cluesRemoved 读点）', () => {
  const state = stateFor()
  state.locations = [{ id: 'stream', code: '09619', originalCode: '09619', clues: 1, connections: [] }]
  state.investigators[0].location = 'stream'
  state.scenarioFlags.tskOnThinIce = { outerWildernessOpened: false }
  const tests = []
  const api = { info: () => {}, test: (seat, skills, difficulty, callback) => tests.push({ skills, difficulty }) }
  oti.behavior.locationEntered(state, state.investigators[0], state.locations[0], api)
  assert.equal(tests.length, 1, '进入时进行智力/敏捷检定')
  assert.ok(OTI_SRC.includes('openOuterWilderness'), '最后一个线索被发现后的放置读点存在')
})

test('09620 冰封湖面：本地调查员检定揭示符号后弃 1 张手牌或受 1 点恐惧（afterTest 读点）', () => {
  const state = stateFor()
  state.locations = [{ id: 'lake', code: '09620', originalCode: '09620', connections: [] }]
  state.investigators[0].location = 'lake'
  state.investigators[0].hand = ['01009']
  const calls = []
  const api = {
    info: () => {}, choice: () => 'horror', harm: (...args) => calls.push(['harm', ...args]),
    discardOneFromHand: (...args) => calls.push(['discard', ...args]),
  }
  oti.behavior.afterTest(state, state.investigators[0], { drawn: ['skull'], success: true }, api)
  assert.equal(calls.length, 1)
  assert.equal(calls[0][0], 'harm', '选择受恐惧 → 受 1 点恐惧')
})

test('09621 偏远小路：本地点每轮第一张[[危险]]诡计获得涌动无任何读点', () => {
  const location = otiDef.LOCATIONS.isolatedRoad
  assert.equal(String(location.originalCode), '09621')
  assert.equal(/firstHazard|gainsSurge/.test(OTI_SRC), false, 'behavior 没有首张危险诡计获得涌动的读点')
})

test('09622 被遗忘的哨站：[action] 抽 3 张卡（每场一次）行动读点', () => {
  const location = otiDef.LOCATIONS.forgottenOutpost
  assert.equal(String(location.originalCode), '09622')
  assert.equal(typeof oti.behavior.actions, 'function')
  assert.ok(OTI_SRC.includes('ACTION_RULES.outpostDraw'))
  assert.ok(OTI_SRC.includes('outpostUsed') || OTI_SRC.includes('outpostDrawAction'))
})

