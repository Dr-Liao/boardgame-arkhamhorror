// 02181 铁轨断裂
// 归属：关卡专用 · theEssexCountyExpress（疯狂列车）
// 遭遇组：essex_county_express
// 卡面：显现 - 每位你所在​​地点的调查员失去1个行动。每位你所在地点有至少4点伤害的调查员还必须弃掉其控制的一个支援。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

import { ALL_CARDS } from '../../_shared.js'

export default {
  code: '02181', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['dunwich'],
  encounterResolve(state, inv, card, api) {
    const code = card.originalCode || card.code
    for (const target of state.investigators.filter(other =>
      !other.defeated && !other.resigned && other.location === inv.location)) {
      target.actionsLeft = Math.max(0, target.actionsLeft - 1)
      if (target.damage >= 4 && target.assets.length) {
        const choice = api.choose({ kind: 'target', source: code, seat: target.seat,
          prompt: '铁轨断裂：选择弃掉一张你控制的支援。',
          options: target.assets.map(asset => ({ id: asset.id, label: ALL_CARDS[asset.code]?.nameZh || asset.code })) })
        api.discardAsset(target.seat, choice)
      }
    }
    return false
  },
}
