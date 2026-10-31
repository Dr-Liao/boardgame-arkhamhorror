// 06025 结晶器守卫
// 卡面：绑定(梦境结晶器)。猎手。
//       猎物 - Investigator with a Crystallizer of Dreams only.
//       结晶器守卫以横置状态入场。
//       强制 - 如果场上没有梦境结晶器：将结晶器守卫放在一边，位于场外。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 06025 结晶器守卫：
//   · 玩家包里的敌人型弱点：条目 scope:'enemy'（非玩家通道）。敌人型弱点由 resolveWeakness 的
//     `def.type === 'enemy'` 分支直接生成，不需要 weakness 描述子（与 06012/06017 同形；
//     scope enemy 的条目不允许声明 weakness kind）。
//   · 关键词来自条目 enemyWeakness（hunter + prey: bearer，bearerSeat = 抽到它的座位）。
//   · enemySpawn 的 forced：横置入场；场上没有 06024 时移出对局。
//
// 显式简化：「放在一边」只用 api.removeEnemy 移出对局（引擎没有把敌人放进 setAside 的写入口）。

export default {
  code: '06025',
  scope: 'enemy',
  simplified: true,
  note: '未实现：「放在一边」用 removeEnemy 移出对局代替（引擎无敌人 setAside 写入口）；其余生成/横置/猎手/bearer 猎物已实现。',
  enemyWeakness: { hunter: true, prey: true },
  abilities: [
    {
      kind: 'forced',
      trigger: 'enemySpawn',
      silent: true,
      label: '入场：横置；场上没有梦境结晶器时移出对局',
      criteria: [({ context }) => context?.enemy?.code === '06025'],
      resolve: ({ state, inv, context, api }) => {
        const enemy = context?.enemy
        if (!enemy) return
        api.exhaust(enemy)
        const hasCrystallizer = (state.investigators || []).some(owner =>
          (owner.assets || []).some(asset => asset.code === '06024'))
        if (!hasCrystallizer) {
          api.removeEnemy(enemy)
          api.info('「结晶器守卫」：场上没有「梦境结晶器」，将其放在一边（移出对局）。')
        } else {
          api.info(`「结晶器守卫」以横置状态入场，猎物为 ${inv.name}。`)
        }
      },
    },
  ],
  modifiers: [],
}
