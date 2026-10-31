// 06037 嗜睡症（基础弱点）
// 卡面：多人游戏专用。
//       显现 - 将嗜睡症放置入场，放到你的威胁区域。
//       你不能进行行动、触发能力、打出卡牌。
//       [action]：“醒醒！”弃掉嗜睡症。
//       强制 - 你受到伤害或恐惧后：弃掉嗜睡症。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 06037 嗜睡症：
//   · 显现：威胁区（weakness type threat）。[action] 弃置 → discardCost { action: 1 }（通用弃置行动）。
//   · 不能进行行动 / 触发能力 / 打出卡牌：
//       - 打出卡牌 → weakness 数据体里的 cannotPlay（getThreatEffect 对威胁区弱点返回该数据体，
//         engine 的 cannotPlayTypes 读它）；
//       - [action] 能力 → 条目 threatEffect.cannotTriggerActionAbilities（moves.js 的读点）；
//       - 行动/能力 → modifiers 里的 capability 修正（modifierSourceRows 会枚举威胁区卡牌）。
//   · 强制「受到伤害或恐惧后弃掉」：挂在 harmDealt 窗口的 forced 描述子。
//     显式简化：在伤害/恐惧分配前结算；若伤害全部由支援承接、本人没有实际承受，也会弃掉。

export default {
  code: '06037',
  simplified: true,
  note: '未实现：强制「受到伤害或恐惧后弃掉」在伤害/恐惧分配前结算（harmDealt 窗口），若伤害全部由支援承接也会弃掉；其余限制与 [action] 弃置已实现。',
  threatEffect: { cannotTriggerActionAbilities: true },
  modifiers: [
    { target: 'capability:investigate' },
    { target: 'capability:fight' },
    { target: 'capability:evade' },
    { target: 'capability:move' },
    { target: 'capability:draw' },
    { target: 'capability:play' },
    { target: 'capability:triggerAbilities' },
    { target: 'capability:locationAbility' },
    { target: 'capability:commit' },
    { target: 'capability:resign' },
    { target: 'capability:discoverClue' },
  ],
  abilities: [
    {
      kind: 'weakness',
      label: '显现：放入威胁区域；[action] “醒醒！”弃掉',
      weakness: {
        type: 'threat',
        discardCost: { action: 1 },
        cannotPlay: ['asset', 'event', 'skill'],
      },
    },
    {
      kind: 'forced',
      trigger: 'harmDealt',
      silent: true,
      label: '受到伤害或恐惧后：弃掉嗜睡症',
      criteria: [({ source }) => Boolean(source)],
      resolve: ({ source, api }) => {
        if (!source) return
        api.removeThreat(source)
        api.info('「嗜睡症」：受到伤害或恐惧后弃掉。')
      },
    },
  ],
}
