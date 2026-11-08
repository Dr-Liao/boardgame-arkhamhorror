// 08130 臂伤（Arm Injury）
// 卡面：显现 - 将臂伤放置入场，放到你的威胁区域。
//        臂伤可被治愈，如同是你身上的 1 点伤害（如果它被治愈，将其弃掉）。
//        强制 - 在你执行攻击或启动行动后：本回合剩余时间内，你不能再进行任何这些类型的行动。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点：
//   · 弱点模板 kind:'weakness'（type:'threat' + clues:1 作为「1 点伤害」计数器）；
//   · 「可如同 1 点伤害被治愈，治愈后弃掉」走引擎 P6 原语 threatDamageSink：
//     src/engine/harm-threat.js:714-740 healDamageFrom 读 `flags.threatDamageSink === true`
//     （api.healDamage 的统一入口），治疗量先扣 counters，归零时 removeThreat + 弃卡；
//   · 强制能力走 actionResolvedAtLocation 窗口 + api.addEffect
//     （capability:fight / capability:triggerAbilities，duration:'endOfTurn'，回合末统一过期）。
// approximation: actionResolvedAtLocation 窗口不带行动类型，近似为任意行动后立即锁住
//   印刷的两类行动直到回合结束（略偏严）。
const code = '08130'

export default {
  code,
  flags: { threatDamageSink: true },
  note: 'approximation: 动作后锁读 actionResolvedAtLocation（窗口不带行动类型），近似为任意行动后锁住印刷行动类型至回合结束。',
  abilities: [
    {
      kind: 'weakness',
      label: '显现：放入威胁区域（1 点「伤害」计数器）',
      weakness: { type: 'threat', clues: 1 },
    },
    {
      kind: 'forced',
      trigger: 'actionResolvedAtLocation',
      label: '执行行动后：本回合不能攻击或启动能力',
      criteria: [({ state, inv }) => !(state.effects || []).some(effect => effect.sourceCode === code
        && effect.duration === 'endOfTurn' && effect.controllerSeat === inv.seat)],
      resolve: ({ inv, api }) => {
        api.addEffect({
          sourceCode: code,
          controllerSeat: inv.seat,
          duration: 'endOfTurn',
          label: '臂伤：本回合不能攻击或启动能力',
          modifiers: [{ target: 'capability:fight' }, { target: 'capability:triggerAbilities' }],
        })
        api.info(`🩹 「臂伤」：${inv.name} 本回合不能再攻击或启动能力。`)
      },
    },
  ],
  modifiers: [],
}
