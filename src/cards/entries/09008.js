// 09008 基玛尼·琼斯（Kymani Jones）· 流浪者 · 罪犯
// 卡面：
//   [fast] 与同地点一名已横置敌人交战。
//   [reaction] 当你尝试躲避一名已横置的非[[精英]]敌人时：把 [intellect] 加入本次检定的技能值。
//     若你成功且超过难度至少 X，弃掉该敌人。X 为该敌人剩余生命值。
//   [elder_sign] 效果：+1。若同地点有已横置敌人，改为自动成功。
//   卡背：开局额外获得 5 点经验（数据见 content/campaigns/theScarletKeys/investigator-data.js）。
export default {
  code: '09008',
  kind: 'investigator',
  investigator: {
    freeAction: {
      id: 'kymaniFastEngage',
      cost: {},
      label: '⚡ 与同地点一名已横置的敌人交战',
      resolve: ({ state, inv, api }) => {
        const candidates = (state.enemies || []).filter(enemy =>
          enemy.location === inv.location && enemy.exhausted && enemy.engagedSeat == null && !enemy.massive)
        if (!candidates.length) return
        const chosen = candidates.length === 1 ? candidates[0].id : api.choice({
          kind: 'enemy', source: '09008', seat: inv.seat, prompt: '选择要交战的已横置敌人。',
          options: candidates.map(enemy => ({ id: enemy.id, label: enemy.name })),
        })
        const enemy = candidates.find(item => item.id === chosen)
        if (enemy) api.engage(enemy, inv.seat)
      },
    },
 elderSign: { bonus: 1 } },
  elderSign: {
    id: '09008-eldersign',
    label: '基玛尼旧印：+1；同地点有已横置敌人时改为自动成功',
    resolve: ({ state, inv }) => {
      const shown = (state.enemies || []).some(enemy => enemy.location === inv.location && enemy.exhausted)
      return shown ? { delta: 1, autoSuccess: true } : { delta: 1 }
    },
  },
  abilities: [
    {
      kind: 'reaction',
      trigger: 'testBegins',
      label: '躲避已横置非精英敌人时：把 [intellect] 加入本次检定',
      criteria: ({ state, inv }) => {
        const test = state.skillTest
        if (!test || test.seat !== inv.seat || test.actionKind !== 'evade') return false
        const target = test.target?.kind === 'enemy' ? state.enemies.find(enemy => enemy.id === test.target.id) : null
        return Boolean(target) && target.exhausted === true && target.elite !== true
      },
      resolve: ({ inv, api }) => {
        const intellect = api.stat(inv.seat, 'intellect')
        api.addTestValue(intellect)
        api.info(`🧠 基玛尼：把 [intellect] ${intellect} 加入本次躲避检定。`)
      },
    },
    {
      // 「成功且超过难度至少 X」：evadeSuccess 窗口带 successBy 与 enemy。
      kind: 'forced',
      trigger: 'evadeSuccess',
      silent: true,
      label: '躲避已横置非精英敌人成功且超过难度至少其剩余生命时：弃掉该敌人',
      criteria: ({ inv, context }) => {
        const enemy = context?.enemy
        if (!enemy || enemy.elite === true) return false
        const remaining = Math.max(0, (enemy.health || 0) - (enemy.damageTaken || 0))
        return remaining > 0 && Number(context?.successBy) >= remaining
      },
      resolve: ({ context, api }) => {
        if (context?.enemy) api.discardEnemy(context.enemy)
        void api.info(`⛓️ 基玛尼：躲避超额，弃掉「${context?.enemy?.name || '敌人'}」。`)
      },
    },
  ],
  modifiers: [],
}
