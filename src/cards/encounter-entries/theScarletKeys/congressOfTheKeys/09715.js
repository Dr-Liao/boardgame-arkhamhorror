// 09715 拟态克星（Mimetic Nemesis · Infiltrator of Realities）· 敌人 · congress_of_the_keys
//
// 印刷（中文）：
//   庞大。不能进行趁乱攻击。
//   拟态克星得到+3[每调查员]生命值。
//   强制 - 在拟态克星将要从攻击或玩家牌受到伤害时：选择并揭示一张隐匿迷你卡牌。如果是诱饵，
//   取消刚才造成的所有伤害（诱饵依然留在场上，正面朝上）。否则，如常造成伤害，然后将所有已揭示的
//   迷你卡牌翻至正面朝下并混洗。
//
// 引擎读点：
//   · 「庞大 / 精英 / 古神 / 域外」由章节 definition 的印刷关键词与 traits 提供（`spawnEnemy` 读 `def.massive`）；
//   · 「不能进行趁乱攻击」= 实体修正 `cannot:opportunityAttack`（modifiers.js 的 ENTITY_RULE_TARGETS，
//     与 06347 同一写法）；
//   · 「+3[每调查员]生命值」= `enemyHealth` 修正（modifiers.js#enemyHealthDelta → enemies.js#enemyHealth），
//     与 07164b/07144 同一写法；
//   · 「将要受到伤害时揭示迷你卡」= `enemyRule.damageRevealsConcealedMiniCard`：读点是本章
//     `behavior.enemyDamageAllowed`（combat.js / enemies.js#canDamageEnemy 的唯一扣伤害前置读点），
//     结算在 `behavior.mimeticNemesisDamageShield`（诱饵 → 返回 false 取消全部伤害；真身 → 如常伤害 +
//     已揭示迷你卡翻回并混洗）。
//
// 近似：该前置读点只拿得到 state/enemy/source/seat（没有 api），无法询问「揭示哪一张」，
//   因此由章节行为按确定性顺序取第一张；见 behavior.scenarioApproximations 与
//   artifacts/migration/tsk/primitive-requests/09694.json。
export default {
  code: '09715',
  scope: 'enemy',
  implemented: true,
  flags: { elite: true, ancientOne: true, outsider: true, massive: true },
  modifiers: [
    { target: 'cannot:opportunityAttack' },
    {
      target: 'enemyHealth',
      amount: ({ state }) => 3 * Math.max(1, Number(state?.numInvestigators) || (state?.investigators || []).length || 1),
    },
  ],
  enemyRule: {
    damageRevealsConcealedMiniCard: true,
  },
  note: '庞大/精英由印刷数据提供；趁乱攻击与每调查员生命值走 modifiers；'
    + '「受伤时揭示迷你卡」由 behavior.enemyDamageAllowed 读 enemyRule.damageRevealsConcealedMiniCard 结算。',
}
