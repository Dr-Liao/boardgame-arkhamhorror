import { ALL_CARDS } from '../cards/cards-data.js'
import { awardExperience, campaignCardChange } from './campaign.js'
import { changeChaosBag } from '../engine/chaos-bag.js'
import { requestChoice } from '../engine/resolution.js'
import { resolveSurvivors } from '../../content/campaigns/theDunwichLegacy/later-behaviors.js'

// Called inside the existing replayable resolution transaction. A saved choice
// replays from its base state, so neither rewards nor bag changes are duplicated.
export function awardStoryCard(state, code, reason) {
  const card = ALL_CARDS[code]
  if (!card || card.type !== 'asset' || !(card.unique || (card.encounterCode && card.quantity === 1))) throw new Error('无效的剧情资产')
  const campaign = state.campaign
  if (Object.values(campaign.investigators).some(record => record.deck.includes(code))) return
  const candidates = Object.values(campaign.investigators).filter(record => record.status === 'active')
  if (!candidates.length) return
  const answer = requestChoice(state, {
    kind: 'storyCard', source: code, seat: campaign.leadSeat ?? candidates[0].seat,
    prompt: `是否将${card.nameZh || card.name}加入一位调查员的牌组？不计入牌组张数。`, canSkip: true,
    options: [{ id: 'skip', label: '不加入牌组' }, ...candidates.map(record => ({
      id: String(record.seat), label: `加入${record.name}的牌组`,
    }))],
  })
  if (answer !== 'skip') campaignCardChange(campaign, Number(answer), code, 'add', reason)
}

export function applyCampaignEffect(state, effect, log) {
  if (effect.type === 'chaos') changeChaosBag(state, effect.token, effect.amount, { permanent: true })
  else if (effect.type === 'log') log(effect.text)
  else if (effect.type === 'storyCard') awardStoryCard(state, effect.code, state.campaign.flow.nodeId)
  else if (effect.type === 'recordUnion') {
    if (!Array.isArray(effect.values) || effect.values.some(value => typeof value !== 'string')) {
      throw new Error('集合记录必须是字符串数组')
    }
    const current = state.campaign.records[effect.key] || []
    if (!Array.isArray(current)) throw new Error(`战役记录 ${effect.key} 不是集合`)
    state.campaign.records[effect.key] = [...new Set([...current, ...effect.values])]
  } else if (effect.type === 'recordRemove') {
    if (!Array.isArray(effect.values)) throw new Error('划掉记录必须是数组')
    const removed = new Set(effect.values)
    state.campaign.records[effect.key] = (state.campaign.records[effect.key] || [])
      .filter(value => !removed.has(value))
  } else if (effect.type === 'replaceChaosFamily') {
    const family = new Set(['cultist', 'tablet', 'elderthing'])
    if (!Array.isArray(effect.tokens) || effect.tokens.some(token => !family.has(token))) {
      throw new Error('卡尔克萨符号族替换无效')
    }
    const replace = bag => [...(bag || []).filter(token => !family.has(token)), ...effect.tokens]
    state.campaign.chaosBag = replace(state.campaign.chaosBag)
    if (state.chaosBag) state.chaosBag = replace(state.chaosBag)
  } else if (effect.type === 'campaignRuleFlag') {
    state.campaign.ruleFlags ||= {}
    state.campaign.ruleFlags[effect.key] = effect.value ?? true
  } else if (effect.type === 'privateStory') {
    const audience = effect.audienceRecord
      ? state.campaign.records[effect.audienceRecord] || []
      : effect.audienceInvestigatorIds || []
    state.campaign.privateStories ||= []
    state.campaign.privateStories.push({
      id: effect.id,
      title: effect.title,
      text: effect.text,
      audienceInvestigatorIds: [...new Set(audience)],
    })
  } else if (effect.type === 'campaignWeakness') {
    const code = effect.code
    const active = Object.entries(state.campaign.investigators)
      .filter(([, record]) => record.status === 'active')
    if (!active.length || active.some(([, record]) => record.deck.includes(code))) return
    let target = active.find(([, record]) => record.seat === state.campaign.leadSeat)
    if (!target) target = active[0]
    campaignCardChange(state.campaign, target[1].seat, code, 'add', effect.reason || 'campaign')
    state.campaign.records[effect.bearerRecord || 'pallidMaskBearer'] = target[1].id
  } else if (effect.type === 'transferCampaignWeakness') {
    const key = effect.bearerRecord || 'pallidMaskBearer'
    const currentId = state.campaign.records[key]
    const current = Object.values(state.campaign.investigators)
      .find(record => record.id === currentId)
    if (current?.status === 'active') return
    const next = Object.entries(state.campaign.investigators)
      .find(([, record]) => record.status === 'active')
    if (!next) return
    if (current?.deck.includes(effect.code)) {
      campaignCardChange(state.campaign, current.seat, effect.code, 'remove', 'bearer-transfer')
    }
    if (!next[1].deck.includes(effect.code)) {
      campaignCardChange(state.campaign, next[1].seat, effect.code, 'add', 'bearer-transfer')
    }
    state.campaign.records[key] = next[1].id
  }
  else if (effect.type === 'dunwichSurvivors') resolveSurvivors(state)
  else if (effect.type === 'experience') {
    if (!Number.isSafeInteger(effect.amount) || effect.amount < 0) throw new Error('经验奖励必须为非负整数')
    for (const record of Object.values(state.campaign.investigators)) {
      if (record.status !== 'active') continue
      awardExperience(state.campaign, record.seat, effect.amount)
      log(`${record.name} 获得 ${effect.amount} XP。`)
    }
  } else throw new Error('未注册的战役效果：' + effect.type)
}
