// 10693b 蕾切尔嬷嬷 · 敌人（蕾切尔嬷嬷的敌人面，theFeastOfHemlockVale/_shared/residents）
// 卡面（中文正文见 src/cards/cards-data.js 的 textZh，本文件不抄第二份）：
//   Aloof. Retaliate.
//   Mother Rachel gets +2 [per_investigator] health.
//   Forced - After you deal 1 or more damage to Mother Rachel: Choose a different [[Resident]] enemy at
//     her location. That enemy attacks you.
// 归属：战役共用 · theFeastOfHemlockVale/_shared/residents（Residents 遭遇组双面卡 10693 的背面）。
//
// 印刷数值（战斗 4 / 躲避 2 / 生命 2 / 伤害 1 / 恐惧 2 / 胜利 1 / 特性）由 cards-data 提供，章节
// encounterDefinitions 展开；Aloof / Retaliate 由该函数从英文正文解析，Elite 由 [[Elite]] 特性给出。
// 读点：
//   · 「+2[per_investigator] 生命」= enemyRule.healthPerPlayerBonus（enemies.js#spawnEnemy 读点）；
//     FHV 的 encounterDefinitions 不并 enemyRule，因此同一数值另存 flags.healthPerInvestigatorBonus 供内容层读；
//   · 「受到伤害后」= enemyDamaged 窗口（damageEnemy 的唯一派发点，context 带 enemy/seat/amount）；
//   · 「该敌人攻击你」= api.scenario.attack（scenario-runtime 的攻击入口）。
const CODE = '10693b'
const RESIDENT = 'motherRachel'
const NAME = '蕾切尔嬷嬷'

export default {
  code: CODE,
  scope: 'enemy',
  implemented: true,
  enemyRule: { healthPerPlayerBonus: 2 },
  flags: {
    resident: RESIDENT,
    assetCode: '10693',
    keywords: ['aloof', 'retaliate'],
    elite: true,
    victory: 1,
    healthPerInvestigatorBonus: 2,
    damagedRedirectToResident: true,
  },
  abilities: [{
    kind: 'forced',
    trigger: 'enemyDamaged',
    label: '你对蕾切尔嬷嬷造成伤害后：她所在地点另一个[[居民]]敌人攻击你',
    criteria: [({ context }) => String(context?.enemy?.originalCode || context?.enemy?.code || '') === CODE],
    resolve: ({ state, context, api }) => {
      const here = (state.enemies || []).filter(enemy => enemy.id !== context.enemy.id
        && enemy.location === context.enemy.location
        && (enemy.traits || []).some(trait => String(trait).toLowerCase() === 'resident'))
      if (!here.length) return false
      const inv = state.investigators?.[context.seat] || state.investigators?.[0]
      if (!inv) return false
      const picked = here.length === 1 ? here[0] : here.find(enemy => String(enemy.id) === String(api.choice({
        kind: 'enemy', source: CODE, seat: inv.seat,
        prompt: '「蕾切尔嬷嬷」：选择攻击你的[[居民]]敌人。',
        options: here.map(enemy => ({ id: enemy.id, label: enemy.name || enemy.code })),
      }))) || here[0]
      api.info?.(`💥 「蕾切尔嬷嬷」受到伤害：${picked.name || picked.code} 转而攻击 ${inv.name}。`)
      return api.scenario.attack(picked, inv)
    },
  }],
  note: '+2[per_investigator] 生命走 enemyRule.healthPerPlayerBonus（spawnEnemy 读点），同一数值另存 flags.healthPerInvestigatorBonus'
    + '（FHV 章节的 encounterDefinitions 不合并 enemyRule，内容层 enemyStatModifier 读 flags）。「攻击你」走 api.scenario.attack。',
}
