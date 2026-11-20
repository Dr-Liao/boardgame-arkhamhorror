// 11568 · 养育场（theApiary）单卡条目。
// 归属：关卡专用 · theDrownedCity/theApiary（P7 养育场，参考卡 11553）。
// 规则文本与卡表一致见 src/cards/cards-data.js；逐卡行为读点见 note 与章节 behavior.js。
//
// P7 第四轮：受控剧情资产 11568 玛莉亚·里维拉
//   · 伤害转嫁：`storyAssetRule.redirectEnemyDamage = { traits: ['Cultist'] }`（引擎既有读点
//     story-asset-rules.js → enemies.js#damageEnemy：所在地点[[异教徒]]敌人将要受到伤害时，
//     改为放在玛莉亚身上）；
//   · 毁灭转嫁：[reaction] trigger 'doomPlaced'（引擎既有窗口，context { card, amount }）+
//     cost exhaust → api.removeDoomFromCard(敌人, n) 后 api.damageControlledAsset(玛莉亚, n)；
//   · 被击败加入胜利区由章节 behavior.assetLeftPlay 结算。
export default {
  code: '11568',
  scope: 'storyAsset',
  implemented: true,
  controlledAsset: true,
  storyAssetRule: { redirectEnemyDamage: { traits: ['Cultist'] } },
  abilities: [{
    kind: 'reaction',
    trigger: 'doomPlaced',
    cost: { exhaust: true },
    label: '一名[[异教徒]]敌人将要被放置毁灭标记时，横置玛莉亚：改为将其作为伤害放在玛莉亚身上',
    criteria: ({ state, source, context, helpers }) => {
      const owner = (state.investigators || []).find(inv => (inv.assets || []).includes(source))
      if (!owner || source.exhausted) return false
      const card = context?.card
      if (!card || !(state.enemies || []).includes(card)) return false
      if (card.location !== owner.location) return false
      if (!(Number(context?.amount) > 0)) return false
      const traits = (card.traits || []).length ? card.traits : (helpers?.cardTraits?.(card.code) || [])
      return traits.some(trait => String(trait).toLowerCase() === 'cultist')
    },
    resolve: ({ state, source, context, api }) => {
      const amount = Math.max(1, Number(context?.amount) || 1)
      // 选择恢复时 context.card 是快照副本：按 id 找回真实敌人实例再移除毁灭。
      const realEnemy = (state.enemies || []).find(enemy => String(enemy.id) === String(context?.card?.id)) || context.card
      api.removeDoomFromCard?.(realEnemy, amount)
      api.damageControlledAsset?.(source, amount)
      api.info?.(`玛莉亚·里维拉：把 ${amount} 个毁灭标记改为 ${amount} 点伤害放在她身上。`)
    },
  }],
  note: "印刷：你所在地点一名[[异教徒]]敌人将要被放置伤害时，改为将其放置在玛莉亚·里维拉上；[reaction] 一名[[异教徒]]敌人将要被放置毁灭标记时，横置玛莉亚：改为将其作为伤害放置在玛莉亚·里维拉上；强制 - 如果玛莉亚被击败：将她加入胜利区。已接线：伤害转嫁由 storyAssetRule.redirectEnemyDamage = { traits: ['Cultist'] }（引擎既有 story-asset-rules.js → enemies.js 伤害改道读点）自动处理；毁灭转嫁为 reaction 描述子 trigger 'doomPlaced'（引擎既有窗口）+ cost exhaust + api.removeDoomFromCard + api.damageControlledAsset；被击败加入胜利区在 behavior.assetLeftPlay。幕间「选一位调查员控制玛莉亚」在 behavior.act1Back。全部子句已接线（成功结算按强制、无询问）。",
}
