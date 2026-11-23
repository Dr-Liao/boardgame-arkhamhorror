// 11677 · location · sepulchreOfTheSleeper
//
// 刻印壁龛（野心的故事）。[action][意志](5) 成功在「黑曜石之爪」上放 1 毁灭；本地点调查员可团队花 1[per_investigator] 线索再放 1 个（behavior.actions/performAction sepulchreAlcove）。克苏鲁进入时每位调查员随机弃 1 手牌（behavior.enemyMoved）。
// 数据型条目：数值/身份由 definition 从卡表读取；行为读点见 note 中的 behavior 钩子。
export default {
  code: '11677',
  scope: 'location',
  implemented: true,
  flags: { artifactRecord: 'obsidianClaw', skill: 'willpower' },
  
  note: "刻印壁龛（野心的故事）。[action][意志](5) 成功在「黑曜石之爪」上放 1 毁灭；本地点调查员可团队花 1[per_investigator] 线索再放 1 个（behavior.actions/performAction sepulchreAlcove）。克苏鲁进入时每位调查员随机弃 1 手牌（behavior.enemyMoved）。",
}
