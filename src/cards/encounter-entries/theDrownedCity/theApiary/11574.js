// 11574 · 养育场（theApiary）单卡条目。
// 归属：关卡专用 · theDrownedCity/theApiary（P7 养育场，参考卡 11553）。
// 规则文本与卡表一致见 src/cards/cards-data.js；逐卡行为读点见 note 与章节 behavior.js。
//
// 强制「你使用一张[[武器]]支援攻击本敌人后：在该支援上放置 1 个毁灭标记」= 引擎既有
// enemyDamaged 窗口（combat.js 普通攻击路径 / enemies.js damageEnemy 均在伤害写入后派发，
// context { enemy, seat, source: assetId, amount }）→ 条目 forced 描述子。
export default {
  code: '11574',
  scope: 'enemy',
  implemented: true,
  abilities: [{
    kind: 'forced',
    trigger: 'enemyDamaged',
    label: '奇丑混种：你使用一张[[武器]]支援攻击它后，在该支援上放置 1 个毁灭标记',
    criteria: ({ state, source, context, helpers }) => {
      const enemy = context?.enemy
      if (!enemy || !source || String(enemy.id) !== String(source.id)) return false
      if (!(Number(context?.amount ?? context?.damage) > 0)) return false
      const owner = state.investigators?.[context?.seat]
      const weapon = owner && (owner.assets || []).find(asset => asset.id === context?.source)
      if (!weapon) return false
      const traits = helpers?.cardTraits?.(weapon.code) || []
      return traits.some(trait => String(trait).toLowerCase() === 'weapon')
    },
    resolve: ({ state, context, api }) => {
      const owner = state.investigators?.[context?.seat]
      const weapon = owner && (owner.assets || []).find(asset => asset.id === context?.source)
      if (weapon) api.placeDoomOnCard?.(weapon, 1)
    },
  }],
  note: "印刷：猎手、反击；强制 - 你使用一张[[武器]]支援攻击本敌人后：在该支援上放置 1 个毁灭标记。已接线：forced 描述子 trigger 'enemyDamaged'（引擎既有窗口：combat.js 普通攻击路径与 enemies.js#damageEnemy 都在伤害写入后派发，context.source = 武器支援实例 id）→ api.placeDoomOnCard(武器, 1)。行为：data-type + behavior.spawnEnemy（议程 1 背面洗入遭遇牌库）。全部子句已接线。",
}
