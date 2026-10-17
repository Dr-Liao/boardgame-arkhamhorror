// Optional story awareness for AI teammates (setting aiStoryAwareness).
// Decisions only receive the reached campaign log as structured facts; story
// choice windows add a short background of the current scenario; chat may use
// a brief excerpt for role-play. Never sends resolution maps or unreached text.
import { ALL_CARDS, INVESTIGATORS } from '../cards/cards-data.js'
import { contentRegistry } from '../../content/registered.js'
import { resolutionStory } from '../campaign/story.js'

const STORY_CHOICE_KINDS = new Set(['story', 'storyCard'])
const PRIOR_EFFECTS = '此前调查的影响'
const NOTE = '剧情背景只用于理解处境和角色扮演，不构成规则、触发条件或合法选项；开局前情可能已过时，与当前局面冲突时以当前局面为准。'

export const storyAwarenessEnabled = state => state?.aiStoryAwareness === true

const clip = (text, max) => {
  const s = String(text || '').replace(/\s+/g, ' ').trim()
  return s.length > max ? s.slice(0, max) + '…' : s
}

function nameOf(state, value) {
  if (typeof value !== 'string') return String(value)
  const campaign = state.campaign || {}
  const records = [...Object.values(campaign.investigators || {}), ...(Array.isArray(campaign.retired) ? campaign.retired : [])]
  const record = records.find(r => r && r.id === value)
  if (record?.name) return record.name
  const card = ALL_CARDS[value] || INVESTIGATORS[value]
  return card ? (card.nameZh || card.name) : value
}

function formatValue(state, value) {
  if (typeof value === 'boolean') return value ? '是' : '否'
  if (Array.isArray(value)) return value.length ? value.map(v => nameOf(state, v)).join('、') : '无'
  if (value && typeof value === 'object') return JSON.stringify(value)
  return nameOf(state, value)
}

// Reached campaign-log entries with display labels; unlabeled internal keys are skipped.
export function campaignLogFacts(state) {
  const labels = contentRegistry.getCampaign(state.campaign?.id)?.recordLabels || {}
  return Object.entries(state.campaign?.records || {})
    .filter(([key]) => labels[key])
    .map(([key, value]) => `${labels[key]}：${formatValue(state, value)}`)
}

function introExcerpt(state, max) {
  if (!['inScenario', undefined].includes(state.uiState)) return null
  const sections = state.scenarioIntro?.sections
  if (!Array.isArray(sections) || !state.scenario) return null
  const narrative = sections.filter(s => s.title !== PRIOR_EFFECTS).at(-1)?.paragraphs || []
  const priorEffects = sections.find(s => s.title === PRIOR_EFFECTS)?.paragraphs || []
  return { scenario: state.scenario.name, summary: clip(narrative.join(' '), max), priorEffects: [...priorEffects] }
}

function lastResolution(state, max) {
  const result = (state.campaign?.scenarioResults || []).at(-1)
  const story = reachedResultStory(result)
  if (!story?.paragraphs?.length) return null
  const name = safeScenarioName(result.scenarioId)
  return `上一关《${name}》${story.title || ''}：${clip(story.paragraphs.join(' '), max)}`
}

function reachedResultStory(result) {
  if (!result) return null
  try {
    return resolutionStory(
      contentRegistry.getScenarioData(result.scenarioId),
      result.storyResolution || result.resolution,
      result.story,
      { records: result.recordsBefore, recordsAfter: result.recordsAfter, investigators: result.investigators },
    )
  } catch {
    return result.story
  }
}

function safeScenarioName(id) {
  try { return contentRegistry.getScenario(id).name } catch { return id }
}

// Structured addition for aiDecisionContext; null when disabled or empty.
export function storyDecisionContext(state, seat) {
  if (!storyAwarenessEnabled(state)) return null
  const data = {}
  const facts = campaignLogFacts(state)
  if (facts.length) data.campaignLog = facts
  const choice = state.pendingChoice
  if (choice && STORY_CHOICE_KINDS.has(choice.kind) && choice.seat === seat) {
    const intro = introExcerpt(state, 400)
    if (intro) data.storyChoiceBackground = intro
  }
  return Object.keys(data).length ? { note: NOTE, ...data } : null
}

// Prose addition for the tactical chat prompt only.
export function storyChatContext(state) {
  if (!storyAwarenessEnabled(state)) return ''
  const intro = introExcerpt(state, 240)
  const resolution = intro ? null : lastResolution(state, 200)
  const facts = campaignLogFacts(state)
  if (!intro && !resolution && !facts.length) return ''
  const lines = ['', '【剧情背景】' + NOTE]
  if (intro) {
    lines.push(`当前关卡《${intro.scenario}》梗概：${intro.summary}`)
    intro.priorEffects.forEach(p => lines.push('- 开局前情：' + p))
  }
  if (resolution) lines.push(resolution)
  if (facts.length) lines.push('冒险日志：' + facts.join('；'))
  lines.push('讨论时可以结合剧情代入角色，但战术建议仍以当前局面和合法行动为准。')
  return lines.join('\n')
}

// Narrative prose that startScenario/finishScenario write into state.log.
// describeState collapses these so long story text never floods decision prompts.
export function narrativeLogTexts(state) {
  const texts = new Set()
  const add = story => { if (Array.isArray(story?.paragraphs) && story.paragraphs.length) texts.add(story.paragraphs.join('\n\n')) }
  add(state.scenarioIntro)
  for (const result of state.campaign?.scenarioResults || []) {
    add(result.introStory)
    add(result.story)
    add(reachedResultStory(result))
  }
  return texts
}
