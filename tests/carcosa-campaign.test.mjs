import test from 'node:test'
import assert from 'node:assert/strict'
import { manifest } from '../content/campaigns/thePathToCarcosa/manifest.js'
import { flowCondition, validateCampaignGraph, walkCampaign, enterCampaignNode } from '../src/campaign/campaign-flow.js'
import { applyCampaignEffect } from '../src/campaign/campaign-effects.js'
import { campaignView } from '../src/campaign/campaign.js'

const campaign = () => ({
  id: manifest.id,
  leadSeat: 0,
  records: {
    doubt: 0,
    conviction: 0,
    vipsSlain: [],
    possessed: [],
    danielStatus: '',
  },
  chaosBag: ['0', 'cultist', 'tablet', 'elderthing'],
  scenarioResults: [],
  investigators: {
    0: { id: 'mark', seat: 0, name: 'Mark', status: 'active', deck: [], purchases: [],
      removedCards: [], xp: 0, earnedXp: 0 },
    1: { id: 'minh', seat: 1, name: 'Minh', status: 'active', deck: [], purchases: [],
      removedCards: [], xp: 0, earnedXp: 0 },
  },
  retired: [],
})

const stateFor = cp => ({ campaign: cp, chaosBag: [...cp.chaosBag] })
const apply = state => effect => applyCampaignEffect(state, effect, () => {})

test('Carcosa flow contains exactly eight scenarios and two conditional narrative interludes', () => {
  const graph = validateCampaignGraph(manifest)
  assert.deepEqual(Object.values(graph.nodes).filter(node => node.type === 'scenario').map(node => node.scenarioId),
    manifest.scenarioIds)
  assert.equal(graph.nodes.interludeOne.type, 'choice')
  assert.equal(graph.nodes.interludeTwo.type, 'choice')
  assert.equal(graph.nodes.afterLastKing.options[0].when.resolution.value, 'r1')
  assert.deepEqual(graph.nodes.afterOath.options[0].when.any.map(condition => condition.resolution.value),
    ['r2', 'r3'])
})

test('Interlude I choices atomically replace the symbol family and union slain VIP ids', () => {
  const cp = campaign()
  cp.scenarioResults.push({ scenarioId: 'theLastKing', resolution: 'r1' })
  const state = stateFor(cp)
  enterCampaignNode(cp, manifest, 'interludeOne')
  const result = walkCampaign(cp, manifest, () => 'burn', apply(state))
  assert.equal(result.id, 'beforeEchoes')
  assert.equal(cp.records.youSlayedTheMonstersAtTheDinnerParty, true)
  assert.equal(cp.records.conviction, 1)
  assert.deepEqual(cp.records.vipsSlain, ['03065', '03066', '03067', '03068', '03069'])
  assert.deepEqual(cp.chaosBag.filter(token => ['cultist', 'tablet', 'elderthing'].includes(token)),
    ['cultist', 'cultist'])
})

test('Interlude II Daniel outcomes award 0/1/2/3 XP combinations without replay duplication', () => {
  for (const [status, choice, expected] of [
    ['didNotSurvive', 'ignore', 0],
    ['didNotSurvive', 'heed', 1],
    ['survived', 'ignore', 2],
    ['survived', 'heed', 3],
  ]) {
    const cp = campaign()
    cp.records.danielStatus = status
    const state = stateFor(cp)
    enterCampaignNode(cp, manifest, 'danielBonus')
    let node = walkCampaign(cp, manifest, () => choice, apply(state))
    if (node.id === 'interludeTwo') {
      enterCampaignNode(cp, manifest, 'interludeTwo')
      node = walkCampaign(cp, manifest, () => choice, apply(state))
    }
    assert.equal(node.id, 'beforePhantom')
    assert.equal(cp.investigators[0].xp, expected)
    assert.equal(cp.investigators[1].xp, expected)
  }
})

test('Unspeakable Oath enters Interlude II only after R2/R3', () => {
  const condition = manifest.flow.nodes.afterOath.options[0].when
  for (const [value, expected] of [['r1', false], ['noResolution', false],
    ['r2', true], ['r3', true]]) {
    const cp = campaign()
    cp.scenarioResults.push({ scenarioId: 'theUnspeakableOath', resolution: value })
    assert.equal(flowCondition(condition, cp), expected)
  }
})

test('Doubt/conviction comparisons support sums and preserve the tie rules', () => {
  const cp = campaign()
  cp.records.doubt = 3
  cp.records.conviction = 3
  assert.equal(flowCondition({ compare: { left: 'doubt', op: '>=', right: 'conviction' } }, cp), true)
  assert.equal(flowCondition({ compare: { left: { sum: ['doubt', 'conviction'] }, op: '>=', right: 6 } }, cp), true)
})

test('Possessed epilogue is visible only to its investigator audience', () => {
  const cp = campaign()
  cp.records.possessed = ['minh']
  const state = stateFor(cp)
  applyCampaignEffect(state, {
    type: 'privateStory',
    id: 'secret',
    title: '秘密',
    text: '黄色帷幕后',
    audienceRecord: 'possessed',
  }, () => {})
  assert.equal(campaignView(cp, 0).privateStories.length, 0)
  assert.equal(campaignView(cp, 1).privateStories[0].text, '黄色帷幕后')
  assert.equal(Object.hasOwn(campaignView(cp, 0).records, 'possessed'), false)
})

test('The Man in the Pallid Mask transfers when its bearer dies or goes insane', () => {
  const cp = campaign()
  cp.records.pallidMaskBearer = 'mark'
  cp.investigators[0].deck.push('03059')
  cp.investigators[0].status = 'insane'
  cp.scenarioIndex = 2
  applyCampaignEffect(stateFor(cp), {
    type: 'transferCampaignWeakness',
    code: '03059',
    bearerRecord: 'pallidMaskBearer',
  }, () => {})
  assert.equal(cp.investigators[0].deck.includes('03059'), false)
  assert.equal(cp.investigators[1].deck.includes('03059'), true)
  assert.equal(cp.records.pallidMaskBearer, 'minh')
})
