// 03314 内讧
// 卡面：快速。敌军阶段开始后打出。
// 卡面：取消本阶段所有非[[精英]]敌人对你的攻击。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 03314 内讧：本阶段非精英敌人不攻击（敌人阶段开始时快速打出）。

export default {
  code: '03314',
  abilities: [
    {
      kind: 'played', fast: true, trigger: 'enemyPhaseBegins',
      label: '内讧',
      resolve: ({ inv, api }) => { api.preventNonEliteAttacks(inv.seat) },
    },
  ],
  modifiers: [

  ],
}
