// 06014 脱离现实
// 卡面：显现 - 如果梦境之门(奇妙旅程)已在场上，将其翻面。否则，查找你的绑定卡牌，找出
//       梦境之门(无谓现实) 将其放置入场。不论是哪一种情况，与你交战的每个敌人解除交战，
//       你移动到梦境之门。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
export default {
  code: '06014',
  abilities: [
    {
      kind: 'weakness',
      label: '翻面或放置梦境之门，解除交战并移动过去',
      weakness: { type: 'custom' },
      resolve: ({ inv, api }) => {
        api.disengageAll(inv.seat)
        const gate = api.flipOrPlaceDreamGate({ from: '06015a', to: '06015b', asideHorror: 2, ownerCode: inv.code, flipAfterInvestigate: '06015a' })
        if (gate) api.moveInvestigator(inv.seat, gate.id)
        api.info(`「脱离现实」：${inv.name} 进入梦境之门。`)
      },
    },
  ],
  modifiers: [],
}
