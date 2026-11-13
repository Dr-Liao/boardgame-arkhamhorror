// 09074 破门而入（Breaking and Entering）· 游荡者（Rogue）事件 · 2 经验 · 技巧。
//
// 卡面：调查。本次调查将你的[敏捷]值加入你的技能值。如果你检定成功且超过难度至少 1 点，你可以
//       自动躲避本地点的 1 个敌人。如果你检定成功且超过难度至少 3 点，当你回合结束时将破门而入
//       返回你的手牌。本行动不会触发借机攻击。
//
// 一卡一文件：这张卡的行为只在这里维护。
//
// 读点：
//   · 「调查 + 加入[敏捷]」→ api.investigate 的 addSkill（actions.js#runInvestigate 同一读点）；
//     「不会触发借机攻击」→ played 描述子 noOpportunityAttack + countsAs:'investigate'。
//   · 「成功后自动躲避本地点敌人」→ onInvestigateSuccess 回调 + api.autoEvadeEnemy。
//   · 「回合结束时返回手牌」→ 没有延迟效果读点时，用「结算后返回手牌」近似（条目 keepOnPlay
//     阻止默认弃置，再由 resolve 显式放回手牌/弃牌堆），见 note 与原语请求。
// approximation: 卡面写「你回合结束时」返回；引擎对事件卡没有延迟去向读点，因此本实现是
//   「超过难度 3 点时结算后立即返回手牌」。见 primitive-requests/09074.json。
const CODE = '09074'

export default {
  code: CODE,
  keepOnPlay: true,
  simplified: true,
  note: 'approximation:「回合结束时返回手牌」实现为结算后立即返回手牌（事件卡延迟去向缺读点，primitive-requests/09074.json）。',
  abilities: [
    {
      kind: 'played',
      countsAs: 'investigate',
      noOpportunityAttack: true,
      label: '调查：加入[敏捷]；成功超过 1 点可自动躲避本地点敌人；超过 3 点返回手牌',
      resolve: ({ inv, api }) => {
        let returnToHand = false
        api.investigate(inv.seat, {
          addSkill: 'agility',
          onInvestigateSuccess: (result, { loc }) => {
            const successBy = Number.isFinite(result?.successBy)
              ? Number(result.successBy)
              : Math.max(0, Number(result?.value) - Number(result?.difficulty))
            if (successBy >= 1) {
              const enemies = api.enemiesAt(loc?.id || inv.location)
              if (enemies.length) {
                const picked = enemies.length === 1 ? enemies[0].id : api.choice({
                  kind: 'target', source: CODE, seat: inv.seat, canSkip: true,
                  prompt: '「破门而入」：自动躲避本地点的一个敌人？',
                  options: [{ id: 'skip', label: '不躲避' }, ...enemies.map(enemy => ({ id: enemy.id, label: enemy.name }))],
                })
                const enemy = enemies.find(item => item.id === picked)
                if (enemy && api.autoEvadeEnemy(enemy)) {
                  api.info(`🚪 「破门而入」：自动躲避「${enemy.name}」。`)
                }
              }
            }
            if (successBy >= 3) returnToHand = true
          },
        })
        if (returnToHand) {
          api.putInHand(inv.seat, CODE)
          api.info('🚪 「破门而入」：检定超过难度 3 点，返回你的手牌（近似：结算后立即返回）。')
          return
        }
        api.putIntoDiscard(inv.seat, CODE)
      },
    },
  ],
  modifiers: [],
}
