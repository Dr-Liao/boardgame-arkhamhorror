// 09741 裂隙空间（Splintered Space） · 诡计 · spatial_anomaly
// 归属：战役共用 · theScarletKeys/_shared/spatialAnomaly。
// 卡面：显现 - 将裂隙空间附属到你所在地点并检定 [agility](3)。如果你检定失败，
//   你所在地点每附属一张 [[巫术]] 诡计，受到 1 点伤害。本次检定结束后，如果场上正好有 3 张裂隙空间，将它们弃掉。
//   Revelation - Attach Splintered Space to your location and test [agility] (3). If you fail, take 1
//   damage for each [[Hex]] treachery attached to your location. After this test ends, if there are exactly
//   3 copies of Splintered Space in play, discard them.
// 读点：
//   · 附属到地点 = api.attachToLocation（location.attachments 唯一写入口，与 04076 等雾/阴影类同款）；
//   · 显现检定 = api.test（条目 encounterResolve 走 entryRevelation 通道）；
//   · 「[[巫术]] 诡计」= cards-data 的 traits 含 Hex（_shared.js 的 ALL_CARDS 只读卡表）；
//   · 「正好 3 张」= 全部地点附属里同卡号数量，弃掉走 api.detachLocationAttachment（地点附属唯一去除写入口）；
//   · 返回 { placed: true } 阻止本卡进遭遇弃牌堆（它已经作为地点附属在场）。
import { ALL_CARDS } from '../../../_shared.js'

const CODE = '09741'
const DIFFICULTY = 3
const COPIES_TO_DISCARD = 3

const isHex = attachment => (ALL_CARDS[attachment?.originalCode || attachment?.code]?.traits || [])
  .some(trait => String(trait).toLowerCase() === 'hex')

function copiesInPlay(state) {
  const copies = []
  for (const location of state.locations) {
    for (const attachment of location.attachments || []) {
      if ((attachment.originalCode || attachment.code) === CODE) copies.push({ location, attachment })
    }
  }
  return copies
}

export default {
  code: CODE, scope: 'treachery', implemented: true,
  encounterResolve(state, inv, card, api) {
    api.attachToLocation(inv.location, { code: CODE, originalCode: CODE })
    api.info?.(`🌌 「裂隙空间」附属到「${api.locationName(inv.location)}」。`)
    api.test(inv.seat, 'agility', DIFFICULTY, result => {
      if (!result.success) {
        const host = state.locations.find(location => location.id === inv.location)
        const amount = (host?.attachments || []).filter(isHex).length
        if (amount > 0) {
          api.damage(inv.seat, amount)
          api.info?.(`🌌 ${inv.name} 所在地点附属了 ${amount} 张[[巫术]]诡计：受到 ${amount} 点伤害。`)
        }
      }
      const copies = copiesInPlay(state)
      if (copies.length === COPIES_TO_DISCARD) {
        for (const copy of copies) api.detachLocationAttachment(copy.location.id, copy.attachment.id)
        api.info?.(`🌌 场上正好有 ${COPIES_TO_DISCARD} 张「裂隙空间」：全部弃掉。`)
      }
    })
    return { placed: true }
  },
  note: 'approximation: 「每附属一张[[巫术]]诡计」按印刷特性 Hex 统计（含本卡自身）；「正好 3 张」只在显现结算后检查，'
    + '不监听后续入场（卡面只要求本次检定结束后检查）。无缺读点。',
}
