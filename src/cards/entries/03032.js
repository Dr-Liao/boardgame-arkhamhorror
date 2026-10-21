// 03032 炼金转化
// 卡面：使用(3充能)。
// 卡面：[action]横置炼金转化，花费1充能：检定[willpower](1)。你检定成功且每超过难度1点，获得1资源(最多3个)。如果本次检定期间揭示了[skull]、[cultist]、[tablet]、[elder_thing]或[auto_fail]符号，受到1点伤害。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 03032 炼金转化：意志检定(1)，按成功点数获得资源（最多 3）；揭示符号标记则受 1 点伤害。

export default {
  code: '03032',
  uses: 3,
  usesType: 'charges',
  abilities: [
    {
      kind: 'action', label: '炼金转化', cost: { action: true, exhaust: true, uses: 1 },
      resolve: ({ inv, api }) => {
        api.startTest({
          skill: 'willpower', difficulty: 1, seat: inv.seat,
          source: { label: '支援能力', code: '03032' },
          resolve: result => {
            if (result.success) api.gainResources(inv.seat, Math.min(3, result.value - result.difficulty))
            if ((result.drawn || []).some(token => ['skull', 'cultist', 'tablet', 'elderthing', 'autofail'].includes(token))) {
              api.harm(inv.seat, { damage: 1 })
            }
          },
        })
      },
    },
  ],
  modifiers: [

  ],
}
