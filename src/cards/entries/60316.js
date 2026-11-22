// 60316 悄然溜过
// 卡面：躲避。本行动开始时，获得2资源。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '60316',
  abilities: [{
    kind: 'played', countsAs: 'evade', label: '躲避，行动开始时获得 2 资源',
    resolve: ({ inv, api }) => {
      const enemy = api.chooseEnemy(inv.seat, { type: 'evade' })
      if (!enemy) return
      api.gainResources(inv.seat, 2)
      api.evade(inv.seat, { enemyId: enemy.id })
    },
  }],
}
