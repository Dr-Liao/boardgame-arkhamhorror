// 06011 托尼的 .38 柯尔特长管手枪
// 卡面：托尼·摩尔根牌库专用。使用(3 子弹)。
//       [reaction] 你打出托尼的 .38 柯尔特长管手枪后：免费从你手牌打出另一张托尼的 .38 柯尔特长管手枪。
//       [action] 花费 1 子弹：攻击。被攻击的敌人上每有 1 赏金，你得到 +1 [combat]。本次攻击造成 +1 伤害。
//       如果本次攻击击败了带有至少 1 赏金的敌人，在赏金合约上放置 1 赏金。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点：
//   · 攻击走 api.fight（doFight 支持 combatBonus / damageBonus），赏金来自 card-counters 的具名计数器；
//   · 第二张免费打出走 api.playCardFromHandFree（P6 原语，与正常支付/入场共用 doPlay）；
//   · 入场窗口是引擎既有的 `assetEnteredPlay`（context.assetCode 指刚入场的支援）。

export default {
  code: '06011',
  uses: 3,
  usesType: 'ammo',
  abilities: [
    {
      kind: 'action',
      label: '花费 1 子弹：攻击（每个赏金 +1 战斗，伤害 +1）',
      cost: { action: true, uses: 1 },
      target: { kind: 'enemy' },
      countsAs: 'fight',
      resolve: ({ inv, source, target, api }) => {
        const enemy = target?.entity
        if (!enemy) return
        const bounties = enemy.markers?.bounty || 0
        api.fight(inv.seat, enemy.id, {
          assetId: source?.id,
          combatBonus: bounties,
          damageBonus: 1,
          noSpend: true,
        })
        // 击败带赏金的敌人：在赏金合约上放置 1 赏金（被击败后敌人已离场，按实例判断）。
        const defeated = !api.isEnemyInPlay(enemy)
        if (defeated && bounties > 0) {
          const contracts = (inv.assets || []).find(asset => asset.code === '06010')
          if (contracts) api.addCardCounter(contracts, 'bounty', 1, { max: 6 })
        }
      },
    },
    {
      kind: 'reaction',
      trigger: 'assetEnteredPlay',
      id: 'longColtSecondCopy',
      label: '打出后：免费从手牌打出另一张同名枪',
      criteria: [({ inv, context }) => context?.assetCode === '06011'
        && (inv.hand || []).includes('06011')],
      resolve: ({ inv, api }) => {
        api.playCardFromHandFree(inv.seat, '06011')
        api.info(`${inv.name} 免费打出了另一张「${api.cardName('06011')}」。`)
      },
    },
  ],
  modifiers: [],
}
