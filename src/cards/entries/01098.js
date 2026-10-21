// 01098 恶灵附身
// 卡面：显现 - 将恶灵附身加入你的威胁区域。
// 卡面：你得到每项技能-1。
// 卡面：[action][action]：弃掉恶灵附身。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '01098',
  abilities: [
    {
      kind: 'weakness',
      label: '恶灵附身',
      weakness: { type: 'threat', mods: { allSkills: -1 }, discardCost: { action: 2 } },
    },
  ],
  modifiers: [

  ],
}
