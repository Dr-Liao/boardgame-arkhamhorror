// 10063 “咪咪”比安卡（Bianca "Die Katz"）· 敌人 · 类人/罪犯/社会名流 · 弱点（绑定 10062）
// 卡面：
//   绑定(“咪咪”比安卡)。猎手。猎物 - 仅对承受者。
//   [action] 如果“你欠比安卡 X 资源”，花费 X 资源：谈判。将“咪咪”比安卡加入胜利区。
//   强制 - 在“咪咪”比安卡离场（除因上述能力外）时：将她混洗入你的牌库。
//
// 读点（卡面 → 引擎）：
//   · 绑定关系来自 cards-data（bondedTo/bondedCards），条目不需要再声明；本卡由 10062 的
//     「查找绑定卡牌」把副本从场外集合取出后生成。
//   · 猎手 / 猎物仅对承受者 = 条目级 enemyWeakness（card-lookup.js#enemyDef 合并 hunter / prey；
//     `prey: true` 即 prey = bearer，bearerSeat 由 spawnEnemy 写成承受者座位）。
//   · 离场替代送回承受者的牌库；本卡的还款谈判明确豁免此替代。
//   · 「[action] 如果欠款则花费 X：谈判。加入胜利区」= scope 'enemy' 的 action + actionKind 'parley'
//     （parley.js#parleyMovesFor 枚举同地点敌人的谈判行动；不引发借机攻击）。
//     欠款 X 读战役记录 youOweBianca:<seat>（10062 失败时写入）；花费用声明式动态费用
//     cost.resources（canAffordAbility / payAbilityCost 共用同一份求值）。
//   · 「加入胜利区」= api.scenario.addEnemyToVictory（banishEnemyToVictory 的唯一读点：移出敌人列表、
//     解除交战、压入 victoryDisplay；不经过击败管线，所以不会触发上面的「离场洗回」）。
const CODE = '10063'
const DEBT_PREFIX = 'youOweBianca:'

const owedBy = (state, seat) => Math.max(0, Number(state?.campaign?.records?.[`${DEBT_PREFIX}${seat}`]) || 0)

export default {
  code: CODE,
  name: 'Bianca "Die Katz"',
  scope: 'enemy',
  enemyWeakness: { hunter: true, prey: true, shuffleIntoBearerDeckOnLeave: true },
  abilities: [
    {
      kind: 'action',
      actionKind: 'parley',
      countsAs: 'parley',
      cost: { action: true, resources: ({ state, inv }) => owedBy(state, inv.seat) },
      label: '如果“你欠比安卡 X 资源”：花费 X 资源谈判，将她加入胜利区',
      criteria: [({ state, inv }) => owedBy(state, inv.seat) > 0],
      resolve: ({ state, inv, source, api }) => {
        const amount = owedBy(state, inv.seat)
        api.scenario.setCampaignRecord(`${DEBT_PREFIX}${inv.seat}`, null)
        api.scenario.addEnemyToVictory(source, { skipLeaveReplacement: true })
        api.info(`🎶 ${inv.name} 还清欠“咪咪”比安卡的 ${amount} 资源：她加入胜利区。`)
      },
    },
  ],
  modifiers: [],
}
