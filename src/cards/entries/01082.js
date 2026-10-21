// 01082 安奎娜
// 卡面：[reaction]在敌人攻击你时，横置安奎娜并对她造成1点恐惧：改为对你所在地点的另一个敌人造成该敌人的伤害。(你依然受到此次攻击的恐惧。)
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 01082 安奎娜：被攻击时可以横置 + 放 1 点恐惧，把这次攻击的伤害转给另一个敌人。
// 触发点在 enemyAttack 的 tryAquinnahRedirect（攻击窗口在反应能力之前），因此只声明标记；
// 旧条目里那条 aquinnahRedirect 反应是死代码（运行时没有这个原语）。

export default {
  code: '01082',
  explicitReactionPrompt: true,
  redirectAttackToAsset: true,
  abilities: [

  ],
  modifiers: [

  ],
}
