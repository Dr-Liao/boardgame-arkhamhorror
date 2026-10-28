// 04082 补给短缺
// 归属：战役共用 · theForgottenAge（失落的时代）
// 遭遇组：expedition
// 卡面：险境。
// 卡面：显现 - 你必须决定(选择一项)：
// 卡面：- 每位调查员失去2资源。
// 卡面：- 每位调查员受到1点伤害。
// 卡面：- 每位调查员选择并弃掉自己控制的一个支援。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

import { ALL_CARDS, originalOf } from '../../../_shared.js'

export default {
  code: '04082', scope: 'treachery', implemented: true,
  encounterResolve(state, inv, card, api) {
    const answer = api.choose({
      kind: 'team', source: '04082', seat: inv.seat, peril: true,
      prompt: '补给短缺：全队选择一项。',
      options: [
        { id: 'resources', label: '每位调查员失去 2 资源' },
        { id: 'damage', label: '每位调查员受到 1 点伤害' },
        { id: 'asset', label: '每位调查员弃掉自己控制的一个支援' },
      ],
    })
    for (const target of state.investigators.filter(item => !item.defeated && !item.resigned)) {
      if (answer === 'resources') api.loseResources(target.seat, 2)
      else if (answer === 'damage') api.damage(target.seat, 1)
      else if (target.assets.length) {
        const picked = api.choose({
          kind: 'asset', source: '04082', seat: target.seat,
          prompt: `${target.name}：选择弃掉自己控制的一个支援。`,
          options: target.assets.map(asset => ({ id: asset.id, label: ALL_CARDS[originalOf(asset)]?.nameZh || asset.name || asset.code })),
        })
        const chosen = target.assets.find(asset => asset.id === picked) || target.assets[0]
        api.discardAsset(target.seat, chosen.id)
      }
    }
    return false
  },
}
