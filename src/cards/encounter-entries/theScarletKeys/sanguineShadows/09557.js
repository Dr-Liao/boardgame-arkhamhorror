// 09557 红衣女郎（La Chica Roja · The Girl in the Carmine Coat）· enemy
//
// 归属：关卡专用 · theScarletKeys/sanguineShadows（P7）。
// 卡面：
//   隐匿 5。
//   强制 - 与红衣女郎交战的调查员在移动时：她与该调查员解除交战。
//   （另一面 09557b 是剧情支援面，另有条目。）
//
// 逐卡规则用 `src/cards/card-rules.js` 的读点读取（enemyRule / enemyScript），
// 章节 behavior 只做分派：`concealedAmountOf()` 读 `enemyRule.concealed` 结算隐匿迷你卡，
// `locationEntered()` 读 `enemyScript.onEngagedInvestigatorMoved` 结算移动时解除交战。
export default {
  code: '09557',
  scope: 'enemy',
  implemented: true,
  enemyRule: { concealed: 5 },
  enemyScript: {
    // 引擎在调查员移动时把「移动前的交战名单」传进 locationEntered；命中本敌人即解除交战。
    onEngagedInvestigatorMoved(state, inv, enemy, api) {
      if (!api?.disengage?.(enemy)) return false
      api?.info?.(`💨 ${inv?.name || '调查员'} 移动：红衣女郎与其解除交战。`)
      return true
    },
  },
  note: '隐匿 5 = 5 张诱饵 + 真身迷你卡（参考实现 gatherConcealedCards：card : replicate 5 Decoy）。真身被揭露时她在该地点入场，与任何调查员都不交战。',
}
