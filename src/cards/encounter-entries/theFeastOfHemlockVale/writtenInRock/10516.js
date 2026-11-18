// 10516 轨道桥梁 · 地点（writtenInRock）
// 卡面：X 为轨道桥梁的列号。[action] 花费 1[per_investigator] 资源：在剧本参考卡上放
// 1 个资源，作为「道岔」。（团队每轮一次。）
// 印刷帷幕是 X（卡表把它记成 -2 占位）：definition 把基础帷幕设为 0，由
// behavior.locationShroudModifier 返回列号。行动在 behavior.actions / performAction
// （writtenInRockRailBridgeSwitch）。
export default {
  code: '10516',
  scope: 'location',
  implemented: true,
  flags: {
    printedShroudByColumn: true,
    printedCluesPerInvestigator: 2,
    railIcons: ['north', 'south'],
    shroudByColumn: true,
    actionResourcesForSwitch: { perInvestigator: 1, groupLimit: 'perRound' },
  },
  note: '近似：卡表没有「X 帷幕」字段（记为 -2 占位）；运行期按列号覆盖，而不是把 -2 与列号相加。',
  abilities: [],
}
