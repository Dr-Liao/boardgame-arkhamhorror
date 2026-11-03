// 06100 现实之线（Threads of Reality，诡计，2 张）
// 归属：战役共用 · theDreamEaters/_shared。遭遇组：merging_realities（WN / ATSOH）。
// 卡面：Revelation - 附属到你控制的印刷费用最高的非永久、非弱点支援。否则，现实之线获得涌动。
//       将所附属支援的印刷文本框视为空白（[[特性]] 与强制能力除外）。
//       [action] 弃掉一个你控制的支援：弃掉现实之线。
// 实现：从符合条件的支援中选最高印刷费用，同费时由揭示者选择；附属、文本空白和摆脱行动
//   分别走 attachToAsset、blankHostExceptForced 和共享场景行动。
import { ALL_CARDS } from '../../../_shared.js'

const printedCost = asset => Number(ALL_CARDS[asset.code]?.cost) || 0
const eligibleAssets = inv => (inv.assets || []).filter(asset => {
  const definition = ALL_CARDS[asset.code]
  return definition && !definition.permanent
    && !['weakness', 'basicweakness'].includes(definition.subtype)
    && !asset.removedFromGame && !asset.returnedToHand
})

export default {
  code: '06100',
  scope: 'treachery',
  implemented: true,
  treacheryRule: { blankHostExceptForced: true },
  encounterResolve(state, inv, card, api) {
    const candidates = eligibleAssets(inv)
    if (!candidates.length) return { placed: false, gainSurge: true }
    const highest = Math.max(...candidates.map(printedCost))
    const hosts = candidates.filter(asset => printedCost(asset) === highest)
    const answer = hosts.length === 1 ? hosts[0].id : api.choose?.({
      kind: 'asset', source: '06100', seat: inv.seat,
      prompt: '现实之线：选择一个你控制的印刷费用最高的非永久、非弱点支援。',
      options: hosts.map(asset => ({
        id: asset.id, label: ALL_CARDS[asset.code]?.nameZh || ALL_CARDS[asset.code]?.name || asset.code,
      })),
    })
    const host = hosts.find(asset => String(asset.id) === String(answer)) || hosts[0]
    api.attachToAsset?.(inv.seat, host.id, '06100')
    api.info?.(`🧵 「现实之线」附属到「${api.cardName?.(host.code) || host.code}」。`)
    return true
  },
  flags: {
    discardControlledAssetToRemoveAttachment: true,
  },
}
