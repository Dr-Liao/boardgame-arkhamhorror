// 01133 墓地
// 归属：关卡专用 · theMidnightMasks（夜之狂热 · 第二幕：午夜假面）
// 遭遇组：arkham
// 卡面：强制 - 你进入墓地后：检定[willpower](3)。如果你检定失败，你必须受到2点恐惧或移动到河岸城。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 墓地（01133）：进入后意志(3)检定，失败二选一「受到 2 点恐惧 / 移动到河岸城」。
// 迁移自 movement.js 的 `loc.id === 'graveyard'` 分支（REPORT.md §2.1）。

export default {
  code: '01133',
  name: '墓地',
  scope: 'location',
  text: '强制 - 你进入墓地后：意志（3）检定，失败须受到 2 点恐惧或移动到河岸城。',
  locationRule: {
    onEnter: {
      test: { skill: 'willpower', difficulty: 3 },
      failChoice: {
        prompt: '墓地检定失败：选择受到 2 点恐惧或移动到河岸城。',
        options: [
          { id: 'horror', label: '受到 2 点恐惧', log: '😱 「墓地」检定失败：{name} 受到 2 点恐惧。', effect: { type: 'takeHorror', amount: 2, silent: true } },
          { id: 'move', label: '移动到河岸城', requiresLocation: 'rivertown', effect: { type: 'moveInvestigator', destination: 'rivertown' } },
        ],
      },
    },
  },
}
