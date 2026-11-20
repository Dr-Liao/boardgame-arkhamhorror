// 11724 朝圣者领袖（Pilgrim Leader）· 敌人 · 共享遭遇组 pilgrims（印刷 1 张）
// 归属：战役内跨关卡共用 · theDrownedCity/_shared/pilgrims。
// 卡面（cards-data 11724）：
//   冷漠。
//   生成 - 任意地点(尽可能为空地点)。
//   朝圣者领袖处于重整状态时，每名其他[[异教徒]]敌人得到+2战斗值，并获得猎手和无情。
//
// 读点（声明即接线）：
//   · 「生成 - 任意地点（尽可能为空地点）」= enemyRule.spawnAnyEmpty（encounter.js#drawEncounter 的
//     印刷生成点分支：先找无人地点，没有才回到任意地点）；
//   · 「每名其他异教徒敌人 +2 战斗」= 条目 modifiers 的 audience:'enemies'（modifiers.js#entityModifierRows
//     的 enemyAura 行 + entityModifierTotal('enemyFight')）；condition 里同时判定「本卡处于重整状态」
//     「目标不是自己」「目标带 Cultist 特性」；
//   · 「获得无情」= api.scenario.setEnemyKeywords 的 relentless 覆盖（enemy-keyword-movement.js 的
//     可编辑关键词含 relentless）；在敌人生成/轮开始/本卡重整时同步一次，每轮失效后重算；
//   · 「获得猎手」= 引擎的可编辑关键词不含 hunter，见 note 与 primitive request（pending）。
const CODE = '11724'
const TRAIT = 'cultist'

const isCultist = enemy => (enemy?.traits || []).some(trait => String(trait).toLowerCase() === TRAIT)
const leaderOf = (state, source) => (state?.enemies || []).find(enemy => enemy.id === source?.id) || null

export default {
  code: CODE,
  name: '朝圣者领袖',
  scope: 'enemy',
  implemented: true,
  enemyRule: { spawnAnyEmpty: true },
  flags: {
    traits: ['Humanoid', 'Cultist'],
    quantity: 1,
    fight: 3,
    evade: 3,
    health: 3,
    damage: 1,
    horror: 1,
    aloof: true,
    spawnAnyEmpty: true,
    cultistAura: { fight: 2, relentless: true, hunter: true },
  },
  modifiers: [{
    target: 'enemyFight',
    amount: 2,
    audience: 'enemies',
    condition: {
      when: ({ source, entity }) => Boolean(source) && !source.exhausted
        && source.id !== entity?.id && isCultist(entity),
    },
  }],
  abilities: [{
    kind: 'forced',
    trigger: ['enemySpawn', 'roundStarts', 'enemyReadied'],
    silent: true,
    label: '重整时：其他异教徒敌人获得无情（引擎不支持授予猎手，见 note）',
    criteria: ({ state, source }) => {
      const leader = leaderOf(state, source)
      return Boolean(leader) && !leader.exhausted
    },
    resolve: ({ state, source, api }) => {
      const leader = leaderOf(state, source)
      if (!leader) return
      for (const enemy of state.enemies || []) {
        if (enemy === leader || !isCultist(enemy)) continue
        api.scenario?.setEnemyKeywords?.(enemy, ['relentless'], { enabled: true, throughRound: state.round })
      }
      api.info?.('🕯️ 「朝圣者领袖」重整：其他异教徒敌人获得无情。')
    },
  }],
  note: 'generated 位置走 enemyRule.spawnAnyEmpty；+2 战斗走 enemyAura 修正（重整状态条件在 condition 里）；'
    + '无情通过 setEnemyKeywords 的 relentless 覆盖同步。近似：引擎可编辑关键词白名单不含 hunter，'
    + '「获得猎手」没有写入读点——已登记 primitive request（shared-1：允许 setEnemyKeywords 授予 hunter）。'
    + '重整后才进入在场的敌人会在下一次 enemySpawn/roundStarts/enemyReadied 同步。',
}
