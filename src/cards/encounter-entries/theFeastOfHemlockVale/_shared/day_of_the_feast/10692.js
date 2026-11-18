// 10692 狂乱的赴宴者 · 敌人 · 共享遭遇组 day_of_the_feast
// 归属：战役共用 · theFeastOfHemlockVale/_shared/day_of_the_feast（印刷 2 张；preludeTheFinalEvening 与
//   fateOfTheVale 都把它放在一边，按剧情生成）。
// 卡面（cards-data 10692）：[[类人]]。[[居民]]。攻击 2 / 躲避 2 / 生命 2 / 伤害 1 / 恐惧 0。
//   强制 - 在狂乱的赴宴者被击败时：在当前密谋上放置 1 个毁灭标记。本效果能导致当前密谋推进。
//   [action]：谈判。检定[敏捷](4)。如果你检定成功，将狂乱的赴宴者从游戏中移除。
//
// 读点（条目自足实现，全部走 ctx.api）：
//   · 被击败 → 放毁灭：enemyDefeated 窗口的 forced 描述子（enemies.js#defeatEnemy 派发，窗口来源包含
//     这次结算的敌人实体）；api.addDoom(1) 会照常触发议程推进。
//   · [action] 谈判：带 actionKind 'parley' 的 action 描述子（非玩家实体允许的唯一行动声明形式），
//     检定走 api.test(seat, 'agility', 4, { resolve })，成功后 api.removeEnemyFromGame 把实体移出游戏并
//     记入 state.removedFromGame。
//   · 数值/关键词（攻击/躲避/生命/伤害）由章节 definition 的 encounterDefinitions 从卡表读取，条目只声明身份。
const CODE = '10692'
const PARLEY_SKILL = 'agility'
const PARLEY_DIFFICULTY = 4

export default {
  code: CODE,
  scope: 'enemy',
  implemented: true,
  flags: {
    traits: ['Humanoid', 'Resident'],
    fight: 2,
    evade: 2,
    health: 2,
    damage: 1,
    horror: 0,
    quantity: 2,
    parleySkill: PARLEY_SKILL,
    parleyDifficulty: PARLEY_DIFFICULTY,
    doomOnDefeat: 1,
  },
  abilities: [{
    kind: 'action',
    actionKind: 'parley',
    cost: { action: 1 },
    label: '谈判：检定[敏捷](4)，成功则把狂乱的赴宴者移出游戏',
    resolve: ({ inv, source, api }) => {
      api.test(inv.seat, PARLEY_SKILL, PARLEY_DIFFICULTY, {
        source: { type: 'scenario', code: CODE, action: 'parley', ability: true },
        resolve: result => {
          if (!result?.success) {
            api.info?.(`❌ ${inv.name} 与「狂乱的赴宴者」谈判失败（敏捷 ${result?.value ?? 0} vs ${PARLEY_DIFFICULTY}）。`)
            return
          }
          api.removeEnemyFromGame(source)
          api.info?.(`🤝 ${inv.name} 说服了「狂乱的赴宴者」，它被移出游戏。`)
        },
      })
    },
  }, {
    kind: 'forced',
    trigger: 'enemyDefeated',
    silent: true,
    label: '被击败时：在当前密谋上放置 1 个毁灭标记',
    criteria: ({ source, context }) => Boolean(source && context?.enemy && context.enemy.id === source.id),
    resolve: ({ api }) => {
      api.addDoom(1)
      api.info?.('🌑 「狂乱的赴宴者」被击败：在当前密谋上放置 1 个毁灭标记。')
    },
  }],
  note: '两条印制规则都在条目内自足实现（谈判行动 + 击败时放毁灭）；数值由章节 definition 的 encounterDefinitions 从卡表读。',
}
