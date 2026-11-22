// 60162 定制握把（Custom Grip）
// 卡面：快速。只能在你回合期间打出。附属到你控制的[[枪械]]支援。
// [free] 你的回合期间（行动外），弃掉定制握把：将所附属支援返回手牌；你可以打出你手牌中一张[[枪械]]支援（支付费用）。
// 读点：keepOnPlay + api.attachPlayerCardToAsset（actions-extra 唯一写点）；free 能力（player window）+ api.returnAssetToHand。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

import { ownTurn } from '../../engine/matcher.js'

const CODE = '60162'

export default {
  code: CODE,
  keepOnPlay: true,
  playCondition: [ownTurn()],
  abilities: [
    {
      kind: 'played',
      fast: true,
      label: '附属到你控制的[[枪械]]支援',
      resolve: ({ inv, api }) => {
        const candidates = (inv.assets || []).filter(asset => !asset.attachedToAsset
          && (api.cardTraits(asset.code) || []).some(trait => String(trait).toLowerCase() === 'firearm'))
        if (!candidates.length) {
          api.info('你没有可以附属的[[枪械]]支援。')
          return
        }
        const id = candidates.length === 1 ? candidates[0].id : api.choice({
          kind: 'target', source: CODE, seat: inv.seat, prompt: '选择要附属的[[枪械]]支援。',
          options: candidates.map(asset => ({ id: asset.id, label: api.cardName(asset.code) })),
        })
        const host = candidates.find(asset => asset.id === id)
        if (host) api.attachPlayerCardToAsset(CODE, host, { ownerSeat: inv.seat })
      },
    },
    {
      kind: 'free',
      label: '弃掉定制握把：把所附属支援收回手牌，并可再打出一张枪械',
      criteria: [ownTurn(), ({ source }) => Boolean(source?.hostAssetId)],
      resolve: ({ state, inv, source, api }) => {
        const host = (inv.assets || []).find(asset => asset.id === source?.hostAssetId)
        api.discardSelf(CODE)
        if (host && api.returnAssetToHand(inv.seat, host)) {
          const firearms = (inv.hand || []).filter(code => (api.cardTraits(code) || [])
            .some(trait => String(trait).toLowerCase() === 'firearm'))
          if (firearms.length) {
            const code = firearms.length === 1 ? firearms[0] : api.choice({
              kind: 'card', source: CODE, seat: inv.seat, canSkip: true,
              prompt: '可以打出你手牌中一张[[枪械]]支援（支付费用）。',
              options: [{ id: 'skip', label: '不打出' },
                ...firearms.map(item => ({ id: item, label: api.cardName(item) }))],
            })
            if (code && code !== 'skip') api.playCardFromHandFree(inv.seat, code)
          }
        }
        void state
      },
    },
  ],
  modifiers: [],
}
