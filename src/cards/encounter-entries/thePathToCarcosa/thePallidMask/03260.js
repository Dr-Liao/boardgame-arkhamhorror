// 03260 墙中之眼
// 归属：关卡专用 · thePallidMask（卡尔克萨之路 · 苍白面具）
// 遭遇组：the_pallid_mask
// 卡面：显现 - 检定[willpower](3)。你检定失败且每低于难度1点，受到1点恐惧。在分配来自本效果的恐惧时，必须尽量平均地分配到所有可分配的卡牌上。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

import { ALL_CARDS, chooseEntryOption } from '../../_shared.js'

export default {
  code: '03260', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['carcosa'],
  encounterResolve(state, inv, card, api) {
    api.test(inv.seat, 'willpower', 3, result => {
      if (result.success) return
      const amount = Math.max(0, result.difficulty - result.value)
      const recipients = [{ id: `inv:${inv.seat}`, kind: 'investigator', name: inv.name,
        capacity: Math.max(0, (inv.maxSanity || 0) - inv.horror), assigned: 0 },
      ...inv.assets.flatMap(asset => {
        const sanity = ALL_CARDS[asset.code]?.sanity || 0
        return sanity > (asset.horror || 0) ? [{ id: `asset:${asset.id}`, kind: 'asset',
          assetId: asset.id, name: ALL_CARDS[asset.code]?.nameZh || asset.code,
          capacity: sanity - (asset.horror || 0), assigned: 0 }] : []
      })]
      for (let point = 0; point < amount; point++) {
        const available = recipients.filter(recipient => recipient.assigned < recipient.capacity)
        if (!available.length) break
        const minimum = Math.min(...available.map(recipient => recipient.assigned))
        const even = available.filter(recipient => recipient.assigned === minimum)
        const picked = chooseEntryOption(api, {
          kind: 'horror', source: '03260', seat: inv.seat,
          prompt: `墙中之眼：分配第${point + 1}/${amount}点恐惧（必须尽量平均）。`,
        }, even, recipient => `${recipient.name}（已分配${recipient.assigned}）`)
        picked.assigned++
      }
      for (const recipient of recipients.filter(candidate => candidate.assigned)) {
        if (recipient.kind === 'investigator') api.horror(inv.seat, recipient.assigned)
        else api.horrorAsset(inv.seat, recipient.assetId, recipient.assigned)
      }
    })
    return false
  },
}
