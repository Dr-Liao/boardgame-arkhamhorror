// 11583 · 养育场（theApiary）单卡条目。
// 归属：关卡专用 · theDrownedCity/theApiary（P7 养育场，参考卡 11553）。
// 规则文本与卡表一致见 src/cards/cards-data.js；逐卡行为读点见 note 与章节 behavior.js。
//
// P7 第四轮：威胁区弱点（寄生变形）用两条既有读点接线：
//   · `threatEffect.discardCost = { action: 2 }` → 引擎 moves.js / actions-extra.js 的「弃掉威胁」行动；
//   · 强制「一名敌人与你交战后：在寄生变形上放置 1 个毁灭标记」→ 引擎既有
//     `scenarioBehavior.enemyEngaged(state, enemy, inv, api)` 钩子（enemies.js#engageEnemy），
//     由章节 behavior.enemyEngaged 在本调查员的威胁区找到寄生变形并放置 1 个毁灭标记
//     （api.placeDoomOnCard）。注意引擎的 enemyEngaged 走 triggerReaction 旧通道，不打开描述子窗口，
//     因此这里不用条目 forced 描述子，而用章节钩子（声明即接线）。
// 显现放入威胁区由《养育场》结局 2 / 无结局的 grantParasiticTransformation / 抽弱点流程处理。
export default {
  code: '11583',
  scope: 'treachery',
  implemented: true,
  flags: { threatArea: true },
  threatEffect: { discardCost: { action: 2 } },
  note: "弱点（×4）：显现放入你的威胁区；强制 - 一名敌人与你交战后：在寄生变形上放置 1 个毁灭标记；[action][action]：弃掉寄生变形。已接线：threatEffect.discardCost = { action: 2 }（引擎既有读点：moves.js / actions-extra.js 的弃掉威胁行动）；强制触发走章节 behavior.enemyEngaged（引擎既有 scenarioBehavior.enemyEngaged 钩子，enemies.js#engageEnemy；该窗口不打开描述子能力窗口）→ api.placeDoomOnCard(本卡, 1)。显现进入威胁区由抽弱点/战役授予流程处理（本条目为弱点数据，不含显现检定）。全部子句已接线。",
}
