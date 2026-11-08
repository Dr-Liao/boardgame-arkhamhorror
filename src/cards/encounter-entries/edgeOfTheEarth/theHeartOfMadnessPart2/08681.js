// 08681 最终幻景（The Final Mirage）· 幕 4 / 议程 6 双面
// 卡面：无名的疯狂获得 hunter。强制 - 当 1+ 毁灭将被放置时，改为在左侧调查员所在地点生成 1 份。
// 目标 - 逃跑（Run）。背面：检查战役日志：五座高塔全坍塌且肯斯勒有计划 → R1；
// 五座高塔全坍塌但真相未明 → R2；否则 → R3。
export default {
  code: '08681',
  scope: 'act',
  implemented: true,
  actRule: {
    objective: { type: 'runToHiddenTunnel' },
    backEffect: 'finalMirageOutcome',
    namelessGainsHunter: true,
  },
  flags: { finalMirage: true, resolutionByRecords: true },
}
