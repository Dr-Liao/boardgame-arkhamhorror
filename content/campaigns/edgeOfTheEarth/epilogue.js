// 《地球边缘》（Edge of the Earth）· 尾声（P7）。
//
// 事实源（锁定）：参考实现 `Campaigns/EdgeOfTheEarth.hs#CampaignStep EpilogueStep`：
//   先讲 `epilogue`；随后按两两组合讲述仍存活伙伴的后续：
//     埃尔斯沃思 + 克莱普尔 → `ellsworthAndClaypool`
//     肯斯勒 + 辛哈 → `kenslerAndSinha`
//     戴尔 + 丹佛斯 → `dyerAndDanforth`
//     高田 + 曲奇 → `takadaAndCookie`
//   若其余八人全部不在且阿什瓦克存活 → `ashevak`（只剩阿什瓦克与调查员）。
//   最后结束战役（`GameOver`）。
//   「调查员在战役中胜利」是阅读前提：`theSurvivorsOfTheExpeditionWere` 由《疯狂之心》第 II 部分结算写入。
//
// 本文件导出尾声节点 + 已注册的战役效果处理器（按伙伴存活状态选择性讲述，不泄露未达分支）。
import { registerCampaignEffectHandler } from '../../../src/campaign/content-effects.js'
import { initializePartners, partnerState } from '../../../src/campaign/eote-partners.js'
import { PARTNERS, PARTNER_CODES, partnerStatusEntries, storyBody, storyHeading } from './records.js'

export const EPILOGUE_HANDLER_ID = 'edgeOfTheEarthEpilogue'

const text = (key, fallback) => storyBody(key) || fallback
const heading = (key, fallback) => storyHeading(key, fallback) || fallback

export const EPILOGUE_NODES = Object.freeze({
  epilogue: {
    type: 'story',
    title: heading('epilogue.epilogue', '尾声'),
    textKey: 'epilogue.epilogue',
    text: text('epilogue.epilogue', '检查剧本日志，只有当调查员在战役中胜利，且对应的探险队队员生还时，才阅读以下条目。'),
    effects: [{ type: 'registered', handler: EPILOGUE_HANDLER_ID, event: 'epilogue' }],
    next: 'end',
  },
  end: {
    type: 'end',
    outcome: 'campaignComplete',
  },
})

// ---------------------------------------------------------------------------
// 尾声效果处理器
// ---------------------------------------------------------------------------

const logLine = (log, line) => { if (typeof log === 'function') log(line) }

function appendStory (state, line) {
  const visit = state?.campaign?.flow?.history?.at?.(-1)
  if (visit) visit.storyText = [visit.storyText, line].filter(Boolean).join('\n\n')
}

function ensurePartners (state) {
  if (state?.campaign?.eote?.partners) return
  initializePartners(state, {
    partners: PARTNERS.map(partner => ({ code: partner.code, damage: 0, horror: 0 })),
    resoluteForms: PARTNERS.map(partner => [partner.code, partner.resolute]),
  })
}

function isAlive (state, key) {
  const def = PARTNERS.find(partner => partner.key === key)
  if (!def) return false
  const entry = partnerState(state, def.code)
  return Boolean(entry && (entry.status === 'safe' || entry.status === 'resolute'))
}

function survivorsOfExpedition (state) {
  const records = state?.campaign?.records
  if (!records) return []
  const set = records.theSurvivorsOfTheExpeditionWere
  return Array.isArray(set) ? set : []
}

const PAIR_STORIES = Object.freeze([
  Object.freeze({ keys: Object.freeze(['ellsworth', 'claypool']), storyKey: 'epilogue.ellsworthAndClaypool' }),
  Object.freeze({ keys: Object.freeze(['kensler', 'sinha']), storyKey: 'epilogue.kenslerAndSinha' }),
  Object.freeze({ keys: Object.freeze(['dyer', 'danforth']), storyKey: 'epilogue.dyerAndDanforth' }),
  Object.freeze({ keys: Object.freeze(['takada', 'cookie']), storyKey: 'epilogue.takadaAndCookie' }),
])

function runEpilogue (state, log) {
  ensurePartners(state)
  const campaign = state.campaign
  const records = campaign.records
  // 同步一次伙伴状态镜像，便于存档/审计读取最终存亡。
  records.eotePartnerStatuses = partnerStatusEntries(
    PARTNER_CODES.map(code => partnerState(state, code)).filter(Boolean))

  // 只有胜利结局（结算写入了幸存者名单）才逐段讲组合后续；未胜利时只保留尾声前言，避免剧透。
  const survivors = survivorsOfExpedition(state)
  const victory = survivors.length > 0 || records.theNamelessMadnessIsContainedSafelyWithinItsHostForNow === true
  if (!victory) {
    logLine(log, '🌅 尾声：调查员未能在战役中获胜，探险队的后续无人知晓。')
    return
  }
  const told = []
  for (const story of PAIR_STORIES) {
    if (!story.keys.every(key => isAlive(state, key))) continue
    const body = storyBody(story.storyKey)
    if (!body) continue
    appendStory(state, body)
    logLine(log, body)
    told.push(...story.keys)
  }
  // 阿什瓦克：其余八人都不在时，只讲「阿什瓦克与调查员是仅剩的幸存者」。
  const others = PARTNERS.filter(partner => partner.key !== 'ashevak')
  const noneOthersAlive = others.every(partner => !isAlive(state, partner.key))
  if (noneOthersAlive && isAlive(state, 'ashevak')) {
    const body = storyBody('epilogue.ashevak')
    if (body) {
      appendStory(state, body)
      logLine(log, body)
      told.push('ashevak')
    }
  }
  logLine(log, `🌅 尾声：讲述了 ${told.length} 个存活伙伴的后续（幸存者名单 ${survivors.length} 项）。`)
}

export function runEpilogueEffect (state, effect, log) {
  if (effect.event === 'epilogue') return runEpilogue(state, log)
  throw new Error(`未知尾声效果：${String(effect.event)}`)
}

registerCampaignEffectHandler(EPILOGUE_HANDLER_ID, runEpilogueEffect)
