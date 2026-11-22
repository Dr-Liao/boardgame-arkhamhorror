// 12033 本地地图
// 卡面：使用(4秘密)。
// 卡面：[action]花费1秘密：调查([intellect])。调查一个连接的已揭示地点。你本次调查得到+1[intellect]。
//       如果你检定成功，你可以横置[本地地图]以移动到该地点。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点：
//   · 使用次数 = 条目级 uses/usesType（实例初始化与 cost.uses 扣费）；
//   · 远程调查 = api.investigate(seat, { locationId, bonus, noClueDiscovery })（runInvestigate 是
//     调查唯一入口；locationId 决定查哪个地点的帷幕，线索发现默认发生在调查员所在地点，
//     所以抑制标准发现并在目标地点手动发现 — 与 08097 同一口径）；
//   · 成功后可选横置移动 = api.exhaust（唯一横置写点）+ api.moveInvestigator（移动唯一入口），
//     目标地点是已揭示连接地点，移动前用 api.canMoveTo 校验。

const CODE = '12033'
const BONUS = 1

const revealedConnections = (state, inv) => {
  const here = (state.locations || []).find(location => location.id === inv.location)
  return (here?.connections || [])
    .map(id => (state.locations || []).find(location => location.id === id))
    .filter(location => location && location.revealed === true)
}

export default {
  code: CODE,
  uses: 4,
  usesType: 'secrets',
  abilities: [
    {
      kind: 'action',
      countsAs: 'investigate',
      label: '花费 1 秘密：调查一个连接的已揭示地点（+1[智识]）；成功后可以横置本牌移动到该地点',
      cost: { action: true, uses: 1 },
      criteria: [({ state, inv }) => revealedConnections(state, inv).length > 0],
      resolve: ({ state, inv, source, api }) => {
        const candidates = revealedConnections(state, inv)
        if (!candidates.length) { api.info('没有可调查的连接的已揭示地点。'); return }
        const locationId = candidates.length === 1 ? candidates[0].id : api.choice({
          kind: 'location', source: CODE, seat: inv.seat,
          prompt: '选择要调查的连接的已揭示地点。',
          options: candidates.map(location => ({ id: location.id, label: api.locationName(location.id) })),
        })
        if (!candidates.some(location => location.id === locationId)) return
        api.investigate(inv.seat, {
          locationId,
          bonus: BONUS,
          noClueDiscovery: true,
          sourceCode: CODE,
        })
        const result = api.testResult()
        if (!result?.success) return
        api.discoverClue(inv.seat, 1, locationId)
        api.info(`「本地地图」：在「${api.locationName(locationId)}」发现 1 个线索。`)
        if (!source || source.exhausted || !api.canMoveTo(inv.seat, locationId)) return
        const answer = api.choice({
          kind: 'move', source: source.id ?? CODE, seat: inv.seat, canSkip: true,
          prompt: '本地地图：调查成功。是否横置本地地图，移动到该地点？',
          options: [
            { id: 'skip', label: '不移动' },
            { id: 'move', label: '横置本地地图并移动到该地点' },
          ],
        })
        if (answer !== 'move') return
        api.exhaust(source)
        api.moveInvestigator(inv.seat, locationId)
        api.info(`「本地地图」：横置并移动到「${api.locationName(locationId)}」。`)
      },
    },
  ],
  modifiers: [
  ],
}
