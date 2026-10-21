// 02108 探路者
// 卡面：[free]在你回合期间，如果你未与任何敌人交战，横置探路者：移动到一个连接地点。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '02108',
  abilities: [
    {
      kind: 'action',
      label: '探路者移动',
      cost: { action: false, exhaust: true },
      effect: { type: 'moveTo', requiresNoEnemies: true },
    },
  ],
  modifiers: [

  ],
}
