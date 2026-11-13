// 09120 工具带（Tool Belt）· 中立资产 · 0 经验 · 身体槽
// 卡面：每个附属的支援不占用槽位，且其文本框视为如同空白（除[[特性]]外）。
//       [fast] 横置工具带：选择一项——将你游戏区域的一个[[工具]]支援附属到工具带；
//       将你游戏区域的一个[[工具]]支援与一个已附属的支援交换；或将一个已附属的支援解除附属。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点：
//   · 不占槽位：条目级 attachedAssetsIgnoreSlots（assets.js#occupiedSlots 的唯一豁免读点）；
//   · 附属/交换：api.attachOrSwapControlledAsset（引擎的附属宿主唯一写点）；
//   · 快速：kind action + cost.action:false（不消耗行动，牌桌按快速能力展示）。
// approximation: ①「附属支援文本框视为空白」没有宿主级空白读点（引擎只有整卡空白与逐卡
//   blankHostExceptForced 字段），未实现；②「解除附属」没有 api（attachOrSwapControlledAsset 只能
//   挂上/换下），未实现。两项见 primitive-request 09120.json。
import { ALL_CARDS } from '../../cards/cards-data.js'

const code = '09120'

const isTool = cardCode => (ALL_CARDS[cardCode]?.traits || [])
  .some(trait => String(trait).toLowerCase() === 'tool')

export default {
  code,
  note: 'approximation: 附属支援的文本框空白与「解除附属」未实现（缺宿主级空白读点与 detach 写点，见 primitive-request 09120.json）。',
  attachedAssetsIgnoreSlots: ['hand', 'arcane', 'body', 'accessory', 'ally', 'tarot'],
  abilities: [
    {
      kind: 'action',
      label: '[fast] 横置：把一件[[工具]]支援附属到工具带（或与原附属交换）',
      cost: { action: false, exhaust: true },
      resolve: ({ inv, source, api }) => {
        const tools = (inv.assets || []).filter(asset => asset.id !== source?.id && !asset.attachedToAsset && isTool(asset.code))
        if (!tools.length) { api.info('「工具带」：游戏区域没有可附属的[[工具]]支援。'); return }
        const toolId = tools.length === 1 ? tools[0].id : api.choice({
          kind: 'target', source: code, seat: inv.seat,
          prompt: '「工具带」：选择要附属（或交换）的[[工具]]支援。',
          options: tools.map(asset => ({ id: asset.id, label: api.cardName(asset.code) })),
        })
        const tool = tools.find(asset => asset.id === toolId)
        if (!tool) return
        const attached = (inv.assets || []).find(asset => asset.attachedToAsset === source.id)
        if (api.attachOrSwapControlledAsset(inv.seat, source.id, tool.id)) {
          api.info(attached
            ? `🧰 「工具带」：${api.cardName(tool.code)} 与「${api.cardName(attached.code)}」交换，前者附属到工具带。`
            : `🧰 「工具带」：${api.cardName(tool.code)} 附属到工具带（不占槽位）。`)
        }
      },
    },
  ],
  modifiers: [],
}
