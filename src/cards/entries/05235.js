// 05235 蠕虫的秘密（神秘学家 · 2 经验 · 独特）
// 卡面：[action]横置蠕虫的秘密并在其上放置1个毁灭标记：从你的弃牌堆打出一张[[法术]]或[[洞察]]事件，
//       其资源费用减少1点。该事件结算后，将其从游戏中移除。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 05235 蠕虫的秘密：[行动]横置 + 放 1 毁灭：从弃牌堆免费-1 费打出 1 张[[法术]]/[[洞察]]事件，之后移出游戏。
//
// 实现备注（第五轮收窄）：
//   · 费用降低用 api.playCard 的折扣读数（playCost 会扣掉折扣）。
//   · 引擎的「从弃牌堆打出」通道只覆盖弃牌堆顶/标记 playableFromDiscard 的卡，因此先把选中的事件
//     移动到手里再按普通事件打出（对「费用 -1」的净效果一致；差异是被打出的牌在结算期间位于手牌区，
//     引擎 playCardFromDiscard 原语落地后应改走该通道）。
//   · 本轮已收窄两处：
//     ① criteria：弃牌堆为空时能力不出现在合法列表（不再白横置+白放毁灭）；
//        类型/费用过滤仍在 resolve 内：legalMoves 的 criteria 上下文不提供 cardType/cardTraits helpers
//        （moves.js:407-408 只传 state/inv/source），等引擎把 helpers 接到合法行动枚举后再前移。
//     ② 结算后按实际落点移出游戏（discard/deck/被事件自身去向带走都能处理）；若 doPlay 因类型/目标
//        等原因没有实际打出、事件仍留在手牌，则退回弃牌堆并回退刚放置的 1 毁灭（不再静默吃掉费用）。
//   · 残余近似：从弃牌堆打出期间事件位于手牌区（无 state._fromDiscardCode）、不走完整 validateMove；
//     「费用 -1 后才能付得起」的可打性仍由引擎按印刷费用预检，需 playCardFromDiscard 原语。

const isSpellOrInsightEvent = (api, code) => {
  if (api.cardType(code) !== 'event') return false
  const traits = api.cardTraits(code) || []
  return traits.some(trait => ['spell', 'insight'].includes(String(trait).toLowerCase()))
}

const hasTrait = (helpers, code) => (helpers.cardTraits(code) || [])
  .some(trait => ['spell', 'insight'].includes(String(trait).toLowerCase()))

export default {
  code: '05235',
  abilities: [
    {
      kind: 'action',
      label: '横置并放 1 毁灭：从弃牌堆打出 1 张法术/洞察事件（费用 -1），之后移出游戏',
      cost: { exhaust: true },
      criteria: [({ inv, helpers }) => {
        const discard = inv.discard || []
        if (!discard.length) return false
        // 合法行动枚举（moves.js）不带 helpers：此时只做「弃牌堆非空」守卫，类型在 resolve 再过滤；
        // 窗口/执行路径带 helpers 时按类型精确过滤。
        if (!helpers?.cardType) return true
        return discard.some(code => helpers.cardType(code) === 'event' && hasTrait(helpers, code))
      }],
      resolve: ({ inv, api, source }) => {
        const candidates = [...new Set((inv.discard || []).filter(code => isSpellOrInsightEvent(api, code)))]
          .filter(code => api.playCostOf(inv.seat, code) - 1 <= (inv.resources || 0))
        if (!candidates.length) {
          api.info('弃牌堆里没有可支付的法术/洞察事件（或资源不足）。')
          return
        }
        const chosen = candidates.length === 1 ? candidates[0] : api.choice({
          kind: 'card', source: '05235', seat: inv.seat,
          prompt: '选择要从弃牌堆打出的[[法术]]或[[洞察]]事件（费用 -1）。',
          options: candidates.map(code => ({ id: code, cardCode: code, label: api.cardName(code) })),
        })
        const code = candidates.includes(chosen) ? chosen : candidates[0]
        // 额外费用：横置（engine 已付）+ 在这张支援上放 1 毁灭。
        const previousDoom = Number(source?.doom) || 0
        api.placeDoomOnCard(source, 1)
        api.info(`🌑 「蠕虫的秘密」放置 1 毁灭（当前 ${source.doom || 0}）。`)
        // 第七轮：走引擎 playCardFromDiscard 真实管线（绕过弃牌堆顶/playableFromDiscard 限制；
        // 目标/费用/打出窗口齐全、不扣行动；discount 支付前生效；结算后按 exileAfter 移出游戏）。
        const played = api.playCardFromDiscard(inv.seat, code, { discount: 1, exileAfter: true })
        if (!played) {
          // 未实际打出：引擎已把事件退回弃牌堆；回退刚放置的 1 毁灭。
          api.setAssetDoom(source, previousDoom)
          api.info(`⚠️ 「${api.cardName(code)}」未能打出，退回弃牌堆（毁灭已回退）。`)
          return
        }
        api.info(`🗑️ 「${api.cardName(code)}」结算后被移出游戏。`)
      },
    },
  ],
}
