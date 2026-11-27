// 09120 工具带（Tool Belt）· 中立资产 · 0 经验 · 身体槽
// 卡面：每个附属的支援不占用槽位，且其文本框视为如同空白（除[[特性]]外）。
//       [fast] 横置工具带：选择一项——将你游戏区域的一个[[工具]]支援附属到工具带；
//       将你游戏区域的一个[[工具]]支援与一个已附属的支援交换；或将一个已附属的支援解除附属。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
import { ALL_CARDS } from '../cards-data.js'

const code = '09120'
const attached = (inv, source) => inv.assets.filter(asset => asset.attachedToAsset === source.id)
const tools = (inv, source) => inv.assets.filter(asset => asset.id !== source.id && !asset.attachedToAsset
  && ALL_CARDS[asset.code]?.traits?.some(trait => trait.toLowerCase() === 'tool'))

function chooseTool(inv, api, assets, prompt) {
  return assets.length === 1 ? assets[0].id : api.choice({
    kind: 'target', source: code, seat: inv.seat, prompt,
    options: assets.map(asset => ({ id: asset.id, label: api.cardName(asset.code) })),
  })
}

export default {
  code,
  assetRule: { blankAttachments: true },
  attachedAssetsIgnoreSlots: ['hand', 'arcane', 'body', 'accessory', 'ally', 'tarot'],
  abilities: [
    {
      kind: 'free',
      label: '横置：附属、交换或解除附属一件[[工具]]支援',
      cost: { exhaust: true },
      criteria: [({ inv, source }) => attached(inv, source).length > 0 || tools(inv, source).length > 0],
      resolve: ({ inv, source, api }) => {
        const attachedAssets = attached(inv, source)
        const available = tools(inv, source)
        const options = []
        if (available.length) options.push({ id: 'attach', label: '将一件工具附属到工具带' })
        if (available.length && attachedAssets.length) options.push({ id: 'swap', label: '交换一件已附属的工具' })
        if (attachedAssets.length) options.push({ id: 'detach', label: '解除一件工具的附属' })
        const mode = options.length === 1 ? options[0].id : api.choice({
          kind: 'effect', source: code, seat: inv.seat, prompt: '选择工具带的操作。', options,
        })
        if (mode === 'detach') {
          const id = chooseTool(inv, api, attachedAssets, '选择要解除附属的工具。')
          return api.detachControlledAsset(inv.seat, source.id, id)
        }
        const id = chooseTool(inv, api, available, '选择要附属的工具。')
        const replaceId = mode === 'swap'
          ? chooseTool(inv, api, attachedAssets, '选择要解除附属以交换的工具。') : undefined
        return api.attachOrSwapControlledAsset(inv.seat, source.id, id, {
          maximum: Number.MAX_SAFE_INTEGER, ...(replaceId == null ? {} : { replaceId }),
        })
      },
    },
  ],
  modifiers: [],
}
