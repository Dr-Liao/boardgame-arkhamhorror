// 01042 百科全书
// 卡面：[action]横置百科全书：选择你所在地点的一位调查员。直到本阶段结束，该调查员得到一项技能值(由你选择)+2。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '01042',
  abilities: [
    {
      kind: 'action',
      label: '查阅（同地点调查员任选一项技能 +2）',
      cost: { action: true, exhaust: true },
      effect: {
        type: 'targetedEffect',
        target: 'location',
        chooseBy: 'controller',
        effect: {
          type: 'chooseOne',
          options: [
            {
              label: '意志 +2',
              effect: { type: 'addStatPhase', skill: 'willpower', amount: 2 },
            },
            {
              label: '智识 +2',
              effect: { type: 'addStatPhase', skill: 'intellect', amount: 2 },
            },
            { label: '战斗 +2', effect: { type: 'addStatPhase', skill: 'combat', amount: 2 } },
            {
              label: '敏捷 +2',
              effect: { type: 'addStatPhase', skill: 'agility', amount: 2 },
            },
          ],
        },
      },
    },
  ],
  modifiers: [

  ],
}
