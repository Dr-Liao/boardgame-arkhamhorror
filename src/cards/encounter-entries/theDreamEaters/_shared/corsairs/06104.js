// 06104 海盗追猎（Hunted by Corsairs，诡计，2 张）
// 归属：战役共用 · theDreamEaters/_shared。遭遇组：corsairs（TSK / DSM）。
// 卡面：Revelation - 将海盗追猎附属到当前幕。
//       强制 - 在当前幕推进时：每位调查员受到 2 点伤害。
//       附属的幕获得：「[action]：检定[intellect](4) 智胜海盗，或 [agility](4) 偷偷溜走。
//       如果你检定成功，弃掉海盗追猎。」
// 实现：显现时 api.attachToAct；幕上的摆脱行动由 TDE 共享 actions/performAction
//   读取 actGrantedAction。幕推进前 onActAdvancing 对每位在场调查员造成 2 点伤害。
export default {
  code: '06104',
  scope: 'treachery',
  implemented: true,
  encounterResolve(state, inv, card, api) {
    api.attachToAct?.('06104', { originalCode: '06104' })
    api.info?.('🏴 「海盗追猎」附属到当前幕。')
    return true
  },
  treacheryRule: {
    onActAdvancing(state, source, api) {
      for (const inv of state.investigators || []) {
        if (inv.defeated || inv.resigned) continue
        api.damage?.(inv.seat, 2)
      }
    },
  },
  flags: {
    actGrantedAction: { skills: ['intellect', 'agility'], difficulty: 4, rule: 'outwitCorsairs' },
  },
}
