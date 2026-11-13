// 05032 否决存在
// 卡面：快速。在遭遇卡牌或敌人攻击将要导致你执行以下一项(选择一项)时打出：
//       弃掉手牌、失去资源、失去行动、受到伤害、受到恐惧。你忽略该效果的影响。(所有其他效果如常结算。)
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 实现口径（2026-11-11 修正）：
//   · 单一「快速事件统一通道」描述子（reaction + fromHand + quickEvent），一次覆盖四个窗口：
//       harmDealt（受到伤害/恐惧）、wouldDiscardFromHand、wouldLoseResources、wouldLoseActions。
//     旧实现把伤害/恐惧写成 played+fast、另三个窗口写成 reaction+fromHand，两条通道并存：
//     harmDealt 能问、其余三个窗口的可达性依赖能力窗口，且和「每张卡只有一个快速事件视图」
//     （quickEventView）的约定冲突。
//   · 伤害/恐惧是**两个独立面向**：卡面「选择一项……忽略该效果」只能整体忽略其中一项
//     （2 伤害 + 2 恐惧 → 「忽略 2 点伤害」/「忽略 2 点恐惧」），不能自由拆分点数——
//     自由拆点是「我见过更糟的／吉人天相」的“最多 N 点”口径，已由 cancelHarm 的 maximum 分支保留。
//   · 来源限定「遭遇卡或敌人攻击」：规则书 FAQ 把幕/密谋/地点/敌人/诡计/弱点/场景卡都算遭遇卡，
//     引擎在窗口 context.source.kind 上统一标注（src/engine/reaction-source.js），这里只读字段。
import { denyExistenceCandidate, ignoreWouldEffect } from './_shared.js'

export default {
  code: '05032',
  abilities: [
    {
      kind: 'reaction',
      fromHand: true,
      quickEvent: true,
      trigger: ['harmDealt', 'wouldDiscardFromHand', 'wouldLoseResources', 'wouldLoseActions'],
      label: '否决存在：忽略这次遭遇/攻击造成的伤害、恐惧、弃手牌、失资源或失行动',
      criteria: [denyExistenceCandidate],
      resolve: ({ inv, api, context }) => {
        if (context?.when === 'harmDealt') {
          // 整体忽略伤害或恐惧中的一项（只有一项时直接结算，不额外询问）。
          api.cancelHarm(inv.seat, {
            whole: true,
            source: '05032',
            prompt: '「否决存在」：选择要忽略的那一项效果。',
          })
          return
        }
        ignoreWouldEffect({ inv, api, context })
      },
    },
  ],
  modifiers: [

  ],
}
