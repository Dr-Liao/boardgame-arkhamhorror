// 01041 伊察姆纳圆盘
// 卡面：[reaction]在非[[精英]]敌人生成在你所在地点时，弃掉伊察姆纳圆盘：弃掉该敌人。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 01041 伊察姆纳圆盘：非精英敌人生成时弃掉自身并击败它。

export default {
  code: '01041',
  abilities: [
    {
      kind: 'reaction', trigger: 'enemySpawn', id: 'discOfItzamna', legacyReaction: true,
      criteria: { nonElite: true }, label: '敌人生成时弃置自身并击败它', cost: { discardSelf: true },
      effect: { type: 'defeatNonEliteEnemy', target: 'here' },
    },
  ],
  modifiers: [

  ],
}
