// 01055 飞贼
// 卡面：你得到+1[agility]。
// 卡面：[action]横置飞贼：和每个与你交战的敌人解除交战，并移动到一个连接地点。本行动不会触发趁乱攻击。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '01055',
  passive: { stats: { agility: 1 } },
  abilities: [
    {
      kind: 'action', label: '脱身（与全部敌人脱离交战并移到一个连接地点）',
      cost: { action: true, exhaust: true },
      noOpportunityAttack: true,
      effect: { type: 'sequence', effects: [{ type: 'disengageAll' }, { type: 'moveTo' }] },
    },
  ],
  modifiers: [

  ],
}
