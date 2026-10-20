// 诡镇奇谈：卡牌版 · 非玩家卡能力（Phase 3 · D1 内容通道）
//
// 这里写敌人 / 地点 / 幕与议程 / 剧情支援 / 威胁区遭遇卡的声明式行为。
// 与 card-abilities.js 是同一套描述子，只是条目的 `scope` 不是 'card'：
//   scope: 'enemy' | 'location' | 'act' | 'agenda' | 'storyAsset' | 'treachery'
//
// 为什么需要这个通道（重构路线 §5 D1）：
//   · 此前敌人与地点的能力只能写在 `content/campaigns/<campaign>/scenarios/<id>/behavior.js`
//     或 `encounter-rules.js` 的钩子里——同一张卡的规则在多个章节重复实现，
//     引擎里也留着 `enemy.code === '…'` 这样的分支；
//   · 现在这些能力写在卡号条目上：引擎按「场上实体」枚举（descriptorSources），
//     数值与布尔规则走 modifiers.js 的 entityModifierTotal / entityRuleActive。
//
// 可用的修正目标（modifiers.js 的 ENTITY_MODIFIER_TARGETS / ENTITY_RULE_TARGETS）：
//   enemyFight / enemyEvade / enemyHealth / locationShroud / locationClues
//   cannot:attack / cannot:beAttacked / cannot:beDefeated / cannot:beDamaged
//   cannot:opportunityAttack / ignore:revealText
//
// 修正的来源按「声明在谁身上」决定：敌人自己的条目总是生效；地点的条目作用于
// 「位于该地点的敌人」；当前幕/议程的条目作用于全场敌人。
// 条件与数值函数拿到的 ctx：{ state, source, entity, host, helpers }
//   entity = 被修正的实体（敌人/地点/…），source = 声明这条修正的卡，
//   helpers.remainingSanity(inv) / helpers.maxSanity(inv) 是引擎口径的读点。
//
// 约定：只写「这张卡自己的规则」。跨卡、跨章节的剧本流程仍然留在 scenario behavior；
// 有简化行为的条目必须写 simplified: true + note（见路线文档 §3 末条）。

import { hasTrait } from '../engine/matcher.js'

// 胜利区的复仇点数（失落时代的「复仇」按卡面点数累计到胜利区）。
const victoryVengeance = state => (state?.victoryDisplay || [])
  .reduce((sum, card) => sum + Number(card.vengeance || 0), 0)

const actThreeIs = (state, value) => state?.scenarioFlags?.actThree === value

// 一个实体的印刷卡号（附属于别的卡时 originalCode 才是原卡号）。
const originalOf = entity => entity?.originalCode || entity?.code

export const NON_PLAYER_ABILITY_ENTRIES = [
  // -------------------------------------------------------------------------
  // 敌人
  // -------------------------------------------------------------------------
  // 尖叫的拜亚基：与你交战时，若你剩余神智 ≤ 4，它的战斗/躲避 +1。
  // 迁移自 engine.js 的 `enemy.code === 'screechingByakhee'` 分支（Phase 3 D1）。
  {
    code: 'screechingByakhee',
    name: '尖叫的拜亚基',
    scope: 'enemy',
    text: '与你交战时，若你的剩余神智不超过 4，它的战斗与躲避 +1。',
    modifiers: [
      {
        target: 'enemyFight', amount: 1,
        condition: { when: ({ state, entity, helpers }) => entity.engagedSeat != null
          && helpers.remainingSanity(state.investigators[entity.engagedSeat]) <= 4 },
      },
      {
        target: 'enemyEvade', amount: 1,
        condition: { when: ({ state, entity, helpers }) => entity.engagedSeat != null
          && helpers.remainingSanity(state.investigators[entity.engagedSeat]) <= 4 },
      },
    ],
  },
  // 埃兹特里的守卫者（04086）：04048「搜索遗迹」时不能攻击也不能被攻击；
  // 04049「守备森严的遗迹」时战斗与躲避 +1。
  // 迁移自 theUntamedWilds 的 enemyCannotAttack / enemyCannotBeAttacked / enemyStatModifier。
  {
    code: '04086',
    name: '埃兹特里的守卫者',
    scope: 'enemy',
    text: '搜索遗迹时不能攻击也不能被攻击；守备森严的遗迹时战斗与躲避 +1。',
    modifiers: [
      { target: 'cannot:attack', condition: { when: ({ state }) => actThreeIs(state, 'search') } },
      { target: 'cannot:beAttacked', condition: { when: ({ state }) => actThreeIs(state, 'search') } },
      { target: 'enemyFight', amount: 1, condition: { when: ({ state }) => actThreeIs(state, 'guarded') } },
      { target: 'enemyEvade', amount: 1, condition: { when: ({ state }) => actThreeIs(state, 'guarded') } },
    ],
  },
  // 羽翼蛇族（04209b）：不能被击败，也不发动借机攻击。
  // 关卡定义里的实例字段（cannotBeDefeated/noOpportunityAttack）仍在；
  // 这里给出卡面声明，使同一张卡在别的章节生成时也遵守同一规则。
  {
    code: '04209b',
    name: '羽翼蛇族',
    scope: 'enemy',
    text: '不能被击败。不发动借机攻击。',
    modifiers: [
      { target: 'cannot:beDefeated' },
      { target: 'cannot:opportunityAttack' },
    ],
  },
  // 兄弟会教徒（04095）：它身上每有 1 个毁灭标记，战斗与躲避 +1。
  // 迁移自 theForgottenAge/encounter-rules.js 的 enemyStatModifier 分支。
  {
    code: '04095',
    name: '兄弟会教徒',
    scope: 'enemy',
    text: '它身上每有 1 个毁灭标记，它的战斗与躲避 +1。',
    modifiers: [
      { target: 'enemyFight', amount: ({ entity }) => entity.doom || 0 },
      { target: 'enemyEvade', amount: ({ entity }) => entity.doom || 0 },
    ],
  },
  // 蟑螂群（03103）：战斗值等于所在地点的帷幕（含帷幕修正）。
  // 迁移自 thePathToCarcosa/encounter-rules.js 的 enemyStatModifier 分支。
  {
    code: '03103',
    name: '蟑螂群',
    scope: 'enemy',
    text: '它的战斗值等于所在地点的帷幕（含帷幕修正）。',
    modifiers: [{
      target: 'enemyFight',
      amount: ({ state, entity }) => {
        const location = (state.locations || []).find(candidate => candidate.id === entity.location)
        return (location?.shroud || 0) + (location?.shroudMod || 0) - (entity.fight || 0)
      },
    }],
  },
  // 潜行的拜亚基（03222）：横置时战斗 -3。
  {
    code: '03222',
    name: '潜行的拜亚基',
    scope: 'enemy',
    text: '它横置时战斗 -3。',
    modifiers: [{
      target: 'enemyFight', amount: -3,
      condition: { when: ({ entity }) => entity.exhausted === true },
    }],
  },
  // 哈斯塔的傀儡（03096）：调查阶段，它的战斗值获得本轮累积的傀儡加值。
  {
    code: '03096',
    name: '哈斯塔的傀儡',
    scope: 'enemy',
    text: '调查阶段，它的战斗值获得本轮累积的加值。',
    modifiers: [{
      target: 'enemyFight',
      amount: ({ state, entity }) => (state.phase === 'investigation'
        ? (entity.puppetFightBonuses || [])
          .filter(bonus => bonus.investigationRound === state.round)
          .reduce((sum, bonus) => sum + bonus.amount, 0)
        : 0),
    }],
  },
  // -------------------------------------------------------------------------
  // 地点
  // -------------------------------------------------------------------------
  // 万蛇据点（04072）：此处的每个蛇族敌人战斗 +1。
  // 迁移自 theUntamedWilds / heartOfTheEldersPart1 的 enemyStatModifier 分支。
  {
    code: '04072',
    name: '万蛇据点',
    scope: 'location',
    text: '此处的每个[[蛇族]]敌人战斗 +1。',
    modifiers: [{
      target: 'enemyFight', amount: 1,
      condition: { when: ({ entity }) => hasTrait(entity, 'Serpent') },
    }],
  },
  // 毒牙神庙（04074）：胜利区每有 1 点复仇点数，此处帷幕 +1。
  // 迁移自 theUntamedWilds / heartOfTheEldersPart1 的 locationShroudModifier 分支。
  {
    code: '04074',
    name: '毒牙神庙',
    scope: 'location',
    text: '胜利区每有 1 点复仇点数，此处帷幕 +1。',
    modifiers: [{
      target: 'locationShroud',
      amount: ({ state }) => victoryVengeance(state),
    }],
  },
]

// 审计/调试：这张卡是不是由本文件声明的非玩家能力卡。
export const NON_PLAYER_ABILITY_CODES = new Set(NON_PLAYER_ABILITY_ENTRIES.map(entry => entry.code))

// 供内容层复用的读点（避免在 behavior.js 里再写一遍「复仇点数」）。
export { originalOf, victoryVengeance }
