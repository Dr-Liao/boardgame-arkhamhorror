// 60254 致命好奇（Lethal Curiosity，基础弱点）
// 卡面：显现 - 检定[willpower](4)。失败时每低于难度 1 点，你必须受到 1 点伤害，或将 1 个线索放到你所在地点。
// 读点：weakness 描述子自定义 resolve + api.test；每点失败差值二选一（api.damage / api.placeClues）。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

const CODE = '60254'

export default {
  code: CODE,
  abilities: [{
    kind: 'weakness',
    label: '意志(4)：每失败 1 点受伤或放线索',
    weakness: { type: 'custom' },
    resolve: ({ inv, api }) => {
      api.test(inv.seat, 'willpower', 4, {
        source: { code: CODE, label: '致命好奇' },
        resolve: result => {
          if (result.success) return
          const failedBy = Math.max(0, (Number(result.difficulty) || 4) - (Number(result.value) || 0))
          for (let index = 0; index < failedBy; index++) {
            const choice = api.choice({
              kind: 'choice', source: CODE, seat: inv.seat,
              prompt: '致命好奇：选择受到 1 点伤害，或在你所在地点放置 1 个线索。',
              options: [
                { id: 'damage', label: '受到 1 点伤害' },
                { id: 'clue', label: '在你所在地点放置 1 个线索' },
              ],
            })
            if (choice === 'clue') api.placeClues(inv.seat, 1)
            else api.damage(inv.seat, 1)
            if (inv.defeated || inv.resigned) return
          }
        },
      })
    },
  }],
  modifiers: [],
}
