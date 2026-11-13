// 09065 暗袋（Hidden Pocket）· 游荡者（Rogue）事件 · 0 经验 · 升级 · 违法。
//
// 卡面：快速。只能在你回合期间打出。
//       附属到你控制的[[服装]]或[[护甲]]支援。
//       所附属的支援获得：「你拥有额外 1 个手部或饰品槽位（由你选择），只能用来携带[[违法]]支援。」
//
// 一卡一文件：这张卡的行为只在这里维护。
//
// 读点：
//   · 附属 → 条目级 attachTo（actions.js 的 attachTo 通道：affix 到符合特性的受控支援，事件卡不弃置）。
//   · 「快速。只能在你回合期间」→ fast + playCondition（ownTurn）。
// approximation: 引擎的「附属给宿主额外槽位」只有 assetRule.hostExtraSlot，且注册期只接受 'arcane'
//   （assets.js#slotsForOccupancy 读点）。本卡需要的是「手部/饰品 + 只能放[[违法]]」的受限槽，
//   见 primitive-requests/09065.json（extend.attachmentHostSlot）。测试断言近似后的真实行为：
//   只能附属到[[服装]]支援、附属后事件不进入弃牌堆。
import { ownTurn } from '../../engine/matcher.js'

export default {
  code: '09065',
  fast: true,
  simplified: true,
  note: 'approximation: 只实现「快速 + 只能在自己回合 + 附属到[[服装]]支援」；宿主额外的手部/饰品受限槽缺读点（primitive-requests/09065.json）。',
  attachTo: { kind: 'asset', trait: 'clothing' },
  playCondition: [ownTurn()],
  abilities: [],
  modifiers: [],
}
