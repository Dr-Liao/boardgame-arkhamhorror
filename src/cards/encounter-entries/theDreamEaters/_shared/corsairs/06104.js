// 06104 海盗追猎（Hunted by Corsairs，诡计，2 张）
// 归属：战役共用 · theDreamEaters/_shared。遭遇组：corsairs（TSK / DSM）。
// 卡面：Revelation - 将海盗追猎附属到当前幕。
//       强制 - 在当前幕推进时：每位调查员受到 2 点伤害。
//       附属的幕获得：「[action]：检定[intellect](4) 智胜海盗，或 [agility](4) 偷偷溜走。
//       如果你检定成功，弃掉海盗追猎。」
// 实现：附属到「当前幕」用 flags.attachToAct；幕推进伤害在共享层 agendaLeftPlay/actLeftPlay 里
//   读条目数据统一结算；幕上行动由 chapters 的 actions 分派。共享层目前没有这三处数据读点，
//   已登记 coordinator request；数据全部写在条目上，接线即生效。
export default {
  code: '06104',
  scope: 'treachery',
  implemented: true,
  flags: {
    attachToAct: true,
    advancesDamage: { amount: 2, each: 'investigator' },
    actGrantedAction: { skills: ['intellect', 'agility'], difficulty: 4, rule: 'outwitCorsairs' },
  },
  simplified: true,
  note: '「附属到当前幕 / 幕推进全体 2 伤 / 幕获得摆脱行动」由使用 corsairs 组的章节 behavior 读 flags 接线；数据已备好。',
}
