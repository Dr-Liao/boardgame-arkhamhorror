// 11681 · location · sepulchreOfTheSleeper
//
// 刻印壁龛（航程的故事）。[action] 团队花 1[per_investigator] 线索 → 在「伊克雷希特碎片」上放 1 毁灭（本地无检定）。克苏鲁进入时每位调查员将其牌库顶 1 张牌移出游戏。
// 数据型条目：数值/身份由 definition 从卡表读取；行为读点见 note 中的 behavior 钩子。
export default {
  code: '11681',
  scope: 'location',
  implemented: true,
  flags: { artifactRecord: 'shardOfYchlecht', skill: null, groupClueExtra: 1, cthulhuEntry: 'removeTopCard' },
  
  note: "刻印壁龛（航程的故事）。[action] 团队花 1[per_investigator] 线索 → 在「伊克雷希特碎片」上放 1 毁灭（本地无检定）。克苏鲁进入时每位调查员将其牌库顶 1 张牌移出游戏。",
}
