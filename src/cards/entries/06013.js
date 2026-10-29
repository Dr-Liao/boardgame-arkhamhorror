// 06013 门之匣
// 卡面：卢克·罗宾逊牌库专用。使用(3 充能)。
//       [fast] 横置门之匣并花费 1 充能：与你交战的每个敌人解除交战，查找你的绑定卡牌，
//       找出梦境之门(奇妙旅程)，将其放置入场并移动到该地点。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// ⚠️ 显式简化：「查找绑定卡牌并放置梦境之门地点」需要地点型 Bonded 的引擎接线
// （P3 已有 `location.placeBondedLocation`，但真实地点实体的构造与连接属 P8 章节内容）。
// 当前实现只做「与你交战的每个敌人解除交战」，并把梦境之门的放置写进待实现清单。

export default {
  code: '06013',
  uses: 3,
  usesType: 'charges',
  simplified: true,
  note: '梦境之门（06015a）的放置、连接与移动尚未接线（属 P8 地点型 Bonded）；当前只结算「解除所有交战」。',
  abilities: [
    {
      kind: 'free',
      label: '横置并花费 1 充能：解除所有交战（梦境之门待实现）',
      cost: { action: false, exhaust: true, uses: 1 },
      resolve: ({ inv, api }) => {
        api.disengageAll(inv.seat)
        api.info(`${inv.name} 通过「门之匣」与所有敌人解除交战。`)
      },
    },
  ],
  modifiers: [],
}
