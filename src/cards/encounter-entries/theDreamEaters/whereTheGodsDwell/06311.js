// 06311 不可描述的高阶祭司（High Priest Not to Be Described）
// 卡面：警戒。庞大。反击。
//       本敌人不能进行趁乱攻击。
//       [fast] 如果本敌人横置，花费 1[per_investigator] 个线索：记住你「打晕了祭司」。
//       直到本场冒险结束，本敌人攻击值 -3。
//
// 读点分工（声明即接线）：
//   · 「不能趁乱攻击」→ `flags.cannotMakeOpportunityAttacks`，章节 behavior.canOpportunityAttack 读；
//   · 「攻击值 -3（直到本场冒险结束）」→ `flags.stunnedFightPenalty`，章节 behavior.enemyStatModifier
//     在 scenarioFlags.stunnedThePriest 为真时累加（剧本内的「记住」= scenarioFlags，非战役记录）；
//   · [fast] 行动 → enemyScript.encounterAction / performEncounterAction，
//     章节 behavior.actions / performAction 分派（TDE 共享层只分派威胁区 threatAction）。
const STUN_RULE = 'stunThePriest'

const perPlayer = state => Math.max(1,
  Number(state?.numInvestigators) || (state?.investigators || []).length || 1)

const alreadyStunned = state => state?.scenarioFlags?.stunnedThePriest === true

export default {
  code: '06311',
  scope: 'enemy',
  implemented: true,
  flags: { cannotMakeOpportunityAttacks: true, stunnedFightPenalty: -3 },
  enemyScript: {
    encounterAction(state, inv, enemy) {
      if (!enemy || !inv || enemy.location !== inv.location) return null
      if (!enemy.exhausted || alreadyStunned(state)) return null
      const cost = perPlayer(state)
      if ((inv.clues || 0) < cost) return null
      return {
        action: 'encounterAction', rule: STUN_RULE, enemyId: enemy.id,
        actions: 0, fast: true,
        label: `💫 花费 ${cost} 个线索：记住你「打晕了祭司」（本敌人攻击值 -3，直到本场冒险结束）`,
      }
    },
    performEncounterAction(state, inv, enemy, move, api) {
      if (move?.rule !== STUN_RULE) return false
      if (!enemy || !enemy.exhausted || alreadyStunned(state)) return false
      const cost = perPlayer(state)
      if ((inv.clues || 0) < cost) return false
      api.spendClues?.(inv.seat, cost)
      api.setScenarioFlag?.('stunnedThePriest', true)
      api.info?.(`💫 ${inv.name} 打晕了不可描述的高阶祭司：本敌人攻击值 -3，直到本场冒险结束。`)
      return true
    },
  },
}
