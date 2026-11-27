// 09128 准备不足（Underprepared）· 基础弱点 · 事件
// 卡面：[survivor] 调查员专用。
//       仅当准备不足是你唯一的手牌，且你资源池中正好只有 1 资源，才能打出准备不足。
//       准备不足在你手牌中时，你投入到技能检定的每张卡牌视为少 1 个对应的技能图标。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点：
//   · 抽到后留在手中：条目级 weaknessStaysInHand（deck-ops.js 弱点结算分支的唯一读点）——
//     没有 Revelation 的事件弱点抽到后不能进弃牌堆或触发未实现分支；
//   · 打出以弃掉：playableWeakness（弱点可打出的唯一许可）+ played 描述子；
//   · 打出条件：playCondition 读手牌（唯一手牌且就是本卡）与资源恰好 1。
const code = '09128'

export default {
  code,
  playableWeakness: true,
  weaknessStaysInHand: true,
  weaknessHandNote: '留在手中；仅当它是你唯一的手牌且恰好 1 资源时才能打出。',
  handCommitIconReduction: 1,
  playCondition: [
    {
      when: ({ inv }) => (inv.hand || []).length === 1 && inv.hand[0] === code && (inv.resources || 0) === 1,
      message: '「准备不足」只能在你只有这一张手牌且恰好 1 资源时打出',
    },
  ],
  abilities: [
    {
      kind: 'played',
      label: '弃掉准备不足',
      resolve: ({ inv, api }) => {
        api.info(`😵 「准备不足」：${inv.name} 在弹尽粮绝时打出了它。`)
      },
    },
  ],
  modifiers: [],
}
