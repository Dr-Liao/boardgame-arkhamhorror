// 03183 疯人院暴食怪
// 归属：关卡专用 · theUnspeakableOath（卡尔克萨之路 · 邪秽誓约）
// 遭遇组：the_unspeakable_oath
// 卡面：生成 - 地下室走廊。
// 卡面：猎手。
// 卡面：疯人院暴食怪不能进行趁乱攻击，且在其猎手关键词移动的同一阶段期间不能攻击。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 第 114 轮：从章节 behavior 迁出的单卡规则。
//   · enemyScript 新读点 onMoved / attackModifier / onDamaged（内容层只做通用分派）；
//   · locationRule 复用已有 actions / performAction 读点；
//   · 遭遇卡走 encounterResolve + encounterResolveCampaigns。
// 疯人院暴食怪（03183）：猎手关键词移动的同一阶段不能攻击；也不发动借机攻击。

export default {
  code: '03183', scope: 'enemy', implemented: true,
  name: '疯人院暴食怪',
  text: '不能发动借机攻击；在其猎手关键词移动的同一阶段不能攻击。',
  modifiers: [{ target: 'cannot:opportunityAttack' }],
  enemyScript: {
    onMoved(state, enemy, api) {
      if (state.phase === 'enemy') api.markHunterMoved(enemy)
    },
    attackModifier(state, enemy) {
      if (enemy.hunterMovedRound !== state.round) return null
      return { damage: -enemy.damage, horror: -enemy.horror }
    },
  },
}
