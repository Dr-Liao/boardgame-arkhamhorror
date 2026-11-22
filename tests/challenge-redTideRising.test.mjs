// 批次 4 · 调查员挑战：红潮涌起（Red Tide Rising · 90041 / campaign redTideRising）。
//
// 真实引擎验收：独立开局（温蒂限制 / 起始 XP / 四档难度袋）→ 布置（7/8 地点、Leads deck 首张、
// 嫌疑犯/藏身处、放一边怪物、双面神秘相片）→ 幕 1 清空迹象牌堆 → 结局 1 与记录；
// 另验议程 1 的「将要推进 → 移除毁灭 + 洗入怪物」、议程 2 → 结局 2、温蒂被击败 → 结局 2、
// 以及存档 JSON 往返。
//
// 本文件在 import 引擎之前先把挑战内容注册进内容注册表：src/engine/card-lookup.js
// 在模块加载时从 contentRegistry 合并遭遇定义，晚注册的剧本拿不到本关敌人定义。
import test from 'node:test'
import assert from 'node:assert/strict'
import { contentRegistry, registerContentBundle } from '../content/registered.js'
import { createContentRegistry } from '../content/registry.js'
import { manifest as campaign } from '../content/campaigns/redTideRising/manifest.js'
import * as moduleEntry from '../content/campaigns/redTideRising/scenarios/redTideRising/index.js'

const scenarioEntry = moduleEntry.default ?? moduleEntry
const {
  ENCOUNTER_DECK, HIDEOUT_CODES, SUSPECT_CODES, SUSPECT_HOME_LOCATIONS, LOCATION_TABLE,
  MONSTER_CODES, behavior,
} = moduleEntry

test('红潮涌起注册期校验：内容包、遭遇组与剧本身份', () => {
  const registry = createContentRegistry({
    packs: contentRegistry.listPacks(), campaigns: [campaign], scenarios: [scenarioEntry],
  })
  assert.equal(registry.assertLaunchable('redTideRising').id, 'redTideRising')
  const manifestScenario = registry.getScenario('redTideRising')
  assert.equal(manifestScenario.referenceCode, '90041')
  assert.deepEqual(manifestScenario.resolutionIds, ['noResolution', 'resolution1', 'resolution2'])
  // 批次 2 Lead 裁决口径：挑战独立难度四档（side-stories.json difficultyLevels）。
  assert.deepEqual(Object.keys(campaign.chaosBags).sort(), ['easy', 'expert', 'hard', 'standard'])
  assert.equal(campaign.chaosBags.easy.length, 18)
  assert.equal(campaign.chaosBags.standard.length, 18)
  assert.equal(campaign.chaosBags.hard.length, 18)
  assert.equal(campaign.chaosBags.expert.length, 17)
  assert.throws(() => createContentRegistry({
    packs: contentRegistry.listPacks(),
    campaigns: [{ ...campaign, requiredPackIds: ['core', 'missingPack'] }],
    scenarios: [scenarioEntry],
  }), /缺少卡包/)
  assert.throws(() => createContentRegistry({
    packs: contentRegistry.listPacks(), campaigns: [campaign],
    scenarios: [{ ...scenarioEntry, manifest: { ...scenarioEntry.manifest, requiredEncounterGroupIds: ['missingGroup'] } }],
  }), /缺少遭遇组/)
})

// 生产组合根已注册该挑战时直接复用；单独运行本文件时临时注册夹具。
if (!contentRegistry.getCampaign(campaign.id)) registerContentBundle({ campaigns: [campaign], scenarios: [scenarioEntry] })

const engine = await import('../src/engine/engine.js')
const deckbuilding = await import('../src/deck/deckbuilding.js')
const { migrateState } = await import('../src/engine/save-migration.js')
const { viewState } = await import('../src/integration/observation.js')
const { INVESTIGATORS } = await import('../src/cards/cards-data.js')

const players = [{ seat: 0, role: 'human' }]
const send = (state, action) => { move(state, { action }); settle(state) }
function move(state, command) {
  const seat = engine.decisionSeat(state)
  assert.equal(engine.validateMove(state, seat, command), null, JSON.stringify(command))
  return engine.applyMove(state, seat, command)
}
function settle(state, select = () => null) {
  for (let i = 0; state.pendingChoice; i++) {
    assert.ok(i < 150, `Choice loop: ${state.pendingChoice.kind}`)
    const choice = state.pendingChoice
    const id = select(choice, state) ?? ['done', 'skip', 'self'].find(candidate =>
      choice.options.some(option => option.id === candidate)) ?? choice.options[0]?.id
    assert.ok(id != null, JSON.stringify(choice))
    move(state, { action: 'choose', choiceId: choice.id, optionId: id })
  }
}
function deckCodes() {
  return [...deckbuilding.buildDeck(INVESTIGATORS['90037']).playerCards]
}
function enterScenario(state) {
  send(state, 'hubGoSetup')
  move(state, { action: 'hubSelectInvestigator', code: '90037' })
  move(state, { action: 'hubSetDeck', codes: deckCodes() })
  for (const action of ['hubConfirmDeck', 'hubDoneSeat', 'hubBeginScenario']) send(state, action)
}
function makeState(seed = 'red-tide-rising') {
  const state = engine.createGameState({ campaignId: 'redTideRising', campaignHub: true, difficulty: 'standard', seed }, players)
  settle(state)
  return state
}
function leadsPile(state) {
  return state.scenarioFlags?.mechanics?.scenarioDecks?.leads
}

test('红潮涌起：独立开局限制、起始 XP、布置与 Leads deck 首张', () => {
  assert.throws(() => engine.createGameState({ campaignId: 'redTideRising', playerInvestigator: '01001' }, players), /不能使用|要求包含指定调查员/)
  assert.throws(() => engine.createGameState({ campaignId: 'redTideRising' }, [...players, { seat: 1 }]), /不足|要求包含指定调查员/)
  const state = makeState('red-tide-rising-setup')
  assert.equal(state.campaign.opening.experience, 3)
  assert.equal(viewState(state, 0).campaign.opening.experience, 3)
  send(state, 'hubGoSetup')
  // 批次 4：指定调查员必须在场，其余席位任意（其他可选调查员也进入候选）。
  const investigatorOptions = engine.legalMoves(state).filter(row => row.action === 'hubSelectInvestigator').map(row => row.code)
  assert.ok(investigatorOptions.includes('90037'), '必须包含指定调查员温蒂')
  assert.ok(investigatorOptions.length > 1, '其余调查员可选')
  move(state, { action: 'hubSelectInvestigator', code: '90037' })
  move(state, { action: 'hubSetDeck', codes: deckCodes() })
  for (const action of ['hubConfirmDeck', 'hubDoneSeat', 'hubBeginScenario']) send(state, action)
  assert.equal(state.difficulty, 'standard')
  assert.equal(state.chaosBag.length, 18)
  // 布置：7 个固定地点；若首张线索是藏身处则 +1 地点；温蒂从首张线索处开始。
  const firstLead = state.scenarioFlags.firstLead
  const hideoutLocated = HIDEOUT_CODES.includes(firstLead)
  assert.ok([...SUSPECT_CODES, ...HIDEOUT_CODES].includes(firstLead))
  assert.equal(state.locations.length, hideoutLocated ? 8 : 7)
  assert.equal(state.investigators[0].location,
    hideoutLocated ? LOCATION_TABLE.find(([, code]) => code === firstLead)[0]
      : SUSPECT_HOME_LOCATIONS[firstLead])
  assert.equal(state.locations.find(location => location.id === 'innsmouthSquare').revealed, true)
  // 首张是嫌疑犯时它已在场并带 1[per_investigator] 线索；否则藏身处已入场。
  const suspect = state.enemies.find(enemy => SUSPECT_CODES.includes(enemy.code))
  if (hideoutLocated) assert.equal(suspect, undefined)
  else assert.equal(suspect?.clues, 1)
  // Leads deck：12 张抽走首张后剩 11 张。
  assert.equal(leadsPile(state)?.deck.length, 11)
  // 放一边：愤怒暴民 + 3 只怪物（藏在 scenarioZones.setAside）。
  const aside = state.scenarioZones?.setAside || []
  assert.ok(aside.includes('07062b'))
  for (const code of MONSTER_CODES) assert.ok(aside.includes(code))
  // 神秘相片在温蒂控制下。
  const photo = (state.storyAssets || []).find(asset => asset.code === '90045a' || asset.code === '90045b')
  assert.ok(photo)
  assert.equal(photo.controllerSeat, 0)
  assert.equal(state.encounterDeck.length, ENCOUNTER_DECK.length)
  // 存档 JSON 往返。
  const saved = JSON.parse(JSON.stringify(state))
  migrateState(saved)
  assert.equal(saved.locations.length, state.locations.length)
  assert.equal(saved.scenarioFlags.firstLead, firstLead)
  assert.equal(viewState(saved, 0).campaign.opening.experience, 3)
})

test('红潮涌起：清空迹象牌堆 → 幕 1 推进 → 结局 1 与记录', () => {
  const state = makeState('red-tide-rising-win')
  enterScenario(state)
  assert.equal(state.status, 'playing')
  leadsPile(state).deck.length = 0
  move(state, { action: 'debug', kind: 'advanceAct' })
  settle(state)
  assert.equal(state.campaign.scenarioResults.length, 1)
  assert.equal(state.campaign.scenarioResults[0].resolution, 'resolution1')
  assert.equal(state.campaign.records.redTideRisingResolution, 'resolution1')
  assert.equal(state.campaign.records.redTideRisingVictoryCards, 0)
  // 起始经验 3 保留；胜利区为空则没有额外经验。
  assert.equal(state.campaign.investigators[0].earnedXp, 3)
  const saved = JSON.parse(JSON.stringify(state))
  migrateState(saved)
  assert.equal(saved.campaign.scenarioResults[0].resolution, 'resolution1')
})

test('红潮涌起：议程 1 将要推进时改为移除毁灭并洗入放一边的怪物', () => {
  const state = makeState('red-tide-rising-agenda')
  enterScenario(state)
  const asideBefore = (state.scenarioZones?.setAside || []).filter(code => MONSTER_CODES.includes(code)).length
  assert.equal(asideBefore, 3)
  const stub = {
    info: () => {},
    clearDoom: () => { state.doom = 0; for (const card of state.locations || []) card.doom = 0 },
    random: () => 0,
  }
  // 前三次「将要推进」都被替换：移除毁灭 + 把一只怪物洗入迹象牌堆。
  for (let index = 3; index > 0; index -= 1) {
    assert.equal(behavior.agendaWouldAdvance(state, stub), true)
    const left = (state.scenarioZones.setAside || []).filter(code => MONSTER_CODES.includes(code)).length
    assert.equal(left, index - 1)
    assert.equal(state.doom, 0)
  }
  // 放一边的怪物耗尽后允许正常推进。
  assert.equal(behavior.agendaWouldAdvance(state, stub), false)
  // 真引擎推进议程 1：翻面生成愤怒暴民 + 给嫌犯/窝点放线索。
  move(state, { action: 'debug', kind: 'advanceAgenda' })
  settle(state)
  assert.equal(state.agendaIndex, 1)
  assert.equal(state.agendas[state.agendaIndex].code, '90043')
  const mob = state.enemies.find(enemy => enemy.code === '07062b')
  assert.ok(mob, '议程 1 背面应生成愤怒暴民')
  assert.equal(mob.location, 'innsmouthSquare')
  assert.equal(mob.exhausted, true)
  // 议程 2 推进 → 结局 2。
  move(state, { action: 'debug', kind: 'advanceAgenda' })
  settle(state)
  assert.equal(state.campaign.scenarioResults.length, 1)
  assert.equal(state.campaign.scenarioResults[0].resolution, 'resolution2')
  assert.equal(state.campaign.records.redTideRisingResolution, 'resolution2')
})

test('红潮涌起：温蒂·亚当斯被击败 → 结局 2（noResolution 口径）', () => {
  const state = makeState('red-tide-rising-defeat')
  enterScenario(state)
  move(state, { action: 'debug', kind: 'harm', targetSeat: 0, damage: 99 })
  settle(state)
  assert.equal(state.campaign.scenarioResults.length, 1)
  assert.equal(state.campaign.scenarioResults[0].resolution, 'resolution2')
  assert.equal(state.campaign.records.redTideRisingResolution, 'resolution2')
  assert.equal(state.campaign.finished, true)
})

test('红潮涌起：混乱标记说明随难度切换（90041 提示卡）', () => {
  const hard = behavior.tokenMeanings({ difficulty: 'hard', victoryDisplay: [], scenarioFlags: {} })
  const standard = behavior.tokenMeanings({ difficulty: 'standard', victoryDisplay: [], scenarioFlags: {} })
  assert.match(hard.skull.text, /胜利区/)
  assert.match(standard.skull.text, /一半/)
  assert.equal(hard.tablet.delta, -4)
  assert.equal(standard.tablet.delta, -3)
  assert.equal(behavior.resolveChaosToken({ difficulty: 'standard', victoryDisplay: [] }, null, 'cultist').delta, -2)
  assert.equal(behavior.resolveChaosToken({ difficulty: 'hard', victoryDisplay: [] }, null, 'cultist').delta, -3)
})

void LOCATION_TABLE
