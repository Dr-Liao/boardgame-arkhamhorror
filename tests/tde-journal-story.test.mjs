// 食梦者（The Dream-Eaters）· 调查纪事 / 故事导入投影回归。
//
// 用户 bug：「ArkhamHorror 五循环食梦者的故事导入完全错误」——调查纪事只剩
// 「剧本 I-A：梦境门外 / 按玩家顺序，每名调查员选择下列……并大声朗读…」这类 Setup 操作说明。
// 根因：src/campaign/story.js 的 introduction() 没有食梦者分支，8 章全部回退到 `sc.intro`，
// 既没有战役序章，也没有各章「开场 N」叙事。
//
// 本文件锁住 task-1 修复后的投影口径：
//   · 结构：{ version: 3, title, sections: [{ title, paragraphs }], paragraphs }，
//     且 paragraphs 必须等于 sections 摊平（调查纪事/故事导入都读这一份）；
//   · 战役序章（1925 年 2 月 13 日 / 维吉尔·格雷）只叠在本局第一关（A1/B1），第二关起不重复；
//   · A1：梦境选择说明 + 14 条梦境正文 + 14 条「效果：」；
//   · B1/A2/B2/A3/B3/A4/B4：按战役记录 / 在场调查员分支，只投影本局实际到达的开场段；
//   · 未到达的分支（如 A2 的〈开场 7〉）不投影，正文为中文、无 HTML、无 {占位模板}；
//   · campaignStory 历史投影：第一关 introStory 带序章 + 梦境，第二关不带序章。
//
// 数据来源：content/campaigns/theDreamEaters/story-text.js（P8-T 中文自译生成物）与
// content/campaigns/theDreamEaters/scenarios/<id>/index.js 的真实 scenario 对象；
// 分支条件对齐参考实现 Scenario/Scenarios/TheDreamEaters/*.hs 的 PreScenarioSetup。
import test from 'node:test'
import assert from 'node:assert/strict'

import { campaignStory, introduction } from '../src/campaign/story.js'
import { TDE_STORY_TEXT } from '../content/campaigns/theDreamEaters/story-text.js'
import { scenario as beyondTheGatesOfSleep } from '../content/campaigns/theDreamEaters/scenarios/beyondTheGatesOfSleep/index.js'
import { scenario as wakingNightmare } from '../content/campaigns/theDreamEaters/scenarios/wakingNightmare/index.js'
import { scenario as theSearchForKadath } from '../content/campaigns/theDreamEaters/scenarios/theSearchForKadath/index.js'
import { scenario as aThousandShapesOfHorror } from '../content/campaigns/theDreamEaters/scenarios/aThousandShapesOfHorror/index.js'
import { scenario as darkSideOfTheMoon } from '../content/campaigns/theDreamEaters/scenarios/darkSideOfTheMoon/index.js'
import { scenario as pointOfNoReturn } from '../content/campaigns/theDreamEaters/scenarios/pointOfNoReturn/index.js'
import { scenario as whereTheGodsDwell } from '../content/campaigns/theDreamEaters/scenarios/whereTheGodsDwell/index.js'
import { scenario as weaverOfTheCosmos } from '../content/campaigns/theDreamEaters/scenarios/weaverOfTheCosmos/index.js'

const TDE_SCENARIOS = [
  beyondTheGatesOfSleep, wakingNightmare, theSearchForKadath, aThousandShapesOfHorror,
  darkSideOfTheMoon, pointOfNoReturn, whereTheGodsDwell, weaverOfTheCosmos,
]
const SCENARIO_BY_ID = new Map(TDE_SCENARIOS.map(scenario => [scenario.id, scenario]))
const IDS = TDE_SCENARIOS.map(scenario => scenario.id)
const CHAPTERS = TDE_STORY_TEXT.chapters

// 本局第一关（a1/b1 谁先开都可以）：导入要读战役序章。
const FIRST_SCENARIO_CONTEXT = Object.freeze({ campaign: { scenarioResults: [] } })
// 已经有结算记录的上下文：不再是第一关。
const LATER_CONTEXT = Object.freeze({ campaign: { scenarioResults: [{ scenarioId: 'beyondTheGatesOfSleep' }] } })

const journalOf = (id, records = {}, context = null) => {
  const scenario = SCENARIO_BY_ID.get(id)
  assert.ok(scenario, `未知食梦者章节 ${id}`)
  return introduction(scenario, records, context)
}
const textOf = (id, records = {}, context = null) => journalOf(id, records, context).paragraphs.join('\n')

// --- 结构 ---------------------------------------------------------------

test('食梦者 8 章导入返回 v3 调查纪事结构，paragraphs 等于 sections 摊平', () => {
  for (const id of IDS) {
    const journal = journalOf(id)
    assert.equal(journal.version, 3, `${id} 导入版本应为 3`)
    assert.equal(journal.title, SCENARIO_BY_ID.get(id).name, `${id} 标题应是章节名`)
    assert.ok(Array.isArray(journal.sections) && journal.sections.length > 0, `${id} 缺 sections`)
    for (const section of journal.sections) {
      assert.ok(Object.hasOwn(section, 'title'), `${id} section 缺 title 字段`)
      assert.ok(Array.isArray(section.paragraphs) && section.paragraphs.length > 0, `${id} section 缺 paragraphs`)
      for (const paragraph of section.paragraphs) {
        assert.equal(typeof paragraph, 'string', `${id} 段落不是字符串`)
        assert.ok(paragraph.trim().length > 0, `${id} 有空段落`)
      }
    }
    assert.deepEqual(journal.paragraphs, journal.sections.flatMap(section => section.paragraphs),
      `${id} paragraphs 必须等于 sections 摊平结果`)
  }
})

// --- A1《梦境门外》------------------------------------------------------

test('A1 梦境门外：本局第一关导入带战役序章（1925 年 2 月 13 日 / 维吉尔·格雷）', () => {
  const journal = journalOf('beyondTheGatesOfSleep', {}, FIRST_SCENARIO_CONTEXT)
  assert.ok(journal.paragraphs.some(paragraph => paragraph.includes('1925 年 2 月 13 日')),
    '首关导入缺战役序章：1925 年 2 月 13 日')
  assert.ok(journal.paragraphs.some(paragraph => paragraph.includes('维吉尔·格雷')),
    '首关导入缺战役序章：维吉尔·格雷')
  assert.ok(textOf('beyondTheGatesOfSleep', {}, FIRST_SCENARIO_CONTEXT).includes('按玩家顺序'),
    '导入缺梦境选择说明（按玩家顺序……）')
})

test('A1 梦境门外：导入包含 14 条梦境正文（中立 2 条）与 14 条「效果：」', () => {
  const journal = journalOf('beyondTheGatesOfSleep', {}, FIRST_SCENARIO_CONTEXT)
  const dreams = CHAPTERS.beyondTheGatesOfSleep.sections.dreams
  assert.ok(dreams, 'story-text 缺 A1 dreams 段')
  assert.equal(Object.keys(dreams).length, 14, 'A1 应有 14 条梦境')

  // 用户能看到的「XX 之梦：」条目名（来自 en locale 自译），缺一条即视为导入不完整。
  const prefixes = {
    guardian: '守卫者之梦：',
    seeker: '探求者之梦：',
    rogue: '流浪者之梦：',
    mystic: '神秘学家之梦：',
    survivor: '幸存者之梦：',
    criminal: '罪犯之梦：',
    drifter: '漂泊者之梦：',
    hunter: '猎人之梦：',
    medicOrAssistant: '医生或助手之梦：',
    miskatonicOrScholar: '密斯卡托尼克或学者之梦：',
    veteran: '老兵之梦：',
    wayfarer: '旅人之梦：',
    neutral1: '中立之梦：',
    neutral2: '中立之梦：',
  }
  assert.deepEqual(Object.keys(prefixes).sort(), Object.keys(dreams).sort(), '梦境 key 集合应与 story-text 一致')
  for (const [key, prefix] of Object.entries(prefixes)) {
    assert.ok(String(dreams[key]?.body).startsWith(prefix), `${key} 正文应以「${prefix}」开头`)
    assert.ok(journal.paragraphs.includes(dreams[key].body), `导入缺梦境正文 ${key}（${prefix}）`)
  }
  assert.equal(journal.paragraphs.filter(paragraph => paragraph.startsWith('中立之梦：')).length, 2,
    '「中立之梦」应出现 2 次')
  for (const [key, dream] of Object.entries(dreams)) {
    assert.ok(dream.effect, `${key} 缺梦境效果正文`)
    assert.ok(journal.paragraphs.includes(`效果：${dream.effect}`), `导入缺梦境效果 ${key}（效果：……）`)
  }
  assert.equal(journal.paragraphs.filter(paragraph => paragraph.startsWith('效果：')).length, 14,
    '14 条梦境都应带一条「效果：」段落')
})

test('A1/B1 战役序章只属于本局第一关，已有结算记录时不重复投影', () => {
  // 逐段比对：B1 自己的开场正文也会提到「维吉尔·格雷」，只有序章原文段落才算重复。
  const prologueParagraphs = [
    ...TDE_STORY_TEXT.prologue.opening.paragraphs,
    ...TDE_STORY_TEXT.prologue.prologue.paragraphs,
  ]
  for (const id of ['beyondTheGatesOfSleep', 'wakingNightmare']) {
    const journal = journalOf(id, {}, LATER_CONTEXT)
    assert.ok(!journal.paragraphs.some(paragraph => paragraph.includes('1925 年 2 月 13 日')),
      `${id} 非首关不应再读序章（1925 年 2 月 13 日）`)
    for (const paragraph of prologueParagraphs) {
      assert.ok(!journal.paragraphs.includes(paragraph), `${id} 非首关不应再投影序章原文段落`)
    }
  }
})

// --- B1《清醒噩梦》------------------------------------------------------

test('B1 清醒噩梦：首关带序章与开场 1，医生去留按记录投影开场 2/3', () => {
  const first = textOf('wakingNightmare', {}, FIRST_SCENARIO_CONTEXT)
  assert.ok(first.includes('1925 年 2 月 13 日'), 'B1 作为首关时应读战役序章')
  assert.ok(first.includes('开场 1：'), 'B1 导入恒有开场 1')

  assert.ok(textOf('wakingNightmare', { drMaheswaranJoinedTheInvestigation: true }).includes('开场 2：'),
    '记录「马斯沃伦医生与你一同调查」时应投影开场 2')
  assert.ok(textOf('wakingNightmare', { drMaheswaranStayedWithHerPatients: true }).includes('开场 3：'),
    '记录「马斯沃伦医生留在病人身边」时应投影开场 3')
})

// --- A2《寻觅卡达斯》----------------------------------------------------

test('A2 寻觅卡达斯：按记录投影开场 1/3/5/6/9/10/11，未到达的分支不投影', () => {
  // 三种记录都没有（单章试玩）：官方开场 5 的二选一由章节 behavior 结算，导入只投影到选择段。
  const standalone = textOf('theSearchForKadath')
  assert.ok(standalone.includes('开场 1：'), 'A2 导入恒有开场 1')
  assert.ok(standalone.includes('开场 5：'), '缺少记录时应投影开场 5')

  // 本仓库 behavior 对「谈判 / 被伦道夫救下」是近似（直接进神庙，不朗读官方敌对版开场 5）：
  // 被救下 → 开场 9 + 开场 11；谈判 → 开场 9 + 开场 10。不能投影没有发生过的开场 5/7。
  const saved = textOf('theSearchForKadath', { theInvestigatorsWereSavedByRandolphCarder: true })
  assert.ok(saved.includes('开场 9：'), '被伦道夫救下时应投影开场 9')
  assert.ok(saved.includes('开场 11：'), '被伦道夫救下时应投影开场 11')
  assert.ok(!saved.includes('开场 5：'), '被伦道夫救下时不应再投影开场 5')
  assert.ok(!saved.includes('开场 7：'), '被伦道夫救下时不应投影开场 7')
  assert.ok(!saved.includes('开场 10：'), '被伦道夫救下时不应投影开场 10')

  const parleyed = textOf('theSearchForKadath', { theInvestigatorsParleyedWithTheZoogs: true })
  assert.ok(parleyed.includes('开场 9：'), '与祖格鼠谈判过时应投影开场 9')
  assert.ok(parleyed.includes('开场 10：'), '与祖格鼠谈判过时应投影开场 10')
  assert.ok(!parleyed.includes('开场 5：'), '与祖格鼠谈判过时不应再投影开场 5')
  assert.ok(!parleyed.includes('开场 7：'), '与祖格鼠谈判过时不应投影开场 7')
  assert.ok(!parleyed.includes('开场 11：'), '与祖格鼠谈判过时不走开场 11')

  // 猫群收到贡品 → 友好进神庙：开场 6 → 开场 9 → 开场 11（参考实现 DoStep 6/9/11）。
  const tribute = textOf('theSearchForKadath', { theCatsCollectedTheirTributeFromTheZoogs: true })
  for (const key of ['开场 6：', '开场 9：', '开场 11：']) {
    assert.ok(tribute.includes(key), `猫群收到贡品时应投影〈${key.replace('：', '')}〉`)
  }

  // 卢克·罗宾逊（06004）在队 → 读开场 3（参考实现 InvestigatorWithTitle "Luke Robinson"）。
  const withLuke = textOf('theSearchForKadath', {}, {
    campaign: { investigators: { 0: { seat: 0, code: '06004' } } },
  })
  assert.ok(withLuke.includes('开场 3：'), '卢克·罗宾逊在队时应投影开场 3')
})

// --- B2《万千骇形》------------------------------------------------------

test('B2 万千骇形：黑猫在侧读开场 2，否则读开场 3；开场 4 恒有', () => {
  const atYourSide = textOf('aThousandShapesOfHorror', { theBlackCatIsAtYourSide: true })
  assert.ok(atYourSide.includes('开场 2：'), '「黑猫在你身边」时应读开场 2')
  assert.ok(atYourSide.includes('开场 4：'), 'B2 导入恒有开场 4')

  const withoutCat = textOf('aThousandShapesOfHorror', {})
  assert.ok(withoutCat.includes('开场 3：'), '黑猫不在身边时应读开场 3')
  assert.ok(withoutCat.includes('开场 4：'), 'B2 导入恒有开场 4')
})

// --- A3《月之暗面》------------------------------------------------------

test('A3 月之暗面：有调查员被俘读开场 1，无人被俘读开场 2', () => {
  // 记录只有「谁被俘」，开场 2 是「至少 1 人未被俘」分支，所以要带调查员名单（与 setup 注入的 state 一致）。
  const context = { investigators: [{ seat: 0, code: '06001' }] }
  const captured = journalOf('darkSideOfTheMoon', { wasCaptured: ['06001'] }, context)
  const capturedText = captured.paragraphs.join('\n')
  assert.ok(capturedText.includes('开场 1：'), '有调查员被俘时应读开场 1')
  assert.ok(!capturedText.includes('开场 2：'), '全员被俘时不应投影开场 2')

  const free = journalOf('darkSideOfTheMoon', { wasCaptured: [] }, context)
  const freeText = free.paragraphs.join('\n')
  assert.ok(freeText.includes('开场 2：'), '无人被俘时应读开场 2')
  assert.ok(!freeText.includes('开场 1：'), '无人被俘时不应投影开场 1')
})

// --- B3《无归之地》------------------------------------------------------

test('B3 无归之地：伦道夫遇难读开场 1，安全下降读开场 2', () => {
  assert.ok(textOf('pointOfNoReturn', { randolphDidNotSurviveTheDescent: true }).includes('开场 1：'),
    '「伦道夫在下降到地下世界的途中遇难」时应读开场 1')
  assert.ok(textOf('pointOfNoReturn', { randolphSurvivedTheDescent: true }).includes('开场 2：'),
    '「伦道夫安全下降到地下世界」时应读开场 2')
})

// --- A4《神居之所》------------------------------------------------------

test('A4 神居之所：被带到冰封荒土读开场 1，自行前往读开场 2', () => {
  assert.ok(textOf('whereTheGodsDwell', { theInvestigatorsWereCarriedToTheColdWastes: true }).includes('开场 1：'),
    '「调查员被带到冰封荒土」时应读开场 1')
  assert.ok(textOf('whereTheGodsDwell', { theInvestigatorsTraveledToTheColdWastes: true }).includes('开场 2：'),
    '「调查员前往冰封荒土」时应读开场 2')
})

// --- B4《编织宇宙》------------------------------------------------------

test('B4 编织宇宙：导入正文含「一切都指向此处」', () => {
  assert.ok(textOf('weaverOfTheCosmos').includes('一切都指向此处'), 'B4 导入缺「一切都指向此处」正文')
})

// --- 8 章统一质量门禁 ----------------------------------------------------

test('8 章导入都是完整中文叙事：>120 字、非「查看战役日志」操作说明、无 HTML/占位模板', () => {
  // 每章给一组「本局确实到达叙事分支」的记录/上下文，验证导入不会再退回 sc.intro。
  const cases = [
    ['beyondTheGatesOfSleep', {}, FIRST_SCENARIO_CONTEXT, ['1925 年 2 月 13 日', '守卫者之梦：']],
    ['wakingNightmare', {}, FIRST_SCENARIO_CONTEXT, ['开场 1：']],
    ['theSearchForKadath', { theCatsCollectedTheirTributeFromTheZoogs: true }, null, ['开场 1：']],
    ['aThousandShapesOfHorror', { theBlackCatIsAtYourSide: true }, null, ['开场 2：']],
    ['darkSideOfTheMoon', { wasCaptured: ['06001'] }, { investigators: [{ seat: 0, code: '06001' }] }, ['开场 1：']],
    ['pointOfNoReturn', { randolphDidNotSurviveTheDescent: true }, null, ['开场 1：']],
    ['whereTheGodsDwell', { theInvestigatorsWereCarriedToTheColdWastes: true }, null, ['开场 1：']],
    ['weaverOfTheCosmos', {}, null, ['一切都指向此处']],
  ]
  for (const [id, records, context, anchors] of cases) {
    const journal = journalOf(id, records, context)
    const joined = journal.paragraphs.join('')
    assert.ok(joined.length > 120, `${id} 导入正文过短（${joined.length} 字符），仍像操作说明`)
    for (const anchor of anchors) assert.ok(joined.includes(anchor), `${id} 缺叙事锚点「${anchor}」`)
    // 契约：叙事分支适用时，不得只投影「查看战役日志」这类 Setup 说明段。
    // 只有首段是「查看战役日志」的 narration 条目才算操作说明（B4 的 intro 本身就是叙事）。
    const prefatory = (CHAPTERS[id].narration || []).filter(entry => entry.key === 'intro'
      && entry.paragraphs?.length && String(entry.paragraphs[0]).startsWith('查看战役日志'))
    for (const entry of prefatory) {
      assert.ok(!journal.sections.some(section => section.paragraphs.length === entry.paragraphs.length
        && section.paragraphs.every((paragraph, index) => paragraph === entry.paragraphs[index])),
      `${id} 仍只投影了「查看战役日志」操作说明`)
    }
    assert.doesNotMatch(joined, /<[a-zA-Z/]/, `${id} 导入含 HTML 标记`)
    assert.ok(!joined.includes('{'), `${id} 导入含 {占位模板}`)
  }
})

// --- 调查纪事历史投影 ----------------------------------------------------

test('调查纪事：首关 introStory 保存序章 + 梦境，第二关历史不重复序章', () => {
  const registry = {
    getCampaign: id => ({ id, flow: { nodes: {} } }),
    getScenarioData: id => SCENARIO_BY_ID.get(id) || null,
  }
  const investigators = [{ seat: 0, code: '06001', status: 'active', resigned: false, defeated: false }]

  // 第一关：setup() 时 campaign.scenarioResults 为空 → 序章随故事导入一起保存。
  const firstSnapshot = introduction(beyondTheGatesOfSleep, {}, FIRST_SCENARIO_CONTEXT)
  const firstResult = {
    scenarioId: 'beyondTheGatesOfSleep', scenarioIndex: 0, visitId: 'beyondTheGatesOfSleep:1',
    resolution: 'resolution1', storyResolution: 'resolution1',
    introStory: firstSnapshot,
    recordsBefore: {}, recordsAfter: { theCatsCollectedTheirTributeFromTheZoogs: true },
    investigators,
    story: { version: 3, title: '结局 1', paragraphs: ['梦寻的第一关到此结束。'] },
    victory: 1, rounds: 4,
  }
  // 第二关：setup() 时已经有一条结算记录 → 不再叠战役序章；记录走祖格鼠贡品分支。
  const secondSnapshot = introduction(theSearchForKadath, { ...firstResult.recordsAfter }, {
    campaign: { scenarioResults: [firstResult] },
    investigators,
  })
  const secondResult = {
    scenarioId: 'theSearchForKadath', scenarioIndex: 1, visitId: 'theSearchForKadath:1',
    resolution: 'resolution1', storyResolution: 'resolution1',
    introStory: secondSnapshot,
    recordsBefore: { ...firstResult.recordsAfter }, recordsAfter: { ...firstResult.recordsAfter },
    investigators,
    story: { version: 3, title: '结局 1', paragraphs: ['梦寻的第二关到此结束。'] },
    victory: 0, rounds: 3,
  }
  const state = {
    uiState: 'scenarioResult',
    chaosBag: [],
    campaign: {
      id: 'theDreamEaters', leadSeat: 0, records: {}, scenarioResults: [firstResult, secondResult],
      flow: { nodeId: null, history: [] }, investigators: { 0: investigators[0] },
      retired: [], privateStories: [],
    },
  }

  const { entries } = campaignStory(state, registry)
  const introEntries = entries.filter(entry => entry.kind === 'intro')
  assert.equal(introEntries.length, 2, '两条 scenarioResults 应各投影一条历史导入')

  const firstIntro = introEntries.find(entry => entry.scenarioId === 'beyondTheGatesOfSleep')
  assert.ok(firstIntro, '缺第一关历史导入')
  assert.equal(firstIntro.id, 'beyondTheGatesOfSleep:1:intro')
  const firstText = firstIntro.paragraphs.join('\n')
  assert.ok(firstText.includes('1925 年 2 月 13 日'), '第一关历史导入应保留战役序章')
  assert.ok(firstText.includes('按玩家顺序'), '第一关历史导入应保留梦境选择说明')
  assert.ok(firstText.includes('守卫者之梦：'), '第一关历史导入应保留梦境正文')

  const secondIntro = introEntries.find(entry => entry.scenarioId === 'theSearchForKadath')
  assert.ok(secondIntro, '缺第二关历史导入')
  assert.equal(secondIntro.id, 'theSearchForKadath:1:intro')
  const secondText = secondIntro.paragraphs.join('\n')
  assert.ok(!secondText.includes('1925 年 2 月 13 日'), '第二关历史导入不应重复战役序章')
  assert.ok(secondText.includes('开场 '), '第二关历史导入仍应是该章的开场叙事')
})
