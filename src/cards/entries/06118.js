// 06118 洁西卡·海德
// 卡面：你得到+1[combat]。
// 卡面：洁西卡·海德入场时，其上带有2点伤害。
// 卡面：[reaction]你的回合结束后：治愈洁西卡·海德的1点伤害。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 实现：+1[combat] 走 modifiers（引擎统计管线读点）。
// 入场用 api.placeAssetHarm 放置 2 伤害；回合结束窗口可选治愈自身 1 伤害。

import { skillModifier } from './_shared.js'

export default {
  code: '06118',
  abilities: [
    {
      kind: 'entersPlay',
      label: '入场时带有 2 点伤害',
      resolve: ({ source, api }) => {
        if (source) api.placeAssetHarm(source, { damage: 2 })
      },
    },
    {
      kind: 'reaction',
      trigger: 'turnEnded',
      label: '你的回合结束后：治愈洁西卡·海德的 1 点伤害',
      criteria: [({ inv, source, context }) => context?.seat === inv.seat && (source?.damage || 0) > 0],
      resolve: ({ source, api }) => api.healAsset(source, { damage: 1 }),
    },
  ],
  modifiers: [
    skillModifier('combat', 1),
  ],
}
