// 06163 治愈真言
// 卡面：使用(3充能)。
// 卡面：[action]花费1充能：治愈你所在地点一位调查员1点伤害。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点：使用次数是条目级 uses/usesType；目标用描述子 target.kind='investigator'（同地点含自己）；
// 治愈走 api.healDamage。

export default {
  code: '06163',
  uses: 3,
  usesType: 'charge',
  discardWhenEmpty: true,
  abilities: [
    {
      kind: 'action',
      label: '花费 1 充能：治愈 1 点伤害',
      cost: { action: true, uses: 1 },
      target: { kind: 'investigator' },
      resolve: ({ state, inv, target, api }) => {
        const entity = target?.entity || (state.investigators.find(item => String(item.seat) === String(target?.id)))
        const seat = Number.isInteger(entity?.seat) ? entity.seat : inv.seat
        api.healDamage(seat, 1)
        api.info(`💚 「治愈真言」治愈了 ${state.investigators[seat]?.name || '调查员'} 1 点伤害。`)
      },
    },
  ],
  modifiers: [],
}
