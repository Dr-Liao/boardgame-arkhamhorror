// 古代遗物《某种装置》→《阻断未来》的换版逻辑（《失落的时代》·《时空之外》）。
//
// 从 behavior.js 拆出的原因：Phase 3 的 behavior 行数预算只减不增；本文件只服务本章的
// 布置钩子，与章节流程无关（与《天机之城》的 body-swap.js 同一拆分口径）。
//
// 两条不变式：
//   1. 在局区域（deck / discard / hand / 场上支援）里的 04061 换成 04191；
//   2. 战役牌组记录同步（scenarioPlayable 的「授予事实源」）：参照参考实现
//      removeCampaignCard(旧版) + addCampaignCardToDeck(新版)。下一关按 record.deck 重建牌库，
//      只改在局区域会让新印刷丢失。旧存档里 campaign.investigators 可能是数组。

import { campaignCardChange } from '../../../../../src/campaign/campaign.js'

const RELIC_BASE = '04061'
const RELIC_FUTURE = '04191'

export function swapRelicOfAges(state, api) {
  for (const inv of state.investigators) {
    for (const zone of ['deck', 'discard', 'hand']) {
      const index = (inv[zone] || []).indexOf(RELIC_BASE)
      if (index < 0) continue
      inv[zone][index] = RELIC_FUTURE
      syncRelicOfAgesCampaignRecord(state, inv.seat)
      api?.moveRelicOfAges?.({ code: RELIC_FUTURE, seat: inv.seat })
      api?.info?.('🏺 失落的遗物换成了《古代遗物（阻断未来）》。')
      return true
    }
    const asset = (inv.assets || []).find(entry => (entry.originalCode || entry.code) === RELIC_BASE)
    if (!asset) continue
    asset.code = RELIC_FUTURE
    asset.originalCode = RELIC_FUTURE
    syncRelicOfAgesCampaignRecord(state, inv.seat)
    api?.moveRelicOfAges?.({ code: RELIC_FUTURE, seat: inv.seat })
    return true
  }
  return false
}

function syncRelicOfAgesCampaignRecord(state, seat) {
  const campaign = state.campaign
  const records = campaign?.investigators
  const record = Array.isArray(records) ? records[seat] : records?.[seat]
  if (!Array.isArray(record?.deck) || !record.deck.includes(RELIC_BASE)) return
  campaignCardChange(campaign, seat, RELIC_BASE, 'remove', 'theBoundaryBeyond')
  if (!record.deck.includes(RELIC_FUTURE)) {
    campaignCardChange(campaign, seat, RELIC_FUTURE, 'add', 'theBoundaryBeyond')
  }
}
