// 03016 挖土深埋
// 卡面：威廉·约里克牌库专用。
// 卡面：快速。你所在地点的一个非[[精英]]敌人被击败后打出。
// 卡面：将该敌人(和本卡牌)加入胜利区。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 03016 掩埋：击败非精英敌人后快速打出——把那名敌人和这张牌一起放进胜利区。

export default {
  code: '03016',
  abilities: [
    {
      kind: 'played', fast: true, trigger: 'defeatEnemy',
      criteria: { nonElite: true },
      label: '把击败的非精英敌人与自身加入胜利区',
      resolve: ({ api }) => {
        const enemy = api.reactionContext()?.enemy
        if (!enemy) return
        api.buryEnemyInVictory(enemy, '03016')
      },
    },
  ],
  modifiers: [

  ],
}
