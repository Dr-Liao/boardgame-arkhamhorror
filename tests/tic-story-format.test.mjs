// P0/P1 回归：TIC 剧情/设置文本的展示格式（分段、ICU 转义、Markdown 强调、英文标签）。
//
// 根因（docs/translate/findings.json story-0004/0005/0006/0009、setup-0001/0002）：
//   · textBlocks() 过去把整串 HTML 折成单段，故事日志/纪事里多段正文被 HTML 折叠；
//   · 参考 zh locale 的 i18next 转义 `{'{'}cultist{'}'}` 没有还原，闪现记忆里原样显示；
//   · 设置正文里的 Markdown 强调（*遭遇组名*）、悬空「图标」句和 ICU 转义会进入设置回退面板；
//   · 结局正文段首的「结局 N：」与结局面板标题重复。
import test from 'node:test'
import assert from 'node:assert/strict'
import { buildChapterDefinition, textBlocks } from '../content/campaigns/theInnsmouthConspiracy/chapter-definition.js'
import { STORY_TEXT } from '../content/campaigns/theInnsmouthConspiracy/story-text.js'
import { story } from '../content/campaigns/theInnsmouthConspiracy/flashbacks.js'

test('P0 TIC 导入正文按段落拆分，章节 intro 保留完整多段正文', () => {
  const blocks = textBlocks(STORY_TEXT.zh.scenarios.thePitOfDespair.intro)
  assert.ok(blocks.length >= 3, 'intro 应拆成多段')
  for (const block of blocks) assert.doesNotMatch(block, /<[a-z][^>]*>/i, '段落内不得残留 HTML')
  const scenario = buildChapterDefinition('thePitOfDespair').scenario
  assert.ok(scenario.intro.includes('\n\n'), 'scenario.intro 应保留段落分隔')
  assert.doesNotMatch(scenario.intro, /<[a-z][^>]*>/i)
})

test('P0 TIC 闪现记忆把 ICU 转义还原为混乱标记图标', () => {
  const presented = []
  const state = { scenario: { id: 'thePitOfDespair' }, campaign: { chaosBag: [] } }
  const api = { present: text => presented.push(text), choose: () => null }
  story(state, api, 'flashback2')
  story(state, api, 'flashback3')
  story(state, api, 'flashback4')
  const joined = presented.join('\n')
  assert.match(joined, /\[cultist\]/)
  assert.match(joined, /\[tablet\]/)
  assert.match(joined, /\[elder_thing\]/)
  assert.doesNotMatch(joined, /\{'\{/, '不得泄漏 i18next 转义')
  assert.match(joined, /记忆闪回II/, '闪现记忆保留标题与正文')
})

test('P0 TIC 设置文本还原 ICU 转义、去掉 Markdown 强调', () => {
  const lair = buildChapterDefinition('theLairOfDagon').scenario
  assert.match(lair.setup, /\[bless\]/)
  assert.match(lair.setup, /\[curse\]/)
  assert.doesNotMatch(lair.setup, /\{'\{/)
  const vanishing = buildChapterDefinition('theVanishingOfElinaHarper').scenario
  assert.doesNotMatch(vanishing.setup, /\*[^*\n]+\*/, '设置正文不得保留 Markdown 星号')
})

test('P0 TIC 中文剧情段首的英文分节标签改为中文', () => {
  const intro4 = textBlocks(STORY_TEXT.zh.scenarios.theLairOfDagon.intro4)
  const intro5 = textBlocks(STORY_TEXT.zh.scenarios.theLairOfDagon.intro5)
  assert.match(intro4[0], /^引言 4：/)
  assert.match(intro5[0], /^引言 5：/)
  const joined = [...intro4, ...intro5].join('\n')
  assert.doesNotMatch(joined, /\b(?:Intro|Resolution)\s*\d*\s*[:：]/, '不得残留英文分节标签')
})

test('P1 TIC 闪现记忆不再保留 Markdown 强调记号（story-0006）', () => {
  const presented = []
  const state = { scenario: { id: 'thePitOfDespair' }, campaign: { chaosBag: [] } }
  const api = { present: text => presented.push(text), choose: () => null }
  story(state, api, 'flashback1')
  const text = presented.join('\n')
  assert.doesNotMatch(text, /[*_]/, '正文不得残留 *…* / _…_ 强调记号')
  assert.match(text, /托马斯·道森/)
})

test('P1 TIC 全部设置正文无 Markdown/HTML/悬空图标句（setup-0002）', () => {
  for (const id of ['thePitOfDespair', 'theVanishingOfElinaHarper', 'inTooDeep', 'devilReef',
    'aLightInTheFog', 'theLairOfDagon', 'horrorInHighGear', 'intoTheMaelstrom']) {
    const setup = buildChapterDefinition(id).scenario.setup
    assert.doesNotMatch(setup, /[*<>]/, `${id} 设置仍有 Markdown/HTML 记号`)
    assert.doesNotMatch(setup, /遭遇(?:组|牌)[^。\n]*(?:图标|圖標)[^。\n]*[：:]/, `${id} 设置仍有悬空图标句`)
  }
})

test('P1 TIC 结局正文不再重复段首「结局 N：」标签（story-0009）', () => {
  const scenario = buildChapterDefinition('inTooDeep').scenario
  for (const [key, text] of Object.entries(scenario.resolutions)) {
    assert.doesNotMatch(text, /^(?:结局|尾声|无结局)\s*\d*\s*[:：]/, `${key} 正文重复结局标签`)
  }
  const presented = []
  const state = { scenario: { id: 'inTooDeep' }, campaign: { chaosBag: [] } }
  const api = { present: text => presented.push(text), choose: () => null }
  story(state, api, 'resolutions.resolution1')
  assert.doesNotMatch(presented.join('\n'), /^(?:结局|尾声|无结局)\s*\d*\s*[:：]/, '闪现结局正文重复结局标签')
})

