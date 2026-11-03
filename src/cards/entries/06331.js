// 06331 梦境寄生物
// 卡面：绑定 (噩梦球)。
//       梦境寄生物在你手牌中时，你必须将其投入到你执行的下一次技能检定中(如可能)。
//       本技能的图标不加入你的技能值，改为减去。
//       如果本次技能检定失败，受到1点伤害和1点恐惧。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 06331 梦境寄生物：在手牌中的下一场检定自动投入；图标扣除检定值，失败承受伤害与恐惧。

export default {
  code: '06331',
  abilities: [
    { kind: 'commit', label: '梦境寄生物：强制投入，图标扣除检定值',
      skill: { anySkill: true, mustCommitNextTest: true, subtractIcons: true,
        onFail: { damage: 1, horror: 1 } } },
  ],
  modifiers: [],
}
