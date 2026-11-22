// 12052 变戏法（Prestidigitation）· 事件 · 游荡者 0 经验 · 费用 1
// 卡面：快速。只能在你的回合期间打出。
// 卡面：从你的手牌中打出一张[[道具]]支援，其费用减 2。
//       在你的回合结束时，将你控制的一张[[道具]]支援返回你的手牌。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点：
//   · played + fast（打出不耗行动）→ playCondition（本人回合 + 手牌里有减费后可支付的道具支援）；
//   · 「减 2 费打出道具支援」= api.playCardFromHandFree({ discount: 2, noAction: true })（真实 doPlay
//     管线：付费/入场/槽位/入场反应窗口齐全）；进入场后按「打出前实例 id 集合」找到新实例；
//   · 「回合结束时返回手牌」= 实例级标记 returnToHandAtRoundEnd（api.markAssetRoundEndReturn(asset,'hand')
//     + turn.js#runMythos 轮末段读点）。
// 近似：引擎的轮末段在「新一轮开始时」统一结算上一轮的轮末效果（与 discardAtRoundEnd 同层），因此
//   实际时机是轮末而不是严格意义上的「你的回合结束时」；另外引擎的实例级标记只能指到具体一张支援，
//   所以这里返回的是「本次打出的那张道具」（印刷文本允许在回合结束时选择你控制的任意一张道具支援）。
import { ownTurn } from '../../engine/matcher.js'
import { ALL_CARDS } from '../../cards/cards-data.js'

const isItemAsset = code => ALL_CARDS[code]?.type === 'asset'
  && (ALL_CARDS[code]?.traits || []).some(trait => String(trait).toLowerCase() === 'item')

export default {
  code: '12052',
  playCondition: [
    ownTurn(),
    {
      when: ({ inv, helpers }) => (inv.hand || []).some(code => {
        if (!isItemAsset(code)) return false
        const reduced = Math.max(0, (Number(ALL_CARDS[code]?.cost) || 0) - 2)
        return helpers.availablePlayResources(ALL_CARDS[code]) >= reduced
      }),
      message: '手牌中没有可减费打出的[[道具]]支援',
    },
  ],
  abilities: [
    {
      kind: 'played',
      fast: true,
      label: '打出一张手牌中的道具支援（费用减 2），回合结束时将它返回手牌',
      resolve: ({ inv, api }) => {
        const candidates = [...new Set((inv.hand || []).filter(isItemAsset))]
        if (!candidates.length) { api.info('手牌中没有[[道具]]支援。'); return }
        const code = candidates.length === 1 ? candidates[0] : api.choice({
          kind: 'card', source: '12052', seat: inv.seat,
          prompt: '变戏法：选择要打出的[[道具]]支援（费用减 2）。',
          options: candidates.map((item, index) => ({ id: String(index), label: api.cardName(item), cardCode: item })),
        })
        const picked = candidates[Number(code)] || candidates[0]
        if (!picked) return
        // 打出前记录已场上的实例 id，打出后找出刚入场的这张道具实例用于轮末标记。
        const beforeIds = new Set((inv.assets || []).map(asset => asset.id))
        const played = api.playCardFromHandFree(inv.seat, picked, { discount: 2, noAction: true })
        if (!played) { api.info(`变戏法：无法打出「${api.cardName(picked)}」（资源不足或当前不能打出）。`); return }
        api.info(`${inv.name} 用变戏法打出「${api.cardName(picked)}」（费用减 2）。`)
        const entered = (inv.assets || []).find(asset => asset.code === picked && !beforeIds.has(asset.id))
        if (!entered) {
          api.info('变戏法：道具已打出，但没找到入场实例来标记轮末返回。')
          return
        }
        api.markAssetRoundEndReturn(entered, 'hand')
      },
    },
  ],
  modifiers: [],
}
