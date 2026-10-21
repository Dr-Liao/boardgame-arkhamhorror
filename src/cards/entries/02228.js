// 02228 暴露弱点
// 卡面：快速。在任意[free]玩家时间段期间打出。
// 卡面：选择你所在地点的一个敌人。检定[intellect](X)，其中X等于该敌人的攻击值。你检定成功且每超过难度1点，本阶段对该敌人下次执行的攻击中，该敌人的攻击值降低1点。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '02228',
  abilities: [
    {
      kind: 'played',
      label: '暴露弱点',
      fast: true,
      effect: { type: 'exposeWeakness' },
    },
  ],
  modifiers: [

  ],
}
