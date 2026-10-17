const SKILL_NAMES = {
  willpower: '意志',
  intellect: '智识',
  combat: '战斗',
  agility: '敏捷',
}

export const DEFAULT_AI_DIALOGUE_SETTINGS = Object.freeze({
  routineFrequency: 60,
  selfTestFrequency: 35,
  otherTestFrequency: 35,
  selfCriticalSuccessFrequency: 100,
  otherCriticalSuccessFrequency: 100,
  selfCriticalFailureFrequency: 100,
  otherCriticalFailureFrequency: 100,
  enemyDefeatFrequency: 50,
  investigatorExitDialogue: true,
  scenarioEndDialogue: true,
})

const percentage = (value, fallback) => {
  const number = Number(value)
  return Number.isFinite(number) ? Math.max(0, Math.min(100, Math.round(number))) : fallback
}

const enabled = (value, fallback) => {
  if (typeof value === 'boolean') return value
  if (value === 'on' || value === 'true' || value === 1 || value === '1') return true
  if (value === 'off' || value === 'false' || value === 0 || value === '0') return false
  return fallback
}

export function normalizeAiDialogueSettings(settings = {}) {
  const legacyTestFrequency = percentage(settings.aiTestSpeechFrequency, DEFAULT_AI_DIALOGUE_SETTINGS.selfTestFrequency)
  return {
    routineFrequency: percentage(settings.aiRoutineSpeechFrequency, DEFAULT_AI_DIALOGUE_SETTINGS.routineFrequency),
    selfTestFrequency: percentage(settings.aiSelfTestSpeechFrequency, legacyTestFrequency),
    otherTestFrequency: percentage(settings.aiOtherTestSpeechFrequency, legacyTestFrequency),
    selfCriticalSuccessFrequency: percentage(
      settings.aiSelfCriticalSuccessSpeechFrequency, DEFAULT_AI_DIALOGUE_SETTINGS.selfCriticalSuccessFrequency,
    ),
    otherCriticalSuccessFrequency: percentage(
      settings.aiOtherCriticalSuccessSpeechFrequency, DEFAULT_AI_DIALOGUE_SETTINGS.otherCriticalSuccessFrequency,
    ),
    selfCriticalFailureFrequency: percentage(
      settings.aiSelfCriticalFailureSpeechFrequency, DEFAULT_AI_DIALOGUE_SETTINGS.selfCriticalFailureFrequency,
    ),
    otherCriticalFailureFrequency: percentage(
      settings.aiOtherCriticalFailureSpeechFrequency, DEFAULT_AI_DIALOGUE_SETTINGS.otherCriticalFailureFrequency,
    ),
    enemyDefeatFrequency: percentage(settings.aiEnemyDefeatSpeechFrequency, DEFAULT_AI_DIALOGUE_SETTINGS.enemyDefeatFrequency),
    investigatorExitDialogue: enabled(
      settings.aiInvestigatorExitDialogue ?? settings.aiDeathDialogue,
      DEFAULT_AI_DIALOGUE_SETTINGS.investigatorExitDialogue,
    ),
    scenarioEndDialogue: enabled(settings.aiScenarioEndDialogue, DEFAULT_AI_DIALOGUE_SETTINGS.scenarioEndDialogue),
  }
}

export function actionSpeechFrequency({ settings, events = [] }) {
  if (events.some(event => event?.type === 'presentation' && event.kind === 'test')) return 0
  return normalizeAiDialogueSettings(settings).routineFrequency
}

function testTrigger(event, settings, index, revision) {
  const skill = SKILL_NAMES[event.skill] || event.skill || '技能'
  const drawn = Array.isArray(event.drawn) ? event.drawn : []
  const criticalFailure = event.autoFail || drawn.includes('autofail')
  const criticalSuccess = !criticalFailure && drawn.includes('elder_sign')
  const result = event.success ? '成功' : '失败'
  const special = criticalSuccess ? '，抽到大成功标记' : criticalFailure ? '，抽到大失败标记' : ''
  const token = Array.isArray(event.drawn) && event.drawn.length ? `，抽到 ${event.drawn.join('、')}` : ''
  const source = event.source?.label || event.source?.name
  const frequencies = criticalSuccess
    ? { self: settings.selfCriticalSuccessFrequency, other: settings.otherCriticalSuccessFrequency }
    : criticalFailure
      ? { self: settings.selfCriticalFailureFrequency, other: settings.otherCriticalFailureFrequency }
      : { self: settings.selfTestFrequency, other: settings.otherTestFrequency }
  return {
    key: `arkham:test:${event.seq ?? revision + ':' + index}`,
    kind: criticalSuccess ? 'test.criticalSuccess' : criticalFailure ? 'test.criticalFailure' : 'test.result',
    title: '技能检定结果',
    context: `${event.name || '调查员'}的${skill}检定${result}${special}，最终值 ${event.value}，难度 ${event.difficulty}${token}${source ? `，来源：${source}` : ''}。`,
    frequencyByRole: frequencies,
    audience: 'all',
    subjectSeat: Number.isInteger(event.seat) ? event.seat : null,
  }
}

function exitedInvestigators(before, after) {
  const previous = new Map((before?.investigators || []).map(item => [item.seat, item]))
  return (after?.investigators || []).flatMap(investigator => {
    const old = previous.get(investigator.seat)
    const defeated = investigator.defeated && !old?.defeated
    const resigned = investigator.resigned && !old?.resigned
    if (!defeated && !resigned) return []
    const cause = { damage: '因伤害被击败', horror: '因恐惧被击败', both: '因伤害与恐惧被击败' }[investigator.defeatCause]
    return [{
      seat: investigator.seat,
      name: investigator.name || `座位 ${investigator.seat}`,
      reason: resigned ? '主动撤退' : (cause || '被击败'),
    }]
  })
}

function scenarioResultsAdded(before, after) {
  const count = before?.campaign?.scenarioResults?.length || 0
  return (after?.campaign?.scenarioResults || []).slice(count)
}

function enemyDefeatTrigger(event, settings, index, revision) {
  return {
    key: `arkham:enemy-defeated:${event.seq ?? revision + ':' + index}`,
    kind: 'enemy.defeated',
    title: '敌人被击败',
    context: `${event.name || '敌人'}已被${event.investigatorName || '调查员'}击败。`,
    frequency: settings.enemyDefeatFrequency,
    audience: 'one',
    preferredSeat: Number.isInteger(event.seat) ? event.seat : null,
  }
}

export function reactionTriggers({ settings: rawSettings, before, after, events = [] }) {
  const settings = normalizeAiDialogueSettings(rawSettings)
  const revision = after?.revision ?? 0
  const enemyDefeats = events.filter(event => event?.type === 'agentSignal' && event.kind === 'enemyDefeated')
  const triggers = events
    .filter(event => event?.type === 'presentation' && event.kind === 'test')
    .filter(event => !enemyDefeats.some(defeat => defeat.seat === event.seat))
    .map((event, index) => testTrigger(event, settings, index, revision))
  triggers.push(...enemyDefeats.map((event, index) => enemyDefeatTrigger(event, settings, index, revision)))

  const exited = settings.investigatorExitDialogue ? exitedInvestigators(before, after) : []
  if (exited.length) {
    triggers.push({
      key: `arkham:exit:${revision}:${exited.map(item => item.seat).join(',')}`,
      kind: 'investigator.exited',
      title: '调查员退出本关',
      context: `${exited.map(item => `${item.name}${item.reason}`).join('、')}，已经退出本关，不能继续参与本关行动或支援。`,
      frequency: 100,
      audience: 'all',
    })
  }

  if (settings.scenarioEndDialogue) {
    for (const result of scenarioResultsAdded(before, after)) {
      const paragraphs = Array.isArray(result.story?.paragraphs) ? result.story.paragraphs : []
      triggers.push({
        key: `arkham:scenario:${result.visitId || result.scenarioId}:${result.resolution}`,
        kind: 'scenario.resolved',
        title: `关卡结算：${result.story?.title || result.resolution}`,
        context: [
          `关卡：${after.scenario?.name || result.scenarioId}`,
          `结局：${result.story?.title || result.resolution}`,
          '【本次实际到达的剧情正文】',
          paragraphs.join('\n\n') || '（本结局没有额外剧情正文）',
        ].join('\n'),
        frequency: 100,
        audience: 'all',
      })
    }
  }

  return triggers
}
