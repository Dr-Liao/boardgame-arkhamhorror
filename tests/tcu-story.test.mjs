// 万象无终（The Circle Undone）· P9（M3-C 剧情）验收。
//
// 覆盖：生成物与 tools/import-tcu-story.mjs 的 --check 一致、9 章导入正文与 §2.4
// resolutions 键映射、8 个战役结局正文、叙事正文无 HTML 控制标记、逐章未触发分支不泄露、
// 结局键投影与未知键回退、私密故事按座位过滤、序章私密引言/塔罗结果、旧存档历史正文不重写、
// manifest.flow 节点链与 walkCampaign 幕间分支、幕间效果结算（划掉遗留记忆 / 扭转命运 /
// 核心圈提问 / 幕间二选择边）、尾声按记录组装。
//
// 除生成器与剧情文本外，全部走真实运行时模块与真实效果分发器；夹具只补
// walkCampaign / applyCampaignEffect 需要的最小战役状态字段。
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import { contentRegistry } from '../content/registered.js'
import { manifest } from '../content/campaigns/theCircleUndone/manifest.js'
import { TCU_STORY_TEXT } from '../content/campaigns/theCircleUndone/story-text.js'
import { renderStoryText, storyInventory } from '../tools/import-tcu-story.mjs'
import { chapters, recordTypes, recordDefaults, CHAOS_BAGS } from '../content/campaigns/theCircleUndone/shared.js'
import { MEMENTO_LABELS } from '../content/campaigns/theCircleUndone/record-labels.js'
import { PROLOGUE_TAROT_RESULTS } from '../content/campaigns/theCircleUndone/tarot.js'
import { STORY_INVESTIGATOR_SETUP } from '../content/campaigns/theCircleUndone/scenarios/disappearanceAtTheTwilightEstate/definition.js'
import * as prologue from '../content/campaigns/theCircleUndone/scenarios/disappearanceAtTheTwilightEstate/index.js'
import { campaignStory, introduction, resolutionStory } from '../src/campaign/story.js'
import { applyCampaignEffect } from '../src/campaign/campaign-effects.js'
import { campaignEnding, campaignView } from '../src/campaign/campaign.js'
import {
  enterCampaignNode, flowCondition, validateCampaignGraph, walkCampaign,
} from '../src/campaign/campaign-flow.js'
import { ChoicePause } from '../src/engine/resolution.js'
import { buildTarotDeck, drawTarot } from '../src/engine/tarot.js'

const HTML = /<\/?[a-z][^>]*>/i
const scenario = id => contentRegistry.getScenarioData(id)
const countOf = value => typeof value === 'number' ? value
  : Array.isArray(value) ? value.length : Object.keys(value || {}).length
const clone = value => structuredClone(value)

const allParagraphs = value => {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.flatMap(allParagraphs)
  if (value && typeof value === 'object') return Object.values(value).flatMap(allParagraphs)
  return []
}

// 导入正文的段落组：测试里直接读生成物，缺失即失败（契约 §2.3/§2.4 要求齐全）。
const introSections = (chapterId, key) => {
  const paragraphs = TCU_STORY_TEXT.introductions[chapterId]?.sections?.[key]
  assert.ok(paragraphs?.length, `${chapterId}.${key} 未导入`)
  return paragraphs
}
const interludeSections = (name, key) => {
  const paragraphs = TCU_STORY_TEXT.interludes[name]?.sections?.[key]
  assert.ok(paragraphs?.length, `${name}.${key} 未导入`)
  return paragraphs
}
const epilogueSections = key => {
  const paragraphs = TCU_STORY_TEXT.epilogue.sections?.[key]
  assert.ok(paragraphs?.length, `epilogue.${key} 未导入`)
  return paragraphs
}

// --- 战役夹具（walkCampaign / applyCampaignEffect 需要的最小字段） ---------------

function campaignFixture(overrides = {}) {
  return {
    id: 'theCircleUndone',
    leadSeat: 0,
    records: clone(recordDefaults),
    chaosBag: [...CHAOS_BAGS.standard],
    scenarioResults: [],
    flow: { nodeId: 'prologue', history: [], visits: {} },
    investigators: {
      0: {
        id: 'inv-0', seat: 0, code: '05001', name: '卡洛琳', status: 'active', deck: [],
        purchases: [], removedCards: [], upgradeDrafts: [], xp: 0, earnedXp: 0, spentXp: 0,
        currentScenarioIndex: 0, trauma: { physical: 0, mental: 0 },
      },
      1: {
        id: 'inv-1', seat: 1, code: '05004', name: '黛安娜', status: 'active', deck: [],
        purchases: [], removedCards: [], upgradeDrafts: [], xp: 0, earnedXp: 0, spentXp: 0,
        currentScenarioIndex: 0, trauma: { physical: 0, mental: 0 },
      },
    },
    retired: [],
    privateStories: [],
    ...overrides,
  }
}

// walkCampaign 的起点夹具：从指定节点进图，其余状态尽量接近真实战役。
function flowState(startNodeId, { records = {}, scenarioResults = [], chaosBag = [...CHAOS_BAGS.standard] } = {}) {
  const campaign = campaignFixture({
    records: { ...clone(recordDefaults), ...clone(records) },
    scenarioResults,
    chaosBag: [...chaosBag],
    flow: { nodeId: startNodeId, history: [{ nodeId: startNodeId, visit: 1 }], visits: { [startNodeId]: 1 } },
  })
  return {
    campaign,
    chaosBag: [...chaosBag],
    difficulty: 'standard',
    phase: 'intervention',
    log: [],
  }
}

// 与 resolveTransaction 相同的「ChoicePause 重放」模型执行一个效果。
function runEffect(base, item, pick = choice => choice.options[0].id) {
  const answers = []
  for (let guard = 0; guard < 96; guard++) {
    const state = clone(base)
    state._resolution = { id: 'tcu-story-test', answers, cursor: 0, events: [] }
    try {
      applyCampaignEffect(state, item, text => state.log.push(text))
      return state
    } catch (error) {
      if (!(error instanceof ChoicePause)) throw error
      const choice = error.choice
      answers.push({
        choiceId: choice.id, kind: choice.kind, source: choice.source, seat: choice.seat,
        optionId: pick(choice, answers.length),
      })
    }
  }
  throw new Error('选择循环超过安全上限')
}

// 从 startNodeId 起按真实 walkCampaign 前进：交互节点（scenario/interlude/end）停下后
// 用 enterCampaignNode 推进到 next，直到 until 命中。effects 走真实 applyCampaignEffect。
function walkTo(state, startNodeId, until, choose = () => {
  throw new Error('这条路径不应出现选择')
}) {
  const campaign = state.campaign
  campaign.flow = { nodeId: startNodeId, history: [{ nodeId: startNodeId, visit: 1 }], visits: { [startNodeId]: 1 } }
  const apply = effect => applyCampaignEffect(state, effect, text => state.log.push(text))
  const visited = []
  for (let guard = 0; guard < 24; guard++) {
    const reached = walkCampaign(campaign, manifest, choose, apply)
    visited.push(reached.id)
    if (until(reached)) return { reached, visited }
    if (!reached.next) return { reached, visited }
    enterCampaignNode(campaign, manifest, reached.next)
  }
  throw new Error(`未走到目标节点，路径：${visited.join(' → ')}`)
}

const countToken = (bag, token) => (bag || []).filter(face => face === token).length

// --- 流程图夹具 ---------------------------------------------------------------

const flow = () => {
  assert.ok(manifest.flow, 'manifest.flow 缺失（契约 §3.4）')
  return manifest.flow
}
const flowNode = id => {
  const value = flow().nodes?.[id]
  assert.ok(value, `战役流程缺少节点 ${id}`)
  return value
}
const nodeOptionIds = id => flowNode(id).options.map(option => option.id).sort()
const graphCampaign = (records = {}, scenarioResults = []) => ({
  records: { ...clone(recordDefaults), ...clone(records) },
  recordSchema: { ...recordTypes },
  scenarioResults,
})
// 用真实 flowCondition 求自动分支的唯一命中项。
const matchingOptions = (nodeId, campaign) => flowNode(nodeId).options
  .filter(option => flowCondition(option.when, campaign)).map(option => option.id).sort()

// --- 塔罗夹具（确定性 LCG，同 tcu-prologue.test.mjs） --------------------------

function randomSource(seed = 1) {
  let value = seed >>> 0
  const randomValue = () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0
    return value / 0x100000000
  }
  const shuffle = items => {
    const copy = [...items]
    for (let index = copy.length - 1; index > 0; index--) {
      const target = Math.floor(randomValue() * (index + 1))
      ;[copy[index], copy[target]] = [copy[target], copy[index]]
    }
    return copy
  }
  return { randomValue, shuffle }
}

// 序章开局夹具：两位故事调查员 + 真实塔罗牌堆，跑真实 preScenarioSetup 钩子。
function prologueSetup(chosenCodes = ['05046', '05049'], seed = 7) {
  const state = {
    scenario: clone(prologue.scenario),
    acts: clone(prologue.scenario.acts),
    agendas: clone(prologue.scenario.agendas),
    actIndex: 0,
    agendaIndex: 0,
    investigators: chosenCodes.map((code, seat) => ({
      seat, code: '01001', name: `调查员${seat + 1}`, location: 'entryHall',
      damage: 0, horror: 0, clues: 0, resources: 5, hand: [], assets: [], threat: [],
      engaged: [], deck: [], discard: [], actionsLeft: 3,
    })),
    locations: [],
    enemies: [],
    storyAssets: [],
    scenarioFlags: {},
    scenarioZones: {},
    victoryDisplay: [],
    encounterDeck: [],
    encounterDiscard: [],
    storyInvestigators: { chosen: chosenCodes.map((code, seat) => ({ seat, code })) },
    campaign: {
      leadSeat: 0,
      records: clone(recordDefaults),
      investigators: Object.fromEntries(chosenCodes.map((code, seat) => [seat, {
        id: `inv-${seat}`, seat, code: '01001', name: `调查员${seat + 1}`, deck: [],
        purchases: [], removedCards: [], status: 'active', trauma: { physical: 0, mental: 0 },
      }])),
      chaosBag: [...CHAOS_BAGS.standard],
      privateStories: [],
    },
    chaosBag: [...CHAOS_BAGS.standard],
    difficulty: 'standard',
    numInvestigators: chosenCodes.length,
    round: 1,
    phase: 'investigation',
    status: 'playing',
    log: [],
  }
  const { randomValue, shuffle } = randomSource(seed)
  const api = {
    info: () => {},
    privateInfo: () => {},
    tarot: {
      build: options => buildTarotDeck(state, { ...options, shuffle: list => shuffle(list) }),
      draw: (seat, options) => drawTarot(state, { ...options, random: randomValue }),
      remaining: () => [],
    },
  }
  prologue.behavior.preScenarioSetup(state, [], api)
  return state
}

// ===========================================================================
// 1. 生成物
// ===========================================================================

test('TCU 剧情生成物与 tools/import-tcu-story.mjs 的 --check 一致', () => {
  const target = new URL('../content/campaigns/theCircleUndone/story-text.js', import.meta.url)
  assert.equal(readFileSync(target, 'utf8'), renderStoryText(), 'story-text.js 生成物已漂移，请重跑 import-tcu-story.mjs --write')
  const script = fileURLToPath(new URL('../tools/import-tcu-story.mjs', import.meta.url))
  const check = spawnSync(process.execPath, [script, '--check'], { encoding: 'utf8' })
  assert.equal(check.status, 0, `--check 失败：${check.stderr || check.stdout}`)
  const inventory = storyInventory()
  assert.equal(countOf(inventory.chapters), 9, 'storyInventory().chapters')
  assert.equal(countOf(inventory.introductions), 9, 'storyInventory().introductions（章数）')
  assert.equal(countOf(inventory.introSections), 42, 'storyInventory().introSections（导入段落组数）')
  assert.ok(countOf(inventory.resolutions) >= 45, `resolutions 计数不足：${countOf(inventory.resolutions)}`)
  assert.ok(countOf(inventory.sections) >= 30, `导入段落组不足：${countOf(inventory.sections)}`)
  assert.equal(countOf(inventory.tarotResults), 22, 'storyInventory().tarotResults')
  assert.equal(countOf(inventory.endings), 8, 'storyInventory().endings')
  assert.equal(countOf(inventory.interludes), 4, 'storyInventory().interludes')
  assert.ok(countOf(inventory.fallbacks) >= 2, 'storyInventory().fallbacks 至少两条显式回退')
})

// ===========================================================================
// 2. 9 章导入正文、序章/4 幕间/尾声/8 结局
// ===========================================================================

test('TCU 九章导入正文齐全，序章、四段幕间与尾声全部导入', () => {
  assert.deepEqual(manifest.scenarioIds, chapters.map(chapter => chapter.id), '9 章顺序')
  for (const chapter of chapters) {
    const data = scenario(chapter.id)
    const source = TCU_STORY_TEXT.introductions[chapter.id]
    assert.ok(source, `${chapter.id} 没有导入 introductions`)
    assert.ok(source.title.length > 0, `${chapter.id} 缺少标题`)
    const imported = Object.values(source.sections).flat()
    assert.ok(imported.length > 0, `${chapter.id} 没有导入段落`)
    assert.ok(imported.join('').length > 40, `${chapter.id} 导入正文过短`)
    // 空记录下也必须投影出正文（theSecretName 只有「查看剧本日志」也算已到达的段落）。
    const story = introduction(data, {}, { campaign: { investigators: {} } })
    assert.equal(story.version, 3, chapter.id)
    assert.ok(story.paragraphs.length > 0, `${chapter.id} 观察视图没有正文`)
    // §2.4：本仓库章节定义的每个 resolutions 键都要有导入段落。
    for (const key of Object.keys(data.resolutions || {})) {
      const paragraphs = TCU_STORY_TEXT.resolutions[chapter.id]?.[key]
      assert.ok(Array.isArray(paragraphs) && paragraphs.length > 0, `${chapter.id}/${key} 缺少导入结局正文`)
      assert.ok(paragraphs.join('').length > 20, `${chapter.id}/${key} 导入结局正文过短`)
    }
  }

  // 序章：标题 + body/intro + 4 段故事调查员引言 + 22 条塔罗结果。
  assert.ok(TCU_STORY_TEXT.prologue.title.length > 0)
  assert.ok(TCU_STORY_TEXT.prologue.sections.body.length > 0, 'prologue.sections.body')
  assert.ok(TCU_STORY_TEXT.prologue.sections.intro.length > 0, 'prologue.sections.intro')
  assert.deepEqual(Object.keys(TCU_STORY_TEXT.prologue.storyInvestigatorIntros).sort(),
    ['05046', '05047', '05048', '05049'])
  for (const code of ['05046', '05047', '05048', '05049']) {
    const entry = TCU_STORY_TEXT.prologue.storyInvestigatorIntros[code]
    assert.ok(entry.title.length > 0, `${code} 引言标题`)
    assert.ok(entry.paragraphs.length > 0, `${code} 引言正文`)
    assert.ok(entry.paragraphs.join('').length > 100, `${code} 引言过短`)
  }
  const tarot = Object.values(TCU_STORY_TEXT.prologue.tarotResults)
  assert.equal(tarot.length, 22, '塔罗结果必须 22 条')
  assert.deepEqual(tarot.map(row => row.arcana).sort((left, right) => left - right),
    [...Array(22).keys()], '塔罗结果覆盖 arcana 0–21')
  for (const row of tarot) {
    assert.ok(row.text.length > 0, `塔罗 ${row.arcana} 文案为空`)
    assert.equal(row.text.includes('{name}'), true, `塔罗 ${row.arcana} 保留 {name} 占位`)
  }

  // 四段幕间：标题 + 正文，画面标签齐全。
  for (const key of ['interludeOne', 'interludeTwo', 'interludeThree', 'interludeFour']) {
    const entry = TCU_STORY_TEXT.interludes[key]
    assert.ok(entry, `${key} 未导入`)
    assert.ok(entry.title.length > 0, `${key} 缺少标题`)
    const paragraphs = Object.values(entry.sections).flat()
    assert.ok(paragraphs.length > 0, `${key} 没有正文`)
    assert.ok(paragraphs.join('').length > 20, `${key} 正文过短`)
  }
  assert.deepEqual(Object.keys(TCU_STORY_TEXT.interludes.interludeTwo.labels).sort(), ['agree', 'lie', 'refuse'])
  assert.ok(Object.keys(TCU_STORY_TEXT.interludes.interludeThree.labels).length >= 8, '幕间三标签（truth/lie + 6 个问题）')
  for (const key of ['thePriceOfProgress1', 'thePriceOfProgress4', 'thePriceOfProgress7']) {
    assert.ok(interludeSections('interludeTwo', key).length > 0, `interludeTwo.${key}`)
  }
  for (const key of ['theInnerCircle1', 'theInnerCircle2', 'whatIsTheCreature']) {
    assert.ok(interludeSections('interludeThree', key).length > 0, `interludeThree.${key}`)
  }
  for (const key of ['twistOfFate1', 'twistOfFate2']) {
    assert.ok(interludeSections('interludeFour', key).length > 0, `interludeFour.${key}`)
  }

  // 尾声：标题 + 5 个片段。
  assert.ok(TCU_STORY_TEXT.epilogue.title.length > 0)
  for (const key of ['arrestedAnette', 'assumedControlOfTheLodge', 'survivedTheWatchersEmbrace',
    'signedTheBlackBook', 'youAreBeingHunted']) {
    assert.ok(epilogueSections(key).length > 0, `epilogue.${key}`)
  }

  // 8 个战役结局正文。
  assert.equal(Object.keys(TCU_STORY_TEXT.endings).length, 8)
})

// ===========================================================================
// 3. 结局登记与正文
// ===========================================================================

test('TCU 八个战役结局都有导入正文且记录已登记', () => {
  const expectedOrder = [
    'azathothDevouredTheUniverse', 'joinedThePipers', 'signedTheBlackBook', 'reversedTheIncantation',
    'azathothSlumbersForNow', 'covenHoldsTheWorld', 'lodgeHoldsTheWorld', 'neverSeenOrHeardFromAgain',
  ]
  assert.deepEqual(manifest.endings.map(ending => ending.id), expectedOrder, '§3.4 结局顺序')
  assert.deepEqual(Object.keys(TCU_STORY_TEXT.endings).sort(), [...expectedOrder].sort())
  const sources = {
    azathothDevouredTheUniverse: { chapterId: 'beforeTheBlackThrone', resolution: 'r1' },
    joinedThePipers: { chapterId: 'beforeTheBlackThrone', resolution: 'r2' },
    signedTheBlackBook: { chapterId: 'beforeTheBlackThrone', resolution: 'r5' },
    reversedTheIncantation: { chapterId: 'beforeTheBlackThrone', resolution: 'r6' },
    azathothSlumbersForNow: { chapterId: 'beforeTheBlackThrone', resolution: 'r3' },
    covenHoldsTheWorld: { chapterId: 'unionAndDisillusion', resolution: 'r9' },
    lodgeHoldsTheWorld: { chapterId: 'unionAndDisillusion', resolution: 'r2' },
    neverSeenOrHeardFromAgain: { chapterId: 'atDeathsDoorstep', resolution: 'r3' },
  }
  for (const ending of manifest.endings) {
    const imported = TCU_STORY_TEXT.endings[ending.id]
    assert.ok(imported, `${ending.id} 没有导入正文`)
    assert.ok(imported.title.length > 0, `${ending.id} 标题`)
    assert.ok(imported.paragraphs.length > 0, `${ending.id} 正文`)
    assert.ok(imported.paragraphs.join('').length > 20, `${ending.id} 正文过短`)
    assert.equal(HTML.test(imported.paragraphs.join('')), false, `${ending.id} 正文含 HTML`)
    assert.deepEqual(imported.source, sources[ending.id], `${ending.id} 来源映射`)
    assert.ok(ending.label.length > 0, `${ending.id} 缺少中文标签`)
    assert.equal(recordTypes[ending.record], 'boolean', `${ending.id} 记录 ${ending.record} 未登记`)
    // 结局表按记录反查必须回到同一个 id，且无记录时没有结局。
    assert.equal(campaignEnding(manifest, { [ending.record]: true })?.id, ending.id)
  }
  assert.equal(campaignEnding(manifest, {}), null)
  assert.equal(manifest.endings.find(ending => ending.id === 'lodgeHoldsTheWorld').record,
    'theTrueWorkOfTheSilverTwilightLodgeHasBegun')
})

// ===========================================================================
// 4. 无 HTML 控制标记
// ===========================================================================

test('TCU 全部剧情字符串不含 HTML 控制标记', () => {
  const strings = []
  const visit = (value, path) => {
    if (typeof value === 'string') {
      strings.push([path, value])
      return
    }
    if (Array.isArray(value)) {
      // 剧情文本里只出现「段落数组」一种字符串数组。
      if (value.every(item => typeof item === 'string')) {
        for (const [index, item] of value.entries()) {
          assert.ok(item.length > 0, `${path}[${index}] 是空字符串段落`)
        }
      }
      value.forEach((item, index) => visit(item, `${path}[${index}]`))
      return
    }
    if (value && typeof value === 'object') {
      for (const [key, item] of Object.entries(value)) visit(item, path ? `${path}.${key}` : key)
    }
  }
  visit(TCU_STORY_TEXT, 'TCU_STORY_TEXT')
  assert.ok(strings.length > 100, `剧情字符串过少：${strings.length}`)
  for (const [path, value] of strings) {
    assert.equal(HTML.test(value), false, `${path} 含 HTML 标签：${value.slice(0, 60)}`)
    assert.equal(value.includes('&nbsp;'), false, `${path} 含 &nbsp;`)
    assert.equal(value.includes('setImgPath'), false, `${path} 含 setImgPath`)
    assert.equal(value.includes('undefined'), false, `${path} 含 undefined`)
  }
  // 生成器文本与导入正文同源（--write/--check 逐字节一致）。
  assert.equal(renderStoryText().includes('<p'), false)
})

// ===========================================================================
// 5. 未触发分支不泄露
// ===========================================================================

test('TCU 未触发分支不泄露：隐秘之名、崇高利益与混沌魔掌', () => {
  const paragraphs = story => story.paragraphs
  const has = (story, paragraph) => paragraphs(story).includes(paragraph)
  const hasNot = (story, paragraph) => !has(story, paragraph)

  // 隐秘之名：members+told 与 hid+enemies 互斥。
  const tsn = scenario('theSecretName')
  const told = introduction(tsn, {
    theInvestigatorsAreMembersOfTheLodge: true,
    theInvestigatorsToldTheLodgeAboutTheCoven: true,
  })
  assert.ok(has(told, introSections('theSecretName', 'intro1')[0]), 'members 时读 intro1')
  assert.ok(has(told, introSections('theSecretName', 'intro2')[0]), 'told 时读 intro2')
  for (const key of ['intro3', 'intro4', 'intro5', 'intro6']) {
    assert.ok(hasNot(told, introSections('theSecretName', key)[0]), `told 分支不应出现 ${key}`)
  }
  const hid = introduction(tsn, {
    theInvestigatorsHidTheirKnowledgeOfTheCoven: true,
    theInvestigatorsAreEnemiesOfTheLodge: true,
    theInvestigatorsLearnedNothingOfTheLodgesSchemes: true,
  }, { campaign: { investigators: { 0: { code: '05001' } } } })
  assert.ok(has(hid, introSections('theSecretName', 'intro3')[0]), 'hid 时读 intro3')
  assert.ok(has(hid, introSections('theSecretName', 'intro4')[0]), 'enemies 时读 intro4')
  assert.ok(has(hid, introSections('theSecretName', 'intro5')[0]), 'learnedNothing 时读 intro5')
  assert.ok(hasNot(hid, introSections('theSecretName', 'intro1')[0]), '非 members 不读 intro1')
  assert.ok(hasNot(hid, introSections('theSecretName', 'intro2')[0]), '非 told 不读 intro2')
  assert.ok(hasNot(hid, introSections('theSecretName', 'intro6')[0]), '非 neverSeen 不读 intro6')
  // 侧栏指针（intro3Mystic）只给潜修者；intro3Part2 是普通正文，任何职业都读（参考
  // TheSecretName.hs 的 `p.validate anyMystic "intro3Mystic"` + 无条件 `p "intro3Part2"`）。
  const intro3Mystic = introSections('theSecretName', 'intro3Mystic')[0]
  const intro3Part2 = introSections('theSecretName', 'intro3Part2')[0]
  const hidMystic = introduction(tsn, {
    theInvestigatorsHidTheirKnowledgeOfTheCoven: true,
  }, { campaign: { investigators: { 0: { code: '05004' } } }, investigators: [{ seat: 0, code: '05004' }] })
  const hidPlain = introduction(tsn, {
    theInvestigatorsHidTheirKnowledgeOfTheCoven: true,
  }, { campaign: { investigators: { 0: { code: '05001' } } }, investigators: [{ seat: 0, code: '05001' }] })
  assert.ok(has(hidMystic, intro3Mystic), '潜修者读 intro3Mystic 侧栏指针')
  assert.ok(hasNot(hidPlain, intro3Mystic), '非潜修者不读 intro3Mystic')
  assert.ok(has(hidMystic, intro3Part2) && has(hidPlain, intro3Part2), 'intro3Part2 是两种职业都读的正文')

  // 崇高利益：members / enemies / learnedNothing / 默认 四分支互斥。
  const fgg = scenario('forTheGreaterGood')
  const intro1 = introSections('forTheGreaterGood', 'intro1')[0]
  const intro2 = introSections('forTheGreaterGood', 'intro2')[0]
  const intro3 = introSections('forTheGreaterGood', 'intro3')[0]
  const intro4 = introSections('forTheGreaterGood', 'intro4')[0]
  const intro5 = introSections('forTheGreaterGood', 'intro5')[0]
  const deceiving = introSections('forTheGreaterGood', 'deceivingTheLodge')[0]
  const members = introduction(fgg, { theInvestigatorsAreMembersOfTheLodge: true })
  assert.ok(has(members, intro1))
  assert.ok(has(members, intro2), 'members 读 intro2')
  assert.ok(hasNot(members, intro3) && hasNot(members, intro4) && hasNot(members, intro5))
  assert.ok(hasNot(members, deceiving), '未欺骗秘社不读 deceivingTheLodge')
  const deceivers = introduction(fgg, {
    theInvestigatorsAreMembersOfTheLodge: true,
    theInvestigatorsAreDeceivingTheLodge: true,
  })
  assert.ok(has(deceivers, deceiving), '欺骗秘社读 deceivingTheLodge')
  const enemies = introduction(fgg, { theInvestigatorsAreEnemiesOfTheLodge: true })
  assert.ok(has(enemies, intro1) && has(enemies, intro3), 'enemies 读 intro3')
  assert.ok(hasNot(enemies, intro2) && hasNot(enemies, intro4) && hasNot(enemies, intro5))
  const learnedNothing = introduction(fgg, { theInvestigatorsLearnedNothingOfTheLodgesSchemes: true })
  assert.ok(has(learnedNothing, intro1) && has(learnedNothing, intro4), 'learnedNothing 读 intro4')
  assert.ok(hasNot(learnedNothing, intro2) && hasNot(learnedNothing, intro3) && hasNot(learnedNothing, intro5))
  const defaultBranch = introduction(fgg, {})
  assert.ok(has(defaultBranch, intro1) && has(defaultBranch, intro5), '默认读 intro5')
  assert.ok(hasNot(defaultBranch, intro2) && hasNot(defaultBranch, intro3) && hasNot(defaultBranch, intro4))

  // 混沌魔掌：neverSeen 与正常路径的 intro2/intro3 互斥。
  const clutches = scenario('inTheClutchesOfChaos')
  const normal = introduction(clutches, {})
  const neverSeen = introduction(clutches, { theInvestigatorsAreNeverSeenOrHeardFromAgain: true })
  const clutchesIntro2 = introSections('inTheClutchesOfChaos', 'intro2')[0]
  const clutchesIntro3 = introSections('inTheClutchesOfChaos', 'intro3')[0]
  const clutchesIntro4 = introSections('inTheClutchesOfChaos', 'intro4')[0]
  assert.ok(has(normal, clutchesIntro3), '正常路径读 intro3')
  assert.ok(hasNot(normal, clutchesIntro2), '正常路径不读 intro2')
  assert.ok(has(neverSeen, clutchesIntro2), 'neverSeen 读 intro2')
  assert.ok(hasNot(neverSeen, clutchesIntro3), 'neverSeen 不读 intro3')
  assert.ok(has(normal, clutchesIntro4) && has(neverSeen, clutchesIntro4), 'intro4 总是追加')
})

// ===========================================================================
// 6. 结局键投影 / 未知键回退
// ===========================================================================

test('TCU 结局正文按结局键投影，未知键退回剧本摘要', () => {
  const chapter = scenario('atDeathsDoorstep')
  const r1 = resolutionStory(chapter, 'r1')
  assert.equal(r1.version, 3)
  assert.equal(r1.title, '结局 1')
  assert.deepEqual(r1.paragraphs, TCU_STORY_TEXT.resolutions.atDeathsDoorstep.r1)
  assert.notDeepEqual(r1.paragraphs, [chapter.resolutions.r1])

  const none = resolutionStory(chapter, 'noResolution')
  assert.equal(none.title, '未达成结局')
  assert.deepEqual(none.paragraphs, TCU_STORY_TEXT.resolutions.atDeathsDoorstep.noResolution)

  // 导入映射里没有的键：退回该章节剧本摘要，不能被空正文吞掉。
  const legacy = {
    ...chapter,
    id: 'atDeathsDoorstepLegacy',
    resolutions: { r9: '旧存档里的结局摘要正文，长度够用。' },
  }
  const fallback = resolutionStory(legacy, 'r9')
  assert.equal(fallback.title, '结局 9')
  assert.deepEqual(fallback.paragraphs, ['旧存档里的结局摘要正文，长度够用。'])

  // 9 章导入结局都能投影（union r9 与 beforeTheBlackThrone r6 抽两章核对）。
  assert.deepEqual(resolutionStory(scenario('unionAndDisillusion'), 'r9').paragraphs,
    TCU_STORY_TEXT.resolutions.unionAndDisillusion.r9)
  assert.deepEqual(resolutionStory(scenario('beforeTheBlackThrone'), 'r6').paragraphs,
    TCU_STORY_TEXT.resolutions.beforeTheBlackThrone.r6)
})

// ===========================================================================
// 7. 私密段落按座位过滤
// ===========================================================================

test('TCU 私密段落由 privateStory 效果写入并按座位过滤', () => {
  const campaign = campaignFixture()
  const state = { campaign, chaosBag: [] }
  applyCampaignEffect(state, {
    type: 'privateStory',
    id: 'tcuPrivate',
    title: '只给甲的私密故事',
    text: '第一段秘密。\n\n第二段秘密。',
    audienceInvestigatorIds: ['inv-0'],
  }, text => state.log.push(text))

  assert.equal(campaign.privateStories.length, 1)
  assert.deepEqual(campaign.privateStories[0].audienceInvestigatorIds, ['inv-0'])

  const seat0 = campaignView(campaign, 0)
  const seat1 = campaignView(campaign, 1)
  assert.equal(seat0.privateStories.length, 1, '座位 0 看得到自己的私密故事')
  assert.equal(seat0.privateStories[0].audienceInvestigatorIds, undefined, '投影里不带观众 id')
  assert.equal(seat1.privateStories.length, 0, '座位 1 看不到别人的私密故事')

  // campaignStory 的私密投影同样按座位过滤，且公开纪事（无 observerSeat）不含私密段。
  const projected = campaignStory({ campaign, chaosBag: [], uiState: 'campaignResult' }, contentRegistry, 0)
  const privateEntries = projected.entries.filter(entry => entry.id.startsWith('private:'))
  assert.equal(privateEntries.length, 1)
  assert.deepEqual(privateEntries[0].paragraphs, ['第一段秘密。', '第二段秘密。'])
  assert.equal(campaignStory({ campaign, chaosBag: [], uiState: 'campaignResult' }, contentRegistry, 1)
    .entries.filter(entry => entry.id.startsWith('private:')).length, 0)
  assert.equal(campaignStory({ campaign, chaosBag: [], uiState: 'campaignResult' }, contentRegistry)
    .entries.filter(entry => entry.id.startsWith('private:')).length, 0)
})

// ===========================================================================
// 8. 私密故事只进入本人观察投影
// ===========================================================================

test('TCU 私密故事只进入本人观察投影，不进公开纪事', () => {
  const campaign = campaignFixture({
    privateStories: [
      { id: 'secret-0', title: '甲的秘密', text: '只有甲知道的塔罗结果。', audienceInvestigatorIds: ['inv-0'] },
      { id: 'secret-1', title: '乙的秘密', text: '只有乙知道的引言。', audienceInvestigatorIds: ['inv-1'] },
    ],
  })
  const state = { campaign, chaosBag: [], uiState: 'campaignResult' }
  const own0 = campaignStory(state, contentRegistry, 0).entries.filter(entry => entry.id.startsWith('private:'))
  assert.equal(own0.length, 1)
  assert.equal(own0[0].title, '甲的秘密')
  assert.deepEqual(own0[0].paragraphs, ['只有甲知道的塔罗结果。'])
  const own1 = campaignStory(state, contentRegistry, 1).entries.filter(entry => entry.id.startsWith('private:'))
  assert.equal(own1.length, 1)
  assert.equal(own1[0].title, '乙的秘密')
  // 公开投影（大厅/观战）看不到任何私密故事，也不会泄露给别的座位。
  const publicStory = campaignStory(state, contentRegistry)
  assert.equal(publicStory.entries.filter(entry => entry.id.startsWith('private:')).length, 0)
  assert.equal(JSON.stringify(publicStory).includes('只有甲知道的塔罗结果。'), false)
  assert.equal(JSON.stringify(campaignStory(state, contentRegistry, 0)).includes('只有乙知道的引言。'), false)
})

// ===========================================================================
// 9. 序章私密引言与塔罗结果
// ===========================================================================

test('TCU 序章只显示所选调查员的引言与本人抽到的塔罗结果', () => {
  const chosenCodes = ['05046', '05049']
  const state = prologueSetup(chosenCodes, 7)
  const privateStories = state.campaign.privateStories
  assert.ok(Array.isArray(privateStories), '序章没有写出 campaign.privateStories')

  // 引言：每位所选调查员一条，观众只有本人。
  for (const [seat, code] of chosenCodes.entries()) {
    const intro = privateStories.find(story => story.id === `tcuPrologueIntro:${code}`)
    assert.ok(intro, `缺少 ${code} 的引言私密故事`)
    assert.deepEqual(intro.audienceInvestigatorIds, [`inv-${seat}`])
    assert.ok(String(intro.title).includes('引言'), `${code} 引言标题`)
    const expected = TCU_STORY_TEXT.prologue.storyInvestigatorIntros[code].paragraphs
    for (const paragraph of expected) assert.ok(String(intro.text).includes(paragraph), `${code} 引言段落缺失`)
  }
  // 未选调查员（05047 杰罗姆 / 05048 瓦伦蒂诺）的引言绝不出现。
  for (const code of ['05047', '05048']) {
    const paragraph = TCU_STORY_TEXT.prologue.storyInvestigatorIntros[code].paragraphs[0]
    assert.equal(JSON.stringify(privateStories).includes(paragraph), false, `未选中的 ${code} 引言泄露`)
  }

  // 塔罗：每位座位一条，只含本人抽到的 arcana，{name} 已替换。
  const drawn = state.scenarioDecks.tarot.drawn
  assert.equal(drawn.length, chosenCodes.length)
  const chosen = [...state.storyInvestigators.chosen].sort((left, right) => left.seat - right.seat)
  for (const [index, entry] of chosen.entries()) {
    const tale = privateStories.find(story => story.id === `tcuPrologueTarot:${entry.seat}`)
    assert.ok(tale, `座位 ${entry.seat} 缺少塔罗私密故事`)
    assert.deepEqual(tale.audienceInvestigatorIds, [`inv-${entry.seat}`])
    assert.ok(String(tale.title).includes('命运'), `座位 ${entry.seat} 塔罗标题`)
    const key = PROLOGUE_TAROT_RESULTS.find(row => row.arcana === drawn[index].arcana).key
    const template = TCU_STORY_TEXT.prologue.tarotResults[key].text
    const runtimeName = state.investigators[entry.seat].name
    const setupName = STORY_INVESTIGATOR_SETUP[chosenCodes[entry.seat]].name
    assert.ok([template.replaceAll('{name}', runtimeName), template.replaceAll('{name}', setupName)]
      .includes(String(tale.text)), `座位 ${entry.seat} 塔罗文案应来自 ${key}`)
    assert.equal(String(tale.text).includes('{name}'), false)
  }
  // 座位 0 的观察投影只见本人引言与本人塔罗，不含座位 1 的塔罗结果。
  const projected = campaignStory({ campaign: state.campaign, chaosBag: [], uiState: 'campaignResult' }, contentRegistry, 0)
  const own = projected.entries.filter(entry => entry.id.startsWith('private:'))
  assert.equal(own.length, 2, '座位 0 应看到引言 + 塔罗两条私密故事')
  assert.ok(own.some(entry => entry.title.includes('引言')))
  assert.ok(own.some(entry => entry.title.includes('命运')))
  const seat1Tale = privateStories.find(story => story.id === 'tcuPrologueTarot:1')
  assert.equal(JSON.stringify(projected).includes(String(seat1Tale.text)), false, '座位 0 不应看到座位 1 的塔罗结果')
  // 未选调查员的引言不会混进任何观察投影。
  assert.equal(JSON.stringify(campaignStory({ campaign: state.campaign, chaosBag: [], uiState: 'campaignResult' }, contentRegistry, 1))
    .includes(TCU_STORY_TEXT.prologue.storyInvestigatorIntros['05048'].paragraphs[0]), false)
})

// ===========================================================================
// 10. 旧存档不重写历史正文
// ===========================================================================

test('TCU 旧存档不重写历史正文，短摘要升级为导入正文', () => {
  const chapter = scenario('theWagesOfSin')
  const importedBody = TCU_STORY_TEXT.introductions.theWagesOfSin.sections.body
  const savedStory = paragraphs => ({
    uiState: 'scenarioResult',
    chaosBag: [],
    campaign: campaignFixture({
      flow: { nodeId: 'theWagesOfSin', history: [{ nodeId: 'theWagesOfSin', visit: 1 }], visits: { theWagesOfSin: 1 } },
      records: { ...clone(recordDefaults), theInvestigatorsAreEnemiesOfTheLodge: true },
      scenarioResults: [{
        scenarioId: 'theWagesOfSin',
        visitId: 'theWagesOfSin:1',
        resolution: 'noResolution',
        storyResolution: 'r1',
        introStory: { version: 3, title: chapter.name, paragraphs },
        recordsBefore: {},
        recordsAfter: {},
        investigators: [{ seat: 0, code: '05001', status: 'active', resigned: false, defeated: false }],
        story: { version: 3, title: '结局 1', paragraphs: ['存档中的结局正文。'] },
      }],
    }),
  })
  const storyOf = state => campaignStory(state, contentRegistry).entries
  const introOf = state => storyOf(state).find(entry => entry.kind === 'intro')

  // 旧存档：version 3 但只有一行剧本摘要 → 用导入正文升级。
  const short = savedStory(['这是 P8 之前的旧摘要。'])
  const upgraded = introOf(short)
  assert.ok(upgraded, '短摘要存档应能升级出导入正文')
  assert.ok(upgraded.paragraphs.join('').length > chapter.intro.length + 20, '短摘要没有被升级为导入正文')
  for (const paragraph of importedBody) assert.ok(upgraded.paragraphs.includes(paragraph), '导入正文段落缺失')

  // 已经保存长正文的存档：原样保留，不重写历史。
  const savedLong = [
    '这是旧存档里已经保存的完整历史正文，P9 升级不能把它替换成当前导入版本。',
    ...importedBody,
  ]
  const preserved = introOf(savedStory(savedLong))
  assert.deepEqual(preserved.paragraphs, savedLong)
  assert.equal(short.campaign.scenarioResults[0].introStory.paragraphs.length, 1, '读取升级不能回写存档快照')
  // 结局快照同样保留（不是本次目标，但避免升级顺手覆盖历史结局正文）。
  assert.deepEqual(storyOf(savedStory(savedLong)).find(entry => entry.kind === 'result').paragraphs,
    ['存档中的结局正文。'])
})

// ===========================================================================
// 11. manifest.flow 结构
// ===========================================================================

test('TCU manifest.flow 覆盖序章、九章、三幕间与尾声且通过图校验', () => {
  const graph = validateCampaignGraph(manifest)
  assert.equal(graph.start, 'prologue')
  assert.deepEqual(JSON.parse(JSON.stringify(manifest.flow)), manifest.flow, 'flow 必须是纯 JSON')
  const nodes = graph.nodes
  const scenariosInFlow = Object.values(nodes).filter(node => node.type === 'scenario')
  assert.equal(scenariosInFlow.length, 9, '流程里应有 9 个 scenario 节点')
  assert.deepEqual(scenariosInFlow.map(node => node.scenarioId).sort(), [...manifest.scenarioIds].sort())
  assert.equal(nodes.prologue.type, 'story', '序章是 story 节点')
  assert.ok(nodes.prologue.title?.length > 0 || nodes.prologue.text?.length > 0, '序章节点没有正文/标题')
  // §3.4：序章节点正文 = 序章标题 + base.prologue.body（导入在 prologue.sections.quote，
  // 缺失时退回首段 body）。
  const prologueNarrative = TCU_STORY_TEXT.prologue.sections.quote
    || TCU_STORY_TEXT.prologue.sections.body
  assert.ok(String(nodes.prologue.text || '').includes(prologueNarrative[0]),
    '序章节点正文来自 base.prologue.body')
  assert.equal(nodes.epilogue.type, 'story', '尾声是 story 节点')
  assert.equal(nodes.end.type, 'end')
  for (const id of ['interludeTwo', 'interludeThree', 'interludeFour']) {
    assert.equal(nodes[id]?.type, 'interlude', `${id} 应为 interlude 节点`)
  }
  // 三个幕间节点都挂了结算效果（正文展开由 tcuFlowStory/effects 负责）。
  assert.ok(nodes.interludeTwo, 'interludeTwo')
  assert.ok(nodes.interludeFour.effects.some(effect => effect.type === 'twistOfFate'), '幕间四缺 twistOfFate 效果')
  assert.ok(nodes.interludeThreeTruth.effects.some(effect => effect.type === 'crossOffMementos'), '幕间三缺划掉遗留记忆')
})

// ===========================================================================
// 12. manifest.flow 的 next/选项链与条件
// ===========================================================================

test('TCU manifest.flow 的分支条件与 next 链按契约接线', () => {
  const nextOf = id => flowNode(id).next
  // 序章 → 9 章的主干顺序。
  assert.equal(nextOf('prologue'), 'disappearanceAtTheTwilightEstate')
  assert.equal(nextOf('disappearanceAtTheTwilightEstate'), 'theWitchingHour')
  assert.equal(nextOf('theWitchingHour'), 'atDeathsDoorstep')
  assert.equal(nextOf('atDeathsDoorstep'), 'interludeTwoGate')
  assert.equal(nextOf('theSecretName'), 'theWagesOfSin')
  assert.equal(nextOf('theWagesOfSin'), 'forTheGreaterGood')
  assert.equal(nextOf('forTheGreaterGood'), 'interludeThreeGate')
  assert.equal(nextOf('unionAndDisillusion'), 'unionEndingGate')
  assert.equal(nextOf('inTheClutchesOfChaos'), 'interludeFour')
  assert.equal(nextOf('beforeTheBlackThrone'), 'epilogue')
  assert.equal(nextOf('epilogue'), 'end')

  // 死亡门前后：r1 逃出 → 幕间二；否则直接《隐秘之名》。
  assert.equal(flowNode('interludeTwoGate').type, 'branch')
  assert.deepEqual(nodeOptionIds('interludeTwoGate'), ['escaped', 'skipped'])
  assert.deepEqual(matchingOptions('interludeTwoGate',
    graphCampaign({}, [{ scenarioId: 'atDeathsDoorstep', resolution: 'r1' }])), ['escaped'])
  assert.deepEqual(matchingOptions('interludeTwoGate',
    graphCampaign({}, [{ scenarioId: 'atDeathsDoorstep', resolution: 'r2' }])), ['skipped'])
  assert.equal(flowNode('interludeTwoGate').options.find(option => option.id === 'escaped').next, 'interludeTwo')
  assert.equal(flowNode('interludeTwoGate').options.find(option => option.id === 'skipped').next, 'theSecretName')

  // 幕间二：命运分支 → 三选一邀请 → 回到《隐秘之名》。
  assert.equal(nextOf('interludeTwo'), 'interludeTwoFate')
  assert.equal(flowNode('interludeTwoFate').type, 'branch')
  assert.deepEqual(nodeOptionIds('interludeTwoFate'), ['alive', 'gone', 'rescued'])
  assert.deepEqual(matchingOptions('interludeTwoFate', graphCampaign({ josefDisappearedIntoTheMist: true })), ['gone'])
  assert.deepEqual(matchingOptions('interludeTwoFate', graphCampaign({ theInvestigatorsRescuedJosef: true })), ['rescued'])
  assert.deepEqual(matchingOptions('interludeTwoFate', graphCampaign({})), ['alive'])
  assert.equal(flowNode('interludeTwoFate').options.find(option => option.id === 'gone').next, 'interludeTwoGone')
  assert.equal(flowNode('interludeTwoFate').options.find(option => option.id === 'rescued').next, 'interludeTwoRescued')
  assert.equal(flowNode('interludeTwoFate').options.find(option => option.id === 'alive').next, 'interludeTwoAlive')
  for (const id of ['interludeTwoGone', 'interludeTwoRescued', 'interludeTwoAlive']) {
    const target = id === 'interludeTwoGone' ? 'theSecretName' : 'interludeTwoDecision'
    assert.equal(nextOf(id), target, `${id} 的 next`)
  }
  const decision = flowNode('interludeTwoDecision')
  assert.equal(decision.type, 'choice')
  assert.deepEqual(nodeOptionIds('interludeTwoDecision'), ['agree', 'lie', 'refuse'])
  assert.equal(decision.options.find(option => option.id === 'refuse').next, 'interludeTwoRefused')
  assert.equal(decision.options.find(option => option.id === 'agree').next, 'interludeTwoAgreed')
  assert.equal(decision.options.find(option => option.id === 'lie').next, 'interludeTwoLied')
  for (const id of ['interludeTwoRefused', 'interludeTwoAgreed', 'interludeTwoLied']) {
    assert.equal(nextOf(id), 'theSecretName', `${id} 之后回到隐秘之名`)
  }
  // 幕间二节点的效果声明（供 walkCampaign 结算）。
  const refuseEffects = decision.options.find(option => option.id === 'refuse').effects
  assert.ok(refuseEffects.some(effect => effect.type === 'record'
    && effect.key === 'theInvestigatorsAreEnemiesOfTheLodge' && effect.value === true), 'refuse 应写敌视记录')
  const agreeEffects = decision.options.find(option => option.id === 'agree').effects
  assert.ok(agreeEffects.some(effect => effect.type === 'record'
    && effect.key === 'theInvestigatorsAreMembersOfTheLodge' && effect.value === true), 'agree 应写成员记录')
  assert.ok(agreeEffects.some(effect => effect.type === 'chaos' && effect.token === 'cultist'), 'agree 应加异教徒标记')
  assert.ok(flowNode('interludeTwoRescued').effects.some(effect => effect.type === 'record'
    && effect.key === 'theInvestigatorsRescuedJosef' && effect.value === true))
  assert.ok(flowNode('interludeTwoRescued').effects.some(effect => effect.type === 'experience' && effect.amount === 2))
  assert.ok(flowNode('interludeTwoGone').effects.some(effect => effect.type === 'record'
    && effect.key === 'josefDisappearedIntoTheMist' && effect.value === true))
  assert.ok(flowNode('interludeTwoAlive').effects.some(effect => effect.type === 'record'
    && effect.key === 'josefIsAliveAndWell' && effect.value === true))

  // 崇高利益后：r1 入职 → 幕间三；否则直接《聚合幻灭》。
  assert.equal(flowNode('interludeThreeGate').type, 'branch')
  assert.deepEqual(nodeOptionIds('interludeThreeGate'), ['inducted', 'skipped'])
  assert.deepEqual(matchingOptions('interludeThreeGate',
    graphCampaign({}, [{ scenarioId: 'forTheGreaterGood', resolution: 'r1' }])), ['inducted'])
  assert.deepEqual(matchingOptions('interludeThreeGate',
    graphCampaign({}, [{ scenarioId: 'forTheGreaterGood', resolution: 'r2' }])), ['skipped'])
  assert.equal(flowNode('interludeThreeGate').options.find(option => option.id === 'inducted').next, 'interludeThree')
  assert.equal(flowNode('interludeThreeGate').options.find(option => option.id === 'skipped').next, 'unionAndDisillusion')

  // 幕间三：真相 / 谎言两条路径。
  assert.equal(nextOf('interludeThree'), 'interludeThreeDecision')
  const threeDecision = flowNode('interludeThreeDecision')
  assert.equal(threeDecision.type, 'choice')
  assert.deepEqual(nodeOptionIds('interludeThreeDecision'), ['lie', 'truth'])
  assert.equal(threeDecision.options.find(option => option.id === 'truth').next, 'interludeThreeTruth')
  assert.equal(threeDecision.options.find(option => option.id === 'lie').next, 'interludeThreeLie')
  assert.equal(nextOf('interludeThreeTruth'), 'interludeThreeTruthGate')
  assert.equal(nextOf('interludeThreeLie'), 'unionAndDisillusion')
  assert.ok(flowNode('interludeThreeLie').effects.some(effect => effect.type === 'record'
    && effect.key === 'theInvestigatorsKeptsTheirMementosHidden' && effect.value === true))
  // 交底后：救出约瑟夫 + 告知秘社 → 进入核心圈，否则只读普通段落。
  assert.equal(flowNode('interludeThreeTruthGate').type, 'branch')
  assert.deepEqual(nodeOptionIds('interludeThreeTruthGate'), ['innerCircle', 'otherwise'])
  assert.deepEqual(matchingOptions('interludeThreeTruthGate', graphCampaign({
    theInvestigatorsRescuedJosef: true, theInvestigatorsToldTheLodgeAboutTheCoven: true,
  })), ['innerCircle'])
  assert.deepEqual(matchingOptions('interludeThreeTruthGate', graphCampaign({
    theInvestigatorsRescuedJosef: true,
  })), ['otherwise'])
  assert.equal(flowNode('interludeThreeTruthGate').options.find(option => option.id === 'innerCircle').next,
    'interludeThreeInnerCircle')
  assert.equal(flowNode('interludeThreeTruthGate').options.find(option => option.id === 'otherwise').next,
    'interludeThreeNotInducted')
  assert.equal(nextOf('interludeThreeInnerCircle'), 'interludeThreeInducted')
  assert.equal(nextOf('interludeThreeInducted'), 'unionAndDisillusion')
  assert.equal(nextOf('interludeThreeNotInducted'), 'unionAndDisillusion')
  assert.ok(flowNode('interludeThreeInducted').effects.some(effect => effect.type === 'record'
    && effect.key === 'theInvestigatorsWereInductedIntoTheInnerCircle' && effect.value === true))
  // 核心圈提问：最多 3 次、选项来自 6 段问答。
  const questions = flowNode('interludeThreeInnerCircle').effects.find(effect => effect.type === 'storyQuestions')
  assert.ok(questions, '核心圈节点缺 storyQuestions 效果')
  assert.equal(questions.max, 3)
  assert.ok(questions.questions.length >= 6, '问答少于 6 段')
  assert.ok(questions.questions.every(question => question.id && question.label && question.text))

  // 聚合幻灭结局门：r2/r9 → 直接收尾；否则 → 混沌魔掌。
  assert.equal(flowNode('unionEndingGate').type, 'branch')
  assert.deepEqual(nodeOptionIds('unionEndingGate'), ['continued', 'ended'])
  for (const resolution of ['r2', 'r9']) {
    assert.deepEqual(matchingOptions('unionEndingGate',
      graphCampaign({}, [{ scenarioId: 'unionAndDisillusion', resolution }])), ['ended'], resolution)
  }
  assert.deepEqual(matchingOptions('unionEndingGate',
    graphCampaign({}, [{ scenarioId: 'unionAndDisillusion', resolution: 'r1' }])), ['continued'])
  assert.equal(flowNode('unionEndingGate').options.find(option => option.id === 'ended').next, 'end')
  assert.equal(flowNode('unionEndingGate').options.find(option => option.id === 'continued').next, 'inTheClutchesOfChaos')

  // 幕间四（扭转命运）→ 尾声。
  assert.equal(nextOf('interludeFour'), 'interludeFourOutro')
  assert.equal(nextOf('interludeFourOutro'), 'beforeTheBlackThrone')

  // 交互节点的正文来自导入段落（未触发的互斥分支不在节点里）。
  const assertNodeText = (nodeId, paragraphs) => {
    assert.ok(String(flowNode(nodeId).text || '').includes(paragraphs[0]), `${nodeId} 缺少导入正文`)
  }
  // 序章节点用 base.prologue.body（导入在 sections.quote；缺失时退回 sections.body）。
  const prologueNarrative = TCU_STORY_TEXT.prologue.sections.quote
    || TCU_STORY_TEXT.prologue.sections.body
  assertNodeText('prologue', prologueNarrative)
  assertNodeText('interludeTwoGone', interludeSections('interludeTwo', 'thePriceOfProgress4'))
  assertNodeText('interludeTwoRescued', interludeSections('interludeTwo', 'thePriceOfProgress5'))
  assertNodeText('interludeTwoAlive', interludeSections('interludeTwo', 'thePriceOfProgress6'))
  assertNodeText('interludeTwoRefused', interludeSections('interludeTwo', 'thePriceOfProgress7'))
  assertNodeText('interludeTwoAgreed', interludeSections('interludeTwo', 'thePriceOfProgress8'))
  assertNodeText('interludeTwoLied', interludeSections('interludeTwo', 'thePriceOfProgress9'))
  assertNodeText('interludeThree', interludeSections('interludeThree', 'theInnerCircle1'))
  assertNodeText('interludeThreeTruth', interludeSections('interludeThree', 'theInnerCircle2'))
  assertNodeText('interludeThreeLie', interludeSections('interludeThree', 'theInnerCircle3'))
  assertNodeText('interludeThreeInnerCircle', interludeSections('interludeThree', 'theInnerCircle4'))
  assertNodeText('interludeThreeInducted', interludeSections('interludeThree', 'theInnerCircle6'))
  assertNodeText('interludeThreeNotInducted', interludeSections('interludeThree', 'theInnerCircle5'))
  assertNodeText('interludeFour', interludeSections('interludeFour', 'twistOfFate1'))
  assertNodeText('interludeFourOutro', interludeSections('interludeFour', 'twistOfFate2'))
  // 幕间二节点本身只挂标题（正文按记录由 tcuFlowStory 展开）。
  assert.equal(String(flowNode('interludeTwo').text || '').includes('thePriceOfProgress'), false)
})

// ===========================================================================
// 13. walkCampaign：幕间按记录/结局分支
// ===========================================================================

test('TCU 幕间流程按记录与结局分支，不泄露未触发分支', () => {
  const resolved = (scenarioId, resolution) => [{ scenarioId, resolution }]

  // 死亡门前 r1（逃出）→ 幕间二 → 亡于迷雾 →《隐秘之名》。
  const escaped = flowState('atDeathsDoorstep', {
    scenarioResults: resolved('atDeathsDoorstep', 'r1'),
    records: { josefDisappearedIntoTheMist: true },
  })
  const gone = walkTo(escaped, 'atDeathsDoorstep', reached => reached.id === 'theSecretName')
  assert.equal(gone.reached.id, 'theSecretName')
  assert.ok(gone.visited.includes('interludeTwo'), '逃出后进入幕间二')
  // 「消失 / 救出 / 存活」是 story 节点，walkCampaign 会连续走完，因此按访问历史断言命中分支。
  const gonePath = escaped.campaign.flow.history.map(entry => entry.nodeId)
  assert.ok(gonePath.includes('interludeTwoGone'), '约瑟夫消失 → 幕间二「消失」分支')
  assert.equal(gonePath.includes('interludeTwoRescued'), false)
  assert.equal(gonePath.includes('interludeTwoAlive'), false)
  assert.equal(escaped.campaign.records.theInvestigatorsAreEnemiesOfTheLodge, true, '消失分支写敌视记录')

  // 死亡门前 r2 → 跳过幕间二，直接《隐秘之名》。
  const skipped = flowState('atDeathsDoorstep', { scenarioResults: resolved('atDeathsDoorstep', 'r2') })
  const direct = walkTo(skipped, 'atDeathsDoorstep', reached => reached.id === 'theSecretName')
  assert.equal(direct.reached.id, 'theSecretName')
  assert.equal(direct.visited.includes('interludeTwo'), false, '未逃出不应进入幕间二')
  assert.deepEqual(direct.visited, ['atDeathsDoorstep', 'theSecretName'])

  // 崇高利益 r1 → 幕间三；r2 → 直接《聚合幻灭》。
  const inducted = flowState('forTheGreaterGood', { scenarioResults: resolved('forTheGreaterGood', 'r1') })
  const interlude = walkTo(inducted, 'forTheGreaterGood', reached => reached.id === 'interludeThree')
  assert.equal(interlude.reached.id, 'interludeThree')
  assert.equal(interlude.visited.includes('unionAndDisillusion'), false)
  const skippedThree = flowState('forTheGreaterGood', { scenarioResults: resolved('forTheGreaterGood', 'r2') })
  const union = walkTo(skippedThree, 'forTheGreaterGood', reached => reached.id === 'unionAndDisillusion')
  assert.equal(union.reached.id, 'unionAndDisillusion')
  assert.equal(union.visited.includes('interludeThree'), false, '未入职不应进入幕间三')

  // 聚合幻灭 r9 → 直接 end（跳过混沌魔掌与幕间四）。
  const ended = flowState('unionAndDisillusion', { scenarioResults: resolved('unionAndDisillusion', 'r9') })
  const ending = walkTo(ended, 'unionAndDisillusion', reached => reached.id === 'end')
  assert.equal(ending.reached.id, 'end')
  assert.equal(ending.visited.includes('inTheClutchesOfChaos'), false)
  assert.equal(ending.visited.includes('interludeFour'), false)

  // 黑色王座 → 尾声 → end；尾声 visit 必须写进 history（供调查纪事展开）。
  const throne = flowState('beforeTheBlackThrone', {})
  const throneEnd = walkTo(throne, 'beforeTheBlackThrone', reached => reached.id === 'end')
  assert.equal(throneEnd.reached.id, 'end')
  const historyIds = throne.campaign.flow.history.map(entry => entry.nodeId)
  assert.ok(historyIds.includes('epilogue'), '黑色王座之后必须进入尾声')
  assert.ok(historyIds.indexOf('epilogue') < historyIds.indexOf('end'))
})

// ===========================================================================
// 14. 幕间二选择边（walkCampaign）
// ===========================================================================

test('TCU 幕间二「同意」选择边写入记录并永久加入异教徒标记', () => {
  const state = flowState('interludeTwoDecision', { records: {} })
  const cultistsBefore = countToken(state.campaign.chaosBag, 'cultist')
  const answers = []
  // 同意后的 thePriceOfProgress8 是 story 节点，walkCampaign 会直接走到《隐秘之名》。
  const run = walkTo(state, 'interludeTwoDecision', reached => reached.id === 'theSecretName',
    (id, node, options) => {
      assert.equal(id, 'interludeTwoDecision')
      assert.deepEqual(options.map(option => option.id).sort(), ['agree', 'lie', 'refuse'])
      answers.push('agree')
      return 'agree'
    })
  assert.deepEqual(answers, ['agree'])
  assert.equal(run.reached.id, 'theSecretName')
  const path = state.campaign.flow.history.map(entry => entry.nodeId)
  assert.ok(path.includes('interludeTwoAgreed'), '同意后进入 «进步的代价 8» 节点')
  assert.equal(path.includes('interludeTwoRefused'), false, '不应进入拒绝节点')
  assert.equal(path.includes('interludeTwoLied'), false, '不应进入撒谎节点')
  assert.equal(state.campaign.records.theInvestigatorsAreMembersOfTheLodge, true)
  assert.equal(state.campaign.records.theInvestigatorsAreDeceivingTheLodge, false, '同意不是撒谎')
  assert.equal(state.campaign.records.theInvestigatorsAreEnemiesOfTheLodge, false)
  assert.equal(countToken(state.campaign.chaosBag, 'cultist'), cultistsBefore + 1, '战役混乱袋永久 +1 异教徒')
  assert.equal(countToken(state.chaosBag, 'cultist'), cultistsBefore + 1, '对局混乱袋同步 +1')
  // 选择必须写进访问历史（调查纪事靠它区分「同意 / 拒绝 / 撒谎」）。
  assert.equal(state.campaign.flow.history.some(entry => entry.choice === 'agree'), true, '访问历史记录选择')
})

// ===========================================================================
// 15. crossOffMementos
// ===========================================================================

test('TCU 幕间三「真相」划掉全部遗留记忆并逐条记录', () => {
  const state = flowState('interludeThreeTruth', { records: {} })
  const mementos = ['mesmerizingFlute', 'strangeIncantation', 'ritualComponents']
  state.campaign.records.mementosDiscovered = [...mementos]
  const effect = flowNode('interludeThreeTruth').effects.find(item => item.type === 'crossOffMementos')
  assert.ok(effect, '幕间三真相缺 crossOffMementos 效果')
  const run = runEffect(state, effect)
  assert.deepEqual(run.campaign.records.mementosDiscovered, [], '遗留记忆必须全部划掉')
  const lines = run.log.filter(line => line.includes('划掉遗留记忆'))
  assert.ok(lines.length >= mementos.length, `逐条日志不足：${run.log.join(' / ')}`)
  for (const id of mementos) {
    assert.ok(lines.some(line => line.includes(MEMENTO_LABELS[id]) || line.includes(id)),
      `划掉 ${id} 没有对应日志`)
  }
  // 已经划掉的集合再结算一次不报错（幂等）。
  const again = runEffect(run, effect)
  assert.deepEqual(again.campaign.records.mementosDiscovered, [])
})

// ===========================================================================
// 16. twistOfFate
// ===========================================================================

test('TCU 幕间四「扭转命运」按记录计分并按难度加入混乱标记', () => {
  const state = flowState('interludeFour', {
    records: {
      youHaveAcceptedYourFate: true,
      theInvestigatorsAskedAnetteForAssistance: true,
      mementosDiscovered: [
        'mesmerizingFlute', 'strangeIncantation', 'ritualComponents',
        'scrapOfTornShadow', 'gilmensJournal', 'keziahsFormulae',
      ],
    },
  })
  const effect = flowNode('interludeFour').effects.find(item => item.type === 'twistOfFate')
  assert.ok(effect, '幕间四缺 twistOfFate 效果')
  assert.equal(effect.record, 'thePathWindsBeforeYou')
  const minusFourBefore = countToken(state.campaign.chaosBag, '-4')
  const logBefore = state.log.length
  const run = runEffect(state, effect)
  // 参照 TheCircleUndone.hs：接受命运 1 + 请求安妮特 2 + 记忆 ≥3 计 1 + ≥6 计 1 = 5。
  assert.equal(run.campaign.records.thePathWindsBeforeYou, 5, '扭转命运总记录数')
  assert.equal(countToken(run.campaign.chaosBag, '-4'), minusFourBefore + 1, 'standard 难度加入 -4')
  assert.equal(countToken(run.chaosBag, '-4'), minusFourBefore + 1, '对局混乱袋同样加入 -4')
  assert.ok(run.log.length > logBefore, '扭转命运没有写日志')
  assert.ok(run.log.some(line => line.includes('thePathWindsBeforeYou') || line.includes('命运')),
    `缺少命中项/总分日志：${run.log.join(' / ')}`)
  // 字段校验失败必须抛错，不能静默跳过。
  assert.throws(() => applyCampaignEffect(clone(state), { type: 'twistOfFate' }, () => {}))
})

// ===========================================================================
// 17. storyQuestions
// ===========================================================================

test('TCU 幕间三「核心圈」提问最多三次且所选段落进入纪事', () => {
  const state = flowState('interludeThreeInnerCircle', { records: {} })
  const effect = flowNode('interludeThreeInnerCircle').effects.find(item => item.type === 'storyQuestions')
  assert.ok(effect, '核心圈节点缺 storyQuestions 效果')
  assert.equal(effect.max, 3)
  const doneOptionOf = choice => choice.options.find(option =>
    option.id === 'done' || option.label === effect.doneLabel)
  const offered = []
  const asked = []
  const run = runEffect(state, effect, choice => {
    offered.push(choice.options.map(option => option.id))
    const done = doneOptionOf(choice)
    const questions = choice.options.filter(option => option !== done)
    assert.ok(questions.length > 0, '还能提问时选项里应有问题')
    asked.push(questions[0].id)
    return questions[0].id
  })
  assert.equal(asked.length, 3, '最多只问 3 次')
  assert.equal(new Set(asked).size, 3, '同一问题不重复')
  const sections = run.campaign.storySections?.interludeThreeInnerCircle || []
  const textOf = Object.fromEntries(effect.questions.map(question => [question.id, question.text]))
  assert.deepEqual(sections, asked.map(id => textOf[id]), '所选问答段落必须进入纪事')
  assert.ok(run.log.some(line => asked.some(id => line.includes(textOf[id]))), '提问也要写日志')
  // 已经问过的问题不再出现在后续选项里（第 n 次提问的选项必须排除前 n-1 个已问问题）。
  for (let index = 1; index < offered.length; index++) {
    for (const id of asked.slice(0, index)) assert.equal(offered[index].includes(id), false, `问题 ${id} 被重复提供`)
  }
  // 选「结束提问」立即停止，不写入纪事。
  const stopped = runEffect(state, effect, choice => {
    const done = doneOptionOf(choice)
    assert.ok(done, '选项里没有结束项')
    return done.id
  })
  assert.deepEqual(stopped.campaign.storySections?.interludeThreeInnerCircle || [], [])
})

// ===========================================================================
// 18. 尾声按记录组装
// ===========================================================================

test('TCU 尾声按记录组装，只包含命中的片段与结局标签', () => {
  const epilogueEntry = (records, extra = {}) => {
    const campaign = campaignFixture({
      records: { ...clone(recordDefaults), ...clone(records) },
      flow: { nodeId: 'epilogue', history: [{ nodeId: 'epilogue', visit: 1 }], visits: { epilogue: 1 } },
      ...extra,
    })
    const state = { campaign, chaosBag: [], uiState: 'campaignResult' }
    const entry = campaignStory(state, contentRegistry).entries.find(item => item.nodeId === 'epilogue')
    assert.ok(entry, '调查纪事里没有尾声条目')
    assert.equal(entry.kind, 'interlude')
    return entry
  }
  const contains = (text, section) => text.includes(section[0].slice(0, 20))
  const absent = (text, section) => !contains(text, section)

  // 只命中「逮捕安妮特」+ 女巫集会结局：其它片段不能出现。
  const partial = epilogueEntry({
    theInvestigatorsArrestedAnette: true,
    theCovenOfKeziahHoldsTheWorldInItsGrasp: true,
    youAreBeingHunted: ['0'],
  })
  assert.equal(partial.title, TCU_STORY_TEXT.epilogue.title)
  const partialText = partial.paragraphs.join('\n')
  const endingLabel = manifest.endings.find(ending => ending.id === 'covenHoldsTheWorld').label
  assert.ok(partialText.includes('【战役结局】'), '尾声缺少结局标签行')
  assert.ok(partialText.includes(endingLabel), `结局标签应为 ${endingLabel}`)
  assert.ok(contains(partialText, epilogueSections('arrestedAnette')), '命中的逮捕片段缺失')
  assert.ok(contains(partialText, epilogueSections('youAreBeingHunted')), '被追捕记录数组非空时应追加片段')
  assert.ok(absent(partialText, epilogueSections('assumedControlOfTheLodge')), '未命中的控制秘社片段泄露')
  assert.ok(absent(partialText, epilogueSections('survivedTheWatchersEmbrace')), '未命中的看守人之拥片段泄露')
  assert.ok(absent(partialText, epilogueSections('signedTheBlackBook')), '未命中的黑书片段泄露')

  // 全部命中：四段记录片段 + 被追捕都追加。结局标签按 manifest.endings 顺序取第一个命中的
  // 记录（签名黑书排在音讯全无之前）。
  const full = epilogueEntry({
    theInvestigatorsArrestedAnette: true,
    theInvestigatorsAssumedControlOfTheSilverTwilightLodge: true,
    theInvestigatorsSurvivedTheWatchersEmbrace: true,
    theInvestigatorsSignedTheBlackBookOfAzathoth: true,
    youAreBeingHunted: ['0', '1'],
    theInvestigatorsAreNeverSeenOrHeardFromAgain: true,
  })
  const fullText = full.paragraphs.join('\n')
  const signedLabel = manifest.endings.find(ending => ending.id === 'signedTheBlackBook').label
  assert.ok(fullText.includes(signedLabel), '多个结局记录命中时按 endings 顺序取第一个标签')
  for (const key of ['arrestedAnette', 'assumedControlOfTheLodge', 'survivedTheWatchersEmbrace',
    'signedTheBlackBook', 'youAreBeingHunted']) {
    assert.ok(contains(fullText, epilogueSections(key)), `命中的 ${key} 片段缺失`)
  }
  const neverLabel = manifest.endings.find(ending => ending.id === 'neverSeenOrHeardFromAgain').label
  const never = epilogueEntry({ theInvestigatorsAreNeverSeenOrHeardFromAgain: true })
  assert.ok(never.paragraphs.join('').includes(neverLabel), '音讯全无结局标签')

  // 什么记录都没有：仍返回尾声标题 + 至少一条通用收尾行，不得留空。
  const empty = epilogueEntry({})
  assert.ok(empty.paragraphs.length >= 1, '无命中时尾声正文不得为空')
  assert.ok(empty.paragraphs.join('').length > 0)
  assert.equal(empty.paragraphs.join('').includes('【战役结局】'), false, '无记录时不应有结局标签')
  for (const key of ['arrestedAnette', 'assumedControlOfTheLodge', 'survivedTheWatchersEmbrace',
    'signedTheBlackBook', 'youAreBeingHunted']) {
    assert.ok(absent(empty.paragraphs.join('\n'), epilogueSections(key)), `未命中的 ${key} 片段泄露`)
  }

  // 私密故事不进入公开尾声投影。
  const privateStory = {
    id: 'tcuPrivateEpilogue',
    title: '甲的秘密尾声',
    text: '这部分只有甲能看到。',
    audienceInvestigatorIds: ['inv-0'],
  }
  const withPrivate = epilogueEntry({ theInvestigatorsArrestedAnette: true }, { privateStories: [privateStory] })
  assert.equal(withPrivate.paragraphs.join('').includes('这部分只有甲能看到。'), false, '公开尾声泄露私密故事')
  const ownPrivate = campaignStory({
    campaign: campaignFixture({
      privateStories: [privateStory],
      flow: { nodeId: 'epilogue', history: [{ nodeId: 'epilogue', visit: 1 }], visits: { epilogue: 1 } },
    }),
    chaosBag: [],
    uiState: 'campaignResult',
  }, contentRegistry, 0).entries.filter(entry => entry.id.startsWith('private:'))
  assert.equal(ownPrivate.length, 1, '本人能看到自己的私密尾声故事')
})
