// 07338 潜水服（Diving Suit）· 暗潮之下（into_the_maelstrom）· 剧情支援（资产）
//
// 印刷（中文）：
//   你忽略当前密谋的强制能力。
//   强制 - 在任意数量的伤害将要放置到你身上时：将此伤害中的 1 点放到潜水服上。
//   强制 - 在潜水服离场时：将其从游戏中移除。
//
// 印刷（英文）：
//   You ignore the Forced ability on the current agenda.
//   Forced - When any amount of damage would be placed on you: Place 1 of that damage on Diving Suit.
//   Forced - When Diving Suit leaves play: Remove it from the game.
//
// 卡面数据（无需条目声明）：
//   · 生命值 3 / 槽位 [[Body]] / 特性 [[Item]] [[Armor]]：来自 cards-data.js 的卡面数据，
//     关卡定义经 content/.../card-data.js#encounterDefinitions 生成遭遇定义（type asset →
//     storyAssets[code] 带 health/slots）；章节 setup 对持有「潜水服」记录的调查员
//     `late-setup.js:72-73` `api.giveAsset(inv.seat, '07338')` 直接放到其控制下。
//
// 引擎读点：
//   · 第 1 条「忽略当前密谋的强制能力」：条目级 `assetRule.ignoreAgendaForced: true`，
//     读点 turn.js#turnBeginningWindow 的 `ignoresAgendaForced`——本章「求取空气」是章节
//     mechanics.water.air 结算的当前密谋强制能力；控制潜水服的调查员回合开始时不记录空气风险
//     （turn.js:512-514）。
//   · 第 2 条「任意数量伤害将要放置到你身上时转移 1 点」：条目级
//     `assetRule.redirectOneDamageToSelf: true`，读点 enemies.js#applyHarm 的伤害分配前
//     （每次伤害结算最多转移 1 点，直接伤害也适用；转移后总量不变、剩余照常分配）。
//   · 第 3 条「离场时从游戏中移除」：条目级 `removeFromGameOnLeave: true`，
//     读点 src/engine/assets.js:370-378 的 leaveAsset（写 asset.removedFromGame + state.removedFromGame）。
//
// 实现状态：implemented:true（三条印刷条款全部接线）。
//
// 一卡一文件：本卡行为只在这里维护；不要写回 encounter-abilities.js。

export default {
  code: '07338',
  scope: 'storyAsset',
  implemented: true,
  assetRule: {
    ignoreAgendaForced: true,
    redirectOneDamageToSelf: true,
  },
  removeFromGameOnLeave: true,
}
