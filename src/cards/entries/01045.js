// 01045 夜盗
// 卡面：[action]横置夜盗：调查。如果你检定成功，不发现线索，改为获得3资源。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '01045',
  abilities: [
    {
      kind: 'action',
      label: '搜刮（调查；成功则获得 3 资源而不发现线索）',
      cost: { action: true, exhaust: true },
      effect: { type: 'investigateForResources', amount: 3 },
    },
  ],
  modifiers: [

  ],
}
