// 04306 有利位置
// 卡面：快速。在一个地点入场或在一位调查员的回合期间被揭示后打出。
// 卡面：直到当前调查员的回合结束，该地点隐藏值-1。你可以将其他任何地点上的1个线索移动到该地点上。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 04306 观景台：快速事件；本回合帷幕 -1，并把别处 1 个线索移到这里。

export default {
  code: '04306',
  abilities: [
    {
      kind: 'played', fast: true, label: '本回合帷幕 -1，并移动 1 个线索到这里',
      resolve: ({ state, inv, api }) => {
        const here = state.locations.find(location => location.id === inv.location)
        if (here) api.tempShroudMod(here, -1)
        const sources = state.locations.filter(location => location.id !== inv.location && (location.clues || 0) > 0)
        if (!sources.length || !here) return
        const chosen = sources.length === 1 ? sources[0].id
          : api.choice({ kind: 'location', source: '04306', seat: inv.seat, prompt: '选择要移动 1 个线索的地点（可跳过）。',
            options: sources.map(location => ({ id: location.id, label: location.name })) })
        const source = sources.find(location => location.id === chosen)
        if (source) api.moveClueToLocation(source.id, here.id, 1)
      },
    },
  ],
  modifiers: [

  ],
}
