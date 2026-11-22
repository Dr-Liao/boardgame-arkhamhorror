// 60153 我行我素（Loose Cannon，托米·马尔登专属弱点）
// 卡面：显现 - 你必须弃掉你控制的每张[[枪械]]支援，或失去 5 资源。
// 读点：weakness 描述子的自定义 resolve（weakness.js#resolveWeakness 先走 descriptor.resolve）；
// 弃支援走 api.discardAsset（唯一写点），失去资源走 api.loseResources（含 wouldLoseResources 窗口）。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

import { ALL_CARDS } from '../../cards/cards-data.js'

const isFirearm = code => (ALL_CARDS[code]?.traits || []).some(trait => String(trait).toLowerCase() === 'firearm')

export default {
  code: '60153',
  abilities: [{
    kind: 'weakness',
    label: '弃掉所有[[枪械]]支援，或失去 5 资源',
    weakness: { type: 'custom' },
    resolve: ({ inv, api }) => {
      const firearms = (inv.assets || []).filter(asset => isFirearm(asset.code))
      const canDiscard = firearms.length > 0
      const canPay = Number(inv.resources) >= 5
      if (!canDiscard && !canPay) {
        api.info('你没有要弃掉的[[枪械]]支援，也没有 5 资源可失去。')
        return
      }
      if (!canPay) {
        for (const asset of firearms.slice()) api.discardAsset(inv.seat, asset.id)
        api.info('我行我素：你弃掉了所有[[枪械]]支援。')
        return
      }
      if (!canDiscard) {
        api.loseResources(inv.seat, 5)
        api.info('我行我素：你失去了 5 资源。')
        return
      }
      const choice = api.choice({
        kind: 'choice', source: '60153', seat: inv.seat, prompt: '选择一项。',
        options: [
          { id: 'discard', label: '弃掉你控制的所有[[枪械]]支援' },
          { id: 'resources', label: '失去 5 资源' },
        ],
      })
      if (choice === 'discard') {
        for (const asset of firearms.slice()) api.discardAsset(inv.seat, asset.id)
        api.info('我行我素：你弃掉了所有[[枪械]]支援。')
      } else {
        api.loseResources(inv.seat, 5)
        api.info('我行我素：你失去了 5 资源。')
      }
    },
  }],
  modifiers: [],
}
