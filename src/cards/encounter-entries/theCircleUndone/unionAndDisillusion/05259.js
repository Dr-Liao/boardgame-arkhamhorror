// 05259 杰罗姆·戴维斯（《聚合幻灭》剧情支援）
// 卡面：你得到 +1[intellect]。
// [reaction] 在你地点的调查员从遭遇牌库抽出诡计时，横置杰罗姆·戴维斯并弃掉你手中总计
//   至少 2 个[intellect]图标的手牌：取消该卡牌的显现效果。
//
// 受控剧情支援与玩家卡同通道：+1 技能走 modifiers，反应走 abilities。取消显现 = 把
// 引擎 encounterDrawn 窗口的 context.cancelled 置真（引擎随后按 redraw 分支处理）；
// 只有「可弃手牌合计图标 ≥ 2」时反应才会出现在窗口里（避免白付费用）。
// 注：卡面允许横置自身（cost.exhaust）；弃牌在我们的 resolve 里逐张选择，不计入弱点。

import { ALL_CARDS } from '../../_shared.js'

const isDiscardable = code => {
  const def = ALL_CARDS[code]
  return Boolean(def) && !['weakness', 'basicweakness'].includes(def.subtype)
}

function discardableHandIcons(inv) {
  return (inv.hand || []).reduce((total, code) => {
    if (!isDiscardable(code)) return total
    return total + Number(ALL_CARDS[code]?.icons?.intellect || 0)
  }, 0)
}

export default {
  code: '05259',
  scope: 'storyAsset',
  implemented: true,
  modifiers: [{ target: 'skill:intellect', amount: 1 }],
  abilities: [{
    kind: 'reaction',
    trigger: 'encounterDrawn',
    label: '横置并弃掉 ≥2 智力图标手牌：取消该遭遇卡（诡计）的显现',
    cost: { exhaust: true },
    criteria: [({ inv, context, state }) => {
      if (!context?.cardCode) return false
      if (state.investigators?.[context.seat]?.location !== inv.location) return false
      if (context.weakness) return false
      return discardableHandIcons(inv) >= 2
    }],
    resolve: ({ inv, state, api, context }) => {
      let icons = 0
      while (icons < 2) {
        const options = (inv.hand || []).map((code, index) => ({ code, index })).filter(({ code }) => isDiscardable(code))
        if (!options.length) break
        const answer = api.choice({
          kind: 'discard', source: '05259', seat: inv.seat,
          prompt: `「杰罗姆·戴维斯」：弃掉手牌以取消本次显现（还需 ${2 - icons} 个智力图标）。`,
          options: options.map(({ code, index }) => ({
            id: String(index), cardCode: code,
            label: `${api.cardName(code)}（智力 ${Number(ALL_CARDS[code]?.icons?.intellect || 0)}）`,
          })),
        })
        const index = Number(answer)
        if (!Number.isInteger(index) || index < 0 || index >= inv.hand.length) break
        const [code] = inv.hand.splice(index, 1)
        inv.discard.push(code)
        icons += Number(ALL_CARDS[code]?.icons?.intellect || 0)
      }
      if (icons < 2) return
      context.cancelled = true
      api.info(`${inv.name} 弃掉手牌，取消了「${api.cardName(context.cardCode)}」的显现效果。`)
    },
  }],
}
