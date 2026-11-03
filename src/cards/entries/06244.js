// 06244 特薇拉·凯瑟琳·普莱斯
// 卡面：[reaction] 你花费[[法术]]支援的至少 1 充能后，横置特薇拉·凯瑟琳·普莱斯：
//       在该支援上放置 1 充能。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 法术支援支付充能后由 spellChargesSpent 窗口提供来源，横置本卡归还 1 充能。

export default {
  code: '06244',
  abilities: [{
    kind: 'reaction',
    trigger: 'spellChargesSpent',
    label: '花费法术支援充能后：横置特薇拉，在该支援上放置 1 充能',
    cost: { exhaust: true },
    criteria: [({ inv, context }) => context?.seat === inv.seat && context.amount >= 1
      && (inv.assets || []).includes(context.asset)],
    resolve: ({ context, api }) => {
      api.addUses(context.asset, 1)
      api.info(`「特薇拉·凯瑟琳·普莱斯」为「${api.cardName(context.asset.code)}」补充了 1 充能。`)
    },
  }],
  modifiers: [],
}
