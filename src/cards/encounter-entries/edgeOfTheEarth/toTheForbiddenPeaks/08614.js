// 08614 绿皂石（Green Soapstone）· storyAsset
//
// 归属：关卡专用 · edgeOfTheEarth/toTheForbiddenPeaks（P7）。
// 卡面：
//   使用(4充能)。
//   [reaction]在你执行一次成功的攻击时，花费1充能并横置绿皂石：这次攻击造成+1伤害。
//
// 读点：testInitiated 窗口（src/engine/windows.js）只在攻击检定发起时枚举受控支援的反应；
// 成功追加 1 点伤害走 api.addExtraOnSuccess（state.skillTest.extraOnSuccess，引擎统一结算）。
// approximation: 印刷是「攻击成功后」强化本次攻击伤害；引擎的攻击伤害已在检定发起时算定，
//   因此以「本次攻击成功后对交战敌人追加 1 点伤害」结算（与 08086 迈克尔·李同一近似口径）。
export default {
  code: '08614',
  scope: 'storyAsset',
  implemented: true,
  uses: 4,
  usesType: 'charges',
  flags: { expedition: true },
  abilities: [{
    kind: 'reaction',
    trigger: 'testInitiated',
    label: '成功攻击时花费 1 充能并横置：本次攻击造成 +1 伤害',
    cost: { action: false, exhaust: true, uses: 1 },
    criteria: ({ source, state, context }) => Boolean(source)
      && (context?.actionKind === 'fight' || state.skillTest?.actionKind === 'fight'
        || state.skillTest?.basicAction === 'fight'),
    resolve: ({ api }) => {
      api.addExtraOnSuccess({ type: 'dealDamage', amount: 1, target: 'engaged' })
      api.info('💎 绿皂石：本次攻击额外造成 1 点伤害。')
    },
  }],
}
