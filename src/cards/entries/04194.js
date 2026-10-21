// 04194 异界罗盘
// 卡面：[action]横置异界罗盘：调查。本次调查你所在地点的隐藏值-X。X为与你所在地点相互连接、且已揭示的地点数量。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 04194 异界罗盘：帷幕按「已揭示的连接地点数」降低（旧 otherworldCompass）。

export default {
  code: '04194',
  abilities: [
    {
      kind: 'action', label: '异界罗盘调查', cost: { action: true, exhaust: true },
      resolve: ({ state, inv, api }) => {
        const here = state.locations.find(location => location.id === inv.location)
        const revealed = (here?.connections || [])
          .filter(id => state.locations.some(location => location.id === id && location.revealed)).length
        api.investigate(inv.seat, { shroudMod: -revealed })
      },
    },
  ],
  modifiers: [

  ],
}
