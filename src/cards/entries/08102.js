// 08102 保护魂灵
// 卡面：快速。你所在地点的一个[[盟友]]支援被击败或因卡牌效果弃掉后打出。
//       将该支援返回其拥有者手中，或其拥有者抽取3张卡牌。
//
// 读点（真实引擎窗口）：
//   · src/engine/assets.js:397-402 的 assetLeavesPlay 窗口 context：
//     `{ when, seat, location, assetCode, assetId, asset(实体), reason, upgrades, prompt }`。
//     实体本身只有 id/code/ownerSeat/enteredRound 等实例字段，**没有 traits/location**
//     （traits 要按 assetCode 从 cards-data 查，地点用 context.location）；
//   · 「被击败或因卡牌效果弃掉」= reason 为 'discard'/'effect'；'return'（放回手牌等）不算；
//   · 返回手牌走 api.returnAssetAndAttachmentsToHand（标记 returnedToHand，引擎各弃牌守卫
//     尊重该标记；只返回盟友本体，不把它的升级附属一并带回）；
//   · 「或其拥有者抽 3 张」走 api.drawCards(ownerSeat, 3)。
//   · 窗口开放时实体已从 inv.assets 移除、还未进弃牌堆，因此不能走 moveCard(from:'discard')。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
import { ALL_CARDS } from '../../cards/cards-data.js'

const isAllyCode = code => (ALL_CARDS[code]?.traits || [])
  .some(trait => String(trait).toLowerCase() === 'ally')

export default {
  code: '08102',
  abilities: [
    { kind: 'played', fast: true, trigger: 'assetLeavesPlay', label: '盟友支援离场后：返回其拥有者手中，或让拥有者抽 3 张',
      criteria: ({ inv, context }) => Boolean(context?.assetCode) && Boolean(context?.location)
        && context.location === inv.location
        && context.reason !== 'return'
        && isAllyCode(context.assetCode),
      resolve: ({ inv, context, api }) => {
        const assetCode = context?.assetCode
        if (!assetCode) return
        const ownerSeat = Number.isSafeInteger(context?.asset?.ownerSeat) ? context.asset.ownerSeat : inv.seat
        const picked = api.choice({ kind: 'effect', source: '08102', seat: inv.seat,
          prompt: '选择保护魂灵的效果。', options: [
            { id: 'return', label: '将该支援返回其拥有者手中' },
            { id: 'draw', label: `让拥有者抽取 3 张卡牌` },
          ] })
        if (picked === 'return') {
          // 只返回这张盟友本体：它身上的升级附属仍按印刷规则留在弃牌堆。
          api.returnAssetAndAttachmentsToHand(inv.seat, context.asset,
            { byOwnerSeat: true, includeAttachments: false })
        } else api.drawCards(ownerSeat, 3)
      } },
  ],
  modifiers: [],
}
