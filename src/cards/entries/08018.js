// 08018 贪婪（Greed，鲍勃·詹金斯的专属弱点）
//
// 卡面：显现 - 受到 1 点恐惧。如果你有……
//   - ……10 资源或更少，额外受到 1 点恐惧。
//   - ……5 资源或更少，额外受到 1 点恐惧。
//   - ……0 资源，额外受到 1 点恐惧。
//
// 读点：弱点描述子的 resolve 接管揭示结算（weakness.js 的能力层分支）；
// 恐惧走 `api.horror` 的直接恐惧入口。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
export default {
  code: '08018',
  abilities: [
    { kind: 'weakness', label: '贪婪', weakness: { type: 'custom' },
      resolve: ({ inv, api }) => {
        const resources = Number(inv.resources) || 0
        let horror = 1
        if (resources <= 10) horror += 1
        if (resources <= 5) horror += 1
        if (resources <= 0) horror += 1
        api.horror(inv.seat, horror)
      } },
  ],
  modifiers: [],
}
