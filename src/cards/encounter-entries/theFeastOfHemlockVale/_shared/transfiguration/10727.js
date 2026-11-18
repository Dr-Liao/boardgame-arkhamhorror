// 10727 真菌感染（Fungal Rot）· 诡计 · 共享遭遇组 transfiguration（印刷 2 张）
// 归属：战役共用 · theFeastOfHemlockVale/_shared/transfiguration。
// 卡面（cards-data 10727）：
//   显现 - 将真菌感染附属到一张你控制的没有附属真菌感染的[[道具]]支援。
//   如果你不能这么做，真菌感染获得涌动。
//   将所附属支援的文本框视为如同空白（除[[特性]]外）。
//   [action]：检定[战斗](3)。如果你检定成功，弃掉真菌感染。否则，受到 1 点伤害。
//
// 读点（声明即接线）：
//   · 「附属到[[道具]]支援」= api.attachToAsset（scenario-runtime 的遭遇卡附属写入口，
//     attachCardTo 会挂到 asset.attachments）；
//   · 「文本框空白」= 条目 treacheryRule.blankHostExceptForced（card-text.js /
//     ability-rules.js#descriptorUsable 的既有宿主空白读点）；
//   · 不能附属时获得涌动 = encounterResolve 返回 { gainSurge: true }（encounter.js#finishDraw）。
//
// 近似（明确披露）：
//   1. 引擎的宿主空白读点只抑制“可选能力”的枚举（blankHostExceptForced 保留强制能力），
//      而印刷是「除特性外全部空白」；修正/被动数值没有同样的逐宿主空白读点。
//   2. 「[action] 战斗(3) 摆脱」需要引擎能枚举「附属在玩家支援上的遭遇卡的行动」；当前
//      moves.js 只从 controlledAbilityCards（assets + threat）枚举行动，挂在 asset.attachments
//      上的这张卡没有行动入口，因此只声明 flags.escapeAction，未写不可达描述子。
import { ALL_CARDS } from '../../../_shared.js'

const CODE = '10727'
const DIFFICULTY = 3

const isItemAsset = asset => ((ALL_CARDS[asset?.code]?.traits) || []).includes('Item')

const hasRot = asset => (asset?.attachments || [])
  .some(card => (card.originalCode || card.code) === CODE)

export default {
  code: CODE,
  scope: 'treachery',
  implemented: true,
  treacheryRule: { blankHostExceptForced: true },
  flags: {
    traits: ['Hazard', 'Blight'],
    quantity: 2,
    attachToItemAsset: true,
    blankHostTextExceptTraits: true,
    escapeAction: { skill: 'combat', difficulty: DIFFICULTY, failDamage: 1 },
  },
  encounterResolve(state, inv, card, api) {
    const candidates = (inv?.assets || []).filter(asset => isItemAsset(asset) && !hasRot(asset))
    if (!candidates.length) {
      api.info?.(`🍄 「真菌感染」：${inv?.name || '调查员'} 没有可附属的[[道具]]支援，获得涌动。`)
      return { gainSurge: true }
    }
    const answer = candidates.length === 1 ? candidates[0].id : String(api.choice({
      kind: 'asset', source: CODE, seat: inv.seat,
      prompt: '选择要附属「真菌感染」的[[道具]]支援。',
      options: candidates.map(asset => ({
        id: asset.id, label: api.cardName?.(asset.code) || asset.code, cardCode: asset.code,
      })),
    }))
    const host = candidates.find(asset => String(asset.id) === answer) || candidates[0]
    api.attachToAsset(inv.seat, host.id, CODE)
    api.info?.(`🍄 「真菌感染」附属到「${api.cardName?.(host.code) || host.code}」（其文本框视为空白）。`)
    return true
  },
  note: 'approximation: 附属/涌动/宿主文本框空白已接线；「文本框空白」的引擎读点只覆盖可选能力枚举'
    + '（blankHostExceptForced 保留强制能力），修正/被动数值没有逐宿主空白读点；'
    + '「[action] 战斗(3) 摆脱」在 FHV 引擎没有「玩家支援附属遭遇卡」的行动枚举入口，'
    + '只落 flags.escapeAction 并在本条披露（不得写不可达描述子）。',
}
