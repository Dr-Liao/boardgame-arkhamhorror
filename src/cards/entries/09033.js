// 09033 外勤特工（Field Agent）· 守卫者资产（2 级）· 盟友槽。
// 卡面：你得到 +1[智力]。[快速] 横置外勤特工并对其造成 1 点恐惧：发现你所在地点的 1 个线索。
export default {
  code: '09033',
  abilities: [{
    kind: 'free', fast: true,
    label: '横置并对其造成 1 恐惧：发现所在地点 1 个线索',
    cost: { exhaust: true },
    resolve: ({ inv, api, source }) => {
      api.addAssetHorror(source, 1)
      api.discoverClue(inv.seat)
    },
  }],
  modifiers: [
    { target: 'skill:intellect', amount: 1 },
  ],
}
