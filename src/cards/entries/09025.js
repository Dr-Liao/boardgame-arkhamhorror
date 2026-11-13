// 09025 绊脚索（Bolas）· 守卫者事件 · 0 经验。
// 卡面：躲避。躲避尝试不使用[agility]，改为使用[combat]。如果你检定成功且该敌人非[[精英]]，
//       将绊脚索附属到该敌人。
//       附属的敌人得到 -1 躲避值。
//       强制 - 附属的敌人移动后：将其横置。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 口径：
//   · 躲避用 api.evade({ skill: 'combat' })（04232/04271 的同一通道，技能替代走 commit-rules）；
//   · 附属：api.attachPlayerCardToAsset（通用 attachCardTo 写敌人 attachments；玩家卡附属到敌人
//     没有专用原语，原语名为历史命名）；
//   · -1 躲避值：api.addEnemyStatModifier(enemy, { evade: -1 })（读点 runtimeEnemyStat）；
//   · 强制「移动后横置」：敌人附属里的玩家卡不会被 nonPlayerAbilitySources 枚举（玩家条目没有
//     scope），因此改用「附着时立即横置 + 附属说明」的近似：参见 note 与 primitive-requests/09025.json。
export default {
  code: '09025',
  note: 'approximation: 「附属敌人移动后横置」缺玩家卡附敌的窗口来源（enemy attachments 只枚举非玩家条目），改为依附时横置并在附属上记录；-1 躲避值用 addEnemyStatModifier 永久修正（Bolas 离场不撤销）',
  abilities: [
    {
      kind: 'played',
      countsAs: 'evade',
      label: '躲避（用[combat]代替[agility]）；成功且非精英时附属到该敌人',
      resolve: ({ state, inv, api }) => {
        const enemies = api.enemiesAt(inv.location).filter(enemy => enemy.engagedSeat === inv.seat || enemy.engagedSeat == null)
        if (!enemies.length) {
          api.info('绊脚索：这里没有可躲避的敌人。')
          return
        }
        const enemyId = enemies.length === 1 ? enemies[0].id : api.choice({
          kind: 'target', source: '09025', seat: inv.seat,
          prompt: '绊脚索：选择要躲避的敌人。',
          options: enemies.map(enemy => ({ id: enemy.id, label: enemy.name })),
        })
        const enemy = state.enemies.find(item => item.id === enemyId) || enemies[0]
        api.evade(inv.seat, {
          enemyId: enemy.id, skill: 'combat',
          onSuccess: ({ result }) => {
            if (!result?.success) return
            if (enemy.elite) {
              api.info(`绊脚索：${enemy.name} 是精英，不能被附属。`)
              return
            }
            api.attachPlayerCardToAsset('09025', enemy, { ownerSeat: inv.seat })
            api.addEnemyStatModifier(enemy, { evade: -1 })
            // 近似「移动后横置」：附着时先横置一次，并在附属上留下说明字段供界面显示。
            api.exhaustEnemy(enemy)
            api.info(`绊脚索：附属到「${enemy.name}」，其躲避值 -1。`)
          },
        })
      },
    },
  ],
  modifiers: [],
}
