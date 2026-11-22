// 90084 珍妮·巴恩斯（平行 / The Socialite）· 游荡者 · 独立发行平行调查员。
//
// 卡面：
//   [reaction] 在你的回合开始后：打出一张 [[才能]] 支援，其费用减 1。
//   [fast] 弃掉你控制的一张 [[才能]] 支援：获得等同其印刷费用的资源。（每轮最多 5 资源。）
//   [elder_sign] 效果：+0。如果你成功，获得 3 资源。
//
// 引擎读点：
//   · 「回合开始后」= turnBegins 窗口（turn.js#turnBeginningWindow 派发，与 03001 等同一读点）；
//     减费打出 = api.playCardFromHandFree(seat, code, { discount: 1, noAction: true })
//     （actions.js#doPlay 的折扣读点；反应打出不占行动）。
//   · 「弃掉才能支援获得印刷费用资源」= free 描述子；弃支援走 api.discardAsset（唯一弃置写点），
//     印刷费用读 cards-data（ALL_CARDS[code].cost）。
//     近似：「每轮最多 5 资源」没有跨次累计的通用上限原语，这里用 limit oncePerRound（每轮最多结算一次）
//     + 单次获得按印刷费用（>5 时截到 5），见 note。
//   · 旧印 = elderSign delta 0 + success 时 gainResource 3（investigator.elderSign.onSuccess 数据读点，
//     与 01003 同一实现）。
import { ALL_CARDS } from '../cards-data.js'
import { ownSeat } from '../../engine/matcher.js'
import { investigatorSign } from './_shared.js'

const code = '90084'
const sign = investigatorSign(code)

const isTalentAsset = code => ALL_CARDS[code]?.type === 'asset'
  && (ALL_CARDS[code]?.traits || []).some(trait => String(trait).toLowerCase() === 'talent')
const printedCost = code => Math.max(0, Number(ALL_CARDS[code]?.cost) || 0)
const talentAssets = inv => (inv.assets || []).filter(asset => !asset.facedown && isTalentAsset(asset.code))

export default {
  code,
  kind: 'investigator',
  investigator: {
    elderSign: { bonus: 0, onSuccess: { type: 'gainResource', amount: 3 } },
  },
  elderSign: {
    id: `${code}-eldersign`,
    label: '旧印：+0。如果你成功，获得 3 资源',
    resolve: () => ({ delta: Number(sign.bonus ?? 0), onSuccess: sign.onSuccess }),
  },
  abilities: [
    {
      kind: 'reaction',
      trigger: 'turnBegins',
      label: '你的回合开始后：打出一张手牌中的 [[才能]] 支援，费用减 1',
      criteria: [
        ownSeat(),
        ({ inv }) => (inv.hand || []).some(item => isTalentAsset(item)
          && printedCost(item) - 1 <= (inv.resources || 0)),
      ],
      resolve: ({ inv, api }) => {
        const candidates = [...new Set((inv.hand || []).filter(item => isTalentAsset(item)
          && printedCost(item) - 1 <= (inv.resources || 0)))]
        if (!candidates.length) return
        const picked = candidates.length === 1 ? candidates[0] : api.choice({
          kind: 'card', source: code, seat: inv.seat,
          prompt: '珍妮（平行）：选择要减 1 费打出的 [[才能]] 支援。',
          options: candidates.map(item => ({ id: item, cardCode: item, label: api.cardName(item) })),
        })
        if (!candidates.includes(picked)) return
        const played = api.playCardFromHandFree(inv.seat, picked, { discount: 1, noAction: true })
        if (!played) api.info(`珍妮（平行）：「${api.cardName(picked)}」无法打出。`)
      },
    },
    {
      kind: 'free',
      limit: 'oncePerRound',
      label: '弃掉一张 [[才能]] 支援：获得等同其印刷费用的资源（每轮近似 1 次）',
      criteria: [({ inv, helpers }) => talentAssets(inv).some(asset =>
        apiCanDiscard(helpers, inv, asset))],
      resolve: ({ inv, api }) => {
        const candidates = talentAssets(inv)
        if (!candidates.length) return
        const picked = candidates.length === 1 ? candidates[0].id : api.choice({
          kind: 'asset', source: code, seat: inv.seat,
          prompt: '珍妮（平行）：选择要弃掉的 [[才能]] 支援。',
          options: candidates.map(asset => ({ id: asset.id, label: api.cardName(asset.code) })),
        })
        const asset = candidates.find(item => item.id === picked)
        if (!asset) return
        const gain = Math.min(5, printedCost(asset.code))
        api.discardAsset(inv.seat, asset)
        if (gain > 0) api.gainResources(inv.seat, gain)
        api.info(`珍妮（平行）：弃掉「${api.cardName(asset.code)}」并获得 ${gain} 资源（每轮 5 资源上限近似）。`)
      },
    },
  ],
  modifiers: [],
  note: '近似：[fast] 弃才能拿资源按「每轮至多触发一次、单次获得 min(印刷费用,5)」结算（缺跨次累计 5 资源/轮的原语）；[reaction] 减费打出与旧印 +0/成功得 3 资源均已接线。',
}

// helpers.canDiscardAsset 在判定里可用；集中成一个函数避免 criteria 里写两遍。
function apiCanDiscard(helpers, inv, asset) {
  try {
    return helpers?.canDiscardAsset ? helpers.canDiscardAsset(asset) === true : true
  } catch {
    return true
  }
}
