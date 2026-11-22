// 90062 蒙特雷·杰克（平行 / Relics of the Past，挑战「往昔遗物」必需调查员）。
//
// 卡面（cards-data 90062）：
//   [reaction] After you discover the last clue at your location: Search the top X cards of your
//     deck for a [[Charm]] or [[Relic]] asset and play it, reducing its cost by X. X is the printed
//     shroud of your location. Shuffle your deck. (Limit once per round.)
//   [elder_sign] effect: +1. Gain 1 resource for each [[Charm]] asset and each [[Relic]] asset you control.
//
// 引擎读点：
//   · 「发现地点的最后一个线索」：`clueDiscovered` 窗口（locations.js）context 带
//     `{ seat, location, amount, lastClue, shroud }`；`lastClue === true` 即最后线索，X 取 `context.shroud`。
//   · 查找 + 减费打出：`api.searchDeck({ type:'asset', traitsAny:['Charm','Relic'], choose:1, shuffle:true })`
//     把找到的支援放进手牌，再 `api.playCardFromHandFree(seat, code, { discount: X, noAction: true })`
//     （doPlay 的 playDiscount 读点，照常支付剩余费用）。
//     近似：引擎「查找牌库顶 N 张」只有 `api.searchTop`（card-ops，只能抽取、不能再打出），
//     因此这里用整副牌库 `searchDeck` 代替「牌库顶 X 张」；已在
//     primitive-requests/core-inv-90062-search-top-playable.json 请求「按顶 N 张查找并可打出」。
//   · 旧印：`elderSign.resolve` 返回 { delta: 1 } 并统计控制中的 Charm/Relic 支援发资源。

import { ALL_CARDS } from '../cards-data.js'
import { ownSeat } from '../../engine/matcher.js'

const code = '90062'
const hasTrait = (cardCode, trait) => (ALL_CARDS[cardCode]?.traits || [])
  .some(item => String(item).toLowerCase() === trait.toLowerCase())
const findRelicAssets = inv => (inv.assets || []).filter(asset => !asset.facedown
  && (hasTrait(asset.code, 'Charm') || hasTrait(asset.code, 'Relic')))

export default {
  code,
  kind: 'investigator',
  investigator: { elderSign: { bonus: 1 } },
  elderSign: {
    id: '90062-eldersign',
    label: '旧印：+1；每控制一个 [[Charm]]/[[Relic]] 支援获得 1 资源',
    resolve: ({ inv, api }) => {
      const count = findRelicAssets(inv).length
      if (count) api.gainResources(inv.seat, count)
      return { delta: 1 }
    },
  },
  abilities: [
    {
      kind: 'reaction',
      trigger: 'clueDiscovered',
      limit: 'oncePerRound',
      label: '发现本地点最后一个线索后：查找一张 [[Charm]]/[[Relic]] 支援并减费打出',
      criteria: [ownSeat(), ({ context }) => context?.lastClue === true],
      resolve: ({ inv, context, api }) => {
        const shroud = Math.max(0, Number(context?.shroud) || 0)
        const taken = api.searchDeck(inv.seat, {
          source: code,
          type: 'asset',
          traitsAny: ['Charm', 'Relic'],
          choose: 1,
          shuffle: true,
          optional: true,
          prompt: `查找你的牌库，选择一张 [[Charm]] 或 [[Relic]] 支援（减 ${shroud} 费用打出）。`,
        }) || []
        const found = taken.find(cardCode => cardCode && api.playCostOf(inv.seat, cardCode) - shroud <= (inv.resources || 0))
        if (!found) {
          api.info(`「蒙特雷·杰克」：没有可减费打出的 [[Charm]]/[[Relic]] 支援。`)
          return
        }
        const played = api.playCardFromHandFree(inv.seat, found, { discount: shroud, noAction: true })
        if (!played) api.info(`「蒙特雷·杰克」：打出的「${api.cardName(found)}」被取消，卡牌留在手中。`)
      },
    },
  ],
  modifiers: [],
  note: '近似：以整副牌库 searchDeck 代替「牌库顶 X 张」（缺「查找顶 N 张并能打出」的原语，primitive-requests/core-inv-90062-search-top-playable.json）；X 取 clueDiscovered 窗口的 shroud。',
}
