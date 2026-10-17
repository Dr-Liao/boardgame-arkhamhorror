import test from 'node:test'
import assert from 'node:assert/strict'
import { contentRegistry, registerContentBundle } from '../content/registered.js'
import { campaignListForUi } from '../content/registry.js'
import { assertScenarioManifest } from '../content/schema.js'
import { scenarioZoneReport } from '../content/scenario-manifest.js'
import { manifest } from '../content/campaigns/theDunwichLegacy/manifest.js'
import { chapters, CHAOS_BAGS } from '../content/campaigns/theDunwichLegacy/shared.js'
import * as university from '../content/campaigns/theDunwichLegacy/scenarios/extracurricularActivity/index.js'
import * as club from '../content/campaigns/theDunwichLegacy/scenarios/theHouseAlwaysWins/index.js'
import { campaignGraph, flowCondition, walkCampaign, enterCampaignNode, validateCampaignGraph } from '../src/campaign/campaign-flow.js'
import { campaignStory, introduction, resolutionStory } from '../src/campaign/story.js'
import { DUNWICH_STORY_TEXT } from '../content/campaigns/theDunwichLegacy/story-text.js'
import { laterBehavior } from '../content/campaigns/theDunwichLegacy/later-behaviors.js'
import { createGameState, applyMove, validateMove, legalMoves } from '../src/engine/engine.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { awardStoryCard, applyCampaignEffect } from '../src/campaign/campaign-effects.js'
import { awardExperience } from '../src/campaign/campaign.js'
import { getAvailability } from '../src/deck/availability.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'

const clone = value => JSON.parse(JSON.stringify(value))
const plainCampaign = () => ({ records: {}, scenarioResults: [] })
function answer(state, id) {
  const choice = state.pendingChoice
  const move = { action: 'choose', choiceId: choice.id, optionId: id }
  assert.equal(validateMove(state, choice.seat, move), null)
  applyMove(state, choice.seat, move)
}
function settle(state) {
  for (let n = 0; state.pendingChoice; n++) {
    assert.ok(n < 40)
    const options = state.pendingChoice.options
    answer(state, options.find(option => ['done', 'skip'].includes(option.id))?.id || options[0].id)
  }
}
function stateFixture() {
  const state = createGameState({ seed: 'dunwich-contract', playerInvestigator: '01001' }, [{ seat: 0 }, { seat: 1 }])
  settle(state)
  state.campaign.chaosBag = [...CHAOS_BAGS.standard]
  state.chaosBag = [...CHAOS_BAGS.standard]
  state.campaign.records = {}
  state.campaign.scenarioResults = []
  return state
}

test('D11 exposes the eight-chapter Dunwich campaign in the hall while keeping encounter cards out of deckbuilding', () => {
  assert.deepEqual(contentRegistry.listScenarios(manifest.id).map(s => s.id), chapters.map(c => c.id))
  assert.equal(contentRegistry.getCampaign(manifest.id).status, 'playable')
  assert.equal(contentRegistry.assertLaunchable(manifest.id).id, manifest.id)
  const launched = createGameState({ campaignId: manifest.id }, [{ seat: 0 }])
  assert.equal(launched.campaign.id, manifest.id)
  assert.ok(campaignListForUi(contentRegistry).some(c => c.id === manifest.id))
  for (const code of ['02001', '02040', '02061', '02080']) assert.equal(getAvailability(code).deckbuilding, false)
  for (const code of ['02020', '02021', '02305']) assert.equal(getAvailability(code).deckbuilding, true)
})

test('D11 later chapters expose original locations, acts and agendas as playable content', () => {
  for (const chapter of chapters.slice(2)) {
    const entry = contentRegistry.getScenario(chapter.id)
    const scenario = contentRegistry.getScenarioData(chapter.id)
    assert.equal(scenario.originalCode, chapter.code)
    assert.equal(entry.status, 'playable')
    assert.ok(entry.locations.length > 0)
    assert.ok(entry.acts.length > 0 && entry.agendas.length > 0)
    assert.ok(entry.requiredMechanicIds.length > 0)
    scenarioZoneReport(scenario, entry)
  }
})

test('D12 imports complete Dunwich introductions and reached resolutions instead of one-line summaries', () => {
  const ids = contentRegistry.getCampaign(manifest.id).scenarioIds
  let importedCharacters = DUNWICH_STORY_TEXT.prologue.paragraphs.join('').length
  for (const id of ids) {
    const scenario = contentRegistry.getScenarioData(id)
    const intro = introduction(scenario, {
      drHenryArmitageWasKidnapped: true, youCalmedTheTownsfolk: true, naomiHasTheInvestigatorsBacks: true,
    })
    assert.ok(intro.paragraphs.join('').length > scenario.intro.length, `${id} 仍在使用单行摘要`)
    importedCharacters += intro.paragraphs.join('').length
    for (const key of Object.keys(scenario.resolutions)) {
      const reached = resolutionStory(scenario, key).paragraphs.join('')
      assert.ok(reached.length > 20, `${id}/${key} 缺少结局正文`)
      importedCharacters += reached.length
    }
  }
  assert.ok(importedCharacters > 12_000, `敦威治正文异常偏少：${importedCharacters}`)
})

test('D12 routed Dunwich no-resolution stories display the reached ending, including old saves', () => {
  const story = (id, context = null, snapshot = null) =>
    resolutionStory(contentRegistry.getScenarioData(id), 'noResolution', snapshot, context)
  const source = DUNWICH_STORY_TEXT.resolutions

  assert.deepEqual(story('theHouseAlwaysWins'), {
    version: 3, title: '结局 1', paragraphs: source.theHouseAlwaysWins.r1,
  })
  assert.deepEqual(story('undimensionedAndUnseen'), {
    version: 3, title: '结局 1', paragraphs: source.undimensionedAndUnseen.r1,
  })
  assert.deepEqual(story('whereDoomAwaits'), {
    version: 3, title: '结局 2', paragraphs: source.whereDoomAwaits.r2,
  })

  const essexPrelude = source.theEssexCountyExpress.noResolution.slice(0, -1)
  assert.deepEqual(story('theEssexCountyExpress'), {
    version: 3, title: '结局 2', paragraphs: [...essexPrelude, ...source.theEssexCountyExpress.r2],
  })

  const lostPrelude = source.lostInTimeAndSpace.noResolution.slice(0, -2)
  assert.deepEqual(story('lostInTimeAndSpace', { actIndex: 3 }), {
    version: 3, title: '结局 2', paragraphs: [...lostPrelude, ...source.lostInTimeAndSpace.r2],
  })
  assert.deepEqual(story('lostInTimeAndSpace', { actIndex: 1 }), {
    version: 3, title: '结局 4', paragraphs: [...lostPrelude, ...source.lostInTimeAndSpace.r4],
  })

  for (const [id, context] of [
    ['theHouseAlwaysWins', null],
    ['theEssexCountyExpress', null],
    ['undimensionedAndUnseen', null],
    ['whereDoomAwaits', null],
    ['lostInTimeAndSpace', { recordsAfter: { yogSothothToreApartTheBarrierBetweenWorldsAndBecameOneWithAllReality: true } }],
  ]) {
    const stale = { version: 3, title: '未达成结局', paragraphs: source[id].noResolution }
    assert.notEqual(story(id, context, stale).title, '未达成结局', id)
  }
})

test('D12 defeated-investigator prelude is retained before an otherwise reached ending', () => {
  const source = DUNWICH_STORY_TEXT.resolutions
  const defeated = { investigators: [{ defeated: true }, { defeated: false }] }
  const active = { investigators: [{ defeated: false }] }

  for (const [id, key, omitted] of [
    ['theEssexCountyExpress', 'r1', 1],
    ['lostInTimeAndSpace', 'r1', 2],
  ]) {
    const scenario = contentRegistry.getScenarioData(id)
    const prelude = source[id].noResolution.slice(0, -omitted)
    assert.deepEqual(resolutionStory(scenario, key, null, defeated).paragraphs, [...prelude, ...source[id][key]])
    assert.deepEqual(resolutionStory(scenario, key, null, active).paragraphs, source[id][key])

    const stale = { version: 3, title: '结局 1', paragraphs: source[id][key] }
    assert.deepEqual(resolutionStory(scenario, key, stale, defeated).paragraphs, [...prelude, ...source[id][key]])
  }
})

test('D12 late-scenario behaviors persist the effective story ending', () => {
  assert.equal(club.behavior.storyResolutionKey({}, 'noResolution'), 'r1')
  const cases = [
    ['theEssexCountyExpress', 0, 'r2'],
    ['undimensionedAndUnseen', 0, 'r1'],
    ['whereDoomAwaits', 0, 'r2'],
    ['lostInTimeAndSpace', 3, 'r2'],
    ['lostInTimeAndSpace', 2, 'r4'],
  ]
  for (const [id, actIndex, expected] of cases) {
    assert.equal(laterBehavior(id).storyResolutionKey({ actIndex }, 'noResolution'), expected, id)
  }
})

test('D12 a fresh Dunwich journal includes the full prologue once with the chosen opening scenario', () => {
  const state = createGameState({ campaignId: manifest.id, campaignHub: true, seed: 'dunwich-story' }, [{ seat: 0 }])
  assert.equal(campaignStory(state, contentRegistry).entries.length, 0)
  applyMove(state, 0, { action: 'hubSelectScenario', scenarioId: 'extracurricularActivity' })
  const fresh = campaignStory(state, contentRegistry).entries
  assert.equal(fresh.length, 1)
  assert.ok(fresh[0].paragraphs.length >= DUNWICH_STORY_TEXT.prologue.paragraphs.length + 1)
  assert.match(fresh[0].paragraphs.join(''), /亨利·阿米蒂奇博士给自己倒了一杯白葡萄酒/)
  const second = introduction(contentRegistry.getScenarioData('theHouseAlwaysWins'), {
    openingScenario: 'extracurricularActivity',
  }).paragraphs.join('')
  assert.doesNotMatch(second, /亨利·阿米蒂奇博士给自己倒了一杯白葡萄酒/)
})

test('D12 the two Dunwich openings are chosen from the case selection page', () => {
  const state = createGameState({ campaignId: manifest.id, campaignHub: true, seed: 'dunwich-opening-choice' }, [{ seat: 0 }])
  assert.equal(state.hubSelectedScenarioId, null)
  assert.equal(state.legalMoves.some(move => move.action === 'hubGoSetup'), false)
  assert.deepEqual(state.legalMoves.filter(move => move.action === 'hubSelectScenario').map(move => move.scenarioId),
    ['extracurricularActivity', 'theHouseAlwaysWins'])

  const clubMove = { action: 'hubSelectScenario', scenarioId: 'theHouseAlwaysWins' }
  assert.equal(validateMove(state, 0, clubMove), null)
  applyMove(state, 0, clubMove)
  assert.equal(state.hubSelectedScenarioId, 'theHouseAlwaysWins')
  assert.equal(state.campaign.records.openingScenario, 'theHouseAlwaysWins')
  assert.equal(state.campaign.flow.nodeId, 'club')
  assert.equal(state.campaign.scenarioIndex, 1)
  assert.ok(state.legalMoves.some(move => move.action === 'hubGoSetup'))
  assert.match(campaignStory(state, contentRegistry).entries.at(-1).paragraphs.join(''), /月下美人/)

  applyMove(state, 0, { action: 'hubSelectScenario', scenarioId: 'extracurricularActivity' })
  assert.equal(state.campaign.records.openingScenario, 'extracurricularActivity')
  assert.equal(state.campaign.flow.nodeId, 'university')
  assert.equal(state.campaign.scenarioIndex, 0)
})

test('D12 story branches show only reached museum, village, survivor and epilogue prose', () => {
  const museum = contentRegistry.getScenarioData('theMiskatonicMuseum')
  const kidnapped = introduction(museum, { drHenryArmitageWasKidnapped: true }).paragraphs.join('')
  const rescued = introduction(museum, { theInvestigatorsRescuedDrHenryArmitage: true }).paragraphs.join('')
  assert.match(kidnapped, /日志中所留下的笔记/)
  assert.doesNotMatch(kidnapped, /我们三个很快就忘了此事/)
  assert.match(rescued, /我们三个很快就忘了此事/)
  assert.doesNotMatch(rescued, /日志中所留下的笔记/)

  const unseen = contentRegistry.getScenarioData('undimensionedAndUnseen')
  const calmed = introduction(unseen, { youCalmedTheTownsfolk: true }).paragraphs.join('')
  const warned = introduction(unseen, { youWarnedTheTownsfolk: true }).paragraphs.join('')
  assert.match(calmed, /冷静下来/); assert.doesNotMatch(calmed, /尽快离开敦威治/)
  assert.match(warned, /尽快离开敦威治/); assert.doesNotMatch(warned, /冷静下来/)

  const state = { uiState: 'campaignResult', campaign: { id: manifest.id, scenarioResults: [],
    records: { sacrificedToYogSothoth: ['02040'], youCalmedTheTownsfolk: true },
    flow: { history: [{ nodeId: 'prologue' }, { nodeId: 'survivors' }, { nodeId: 'epilogue' }] } } }
  const entries = campaignStory(state, contentRegistry).entries
  assert.equal(entries.length, 2)
  assert.doesNotMatch(entries[0].paragraphs.join(''), /比我想像的还要糟糕/)
  assert.match(entries[0].paragraphs.join(''), /莱斯教授擦了擦眼镜/)
  assert.match(entries[1].paragraphs.join(''), /六个月后/)
  assert.doesNotMatch(entries[1].paragraphs.join(''), /金妮跪在地上/)
})

test('D12 existing summary snapshots upgrade to complete Dunwich prose without changing the save', () => {
  const old = { uiState: 'scenarioResult', campaign: { id: manifest.id, records: {}, flow: { history: [] },
    scenarioResults: [{ scenarioId: 'extracurricularActivity', scenarioIndex: 0, resolution: 'r1',
      recordsBefore: {}, investigators: [], introStory: { version: 2, paragraphs: ['旧的一句话导入'] },
      story: { version: 1, paragraphs: ['旧的一句话结局'] } }] } }
  const before = clone(old)
  const entries = campaignStory(old, contentRegistry).entries
  assert.ok(entries.find(entry => entry.kind === 'intro').paragraphs.join('').length > 60)
  assert.ok(entries.find(entry => entry.kind === 'result').paragraphs.join('').length > 300)
  assert.deepEqual(old, before)
})

test('D12 malformed current-version Dunwich snapshots also recover the complete prose', () => {
  const old = { uiState: 'inScenario', scenario: { id: 'extracurricularActivity' },
    scenarioIntro: { version: 3, title: '敦威治遗产 · 课外活动', paragraphs: ['莱斯教授最后出现在米斯卡塔尼克大学。你们来到寂静的校园，开始寻找他的踪迹。'] },
    campaign: { id: manifest.id, records: {}, flow: { history: [] }, scenarioResults: [] } }
  const entry = campaignStory(old, contentRegistry).entries.at(-1)
  assert.ok(entry.paragraphs.length >= DUNWICH_STORY_TEXT.prologue.paragraphs.length + 1)
  assert.match(entry.paragraphs.join(''), /亨利·阿米蒂奇博士给自己倒了一杯白葡萄酒/)
})

for (const [difficulty, count] of [['easy', 15], ['standard', 15], ['hard', 16], ['expert', 17]]) {
  test(`D1 ${difficulty} starts with the original Dunwich chaos bag`, () => {
    assert.equal(CHAOS_BAGS[difficulty].length, count)
    assert.equal(CHAOS_BAGS[difficulty].filter(t => t === 'skull').length, 2)
    assert.equal(CHAOS_BAGS[difficulty].includes('tablet'), false)
    assert.equal(CHAOS_BAGS[difficulty].includes('elderthing'), false)
  })
}

for (const first of ['university', 'club']) test(`D1 ${first} first visits both openings once, then the six later chapters in order`, () => {
  const campaign = plainCampaign(), graph = campaignGraph(manifest), effects = [], visited = []
  let picks = 0
  for (let steps = 0; steps < 40; steps++) {
    const node = walkCampaign(campaign, manifest, () => { picks++; return first }, effect => effects.push(effect))
    if (node.type === 'end') break
    if (node.type === 'scenario') {
      visited.push(node.scenarioId)
      campaign.scenarioResults.push({ scenarioId: node.scenarioId, resolution: node.scenarioId === 'whereDoomAwaits' ? 'r1' : 'r2' })
    }
    enterCampaignNode(campaign, manifest, graph.nodes[node.id].next)
    const restored = clone(campaign)
    const left = [], right = []
    assert.deepEqual(walkCampaign(restored, manifest, () => assert.fail('automatic route asked the player'), e => right.push(e)),
      walkCampaign(campaign, manifest, () => assert.fail('automatic route asked the player'), e => left.push(e)))
    assert.deepEqual(restored, campaign)
    assert.deepEqual(right, left)
    effects.push(...left)
  }
  const opening = first === 'university' ? chapters.slice(0, 2) : [...chapters.slice(0, 2)].reverse()
  assert.deepEqual(visited, [...opening, ...chapters.slice(2)].map(c => c.id))
  assert.equal(picks, 1)
  assert.equal(campaign.records.openingScenario, opening[0].id)
  assert.equal(campaign.records.theInvestigatorsRescuedDrHenryArmitage, true)
  assert.equal(effects.filter(e => e.type === 'storyCard' && e.code === '02040').length, 1)
})

test('D1 automatic routes reject ambiguous or unavailable conditions, and schema checks every exit', () => {
  const copy = clone(manifest)
  copy.flow.nodes.afterUniversity.options[1].when = copy.flow.nodes.afterUniversity.options[0].when
  const campaign = plainCampaign()
  enterCampaignNode(campaign, copy, 'afterUniversity')
  assert.throws(() => walkCampaign(campaign, copy), /没有可用分支/)
  campaign.scenarioResults.push({ scenarioId: 'theHouseAlwaysWins' })
  assert.throws(() => walkCampaign(campaign, copy), /必须唯一/)
  copy.flow.nodes.afterUniversity.options[0].next = 'missing'
  assert.throws(() => validateCampaignGraph(copy), /不存在/)
})

for (const resolution of ['noResolution', 'r1', 'r2', 'r3']) test(`D1 Blood on the Altar ${resolution} routes the second interlude from the actual resolution`, () => {
  const campaign = plainCampaign()
  campaign.scenarioResults.push({ scenarioId: 'bloodOnTheAltar', resolution })
  enterCampaignNode(campaign, manifest, 'afterAltar')
  assert.equal(walkCampaign(campaign, manifest).id, 'beforeBrood')
  assert.equal(!!campaign.flow.visits.survivors, resolution !== 'noResolution')
  assert.equal(flowCondition({ resolution: { scenarioId: 'absent', value: 'noResolution' } }, campaign), false)
})

test('D1 opening zones conserve actual card quantities and do not put the Pit Boss into the encounter deck', () => {
  assert.equal(scenarioZoneReport(university.scenario, university.manifest).encounterCards, 32)
  assert.equal(scenarioZoneReport(club.scenario, club.manifest).encounterCards, 19)
  assert.equal(club.scenario.encounterDeck.includes('02078'), false)
  assert.deepEqual(club.manifest.zones.inPlay, [{ cardCode: '02078', count: 1 }])
  const duplicateBoss = clone(club.manifest)
  duplicateBoss.zones.encounterDeck.push({ cardCode: '02078', count: 1 })
  assert.throws(() => scenarioZoneReport(club.scenario, duplicateBoss), /重复入牌/)
  assert.equal(club.scenario.setAsideEncounterCards.length, 10)
  for (const entry of [university, club]) {
    for (const edge of entry.layout.edges) assert.ok(entry.scenario.locations[edge.from].connections.includes(edge.to))
    for (const card of Object.values(entry.identities).flatMap(Object.values)) assert.ok(ALL_CARDS[card.originalCode])
  }
})

for (const late of [false, true]) test(`D1 university ${late ? 'second' : 'first'} chooses exactly one Faculty Offices variant`, () => {
  const state = { campaign: plainCampaign(), scenario: university.scenario, locationVariants: {} }
  if (late) state.campaign.scenarioResults.push({ scenarioId: 'theHouseAlwaysWins' })
  const plan = university.behavior.setupPlan(state)
  assert.equal(plan.locations.length, 6)
  assert.equal(plan.setAside.length, 7)
  assert.deepEqual(plan.removed, [late ? '02054' : '02055'])
  assert.equal(university.behavior.setupLocations(state).includes('facultyOffices'), false)
  assert.equal(state.locationVariants.facultyOffices.originalCode, late ? '02055' : '02054')
  assert.equal(state.locationVariants.facultyOffices.cluesPerInvestigator, late ? 0 : 2)
  assert.equal(state.locationVariants.facultyOffices.victory, late ? 0 : 1)
  assert.equal(university.scenario.locations.facultyOffices.originalCode, '02054', 'shared content stays immutable')
})

for (const entry of [university, club]) {
  for (const key of ['noResolution', 'r1', 'r2', 'r3', 'r4']) test(`D1 ${entry.scenario.id}/${key} resolution records, rewards and pending story choices survive JSON replay`, () => {
    const state = stateFixture()
    state.scenarioFlags = { cheated: [0] }
    const execute = draft => {
      const api = { addTrauma(s, seat, kind, amount) {
        s.campaign.trauma[seat][kind] += amount
        s.campaign.investigators[seat].trauma[kind] += amount
      } }
      const result = entry.behavior.resolution(draft, key, [], api)
      for (const inv of draft.investigators) awardExperience(draft.campaign, inv.seat, 2 + result.bonus)
    }
    resolveTransaction(state, 0, { action: 'resolveContract' }, execute)
    const restored = clone(state)
    if (state.pendingChoice) {
      assert.equal(state.pendingChoice.kind, 'storyCard')
      const move = { action: 'choose', choiceId: state.pendingChoice.id, optionId: '1' }
      resolveTransaction(state, state.pendingChoice.seat, move, execute)
      resolveTransaction(restored, restored.pendingChoice.seat, move, execute)
    }
    assert.deepEqual(clone(state), restored)
    const records = state.campaign.records, cp = state.campaign
    assert.deepEqual(cp.chaosBag, state.chaosBag)
    if (entry === university) {
      assert.equal(!!records.theInvestigatorsRescuedProfessorWarrenRice, key === 'r1')
      assert.equal(!!records.professorWarrenRiceWasKidnapped, key !== 'r1')
      assert.equal(!!records.theStudentsWereRescued, key === 'r2')
      assert.equal(!!records.theExperimentWasDefeated, key === 'r3')
      assert.equal(!!records.theInvestigatorsFailedToSaveTheStudents, ['noResolution', 'r4'].includes(key))
      assert.equal(cp.chaosBag.filter(t => t === 'tablet').length, ['noResolution', 'r1', 'r4'].includes(key) ? 1 : 0)
      assert.equal(cp.investigators[1].deck.includes('02061'), key === 'r1')
      assert.equal(cp.investigators[0].xp, 2 + (['noResolution', 'r4'].includes(key) ? 1 : 0))
    } else {
      assert.equal(!!records.theInvestigatorsRescuedDrFrancisMorgan, key === 'r2')
      assert.equal(!!records.drFrancisMorganWasKidnapped, key !== 'r2')
      assert.equal(!!records.naomiHasTheInvestigatorsBacks, key === 'r3')
      assert.equal(!!records.oBannionGangHasABoneToPickWithTheInvestigators, key !== 'r3')
      assert.equal(cp.chaosBag.filter(t => t === 'elderthing').length, 1)
      assert.equal(cp.investigators[1].deck.includes('02080'), key === 'r2')
      assert.equal(cp.investigators[0].xp, 2 + (['noResolution', 'r1', 'r4'].includes(key) ? 1 : 0))
      for (const inv of Object.values(cp.investigators)) assert.equal(inv.trauma.physical, key === 'r4' ? 1 : 0)
    }
    assert.equal(!!records.investigatorsWereUnconsciousForSeveralHours, key === 'r4')
  })
}

test('D1 no cheating leaves the elder-thing token out of the bag; unknown outcomes fail before mutation', () => {
  const state = stateFixture()
  club.behavior.resolution(state, 'r1')
  assert.equal(state.chaosBag.includes('elderthing'), false)
  const before = clone(state)
  assert.throws(() => club.behavior.resolution(state, 'r5'), /未知/)
  assert.throws(() => university.behavior.resolution(state, 'r5'), /未知/)
  assert.deepEqual(clone(state), before)
})

for (const kidnapped of [false, true]) test(`D1 Armitage ${kidnapped ? 'kidnapped' : 'rescued'} rewards apply once across save/restore`, () => {
  const state = stateFixture()
  state.campaign.records.investigatorsWereUnconsciousForSeveralHours = kidnapped
  enterCampaignNode(state.campaign, manifest, 'armitagesFate')
  const execute = draft => walkCampaign(draft.campaign, manifest, () => assert.fail('automatic branch'),
    effect => applyCampaignEffect(draft, effect, () => {}))
  resolveTransaction(state, 0, { action: 'interludeContract' }, execute)
  const copy = clone(state)
  if (!kidnapped) {
    assert.equal(state.pendingChoice.source, '02040')
    const move = { action: 'choose', choiceId: state.pendingChoice.id, optionId: '0' }
    resolveTransaction(state, 0, move, execute)
    resolveTransaction(copy, 0, move, execute)
  }
  assert.deepEqual(clone(state), clone(copy))
  resolveTransaction(state, 0, { action: 'readAgain' }, execute)
  assert.equal(state.campaign.flow.nodeId, 'beforeMuseum')
  for (const inv of Object.values(state.campaign.investigators)) assert.equal(inv.xp, kidnapped ? 2 : 0)
  assert.equal(state.campaign.investigators[0].deck.filter(c => c === '02040').length, kidnapped ? 0 : 1)
  assert.equal(!!state.campaign.records.drHenryArmitageWasKidnapped, kidnapped)
  assert.equal(!!state.campaign.records.theInvestigatorsRescuedDrHenryArmitage, !kidnapped)
})

test('D1 story asset can be declined and cannot be awarded twice or to an eliminated investigator', () => {
  const state = stateFixture()
  state.campaign.investigators[1].status = 'killed'
  const execute = draft => awardStoryCard(draft, '02061', 'contract')
  resolveTransaction(state, 0, { action: 'award' }, execute)
  assert.deepEqual(state.pendingChoice.options.map(o => o.id), ['skip', '0'])
  resolveTransaction(state, 0, { action: 'choose', choiceId: state.pendingChoice.id, optionId: 'skip' }, execute)
  assert.equal(state.campaign.investigators[0].deck.includes('02061'), false)
  resolveTransaction(state, 0, { action: 'award' }, execute)
  resolveTransaction(state, 0, { action: 'choose', choiceId: state.pendingChoice.id, optionId: '0' }, execute)
  resolveTransaction(state, 0, { action: 'award' }, execute)
  assert.equal(state.pendingChoice, null)
  assert.equal(state.campaign.investigators[0].deck.filter(c => c === '02061').length, 1)
})

// An isolated test campaign exercises the production setup / mulligan / resign
// path. It does not promote the registered Dunwich campaign or certify gameplay.
for (const [index, entry] of [university, club].entries()) test(`D1 ${entry.scenario.id} uses the existing engine setup and resignation transaction`, () => {
  const id = `dunwichSetupContract${index}`, campaignId = `dunwichContract${index}`
  const core = contentRegistry.getCampaign('nightOfTheZealot')
  registerContentBundle({
    campaigns: [{ ...core, id: campaignId, chaosBags: CHAOS_BAGS, requiredPackIds: ['core', 'dunwichContractPack'],
      recordSchema: manifest.recordSchema, scenarioIds: [id], unlock: { [id]: [] },
      flow: { start: id, nodes: { [id]: { type: 'scenario', scenarioId: id, next: 'end' }, end: { type: 'end' } } } }],
    ...(index === 0 ? { packs: [{ ...contentRegistry.getPack('dunwichCampaign'), id: 'dunwichContractPack', status: 'playable' }] } : {}),
    scenarios: [{ scenario: { ...entry.scenario, id }, behavior: { ...entry.behavior, id },
      manifest: { ...entry.manifest, id, campaignId, status: 'playable', requiredMechanicIds: [],
        requiredPackIds: ['core', 'dunwichContractPack'], behaviorIds: [id] } }],
  })
  const state = createGameState({ campaignId, seed: id, playerInvestigator: '01001' }, [{ seat: 0 }])
  assert.equal(state.pendingChoice.kind, 'mulligan')
  const copy = clone(state)
  settle(state); settle(copy)
  assert.deepEqual(clone(state), clone(copy))
  assert.equal(state.locations.length, index === 0 ? 6 : 4)
  assert.equal(state.encounterDeck.length, index === 0 ? 32 : 19)
  assert.equal(state.investigators[0].location, entry.scenario.startLocation)
  assert.deepEqual(state.chaosBag, CHAOS_BAGS.standard)
  if (index === 1) {
    assert.equal(state.enemies.length, 1)
    assert.equal(state.enemies[0].code, '02078')
    assert.equal(state.enemies[0].location, 'cloverClubLounge')
    assert.equal(state.enemies[0].aloof, true)
  }
  const resign = legalMoves(state).find(move => move.action === 'resign')
  assert.ok(resign)
  assert.equal(resign.locationId, state.investigators[0].location)
  assert.equal(validateMove(state, 0, resign), null)
  applyMove(state, 0, resign)
  settle(state)
  assert.equal(state.campaign.scenarioResults[0].resolution, index === 1 ? 'r1' : 'noResolution')
  assert.equal(state.campaign.investigators[0].xp, 1)
})
