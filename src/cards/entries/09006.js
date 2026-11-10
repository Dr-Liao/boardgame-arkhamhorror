// 09006「术后恢复」（On the Mend）· 技能 · 文森特专属签名（每人 1 张）
// 卡面：你的手牌中至多 1 张「术后恢复」。
//   仅可投入到你自己执行的检定。
//   强制 - 当「术后恢复」将从任何区域被弃置时：改为将其放在一边（场外）。
//
// 读点：zoneReplacement（玩家区域写点替换，同 06113 的绑定场外集合）；
//   commit 描述子的 skill.destination = 'setAside'（投入后去向）。
export default {
  code: '09006',
  zoneReplacement: { discard: 'setAside', shuffle: 'setAside' },
  abilities: [
    {
      kind: 'commit',
      label: '《术后恢复》：投入后放到一边（场外）',
      skill: { destination: () => 'setAside' },
    },
  ],
  modifiers: [],
}
