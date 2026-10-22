// 02025 逃跑本能
// 卡面：快速。在一个敌人将要生成在你的地点时打出。
// 卡面：立刻移动到一个连接地点。(该敌人依然生成在你先前地点。)
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 02025 先制攻击：敌人生成时快速打出，移动到连接地点（旧条目在批量删除中丢失，这里补回）。

export default {
  code: '02025',
  abilities: [
    {
      kind: 'played', fast: true, trigger: 'enemySpawn',
      label: '先制攻击', effect: { type: 'moveTo' },
    },
  ],
  modifiers: [

  ],
}
