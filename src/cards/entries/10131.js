// 10131 黎明之星（Dawn Star）· 中立事件 · 1 资源 · 1 级 · [[仪式]]/[[祝福]]
// 卡面：
//   快速。你所在地点的技能检定期间揭示了混乱标记后打出。
//   忽略本次检定期间揭示的每个[诅咒]标记的修正值。
//   每忽略 1 个[诅咒]标记，对你所在地点的一个敌人造成 1 点伤害。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
//
// 读点（卡面 → 引擎）：
//   · 快速事件 + 固定时机：`kind:'played', fast:true, trigger:'chaosRevealStepEnded'`
//     （tests.js 在标记揭示循环之后、把修正并进检定值之前开窗，context =
//      { when, seat, location, tokens:[{index, face}] }）。快速事件只从 reactionWindow 出候选，
//      默认按「同地点」过滤 —— 与卡面「你所在地点」同口径。
//   · 「忽略[诅咒]标记的修正值」= api.chaosTokens.treat({ index, modifier: 0 })
//     （chaos-token-effects.js#setTokenTreatment 是唯一写点；tests.js 在窗口之后按
//      tokenEffect 重算每个标记的修正，把 0 与原值的差值补回 delta —— 即恰好忽略该标记的修正，
//      标记本身仍照常结算与归还标记池）。
//   · 「每忽略 1 个，对同地点一个敌人造成 1 点伤害」= api.damageEnemy（伤害管线唯一入口）。
//     多个敌人时询问一次目标，全部点数给同一个敌人（见 note）。
const CODE = '10131'
const CURSE = 'curse'

// 本次检定（当前揭示帧）里已揭示的[诅咒]标记下标。
function curseTokenIndexes(state) {
  const start = state?.chaos?.frames?.at(-1) ?? 0
  return (state?.chaos?.revealed || [])
    .flatMap((face, index) => (face === CURSE && index >= start ? [index] : []))
}

export default {
  code: CODE,
  name: 'Dawn Star',
  abilities: [
    {
      kind: 'played',
      fast: true,
      trigger: 'chaosRevealStepEnded',
      criteria: [({ state }) => curseTokenIndexes(state).length > 0],
      label: '忽略本次检定每个[诅咒]标记的修正；每忽略 1 个，对同地点一个敌人造成 1 点伤害',
      resolve: ({ state, inv, api }) => {
        const indexes = curseTokenIndexes(state)
        for (const index of indexes) api.chaosTokens.treat({ index, modifier: 0 })
        if (!indexes.length) {
          api.info('「黎明之星」：本次检定没有揭示[诅咒]标记，没有可忽略的修正。')
          return
        }
        api.info(`🌟 「黎明之星」：忽略本次检定 ${indexes.length} 个[诅咒]标记的修正值。`)
        for (let point = 0; point < indexes.length; point += 1) {
          const targets = api.enemiesAt(inv.location).filter(enemy => api.canDamageEnemy(enemy, inv.seat, CODE))
          if (!targets.length) break
          const enemyId = targets.length === 1 ? targets[0].id : api.choice({
            kind: 'enemy', source: CODE, seat: inv.seat,
            prompt: '「黎明之星」：选择承受这 1 点伤害的敌人。',
            options: targets.map(enemy => ({ id: enemy.id, label: enemy.name })),
          })
          const enemy = targets.find(item => item.id === enemyId)
          if (enemy) api.damageEnemy(enemy, 1, inv.seat)
        }
      },
    },
  ],
  modifiers: [],
}
