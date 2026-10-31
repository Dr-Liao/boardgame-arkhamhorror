// 06159 强梦血清
// 卡面：如果你手中有多张同名手牌，检查手牌上限时其只计作一张。
// 卡面：[reaction]你抽取与你手牌同名的卡牌后，揭示这两张卡牌并横置强梦血清：抽取1张卡牌。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点：
//   · [reaction] 挂 cardDrawn 窗口（drawCards 每次抽牌后开窗，context.cardCode 是刚抽到的牌）；
//     条件 = 手牌里该卡号出现 ≥2 次；费用 = 横置血清；效果 = 抽 1 张（api.drawCards）。
// 显式简化（simplified）：「检查手牌上限时同名只计一张」——引擎 handSize 读点只支持静态
// passive.handSizeBonus / 调查员规则，没有按手牌内容动态计算的手牌上限读取点。

export default {
  code: '06159',
  simplified: true,
  note: '未实现：「如果你手中有多张同名手牌，检查手牌上限时其只计作一张」——引擎 handSize 读点'
    + '只支持静态修正，没有按手牌内容动态计算的手牌上限读取点；'
    + '「抽到与手牌同名的牌后横置血清抽 1 张」已实现（cardDrawn 窗口 + 横置费）。',
  abilities: [
    {
      kind: 'reaction',
      trigger: 'cardDrawn',
      id: 'dreamEnhancingSerumDraw',
      label: '抽到与手牌同名的牌后：横置强梦血清，抽 1 张',
      criteria: [({ inv, context }) => {
        const code = context?.cardCode
        if (!code) return false
        return (inv.hand || []).filter(item => item === code).length >= 2
      }],
      cost: { exhaust: true },
      resolve: ({ inv, api }) => {
        api.info(`🧪 ${inv.name} 揭示两张同名手牌并横置「强梦血清」，抽取 1 张卡牌。`)
        api.drawCards(inv.seat, 1)
      },
    },
  ],
  modifiers: [],
}
