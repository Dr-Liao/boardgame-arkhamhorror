// 09742 越界（Beyond the Pale） · 诡计 · spatial_anomaly
// 归属：战役共用 · theScarletKeys/_shared/spatialAnomaly。
// 卡面：显现 - 将越界附属到你所在地点并检定 [willpower](3)。如果你检定失败，
//   你所在地点每附属一张 [[巫术]] 诡计，受到 1 点恐惧。本次检定结束后，如果场上正好有 3 张越界，将它们弃掉。
//   Revelation - Attach Beyond the Pale to your location and test [willpower] (3). If you fail, take 1
//   horror for each [[Hex]] treachery attached to your location. After this test ends, if there are exactly
//   3 copies of Beyond the Pale in play, discard them.
// 读点（与 09741 同一模板，只换技能/伤害类型/卡号）：
//   · 附属到地点 = api.attachToLocation；
//   · 显现检定 = api.test；失败按印刷特性 Hex 计数，用 api.horror 结算；
//   · 「正好 3 张」= 全部地点附属里同卡号数量，弃掉走 api.detachLocationAttachment。
import { ALL_CARDS } from '../../../_shared.js'

const CODE = '09742'
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
    api.info?.(`🌌 「越界」附属到「${api.locationName(inv.location)}」。`)
    api.test(inv.seat, 'willpower', DIFFICULTY, result => {
      if (!result.success) {
        const host = state.locations.find(location => location.id === inv.location)
        const amount = (host?.attachments || []).filter(isHex).length
        if (amount > 0) {
          api.horror(inv.seat, amount)
          api.info?.(`🌌 ${inv.name} 所在地点附属了 ${amount} 张[[巫术]]诡计：受到 ${amount} 点恐惧。`)
        }
      }
      const copies = copiesInPlay(state)
      if (copies.length === COPIES_TO_DISCARD) {
        for (const copy of copies) api.detachLocationAttachment(copy.location.id, copy.attachment.id)
        api.info?.(`🌌 场上正好有 ${COPIES_TO_DISCARD} 张「越界」：全部弃掉。`)
      }
    })
    return { placed: true }
  },
  note: 'approximation: 「每附属一张[[巫术]]诡计」按印刷特性 Hex 统计（含本卡自身）；「正好 3 张」只在显现结算后检查。'
    + '无缺读点。',
}
