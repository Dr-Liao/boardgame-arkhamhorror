// 06013 门之匣
// 卡面：卢克·罗宾逊牌库专用。使用(3 充能)。
//       [fast] 横置门之匣并花费 1 充能：与你交战的每个敌人解除交战，查找你的绑定卡牌，
//       找出梦境之门(奇妙旅程)，将其放置入场并移动到该地点。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
export default {
  code: '06013',
  uses: 3,
  usesType: 'charges',
  abilities: [
    {
      kind: 'free',
      label: '横置并花费 1 充能：解除交战，放置梦境之门并移动过去',
      cost: { action: false, exhaust: true, uses: 1 },
      resolve: ({ inv, api }) => {
        api.disengageAll(inv.seat)
        const gate = api.placeDreamGate('06015a', { connectToRevealed: true, ownerCode: inv.code })
        if (gate) api.moveInvestigator(inv.seat, gate.id)
        api.info(`${inv.name} 通过「门之匣」进入梦境之门。`)
      },
    },
  ],
  modifiers: [],
}
