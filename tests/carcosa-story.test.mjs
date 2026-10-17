import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { contentRegistry } from '../content/registered.js'
import { manifest } from '../content/campaigns/thePathToCarcosa/manifest.js'
import { CARCOSA_STORY_TEXT } from '../content/campaigns/thePathToCarcosa/story-text.js'
import { campaignStory, introduction, resolutionStory } from '../src/campaign/story.js'
import { applyMove, createGameState, decisionSeat, validateMove } from '../src/engine/engine.js'

const ids = [
  'curtainCall', 'theLastKing', 'echoesOfThePast', 'theUnspeakableOath',
  'aPhantomOfTruth', 'thePallidMask', 'blackStarsRise', 'dimCarcosa',
]

test('卡尔克萨八章投影完整导入而非 definition 摘要', () => {
  for (const id of ids) {
    const scenario = contentRegistry.getScenarioData(id)
    const story = introduction(scenario)
    assert.ok(story.paragraphs.length > 0, id)
    assert.ok(story.paragraphs.join('').length > scenario.intro.length + 20, id)
    assert.doesNotMatch(story.paragraphs.join(''), /<[^>]+>/)
  }
  const curtain = introduction(contentRegistry.getScenarioData('curtainCall'))
  assert.ok(curtain.paragraphs.includes(CARCOSA_STORY_TEXT.prologue.common[0]))
  assert.ok(curtain.paragraphs.includes(CARCOSA_STORY_TEXT.introductions.curtainCall.common[0]))
})

test('萝拉与各章条件信息只投影实际到达分支', () => {
  const curtain = contentRegistry.getScenarioData('curtainCall')
  const ordinary = introduction(curtain, {}, { campaign: { investigators: { 0: { code: '03001' } } } })
  const lola = introduction(curtain, {}, { campaign: { investigators: { 0: { code: '03006' } } } })
  assert.ok(!ordinary.paragraphs.includes(CARCOSA_STORY_TEXT.prologue.lola[0]))
  assert.ok(lola.paragraphs.includes(CARCOSA_STORY_TEXT.prologue.lola[0]))

  const echoes = contentRegistry.getScenarioData('echoesOfThePast')
  const withoutSebastien = introduction(echoes, { vipsInterviewed: [] })
  const withSebastien = introduction(echoes, { vipsInterviewed: ['03079'] })
  assert.ok(!withoutSebastien.paragraphs.includes(CARCOSA_STORY_TEXT.introductions.echoesOfThePast.sebastiensInformation[0]))
  assert.ok(withSebastien.paragraphs.includes(CARCOSA_STORY_TEXT.introductions.echoesOfThePast.sebastiensInformation[0]))

  const oath = contentRegistry.getScenarioData('theUnspeakableOath')
  const defaultRoute = introduction(oath, {})
  const foundRoute = introduction(oath, { theFollowersOfTheSignHaveFoundTheWayForward: true })
  assert.ok(defaultRoute.paragraphs.includes(CARCOSA_STORY_TEXT.introductions.theUnspeakableOath.didNotFindTheWayForward[0]))
  assert.ok(!defaultRoute.paragraphs.includes(CARCOSA_STORY_TEXT.introductions.theUnspeakableOath.foundTheWayForward[0]))
  assert.ok(foundRoute.paragraphs.includes(CARCOSA_STORY_TEXT.introductions.theUnspeakableOath.foundTheWayForward[0]))
})

test('真相幻影只展示实际梦境路径', () => {
  const scenario = contentRegistry.getScenarioData('aPhantomOfTruth')
  const context = { scenarioFlags: { dreamLog: ['dream1', 'dream4', 'dream6', 'dream8', 'dream10', 'dream12', 'dream13'] } }
  const story = introduction(scenario, { youSlayedTheMonstersAtTheDinnerParty: true }, context)
  const source = CARCOSA_STORY_TEXT.introductions.aPhantomOfTruth
  assert.ok(story.paragraphs.includes(source.dreams.dream4[0]))
  assert.ok(story.paragraphs.includes(source.dreams.dream12[0]))
  assert.ok(!story.paragraphs.includes(source.dreams.dream3[0]))
  assert.ok(!story.paragraphs.includes(source.dreams.dream11[0]))

  const claimed = introduction(scenario, {
    theKingClaimedItsVictims: true,
    chasingTheStranger: 5,
  }, { scenarioFlags: { dreamLog: ['dream1', 'dream8', 'dream10'] } })
  assert.ok(!claimed.paragraphs.includes(source.dream6[0]))
  assert.ok(!claimed.paragraphs.includes(source.dreams.dream11[0]))
  assert.ok(!claimed.paragraphs.includes(source.dreams.dream12[0]))
})

test('全部二十九个卡尔克萨结局使用完整正文且不泄露其他结局', () => {
  let count = 0
  for (const id of ids) {
    const scenario = contentRegistry.getScenarioData(id)
    for (const key of Object.keys(CARCOSA_STORY_TEXT.resolutions[id])) {
      const story = resolutionStory(scenario, key)
      const expected = id === 'theUnspeakableOath' && key === 'noResolution'
        ? [...CARCOSA_STORY_TEXT.resolutions[id].noResolution, ...CARCOSA_STORY_TEXT.resolutions[id].r1]
        : CARCOSA_STORY_TEXT.resolutions[id][key]
      assert.deepEqual(story.paragraphs, expected, `${id}/${key}`)
      assert.notDeepEqual(story.paragraphs, [scenario.resolutions[key]], `${id}/${key}`)
      for (const [otherKey, paragraphs] of Object.entries(CARCOSA_STORY_TEXT.resolutions[id])) {
        const routedOathEnding = id === 'theUnspeakableOath' && key === 'noResolution' && otherKey === 'r1'
        if (otherKey !== key && !routedOathEnding) {
          assert.ok(!story.paragraphs.includes(paragraphs[0]), `${id}/${key} leaked ${otherKey}`)
        }
      }
      count++
    }
    if (!CARCOSA_STORY_TEXT.resolutions[id].noResolution && scenario.resolutions.noResolution) {
      const behavior = contentRegistry.getBehavior(id)
      assert.equal(typeof behavior.storyResolutionKey, 'function', `${id}/noResolution`)
      const key = behavior.storyResolutionKey({
        investigators: [{ resigned: false }],
        campaign: { records: { conviction: 0, doubt: 0 } },
      }, 'noResolution')
      assert.ok(CARCOSA_STORY_TEXT.resolutions[id][key], `${id}/noResolution -> ${key}`)
    }
  }
  assert.equal(count, 29)
})

test('动态未达成结局按当时状态投影实际正文，邪秽誓约叠加被击败段落', () => {
  const story = (id, context) => resolutionStory(
    contentRegistry.getScenarioData(id), 'noResolution', null, context,
  ).paragraphs
  assert.deepEqual(story('theLastKing', { investigators: [{ resigned: true }] }),
    CARCOSA_STORY_TEXT.resolutions.theLastKing.r1)
  assert.deepEqual(story('theLastKing', { investigators: [{ defeated: true }] }),
    CARCOSA_STORY_TEXT.resolutions.theLastKing.r2)
  assert.deepEqual(story('echoesOfThePast', {}), CARCOSA_STORY_TEXT.resolutions.echoesOfThePast.r4)
  assert.deepEqual(story('blackStarsRise', {}), CARCOSA_STORY_TEXT.resolutions.blackStarsRise.r3)
  assert.deepEqual(story('dimCarcosa', { records: { conviction: 3, doubt: 2 } }),
    CARCOSA_STORY_TEXT.resolutions.dimCarcosa.r4)
  assert.deepEqual(story('dimCarcosa', { records: { conviction: 2, doubt: 3 } }),
    CARCOSA_STORY_TEXT.resolutions.dimCarcosa.r5)
  assert.deepEqual(story('theUnspeakableOath', { investigators: [{ defeated: true }] }), [
    ...CARCOSA_STORY_TEXT.resolutions.theUnspeakableOath.noResolution,
    ...CARCOSA_STORY_TEXT.resolutions.theUnspeakableOath.r1,
  ])
  assert.deepEqual(resolutionStory(contentRegistry.getScenarioData('theUnspeakableOath'), 'r2', null, {
    investigators: [{ defeated: true }, { resigned: true }],
  }).paragraphs, [
    ...CARCOSA_STORY_TEXT.resolutions.theUnspeakableOath.noResolution,
    ...CARCOSA_STORY_TEXT.resolutions.theUnspeakableOath.r2,
  ])
})

test('缺少旧嵌套上下文时保留已保存的动态结局，并以结算后记录回退', () => {
  const lastKing = contentRegistry.getScenarioData('theLastKing')
  const saved = {
    version: 3,
    title: '结局 1',
    paragraphs: CARCOSA_STORY_TEXT.resolutions.theLastKing.r1,
  }
  assert.deepEqual(resolutionStory(lastKing, 'noResolution', saved), saved)

  const dim = resolutionStory(contentRegistry.getScenarioData('dimCarcosa'), 'noResolution', null, {
    recordsAfter: { conviction: 1, doubt: 2 },
  })
  assert.equal(dim.title, '结局 5')
  assert.deepEqual(dim.paragraphs, CARCOSA_STORY_TEXT.resolutions.dimCarcosa.r5)
})

test('真相幻影前导在调查员准备后执行，乔丹资源不会被重置', () => {
  const move = (state, command) => {
    const seat = decisionSeat(state)
    assert.equal(validateMove(state, seat, command), null)
    return applyMove(state, seat, command)
  }
  const state = createGameState({
    campaignId: 'thePathToCarcosa',
    campaignHub: true,
    seed: 'carcosa-phantom-story-order',
  }, [{ seat: 0, role: 'human' }])
  move(state, { action: 'hubGoSetup' })
  move(state, { action: 'hubSelectInvestigator', code: '01001' })
  move(state, { action: 'hubAutoDeck' })
  move(state, { action: 'hubDoneSeat' })
  state.campaign.flow = {
    nodeId: 'aPhantomOfTruth',
    visits: { aPhantomOfTruth: 1 },
    history: [{ nodeId: 'aPhantomOfTruth', visit: 1, effectsApplied: true }],
  }
  state.campaign.scenarioIndex = 4
  state.hubSelectedScenarioId = 'aPhantomOfTruth'
  state.campaign.records.theKingClaimedItsVictims = true
  state.campaign.records.vipsInterviewed = ['03077']
  move(state, { action: 'hubBeginScenario' })
  assert.equal(state.scenario.id, 'aPhantomOfTruth')
  assert.equal(state.investigators[0].resources, 8)
  assert.ok(state.scenarioFlags.dreamLog.includes('jordansInformation'))
})

test('幕间按保存的访问选择展开完整正文', () => {
  const campaign = {
    id: 'thePathToCarcosa',
    records: { danielStatus: 'possessed' },
    scenarioResults: [],
    flow: { history: [
      { nodeId: 'interludeOne', visit: 1, choice: 'burn', storyText: '旧摘要' },
      { nodeId: 'interludeTwo', visit: 1, choice: 'heed', storyText: '旧摘要' },
    ] },
    finished: true,
  }
  const entries = campaignStory({ campaign, uiState: 'campaignResult' }, contentRegistry).entries
  assert.deepEqual(entries[0].paragraphs, CARCOSA_STORY_TEXT.interludes.interludeOne.burn)
  assert.deepEqual(entries[1].paragraphs, [
    ...CARCOSA_STORY_TEXT.interludes.interludeTwo.danielWasPossessed,
    ...CARCOSA_STORY_TEXT.interludes.interludeTwo.heed,
  ])
  assert.ok(!JSON.stringify(entries).includes(CARCOSA_STORY_TEXT.interludes.interludeOne.flee[0]))
})

test('旧摘要存档按当时记录升级，秘密尾声不进入公共纪事', () => {
  const scenario = contentRegistry.getScenarioData('echoesOfThePast')
  const state = {
    uiState: 'scenarioResult',
    campaign: {
      id: 'thePathToCarcosa',
      records: {},
      flow: { history: [{ nodeId: 'echoesOfThePast', visit: 1 }] },
      scenarioResults: [{
        scenarioId: scenario.id,
        visitId: 'echoesOfThePast:1',
        resolution: 'r1',
        introStory: { version: 3, paragraphs: [scenario.intro] },
        recordsBefore: { vipsInterviewed: ['03079'] },
        investigators: [],
      }],
    },
  }
  const introEntry = campaignStory(state, contentRegistry).entries.find(entry => entry.kind === 'intro')
  assert.ok(introEntry.paragraphs.includes(CARCOSA_STORY_TEXT.introductions.echoesOfThePast.sebastiensInformation[0]))
  const before = structuredClone(state)
  state.campaign.scenarioResults[0].story = { version: 2, title: '旧结局', paragraphs: ['旧结局摘要'] }
  const resultEntry = campaignStory(state, contentRegistry).entries.find(entry => entry.kind === 'result')
  assert.deepEqual(resultEntry.paragraphs, CARCOSA_STORY_TEXT.resolutions.echoesOfThePast.r1)
  assert.deepEqual(state.campaign.scenarioResults[0].story.paragraphs, ['旧结局摘要'])
  state.campaign.scenarioResults[0].story = before.campaign.scenarioResults[0].story
  const epilogue = manifest.flow.nodes.possessedEpilogue
  assert.equal(epilogue.text, undefined)
  assert.ok(epilogue.effects[0].text.length > 100)
  assert.equal(epilogue.effects[0].audienceRecord, 'possessed')

  const privateState = {
    uiState: 'campaignResult',
    campaign: {
      id: 'thePathToCarcosa',
      records: {},
      investigators: {
        0: { id: 'inv-0', seat: 0 },
        1: { id: 'inv-1', seat: 1 },
      },
      scenarioResults: [],
      flow: { history: [] },
      finished: true,
      privateStories: [{
        id: 'carcosaPossessedEpilogue',
        title: epilogue.effects[0].title,
        text: epilogue.effects[0].text,
        audienceInvestigatorIds: ['inv-0'],
      }],
    },
  }
  assert.ok(campaignStory(privateState, contentRegistry, 0).entries.some(entry => entry.id.startsWith('private:')))
  assert.ok(!campaignStory(privateState, contentRegistry, 1).entries.some(entry => entry.id.startsWith('private:')))
  assert.ok(!campaignStory(privateState, contentRegistry).entries.some(entry => entry.id.startsWith('private:')))
})

test('卡尔克萨叙事生成器拒绝未知、重复和组合模式参数', () => {
  const script = fileURLToPath(new URL('../tools/import-carcosa-story.mjs', import.meta.url))
  const run = (...args) => spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' })
  assert.equal(run('--check').status, 0)
  assert.notEqual(run('--unknown').status, 0)
  assert.notEqual(run('--write', '--check').status, 0)
  assert.notEqual(run('--check', '--check').status, 0)
})
