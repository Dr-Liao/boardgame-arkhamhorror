// 11680 · location · sepulchreOfTheSleeper
//
// 刻印壁龛（反抗的故事）。[action][敏捷](5) → 在「骇人面具」上放 1 毁灭（+团队线索追加 1）。克苏鲁进入时每位调查员失去 2 个资源。
// 数据型条目：数值/身份由 definition 从卡表读取；行为读点见 note 中的 behavior 钩子。
export default {
  code: '11680',
  scope: 'location',
  implemented: true,
  flags: { artifactRecord: 'grislyMask', skill: 'agility', groupClueExtra: 1, cthulhuEntry: 'loseResources2' },
  
  note: "刻印壁龛（反抗的故事）。[action][敏捷](5) → 在「骇人面具」上放 1 毁灭（+团队线索追加 1）。克苏鲁进入时每位调查员失去 2 个资源。",
}
