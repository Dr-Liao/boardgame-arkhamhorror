import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { contentRegistry } from '../content/registered.js'
import { campaignListForUi } from '../content/registry.js'
import { chapters } from '../content/campaigns/theForgottenAge/shared.js'
import { storyText, TFA_STORY_TEXT } from '../content/campaigns/theForgottenAge/story-text.js'
import { renderStoryText, storyInventory } from '../tools/import-tfa-story.mjs'
import { introduction, resolutionStory, campaignStory } from '../src/campaign/story.js'
import { applyCampaignEffect } from '../src/campaign/campaign-effects.js'
import { campaignView, campaignEnding } from '../src/campaign/campaign.js'
import { flowCondition } from '../src/campaign/campaign-flow.js'

const HTML = /<\/?[a-z][^>]*>/i
const scenario = id => contentRegistry.getScenarioData(id)
const allParagraphs = value => {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.flatMap(allParagraphs)
  if (value && typeof value === 'object') return Object.values(value).flatMap(allParagraphs)
  return []
}

test('M3-C 剧情生成物与 tools/import-tfa-story.mjs 的 --check 一致', () => {
  const target = new URL('../content/campaigns/theForgottenAge/story-text.js', import.meta.url)
  assert.equal(readFileSync(target, 'utf8'), renderStoryText())
  const inventory = storyInventory()
  assert.equal(inventory.scenarios, 10)
  assert.ok(inventory.resolutionCount >= 30)
  assert.ok(inventory.sectionCount >= 50)
})

test('M3-C 每章都有导入正文，序章、幕间与尾声全部导入', () => {
  for (const chapter of chapters) {
    const sections = introduction(scenario(chapter.id), {})
    assert.ok(sections.paragraphs.length > 0, chapter.id)
    assert.ok(sections.paragraphs.join('').length > 40, `${chapter.id} 正文过短`)
  }
  for (const key of ['prologue', 'interludeOne', 'interludeTwo', 'interludeThree',
    'interludeFour', 'interludeFive', 'epilogue']) {
    assert.ok(storyText[key].text.length > 20, key)
    assert.equal(HTML.test(storyText[key].text), false, key)
  }
  // 补给点是补给选择界面，来源里没有叙事正文：只保留标题。
  assert.ok(storyText.resupplyPoint.title.length > 0)
  assert.equal(storyText.resupplyPoint.text, '')
  const flow = contentRegistry.getCampaign('theForgottenAge').flow.nodes
  assert.equal(flow.prologue.title, storyText.prologue.title)
  assert.equal(flow.epilogue.text, storyText.epilogue.text)
  // 幕间节点只放卡面的「检查清单」：具体分支由 effects 在到达时写进纪事，
  // 所以节点正文必须是来源正文的子集，而不是把互斥分支一次展开。
  for (const key of ['interludeOne', 'interludeTwo', 'interludeThree', 'interludeFour', 'interludeFive']) {
    const node = flow[key]
    assert.equal(node.title, storyText[key].title, key)
    assert.ok(node.text.length > 10, `${key} 缺少检查清单`)
    assert.ok(node.effects.length > 0, `${key} 缺少结算效果`)
    assert.ok(storyText[key].text.includes(node.text.slice(0, 12)), `${key} 的检查清单来自原卡正文`)
  }
  assert.ok(flow.resupplyPoint.effects.some(item => item.type === 'pickSupplies'))
})

test('M3-C 每个可达结局键都有正文，且正文不含 HTML 控制标记', () => {
  for (const chapter of chapters) {
    const data = scenario(chapter.id)
    const keys = Object.keys(data.resolutions || {})
    assert.ok(keys.length > 0, chapter.id)
    for (const key of keys) {
      const imported = TFA_STORY_TEXT.resolutions[chapter.id]?.[key]
      if (imported && imported.join('').length > 20) continue
      // 来源没有独立正文（或只有「阅读结局N」指针）时回退到剧本摘要，
      // 摘要必须是可读正文，而不是占位符。
      const summary = data.resolutions[key]
      assert.equal(typeof summary, 'string', `${chapter.id}/${key}`)
      assert.ok(summary.length > 20, `${chapter.id}/${key} 摘要过短`)
      assert.equal(HTML.test(summary), false, `${chapter.id}/${key}`)
    }
  }
  for (const paragraphs of allParagraphs(TFA_STORY_TEXT)) {
    if (typeof paragraphs !== 'string') continue
    assert.equal(HTML.test(paragraphs), false, paragraphs.slice(0, 60))
    assert.equal(paragraphs.includes('&nbsp;'), false)
    assert.equal(paragraphs.includes('setImgPath'), false)
  }
})

test('M3-C 未触发的分支不出现在观察视图', () => {
  const doom = scenario('theDoomOfEztli')
  const waited = introduction(doom, { theInvestigatorsWereForcedToWaitForAdditionalSupplies: true })
  const cleared = introduction(doom, { theInvestigatorsClearedAPathToTheEztliRuins: true })
  const waitedText = waited.paragraphs.join('')
  const clearedText = cleared.paragraphs.join('')
  assert.notEqual(waitedText, clearedText)
  const waitedBranch = TFA_STORY_TEXT.introductions.theDoomOfEztli.sections.intro1[0]
  const clearedBranch = TFA_STORY_TEXT.introductions.theDoomOfEztli.sections.intro2[0]
  assert.ok(waitedText.includes(waitedBranch.slice(0, 20)))
  assert.equal(waitedText.includes(clearedBranch.slice(0, 20)), false)
  assert.ok(clearedText.includes(clearedBranch.slice(0, 20)))
  assert.equal(clearedText.includes(waitedBranch.slice(0, 20)), false)

  const sha = scenario('shatteredAeons')
  const lit = introduction(sha, { theBraziersAreLit: true }).paragraphs.join('')
  const unlit = introduction(sha, { theBraziersRemainUnlit: true }).paragraphs.join('')
  const litIntro = TFA_STORY_TEXT.introductions.shatteredAeons.sections.intro1[0]
  const unlitIntro = TFA_STORY_TEXT.introductions.shatteredAeons.sections.intro2[0]
  assert.ok(lit.includes(litIntro.slice(0, 20)))
  assert.equal(lit.includes(unlitIntro.slice(0, 20)), false)
  assert.ok(unlit.includes(unlitIntro.slice(0, 20)))
  assert.equal(unlit.includes(litIntro.slice(0, 20)), false)

  const archives = introduction(scenario('theCityOfArchives'), { theInvestigatorsCooperatedWithTheYithians: true })
    .paragraphs.join('')
  const resisted = introduction(scenario('theCityOfArchives'), { theInvestigatorsResistedCaptivity: true })
    .paragraphs.join('')
  assert.ok(archives.includes(TFA_STORY_TEXT.introductions.theCityOfArchives.sections.intro2[0].slice(0, 10)))
  assert.equal(resisted.includes(TFA_STORY_TEXT.introductions.theCityOfArchives.sections.intro2[0].slice(0, 10)), false)
})

test('M3-C 只有携带汽油时不会出现「燃料耗尽」段落', () => {
  const bounded = scenario('theBoundaryBeyond')
  const outOfGas = TFA_STORY_TEXT.introductions.theBoundaryBeyond.sections['gas.outOfGas'][0].slice(0, 12)
  const without = introduction(bounded, {}, {
    campaign: { supplies: { 0: ['provisions', 'medicine'] } },
  }).paragraphs.join('')
  const withGas = introduction(bounded, {}, {
    campaign: { supplies: { 0: ['provisions', 'gasoline'] } },
  }).paragraphs.join('')
  assert.ok(without.includes(outOfGas))
  assert.equal(withGas.includes(outOfGas), false)
})

test('M3-C 结局正文按结局键投影，未知键退回剧本摘要', () => {
  const sc = scenario('theDoomOfEztli')
  const r3 = resolutionStory(sc, 'r3')
  assert.equal(r3.title, '结局 3')
  assert.deepEqual(r3.paragraphs, TFA_STORY_TEXT.resolutions.theDoomOfEztli.r3)
  const fallback = resolutionStory({ ...sc, resolutions: { r9: '摘要' } }, 'r9')
  assert.deepEqual(fallback.paragraphs, ['摘要'])
})

test('M3-C 私密段落按座位过滤', () => {
  const campaign = {
    id: 'theForgottenAge',
    leadSeat: 0,
    records: { theJungleWatches: ['guide'] },
    chaosBag: [],
    scenarioResults: [],
    investigators: {
      0: { id: 'inkeeper', seat: 0, name: 'Austen', status: 'active', deck: [], purchases: [], xp: 0 },
      1: { id: 'guide', seat: 1, name: 'Ichtaca', status: 'active', deck: [], purchases: [], xp: 0 },
    },
    retired: [],
  }
  const state = { campaign, chaosBag: [] }
  applyCampaignEffect(state, {
    type: 'privateStory',
    id: 'tfaSecret',
    title: '伊塔卡的秘密',
    text: '她认出了那件遗物。',
    audienceRecord: 'theJungleWatches',
  }, () => {})
  assert.equal(campaignView(campaign, 1).privateStories.length, 1)
  assert.equal(campaignView(campaign, 0).privateStories.length, 0)
})

test('M3-C 存档恢复不重写已经保存的历史正文', () => {
  const chapter = scenario('theUntamedWilds')
  const savedParagraphs = ['这是存档里保存的完整正文，长度必须明显超过剧本自带的短摘要，才能被认定为已保存的历史正文。',
    ...TFA_STORY_TEXT.introductions.theUntamedWilds.sections.body]
  const campaign = {
    id: 'theForgottenAge',
    flow: { nodeId: 'theUntamedWilds', history: [{ nodeId: 'theUntamedWilds', visit: 1 }], visits: { theUntamedWilds: 1 } },
    records: {},
    scenarioResults: [{
      scenarioId: 'theUntamedWilds',
      visitId: 'theUntamedWilds:1',
      resolution: 'noResolution',
      storyResolution: 'r1',
      introStory: { version: 3, title: chapter.name, paragraphs: savedParagraphs },
      recordsBefore: {},
      recordsAfter: {},
      investigators: [{ seat: 0, code: '01001', status: 'active' }],
      story: { version: 3, title: '结局 1', paragraphs: ['存档中的结局正文。'] },
    }],
    investors: {},
    investigators: { 0: { id: 'a', seat: 0, name: 'A', status: 'active', deck: [] } },
    retired: [],
    privateStories: [],
  }
  const state = { campaign, chaosBag: [], uiState: 'scenarioResult' }
  const story = campaignStory(state, contentRegistry)
  const intro = story.entries.find(entry => entry.kind === 'intro')
  assert.deepEqual(intro.paragraphs, savedParagraphs)
  const result = story.entries.find(entry => entry.kind === 'result')
  assert.deepEqual(result.paragraphs, ['存档中的结局正文。'])
  assert.equal(intro.paragraphs.some(text => text.includes(TFA_STORY_TEXT.introductions.theUntamedWilds.sections.body[0])), true)
})

test('M5 大厅流程仍保留故事节点，战役已可启动', () => {
  const nodes = contentRegistry.getCampaign('theForgottenAge').flow.nodes
  assert.deepEqual(Object.values(nodes).filter(node => node.type === 'story').map(node => node.next),
    ['theUntamedWilds', 'turnBackTime'])
  assert.equal(campaignListForUi(contentRegistry).some(entry => entry.id === 'theForgottenAge'), true)
})

test('TFA 尾声门禁：只有使时间倒流后才进入尾声/时间倒流', () => {
  const flow = contentRegistry.getCampaign('theForgottenAge').flow
  assert.equal(flow.nodes.shatteredAeons.next, 'epilogueGate')
  const gate = flow.nodes.epilogueGate
  assert.equal(gate.type, 'branch')
  const pick = records => {
    const campaign = { records, scenarioResults: [] }
    const options = gate.options.filter(option => flowCondition(option.when, campaign))
    assert.equal(options.length, 1, '自动分支必须唯一命中')
    return options[0].next
  }
  assert.equal(pick({}), 'end', '没有使时间倒流 → 直接收尾')
  assert.equal(pick({ theInvestigatorsTurnedBackTime: true }), 'epilogue')
  assert.equal(pick({ theFabricOfTimeIsUnwoven: true, theInvestigatorsTurnedBackTime: true }), 'end',
    '时间线崩解优先收尾')
})

test('TFA 五个战役结局按剧本日志映射', () => {
  const manifest = contentRegistry.getCampaign('theForgottenAge')
  const cases = [
    ['theFabricOfTimeIsUnwoven', 'timeUnwoven'],
    ['theInvestigatorsTurnedBackTime', 'turnedBackTime'],
    ['theInvestigatorsSavedTheCivilizationOfTheSerpents', 'savedSerpents'],
    ['theInvestigatorsSavedTheCivilizationOfTheYithians', 'savedYithians'],
    ['theInvestigatorsMendedTheTearInTheFabricOfTime', 'mendedTear'],
    ['theInvestigatorsSealedTheRelicOfAgesForever', 'sealedRelic'],
  ]
  for (const [record, id] of cases) {
    assert.equal(campaignEnding(manifest, { [record]: true })?.id, id)
  }
  assert.equal(campaignEnding(manifest, {}), null)
})
