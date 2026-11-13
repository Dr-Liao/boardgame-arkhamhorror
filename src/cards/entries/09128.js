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
// approximation: 「在手牌中时投入卡图标 -1」没有读点——commitIconBonus 只对**控制中的支援**生效，
//   手牌来源的全局图标削减需要新原语；本卡只实现可打出的部分，见 primitive-request 09128.json。
const code = '09128'

export default {
  code,
  playableWeakness: true,
  weaknessStaysInHand: true,
  weaknessHandNote: '留在手中；仅当它是你唯一的手牌且恰好 1 资源时才能打出。',
  note: 'approximation: 「在手牌中使投入卡图标 -1」缺手牌来源的全局投入图标削减读点，未实现（primitive-request 09128.json）；打出条件与弃掉已实现。',
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
