// 60168 武装到牙齿（Armed to the Teeth）
// 卡面：投入到你控制的[[道具]]支援上的技能检定时，武装到牙齿获得[wild][wild]。
// 读点：commit 描述子 + reaction trigger committedCard；api.addCommittedExtraIcons 给本次投入追加 2 wild。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

import { ALL_CARDS } from '../cards-data.js'

const CODE = '60168'

export default {
  code: CODE,
  abilities: [
    {
      kind: 'commit',
      skill: {},
      label: '投入到你控制的[[道具]]支援上的检定：获得 2 个万能图标',
    },
    {
      kind: 'reaction',
      trigger: 'committedCard',
      label: '投入到[[道具]]支援检定时：本次投入 +2 万能图标',
      criteria: [({ state, inv, context }) => {
        if (context?.cardCode !== CODE || context?.seat !== inv.seat) return false
        // 读点：state.skillTest.assetSourceId（检定来源支援实例）；没有来源支援时不触发。
        const sourceId = state.skillTest?.assetSourceId
        if (!sourceId) return false
        const asset = state.investigators.flatMap(owner => owner.assets || []).find(item => item.id === sourceId)
        if (!asset || asset.code === CODE) return false
        return (ALL_CARDS[asset.code]?.traits || []).some(trait => String(trait).toLowerCase() === 'item')
      }],
      resolve: ({ api }) => {
        api.addCommittedExtraIcons('wild')
        api.addCommittedExtraIcons('wild')
      },
    },
  ],
  note: "approximation: 「检定必须使用你控制的[[道具]]支援」无法从 state.skillTest.source 可靠取得检定来源支援（攻击检定 source.code 为敌人卡号）；当前对任何投入本卡都追加 2 wild，行为略强，已登记原语请求。",
  modifiers: [],
}
