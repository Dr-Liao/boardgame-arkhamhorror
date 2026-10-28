// 03306 遗觉记忆
// 卡面：将遗觉记忆作为任意调查员弃牌堆中的一张[[洞察]]事件打出(包括其资源费用)。将该事件从游戏中移除。不要弃掉遗觉记忆，改为将其从游戏中移除。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 03306 遗觉记忆：付等同费用的资源，复制一张洞察事件（移出游戏后重放其效果），这张牌移出游戏。

export default {
  code: '03306',
  removeAfterPlay: true,
  quietPlay: true,
  abilities: [
    {
      kind: 'played', label: '复制弃牌堆里的一张洞察事件并重放',
      resolve: ({ inv, api }) => {
        const candidates = api.discardPiles()
          .filter(item => api.cardType(item.code) === 'event'
            && api.cardTraits(item.code).includes('insight')
            && inv.resources >= api.playCostOf(inv.seat, item.code))
        if (!candidates.length) return
        const answer = api.choice({ kind: 'card', source: '03306', seat: inv.seat,
          prompt: '选择要复制的洞察事件。',
          options: candidates.map((item, index) => ({ id: String(index), cardCode: item.code,
            label: `${api.cardName(item.code)}（${api.playCostOf(inv.seat, item.code)}资源）` })) })
        if (answer === undefined || answer === null) return
        const picked = candidates[Number(answer)]
        if (!picked) return
        const copyCost = api.playCostOf(inv.seat, picked.code)
        // 卡面「包括其资源费用」= 支付费用：走统一的支付入口（合并池先扣寄存量）。
        api.spendResources(inv.seat, copyCost)
        api.exileFromDiscard(picked.seat, picked.code)
        api.replayPlayedCode(inv.seat, picked.code)
      },
    },
  ],
  modifiers: [

  ],
}
