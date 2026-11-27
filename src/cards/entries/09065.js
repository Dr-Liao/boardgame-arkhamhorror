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
// 附属时选手部或饰品槽，槽位规则只接受带违法特性的支援。
import { ownTurn } from '../../engine/matcher.js'

export default {
  code: '09065',
  fast: true,
  attachTo: { kind: 'asset', traitsAny: ['clothing', 'armor'] },
  assetRule: { hostRestrictedSlot: { slots: ['hand', 'accessory'], traitsAny: ['illicit'] } },
  playCondition: [ownTurn()],
  abilities: [],
  modifiers: [],
}
