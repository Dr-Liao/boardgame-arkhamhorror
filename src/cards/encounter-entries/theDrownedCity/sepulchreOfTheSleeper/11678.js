// 11678 · location · sepulchreOfTheSleeper
//
// 刻印壁龛（坚韧的故事）。[action][战斗](5) → 在「屏障节点」上放 1 毁灭（+团队线索追加 1）。克苏鲁进入时每位调查员受 1 直接伤害。
// 数据型条目：数值/身份由 definition 从卡表读取；行为读点见 note 中的 behavior 钩子。
export default {
  code: '11678',
  scope: 'location',
  implemented: true,
  flags: { artifactRecord: 'barrierNode', skill: 'combat' },
  
  note: "刻印壁龛（坚韧的故事）。[action][战斗](5) → 在「屏障节点」上放 1 毁灭（+团队线索追加 1）。克苏鲁进入时每位调查员受 1 直接伤害。",
}
