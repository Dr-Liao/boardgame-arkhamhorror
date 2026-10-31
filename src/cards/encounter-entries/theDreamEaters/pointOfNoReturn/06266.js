// 06266 · 《无归之地》剧情支援「理查德·厄普顿·皮克曼」（Richard Upton Pickman · Venerable Ghoul · 生命 3）。
// 卡面：[fast] Exhaust Richard Upton Pickman: Choose a [[Ghoul]] enemy at your location and attach it
//   to him, facedown.
//   [action] Exhaust Richard Upton Pickman: Fight. You attack with a base [combat] of 5. Instead of its
//   standard damage, this attack deals damage equal to the number of facedown encounter cards attached
//   to Richard Upton Pickman.
//
// 受控剧情支援的行动没有「非玩家 scope 行动描述子」通道（NON_PLAYER_SCOPES 拒绝 action/free），
// 因此本条目的 `assetRule` 只声明规则数据，实际行动由 behavior.actions / performAction 分派：
//   · fastAttachGhoul：把所在地点的一个[[食尸鬼]]敌人移出游戏并记入 attached 计数（API 无「附属到支援」原语）；
//   · fightAction：用基础战斗 5 攻击，伤害 = attached 计数（基础值用 skillBonus 折算）。
// 引擎没有「敌人正面朝下附属到支援」的状态形状 → 用 scenarioFlags 计数，结算后敌人回遭遇弃牌堆。

export default {
  code: '06266',
  scope: 'storyAsset',
  implemented: true,
  assetRule: {
    fastAttachGhoul: { trait: 'Ghoul', exhaustSelf: true },
    fightAction: { baseCombat: 5, damageFromAttached: true, exhaustSelf: true },
  },
  flags: {
    storyAssetOf: '06251',
    attachesEnemyCards: true,
  },
  note: '「把敌人正面朝下附属」用 scenarioFlags 计数 + api.removeEnemyFromGame 近似；离场时附属卡的去向记 simplified。',
}
