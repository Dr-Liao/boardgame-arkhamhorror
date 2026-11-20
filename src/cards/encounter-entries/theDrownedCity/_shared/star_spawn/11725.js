// 11725 怪异星之眷族（Monstrous Star Spawn）· 敌人 · 共享遭遇组 star_spawn（印刷 1 张）
// 归属：战役内跨关卡共用 · theDrownedCity/_shared/star_spawn。
// 卡面（cards-data 11725）：
//   猎手。庞大。无情。
//   猎物 - [combat]最高者。
//   强制 - 你攻击或躲避本敌人时揭示[elder_thing]标记：治愈其1点伤害。
//
// 读点（声明即接线）：
//   · 战斗/躲避/生命/伤害/恐惧 = cards-data；「猎手/庞大/无情」与猎物由章节 encounterDefinitions
//     解析印刷正文（条目 flags 只落数据）；
//   · 「你攻击或躲避本敌人时揭示 elder_thing」= chaosTokenRevealed 窗口（tests.js 的标记揭示段，
//     context 带 token/seat；检定中的目标与行动种类读 state.skillTest.target / actionKind）；
//   · 「治愈其 1 点伤害」= api.healEnemy（enemy 实例唯一自愈写点，不触发击败/胜利结算）。
const CODE = '11725'
const TOKEN = 'elderthing'

const testingThisEnemy = (state, source) => {
  const test = state?.skillTest
  if (!test || test.target?.kind !== 'enemy' || test.target.id !== source?.id) return false
  return ['fight', 'evade'].includes(test.actionKind)
}

export default {
  code: CODE,
  name: '怪异星之眷族',
  scope: 'enemy',
  implemented: true,
  // 印刷「无情」：读点 turn.js#resolveEnemyPhase 的 registeredEntry(...).enemyRule.relentless。
  enemyRule: { relentless: true },
  flags: {
    traits: ['Monster', 'Star Spawn', 'Elite'],
    quantity: 1,
    fight: 2,
    evade: 2,
    health: 6,
    damage: 1,
    horror: 1,
    victory: 1,
    hunter: true,
    massive: true,
    relentless: true,
    prey: 'highestCombat',
  },
  abilities: [{
    kind: 'forced',
    trigger: 'chaosTokenRevealed',
    silent: true,
    label: '攻击/躲避它时揭示 elder_thing：治愈它 1 点伤害',
    criteria: ({ state, source, context }) => context?.token === TOKEN
      && context?.seat === state?.skillTest?.seat
      && Boolean(source?.id) && (state?.enemies || []).some(enemy => enemy.id === source.id)
      && (source.damageTaken || 0) > 0
      && testingThisEnemy(state, source),
    resolve: ({ source, api }) => {
      api.healEnemy?.(source, 1)
      api.info?.(`⭐ 「怪异星之眷族」：揭示旧神标记，治愈 1 点伤害（剩 ${source.damageTaken || 0} 点）。`)
    },
  }],
  note: '标记强制效果挂在 chaosTokenRevealed 窗口，按「本次检定的目标=本敌人 + 行动种类 fight/evade」判定；'
    + '治愈走 api.healEnemy（只改实例伤害、不触发击败/胜利）。猎手/庞大/无情/猎物来自印刷正文解析（章节 encounterDefinitions）。',
}
