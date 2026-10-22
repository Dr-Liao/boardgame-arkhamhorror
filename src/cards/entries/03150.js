// 03150 预先警告
// 卡面：快速。在你抽取一张非弱点的诡计卡牌时打出。
// 卡面：将你的1个线索放到你所在地点。然后，取消该卡牌的显现效果。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 03150 预警：刚抽到诡计时快速打出——花 1 个线索（放回所在地点）取消它。
// 旧 handler 不打日志，这里也不打（日志进 state.log = 进指纹）。

export default {
  code: '03150',
  abilities: [
    {
      kind: 'played', fast: true, trigger: 'encounterDrawn',
      criteria: { selfOnly: true, nonWeaknessOnly: true, treacheryOnly: true },
      label: '花 1 个线索取消刚抽到的诡计',
      resolve: ({ inv, api }) => {
        api.spendClueToLocation(inv.seat, 1)
        api.cancelEncounterDraw(inv.seat)
      },
    },
  ],
  modifiers: [

  ],
}
