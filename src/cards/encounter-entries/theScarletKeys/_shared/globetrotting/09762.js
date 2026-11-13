// 09762 福林探员（Inspector Flint）· 剧情支援（盟友）· globetrotting
// 卡面：[reaction] 在你揭露诱饵时，横置福林探员：取消揭露该诱饵，将其翻至正面朝下，
//   并抽取 1 张卡牌或选择揭露该地点另一张隐匿迷你卡牌。
// 读点：reaction 挂在 tskExposed 窗口（P4 注册的揭露后时机）；cost.exhaust 由 executeDescriptor 支付；
//   抽牌走 api.drawCards。
// 近似：揭露在引擎里是「翻面并取出」，没有回滚读点 → 只能领取「抽 1 张」分支，
//   「取消揭露 / 翻回背面 / 改揭另一张」需要 interrupt 窗口与放回原位的原语（primitive-requests/09762.json）。
const CODE = '09762'

export default {
  code: CODE,
  scope: 'storyAsset',
  implemented: true,
  flags: { ally: true, agency: true, detective: true },
  abilities: [{
    kind: 'reaction',
    trigger: 'tskExposed',
    label: '你揭露诱饵时，横置福林探员：抽 1 张卡牌（取消揭露见 primitive-requests）',
    cost: { exhaust: true },
    criteria: ({ inv, context }) => context?.decoy === true && context?.seat === inv.seat,
    resolve: ({ inv, api }) => {
      api.drawCards(inv.seat, 1)
      api.info?.('「福林探员」：诱饵被揭露，横置并抽 1 张卡牌（取消揭露部分尚未接线）。')
      return true
    },
  }],
  note: 'approximation: 只实现「抽 1 张」分支；取消揭露、翻回背面、改揭另一张需要 tskExposed 的'
    + 'interrupt 版本与迷你卡放回原位的原语（primitive-requests/09762.json）。',
}
