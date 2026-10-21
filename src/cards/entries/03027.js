// 03027 掌握内幕
// 卡面：使用(3秘密)。
// 卡面：[action]花费1秘密：调查。调查场上任意一个已揭示的地点，如同你在该地点。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// ---- Phase 5（5c-2）：Carcosa / TFA 调查与躲避类 8 张 ----
// 这批的共同点：旧原语只是把「调查 / 躲避」入口换成带参数的版本，因此改写后仍走
// 同一个 `api.investigate` / `api.evade`（行动成本、借机攻击、日志都由引擎主流程决定）。
// 03027 洞察万物：远程调查任一已揭示地点（旧 inTheKnow，消耗 1 秘密）。

export default {
  code: '03027',
  uses: 3,
  usesType: 'secrets',
  abilities: [
    {
      kind: 'action', label: '调查任意已揭示地点', cost: { action: true, uses: 1 },
      resolve: ({ state, inv, api }) => {
        const locations = state.locations.filter(location => location.revealed && !location.locked)
        if (!locations.length) return
        const locationId = api.choice({ kind: 'location', source: '03027', seat: inv.seat,
          prompt: '选择要远程调查的已揭示地点。',
          options: locations.map(location => ({ id: location.id, label: api.locationName(location.id) })) })
        api.investigate(inv.seat, { locationId })
      },
    },
  ],
  modifiers: [

  ],
}
