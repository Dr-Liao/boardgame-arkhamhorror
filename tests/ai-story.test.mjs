import test from 'node:test'
import assert from 'node:assert/strict'
import arkham from '../index.js'
import { createGameState, applyMove, decisionSeat, describeState } from '../src/engine/engine.js'
import { aiDecisionContext } from '../src/ai/ai-context.js'
import { storyDecisionContext, storyChatContext } from '../src/ai/ai-story.js'
import { STORY_TEXT } from '../content/campaigns/nightOfTheZealot/story-text.js'
import { DUNWICH_STORY_TEXT } from '../content/campaigns/theDunwichLegacy/story-text.js'
import { buildUserPrompt, buildChatUserPrompt } from '../../../lib/agent/prompt.js'

function settle(s) {
  for (let i = 0; s.pendingChoice; i++) {
    assert.ok(i < 100)
    const c = s.pendingChoice, o = c.options.find(o => ['done', 'skip', 'self'].includes(o.id)) || c.options[0]
    applyMove(s, c.seat, { action: 'choose', choiceId: c.id, optionId: o.id })
  }
}
const fixture = (settings = {}) => {
  const s = createGameState({ playerInvestigator: '01001', seed: 'ai-story', ...settings }, [{ seat: 0 }, { seat: 1 }])
  settle(s); return s
}
const context = (s, seat = decisionSeat(s)) => JSON.parse(aiDecisionContext(s, seat).split('\n')[2])
const session = s => ({ state: s, players: [{ seat: 0, name: '玩家' }, { seat: 1, name: '队友' }], events: [], notes: [] })
const introText = s => s.scenarioIntro.paragraphs.join('\n\n')

test('setting defaults to on in the AI advanced spec; the engine fallback stays off unless asked', () => {
  const spec = arkham.settingsSpec.find(item => item.key === 'aiStoryAwareness')
  assert.equal(spec.type, 'toggle')
  assert.equal(spec.default, 'on')
  assert.equal(arkham.defaults.aiStoryAwareness, 'on')
  // 直接建局（测试/工具/重放）不带这项时沿用旧行为；大厅开局按设置默认提交 'on'。
  assert.equal(fixture().aiStoryAwareness, false)
  assert.equal(fixture({ aiStoryAwareness: 'on' }).aiStoryAwareness, true)
  assert.equal(fixture({ aiStoryAwareness: 'off' }).aiStoryAwareness, false)
})

test('off: no story context, and narrative prose in the log is collapsed', () => {
  const s = fixture({ aiStoryAwareness: 'off' })
  s.campaign.records = { houseBurned: true }
  assert.ok(s.log.includes(introText(s)), 'fixture logs the intro prose')
  assert.equal(context(s).story, undefined)
  assert.equal(storyChatContext(s), '')
  const prompt = buildChatUserPrompt(arkham, session(s), 1, '现在什么情况？', 'table')
  assert.ok(!prompt.includes('【剧情背景】'))
  assert.ok(!describeState(s, 0).includes(introText(s)))
  assert.ok(describeState(s, 0).includes('（剧情文本已省略）'))
})

test('on: decisions get labeled campaign-log facts only, not prose', () => {
  const s = fixture({ aiStoryAwareness: 'on' })
  const lita = s.campaign.investigators[0]
  s.campaign.records = { houseBurned: true, ghoulPriestAlive: false, litaOwner: lita.id, internalOnly: 1 }
  const story = context(s).story
  assert.ok(story.note.includes('不构成规则'))
  assert.deepEqual(story.campaignLog, ['房屋已烧毁：是', '食尸鬼祭司仍存活：否', `丽塔所属调查员：${lita.name}`])
  assert.equal(story.storyChoiceBackground, undefined)
  const decision = buildUserPrompt(arkham, session(s), decisionSeat(s))
  assert.ok(!decision.includes(introText(s)))
  assert.ok(!decision.includes('【剧情背景】'))
})

test('on: story choice windows add current-scenario background for the answering seat only', () => {
  const s = fixture({ aiStoryAwareness: 'on' })
  s.pendingChoice = { id: 'c1', kind: 'story', seat: 0, prompt: '决定房屋的命运。', options: [{ id: 'r1', label: '烧毁房屋' }, { id: 'r2', label: '保留房屋' }] }
  const own = storyDecisionContext(s, 0)
  assert.equal(own.storyChoiceBackground.scenario, s.scenario.name)
  assert.ok(own.storyChoiceBackground.summary.length <= 401)
  assert.equal(storyDecisionContext(s, 1)?.storyChoiceBackground, undefined)
  s.pendingChoice.kind = 'commit'
  assert.equal(storyDecisionContext(s, 0)?.storyChoiceBackground, undefined)
})

test('on: chat gets a short excerpt and never unreached resolution prose', () => {
  const s = fixture({ aiStoryAwareness: 'on' })
  const prompt = buildChatUserPrompt(arkham, session(s), 1, '这里发生了什么？', 'table')
  assert.ok(prompt.includes('【剧情背景】'))
  assert.ok(prompt.includes(`当前关卡《${s.scenario.name}》梗概`))
  assert.ok(storyChatContext(s).length < 800)
  for (const paragraphs of Object.values(STORY_TEXT.resolutions?.theGathering || {})) {
    for (const p of paragraphs) assert.ok(!prompt.includes(p.slice(0, 30)), 'resolution text must not leak')
  }
})

test('on: chat upgrades an old routed Dunwich ending before showing it to AI', () => {
  const s = fixture({ aiStoryAwareness: 'on' })
  const source = DUNWICH_STORY_TEXT.resolutions.whereDoomAwaits
  s.uiState = 'scenarioResult'
  s.campaign.scenarioResults = [{
    scenarioId: 'whereDoomAwaits',
    scenarioIndex: 6,
    resolution: 'noResolution',
    recordsBefore: {},
    recordsAfter: { yogSothothToreApartTheBarrierBetweenWorldsAndBecameOneWithAllReality: true },
    investigators: [{ defeated: true }],
    story: { version: 3, title: '未达成结局', paragraphs: source.noResolution },
  }]
  const chat = storyChatContext(s)
  assert.match(chat, /上一关《毁灭之地》结局 2/)
  assert.ok(chat.includes(source.r2[0].slice(0, 30)))
  assert.ok(!chat.includes(source.noResolution[0]))
})
