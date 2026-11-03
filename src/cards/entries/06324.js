// 06324 阿比盖尔·福尔曼
// 卡面：[free]：附属你游戏区域的一张[[书籍]]支援到阿比盖尔·福尔曼，或将你游戏区域的一张[[书籍]]支援
//       与附属到阿比盖尔·福尔曼的支援互换。附属到阿比盖尔·福尔曼的支援不占手部槽位(附属的支援仅限1张)。
//       [reaction]你结算附属的[[书籍]]支援的[action]能力后，横置阿比盖尔·福尔曼：再次结算其效果。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 书籍保留真实支援实例，附属或互换只改变宿主关系；不占手部槽位。
// 结算附属书籍的行动能力后，assetActionResolved 窗口可横置阿比盖尔重放其效果。

import { ALL_CARDS } from '../../cards/cards-data.js'

function isTomeAsset(code) {
  const def = code ? ALL_CARDS[code] : null
  return Boolean(def) && def.type === 'asset'
    && (def.traits || []).some(trait => String(trait).toLowerCase() === 'tome')
}

export default {
  code: '06324',
  attachedAssetsIgnoreSlots: ['hand'],
  abilities: [
    {
      kind: 'free',
      label: '附属一本[[书籍]]；若已有附属书籍，则与其互换',
      cost: { action: false },
      target: {
        kind: 'asset',
        label: '你游戏区域中未附属的[[书籍]]支援',
        query: ({ candidate }) => isTomeAsset(candidate?.entity?.code ?? candidate?.id)
          && !candidate?.entity?.attachedToAsset,
      },
      resolve: ({ inv, api, source, target }) => {
        const tome = target?.entity
        if (!source || !tome) return
        if (api.attachOrSwapControlledAsset(inv.seat, source.id, tome.id))
          api.info(`📚 ${inv.name} 把「${api.cardName(tome.code)}」附属到阿比盖尔·福尔曼。`)
      },
    },
    {
      kind: 'reaction',
      trigger: 'assetActionResolved',
      label: '横置：再次结算附属[[书籍]]的这项行动能力的效果',
      cost: { exhaust: true },
      criteria: [({ inv, source, context }) => context?.seat === inv.seat
        && (inv.assets || []).some(asset => asset.id === context.assetId
          && asset.attachedToAsset === source?.id && isTomeAsset(asset.code))],
      resolve: ({ context, api }) => api.repeatResolvedAbility(context),
    },
  ],
  modifiers: [],
}
