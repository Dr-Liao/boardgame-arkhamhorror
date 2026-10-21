// 02034 偷梁换柱
// 卡面：躲避。如果你检定成功，且躲避的敌人非[[精英]]，躲避该敌人并将其移动到一个连接地点。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '02034',
  abilities: [
    {
      kind: 'played',
      label: '偷梁换柱',
      effect: { type: 'evade', moveEnemyOnSuccess: true },
    },
  ],
  modifiers: [

  ],
}
