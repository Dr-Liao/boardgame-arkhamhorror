// 10121 猎装（Hunting Jacket）· 生存者资产 · 2 经验 · 身体槽
// 卡面：[fast] 横置猎装：选择你手牌中 1 张非弱点卡牌，将其正面朝下附属到猎装（最多附属 3 张）。
//       然后，每有一张附属的卡牌，获得 1 资源。
//       [reaction] 当猎装被击败时：抽取所有附属的卡牌。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点（卡面 → 引擎）：
//   · 目标「你手牌中的非弱点卡牌」= `target: { kind: 'cardInHand', query }`（targets.js 的唯一枚举；
//     弱点判定读 cards-data 的 subtype，与 04105 的同一口径）。
//   · 「正面朝下附属到猎装」= `api.moveCard({ from: 'hand', to: 'attached', attachTo: source.id,
//     facedown: true })`（deck-ops.js 的 B6 搬运原语 → actions-extra#attachCardTo，落 `asset.attachments`，
//     与背包 04037/摄魂抓魄 10079 同一存储形状；最多 3 张由描述子 criteria 收窄）。
//   · 「每有 1 张附属，获得 1 资源」= `api.gainResources`，数量取附属完成后的 `attachments.length`
//     （含刚附属的那张；印刷口径见参考实现 gainResourcesIfCan(1 + cardsUnderneath)）。
//   · 「被击败时抽取所有附属卡牌」= `assetDefeated` 窗口（asset-defeat.js 的唯一击败判定，窗口在离场前
//     开启），把每张附属用 `api.moveCard({ from: 'attached', to: 'hand' })` 返回手牌。
//   · 生命 2 / 理智 2 来自 cards-data（checkAssetDefeated 读卡面 health/sanity）。
//
// 没有原语缺口。
import { ALL_CARDS } from '../../cards/cards-data.js'

const CODE = '10121'
const MAX_ATTACHED = 3

const isWeaknessCode = code => ['weakness', 'basicweakness'].includes(ALL_CARDS[code]?.subtype)
const attachedOf = host => (host?.attachments || []).filter(card => card.assetReference !== true)

export default {
  code: CODE,
  name: 'Hunting Jacket',
  abilities: [
    {
      kind: 'action',
      label: '[fast] 横置：把 1 张非弱点手牌正面朝下附属；每有 1 张附属获得 1 资源',
      target: { kind: 'cardInHand', query: ({ candidate }) => !isWeaknessCode(candidate.code) },
      cost: { action: false, exhaust: true },
      criteria: [({ source }) => attachedOf(source).length < MAX_ATTACHED],
      resolve: ({ inv, source, targetId, api }) => {
        if (!source || !targetId) return
        const moved = api.moveCard({ code: targetId, from: 'hand', to: 'attached', attachTo: source.id,
          facedown: true, ownerSeat: inv.seat })
        if (!moved) return
        const count = attachedOf(source).length
        api.gainResources(inv.seat, count)
        api.info(`🧥 猎装：把「${api.cardName(targetId)}」正面朝下附属（${count}/${MAX_ATTACHED}），获得 ${count} 资源。`)
      },
    },
    {
      kind: 'reaction',
      trigger: 'assetDefeated',
      label: '猎装被击败时：抽取所有附属的卡牌',
      criteria: [({ source, context }) => Boolean(source) && context?.assetId === source.id],
      resolve: ({ inv, source, api }) => {
        if (!source) return
        const attached = attachedOf(source)
        if (!attached.length) {
          api.info('🧥 猎装被击败，但它上面没有附属卡牌。')
          return
        }
        let drawn = 0
        for (const card of attached) {
          if (api.moveCard({ code: card.code, from: 'attached', to: 'hand', ownerSeat: inv.seat })) drawn += 1
        }
        api.info(`🧥 猎装被击败：抽取 ${drawn} 张附属的卡牌。`)
      },
    },
  ],
  modifiers: [],
}
