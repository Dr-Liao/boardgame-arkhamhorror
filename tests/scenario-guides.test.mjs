import test from 'node:test'
import assert from 'node:assert/strict'
import { contentRegistry } from '../content/registered.js'
import { scenarioGuide, scenarioSetupText } from '../content/scenario-guides.js'
import { createGameState } from '../src/engine/engine.js'
import { viewState } from '../src/integration/observation.js'
import { readFileSync } from 'node:fs'
import { guideText } from '../tools/import-scenario-guides.mjs'

const adventureGuide = id => JSON.parse(readFileSync(new URL(`../web/scenario-guides/${id}.json`, import.meta.url), 'utf8'))
const guideStrings = value => typeof value === 'string' ? [value] : Object.values(value || {}).flatMap(guideStrings)

test('所有注册关卡随包提供中英完整指南，不依赖参考工程或对局同步', () => {
  for (const scenario of contentRegistry.listScenarios()) {
    const guide = adventureGuide(scenario.id)
    assert.equal(guide.id, scenario.id)
    assert.equal(guide.campaignId, scenario.campaignId)
    for (const language of ['zh', 'en']) {
      const sections = guide.locales[language]
      assert.ok(guideStrings(sections.setup).join('').length > 100, `${scenario.id}/${language} 设置不完整`)
      assert.ok(guideStrings(sections.resolutions).join('').length > 100, `${scenario.id}/${language} 缺少结局与奖励`)
      for (const text of guideStrings(sections)) {
        assert.doesNotMatch(text, /@:[\w.]+|<\/?[a-z][^>]*>|\{\w+\}/i, `${scenario.id}/${language} 有未展开的来源格式`)
        if (language === 'zh') assert.doesNotMatch(text.replace(/\[[a-z_]+\]/g, ''), /\b[a-z]{4,}\s+[a-z]{3,}\s+[a-z]{3,}\b/i,
          `${scenario.id} 的中文指南仍夹有未译正文`)
      }
    }
  }
})

test('指南格式保留段落、列表和卡牌图标，不输出 HTML 或动态计数占位', () => {
  const text = guideText('<p>测试 <b>正文</b> [elder_sign]。</p><ul><li>{perPlayer} 个线索</li><li>{fast} 翻面</li></ul>', 'zh')
  assert.match(text, /正文 \[elder_sign\]/)
  assert.match(text, /• \[per_investigator\] 个线索/)
  assert.match(text, /• \[free\] 翻面/)
  assert.doesNotMatch(text, /<|>/)
})

test('卡城幽影指南明示恐惧豁免与剩余神智视为零，保留所有开场和结局分支', () => {
  const guide = adventureGuide('dimCarcosa').locales.zh
  const rules = guideStrings(guide.specialRules).join('\n')
  assert.match(rules, /不会因.*恐惧.*被击败/)
  assert.match(rules, /剩余神智值.*视为 0/)
  assert.match(guideStrings(guide.setup).join('\n'), /一半神智值/)
  const intro = guideStrings(guide.intro).join('\n')
  assert.match(intro, /引言1/)
  assert.match(intro, /引言2/)
  const resolutions = guideStrings(guide.resolutions).join('\n')
  for (const number of [1, 2, 3, 4, 5]) assert.match(resolutions, new RegExp(`结局 ?${number}`))
})

test('特别规则跨战役补齐；久远腹地两部分各自展示对应指南', () => {
  for (const id of ['theMiskatonicMuseum', 'thePallidMask', 'blackStarsRise', 'theBoundaryBeyond', 'theWitchingHour', 'darkSideOfTheMoon']) {
    assert.ok(guideStrings(adventureGuide(id).locales.zh.specialRules).join('').length > 80, `${id} 缺少特别规则`)
  }
  assert.match(guideStrings(adventureGuide('heartOfTheEldersPart1').locales.zh.setup).join(''), /石柱/)
  const secondPart = guideStrings(adventureGuide('heartOfTheEldersPart2').locales.zh.setup).join('')
  assert.match(secondPart, /下有深渊/)
  assert.doesNotMatch(secondPart, /石柱/)
  for (const id of ['wakingNightmare', 'theSearchForKadath']) {
    assert.ok(guideStrings(adventureGuide(id).locales.zh.intro).join('').length > 500, `${id} 的开场不能被归入后续剧透`)
  }
})

test('每关的设置面板都有布置文本和说明', () => {
  const ids = contentRegistry.listScenarios().map(entry => entry.id)
  assert.ok(ids.length >= 30)
  for (const id of ids) {
    const scenario = contentRegistry.getScenarioData(id)
    const guide = scenarioGuide(id)
    const setup = scenarioSetupText(scenario)
    assert.ok(setup.length > 20, `${id} 缺少设置文本`)
    assert.ok(guide?.note && guide.note.length > 20, `${id} 缺少设置说明`)
    assert.doesNotMatch(setup, /gaps/, `${id} 的设置文本还带着开发备注`)
  }
})

test('观察投影带上设置说明，且不改写已有开场', () => {
  const state = createGameState({ seed: 'setup-guide' }, [{ seat: 0, role: 'human' }])
  const view = viewState(state, 0)
  assert.equal(view.scenario.id, 'theGathering')
  assert.equal(view.scenario.intro, state.scenarioIntro.paragraphs.join('\n\n'))
  assert.match(view.scenario.setup, /书房/)
  assert.match(view.scenario.setupNote, /食尸鬼/)
})

test('没有自带设置文本的关卡用补写的布置步骤', () => {
  const scenario = contentRegistry.getScenarioData('theMiskatonicMuseum')
  assert.equal(scenario.setup, undefined)
  const setup = scenarioSetupText(scenario)
  assert.match(setup, /博物馆大门/)
  assert.match(setup, /展厅/)
  assert.match(scenarioGuide('theEssexCountyExpress').setup, /车头/)
})
