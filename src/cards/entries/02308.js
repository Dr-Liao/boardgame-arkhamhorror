// 02308 安奎娜
// 卡面：[reaction]在敌人攻击你时，横置安奎娜并对她造成1点恐惧：改为对你所在地点的任意一个敌人造成该敌人的伤害。(你依然受到此次攻击的恐惧。)
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 02308 阿奎娜：攻击转移的触发点在 enemyAttack 的 tryAquinnahRedirect（反应窗口之前），
// 因此只声明条目级标记；旧的 aquinnahRedirect 反应是死代码（运行时没有这个原语）。

export default {
  code: '02308',
  redirectAttackToAsset: true,
  abilities: [

  ],
  modifiers: [

  ],
}
