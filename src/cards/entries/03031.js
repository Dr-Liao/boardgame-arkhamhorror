// 03031 撬锁工具
// 卡面：使用(3补给)。如果撬锁工具没有补给，将其弃掉。
// 卡面：[action]横置撬锁工具：调查。本次调查将你的[agility]值加入你的技能值。如果你未超过难度至少2点并成功，从撬锁工具移除1补给。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 03031 撬锁工具：调查时改用敏捷，并记录来源支援（旧 lockpicks）。

export default {
  code: '03031',
  uses: 3,
  usesType: 'supplies',
  discardWhenEmpty: true,
  abilities: [
    {
      kind: 'action', label: '撬锁调查', cost: { action: true, exhaust: true },
      resolve: ({ inv, source, api }) => api.investigate(inv.seat, { addSkill: 'agility', lockpicksAssetId: source?.id }),
    },
  ],
  modifiers: [

  ],
}
