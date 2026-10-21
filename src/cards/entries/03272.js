// 03272 “放马过来！”
// 卡面：有敌人与你交战才能投入到技能检定。
// 卡面：每有一个与你交战的敌人，“放马过来！”获得[willpower][combat][agility]。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '03272',
  abilities: [
    {
      kind: 'commit',
      label: '“放马过来！”',
      skill: {
        requireEngagedEnemy: true,
        iconsPerEngagedEnemy: ['willpower', 'combat', 'agility'],
      },
    },
  ],
  modifiers: [

  ],
}
