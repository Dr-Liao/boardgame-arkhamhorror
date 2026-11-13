// 09692 戴红手套的男子（The Red-Gloved Man）／一直都在 · storyAsset
//
// 归属：关卡专用 · theScarletKeys/withoutATrace（P7）。
// 卡面（中）：[reaction] 在你成功攻击或躲避[[域外]]敌人且超过难度至少 2 点后，横置戴红手套的男子：
//   对该敌人造成 1 点伤害并发现你所在地点的 1 个线索。
//
// 读点（本章 `behavior.js`）：
//   · assetRule.outsiderSuccessReaction → behavior.enemyAttackedSuccessfully / behavior.afterEvade：
//     两个命中读点都要求「超过难度 ≥ by」，命中后横置他、造成 damage 点伤害、发现 clue 个线索；
//   · 作为[[同谋]]剧情支援，撤退成功时加入胜利区（behavior.performAction 的 09688 撤退）。
// 剧情资产实例由 behavior 创建（不占牌库、不计入牌库张数），见 behavior.createConspiratorAsset。
export default {
  code: '09692',
  name: '戴红手套的男子',
  scope: 'storyAsset',
  implemented: true,
  note: 'approximation: 卡面是可选 [reaction]，本章在命中读点自动使用并横置（不逐次询问）；'
    + '「不能被弃掉或抽取」留给战役构筑/牌库层，剧情资产本身不在玩家牌库中。',
  assetRule: {
    outsiderSuccessReaction: { by: 2, damage: 1, clue: 1 },
  },
}
