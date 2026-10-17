import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_AI_DIALOGUE_SETTINGS, normalizeAiDialogueSettings,
  actionSpeechFrequency, reactionTriggers,
} from '../src/ai/ai-dialogue.js'

test('AI 对话设置归一化频率和开关', () => {
  assert.deepEqual(normalizeAiDialogueSettings({}), DEFAULT_AI_DIALOGUE_SETTINGS)
  assert.deepEqual(normalizeAiDialogueSettings({
    aiRoutineSpeechFrequency: 120,
    aiTestSpeechFrequency: -4,
    aiEnemyDefeatSpeechFrequency: 55,
    aiInvestigatorExitDialogue: 'off',
    aiScenarioEndDialogue: 'on',
  }), {
    routineFrequency: 100,
    selfTestFrequency: 0,
    otherTestFrequency: 0,
    selfCriticalSuccessFrequency: 100,
    otherCriticalSuccessFrequency: 60,
    selfCriticalFailureFrequency: 100,
    otherCriticalFailureFrequency: 60,
    enemyDefeatFrequency: 55,
    investigatorExitDialogue: false,
    scenarioEndDialogue: true,
  })
})

test('最终检定结果使用独立回应频率，不再发布动作前台词', () => {
  const events = [{
    seq: 7, type: 'presentation', kind: 'test', seat: 0, name: '罗兰',
    skill: 'combat', value: 5, difficulty: 3, success: true, drawn: ['+1'],
    source: { label: '攻击食尸鬼' },
  }]
  const settings = { aiRoutineSpeechFrequency: 80, aiTestSpeechFrequency: 45 }
  assert.equal(actionSpeechFrequency({ settings, events }), 0)
  const [trigger] = reactionTriggers({ settings, before: {}, after: { revision: 4 }, events })
  assert.equal(trigger.kind, 'test.result')
  assert.deepEqual(trigger.frequencyByRole, { self: 45, other: 45 })
  assert.equal(trigger.audience, 'all')
  assert.equal(trigger.subjectSeat, 0)
  assert.match(trigger.context, /罗兰的战斗检定成功/)
  assert.match(trigger.context, /最终值 5，难度 3/)
})

test('大成功与大失败按特殊标记识别，并分别使用自身和其他角色频率', () => {
  const settings = {
    aiSelfCriticalSuccessSpeechFrequency: 81,
    aiOtherCriticalSuccessSpeechFrequency: 61,
    aiSelfCriticalFailureSpeechFrequency: 72,
    aiOtherCriticalFailureSpeechFrequency: 42,
  }
  const success = reactionTriggers({
    settings, before: {}, after: { revision: 1 },
    events: [{ seq: 1, type: 'presentation', kind: 'test', seat: 1, name: '黛西',
      skill: 'intellect', value: 5, difficulty: 4, success: true, drawn: ['elder_sign'] }],
  })[0]
  assert.equal(success.kind, 'test.criticalSuccess')
  assert.deepEqual(success.frequencyByRole, { self: 81, other: 61 })
  assert.match(success.context, /大成功/)

  const failure = reactionTriggers({
    settings, before: {}, after: { revision: 2 },
    events: [{ seq: 2, type: 'presentation', kind: 'test', seat: 2, name: '温蒂',
      skill: 'agility', value: 0, difficulty: 1, success: false, autoFail: true, drawn: ['autofail'] }],
  })[0]
  assert.equal(failure.kind, 'test.criticalFailure')
  assert.deepEqual(failure.frequencyByRole, { self: 72, other: 42 })
  assert.match(failure.context, /大失败/)

  const highMargin = reactionTriggers({
    settings, before: {}, after: { revision: 3 },
    events: [{ seq: 3, type: 'presentation', kind: 'test', seat: 1, name: '黛西',
      skill: 'intellect', value: 9, difficulty: 1, success: true, drawn: ['+1'] }],
  })[0]
  assert.equal(highMargin.kind, 'test.result', '超过难度很多但没抽到古神印记仍是普通成功')
})

test('敌人被击败使用独立频率，同一次攻击不重复触发检定回应', () => {
  const events = [
    {
      seq: 8, type: 'presentation', kind: 'test', seat: 1, name: '罗兰',
      skill: 'combat', value: 6, difficulty: 3, success: true, drawn: ['0'],
    },
    {
      seq: 9, type: 'agentSignal', kind: 'enemyDefeated', seat: 1,
      name: '食尸鬼', investigatorName: '罗兰',
    },
  ]
  const triggers = reactionTriggers({
    settings: { aiTestSpeechFrequency: 35, aiEnemyDefeatSpeechFrequency: 50 },
    before: {}, after: { revision: 5 }, events,
  })
  assert.equal(triggers.length, 1)
  assert.equal(triggers[0].kind, 'enemy.defeated')
  assert.equal(triggers[0].frequency, 50)
  assert.equal(triggers[0].preferredSeat, 1)
  assert.match(triggers[0].context, /食尸鬼已被罗兰击败/)
})

test('调查员退出本关与关卡结算开启时必定触发，并注入实际结局全文', () => {
  const before = {
    investigators: [
      { seat: 0, name: '罗兰', defeated: false, resigned: false },
      { seat: 1, name: '黛西', defeated: false, resigned: false },
    ],
    campaign: {
      investigators: { 0: { status: 'active' }, 1: { status: 'active' } },
      scenarioResults: [],
    },
  }
  const after = {
    revision: 12,
    scenario: { name: '夜幕中的食尸鬼' },
    investigators: [
      { seat: 0, name: '罗兰', defeated: true, resigned: false, defeatCause: 'damage' },
      { seat: 1, name: '黛西', defeated: false, resigned: true },
    ],
    campaign: {
      investigators: { 0: { status: 'active' }, 1: { status: 'active' } },
      scenarioResults: [{
        scenarioId: 'theGathering', visitId: 'theGathering:1', resolution: 'r1',
        story: { title: '结局一', paragraphs: ['第一段实际剧情。', '第二段实际剧情。'] },
      }],
    },
  }
  const triggers = reactionTriggers({
    settings: { aiInvestigatorExitDialogue: 'on', aiScenarioEndDialogue: 'on' },
    before, after, events: [],
  })
  assert.deepEqual(triggers.map(item => item.kind), ['investigator.exited', 'scenario.resolved'])
  assert.ok(triggers.every(item => item.frequency === 100 && item.audience === 'all'))
  assert.match(triggers[0].context, /罗兰因伤害被击败/)
  assert.match(triggers[0].context, /黛西主动撤退/)
  assert.doesNotMatch(triggers[0].context, /永久死亡/)
  assert.match(triggers[1].context, /第一段实际剧情。[\s\S]*第二段实际剧情。/)

  assert.deepEqual(reactionTriggers({
    settings: { aiInvestigatorExitDialogue: 'off', aiScenarioEndDialogue: 'off' },
    before, after, events: [],
  }), [])
})
