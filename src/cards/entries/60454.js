// 60454 晕血（Hemophobia，基础弱点）
// 卡面：显现 - 将晕血放置入场，位于你的威胁区域。
//       强制 - 每轮第一次你所在地点的调查员受到伤害：受到 1 点恐惧。
//       [action][action]：弃掉晕血。
//
// 近似：用弱点声明式的 onDamage 强制（自己受到伤害时）表达「同地点调查员受伤」，
// 已在 primitive request 中登记需要的地点级 harm 强制读点。
export default {
  code: '60454',
  // 读点：applyHarm 放置后扫描同地点威胁区（每轮第一次）。
  locationHarmFirstPerRound: { horror: 1 },
  abilities: [{
    kind: 'weakness',
    label: '显现时放入威胁区域；同地点首次受伤受到 1 点恐惧；两个行动弃掉',
    weakness: {
      type: 'threat',
      discardCost: { action: 2 },
    },
  }],
}
