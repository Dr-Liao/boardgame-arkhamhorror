// 11509 蒂林哈斯特密所 · 地点（金盆洗手，起始地点）
// 归属：关卡专用 · theDrownedCity/oneLastJob。
// 卡面：蒂林哈斯特密所与其右侧的地点相连，反之亦然。
//       [action] 位于本地点的调查员共同花费 1[per_investigator] 个线索：在剧本日志中记录
//       “调查员发现了一种外星语言”。（每场游戏团队限一次。）
// 印刷：shroud 3、每调查员 1 条线索；背面为连接规则文字。
// 读点：behavior.actions/performAction 的 oneLastJobAlienLanguage 读 flags.alienLanguageAction/
//       clueCostPerInvestigator；记录写入 state.campaign.records.theInvestigatorsDiscoveredAnAlienLanguage。
export default {
  code: '11509',
  scope: 'location',
  implemented: true,
  flags: { alienLanguageAction: true, clueCostPerInvestigator: 1, groupLimitPerGame: true },
  note: '数据型条目：连接在 definition（与 Miskatonic University 互通）；行动在 behavior。',
  abilities: [],
}
