// 10041 查尔斯·威斯特三世博士（Dr. Charles West III）· 知晓其使命 · 探寻者支援 · 盟友槽 ·
// 独一无二 · [[盟友]]/[[科学]]
// 卡面：
//   你拥有额外 1 个手部槽位，只可以用来携带 [[工具]] 支援。
//   [reaction] 在你成功调查，且超过难度正好 1 点或 3 点后，横置查尔斯·威斯特三世博士：
//   对你所在地点的一个敌人造成 1 点伤害。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点（卡面 → 引擎）：
//   · 额外手槽（只放 [[工具]]）= 条目级 restrictedSlots（2026-10-26 原语收敛，与 01008 书位 /
//     02147 武器位 / 05112 法术位同一读点）：assets.js#restrictedSlotInfo 只给命中谓词的候选容量，
//     在场受限卡可以移入受限槽、把普通手槽让给其它卡；判定唯一入口是 assets.canEquip。
//   · 「成功调查且超过难度正好 1 或 3」= 窗口 investigateSuccess（actions.js 在发现线索之前开窗，
//     context = { when, seat, location, successBy }）。
//   · 「横置」= 描述子 cost.exhaust；「对同地点一个敌人造成 1 点伤害」= api.damageEnemy
//     （combat.js 的伤害管线；同地点敌人才是合法目标）。
export default {
  code: '10041',
  name: '查尔斯·威斯特三世博士',
  restrictedSlots: [
    { slot: 'hand', traitsAny: ['Tool'], count: 1 },
  ],
  abilities: [
    {
      kind: 'reaction',
      trigger: 'investigateSuccess',
      id: 'drCharlesWestDamage',
      label: '成功调查（差值 1 或 3）后横置：对同地点一个敌人造成 1 点伤害',
      cost: { exhaust: true },
      criteria: [
        ({ state, inv, source, context }) => Boolean(source)
          && [1, 3].includes(Number(context?.successBy))
          && (state.enemies || []).some(enemy => enemy.location === inv.location && !enemy.defeated),
      ],
      resolve: ({ state, inv, api }) => {
        const targets = (state.enemies || []).filter(enemy => enemy.location === inv.location && !enemy.defeated)
        if (!targets.length) {
          api.info('「查尔斯·威斯特三世博士」：所在地点没有敌人。')
          return
        }
        const enemyId = targets.length === 1 ? targets[0].id : api.choice({
          kind: 'enemy', source: '10041', seat: inv.seat,
          prompt: '选择要造成 1 点伤害的敌人。',
          options: targets.map(enemy => ({ id: enemy.id, label: enemy.name })),
        })
        const enemy = targets.find(item => item.id === enemyId) || targets[0]
        api.damageEnemy(enemy, 1, inv.seat)
        api.info(`🔬 「查尔斯·威斯特三世博士」：对「${enemy.name}」造成 1 点伤害。`)
      },
    },
  ],
  modifiers: [],
}
