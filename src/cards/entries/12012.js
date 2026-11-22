// 12012 死灵之书（The Necronomicon）· 中立 · 支援/道具/书籍/诅咒 · 奥秘槽 · 弱点。
// （戴克斯特·德雷克签名弱点）
//
// 卡面：
//   显现 - 将死灵之书放置入场，位于你的威胁区域。除非通过以下 [action] 能力，否则它不能离场。
//   你不能打出支援，不能触发你控制的其他支援上的能力。
//   [action]：检定 [willpower](5)。如果你检定成功，弃掉死灵之书。如果你检定失败，
//     将其混洗入你的牌库并受到 1 点恐惧。
//
// 引擎读点（批次 3 · B2 原语落地后）：
//   · 显现：weakness 描述子的 `{ type: 'threat' }`（weakness.js threat 分支进威胁区域）。
//   · 「不能打出支援」：条目级 `threatEffect.cannotPlay: ['asset']`，读点 turn-flow.js#cannotPlayTypes
//     （行动打出 / 效果打出 / 快速事件共用）。
//   · 「不能触发你控制的其他支援上的能力」：条目级 `cannotTriggerOtherAssetAbilities: true`，
//     读点 src/engine/ability-rules.js#descriptorUsable（kind !== forced 且来源是 inv.assets 的支援时，
//     若控制的其他支援声明该字段则拒绝；自身能力不受影响）。
//     **已知限制**：该读点只扫描 `inv.assets`，而本卡真实类别是「威胁区弱点」——揭示后在 inv.threat，
//     因此真实路径下这条声明暂不生效（已在探针输出 GAP 并在报告里说明；需要引擎把扫描范围扩到
//     威胁区卡或改为按控制者全区域统计）。
//   · 「不能离场」：条目级 `cannotLeavePlay: true`，读点 src/engine/harm-threat.js#removeThreat
//     （除 force 外的任何离场路径拒绝）。本卡自身 [action] 的离场属于印刷允许的例外：
//     成功弃掉 / 失败洗回都先经 api.discardSelf(code)（它按「能力来源卡」直接移出威胁区，
//     等价强制移除），再做后续结算。
//   · [action] 检定：api.test('willpower', 5)；成功 api.discardSelf(code)；
//     失败 api.discardSelf → api.moveCard(弃牌堆 → 牌库顶) → api.shuffleDeck → api.directHorror。

const code = '12012'

export default {
  code,
  cannotLeavePlay: true,
  cannotTriggerOtherAssetAbilities: true,
  threatEffect: { cannotPlay: ['asset'] },
  abilities: [
    {
      kind: 'weakness',
      label: '显现：放入你的威胁区域',
      weakness: { type: 'threat' },
    },
    {
      kind: 'action',
      label: '检定 [willpower](5)：成功弃掉死灵之书；失败洗回牌库并受到 1 点恐惧',
      cost: { action: true },
      resolve: ({ inv, api }) => {
        api.test(inv.seat, 'willpower', 5, {
          source: { label: '死灵之书', name: api.cardName(code), code },
          resolve: result => {
            if (result.success) {
              api.discardSelf(code)
              api.info(`「${api.cardName(code)}」被弃掉。`)
              return
            }
            // 失败：本卡自身能力是「不能离场」的强制例外，先强制移出威胁区，再洗回牌库。
            api.discardSelf(code)
            api.moveCard({ code, from: 'discard', to: 'deckTop' }, { seat: inv.seat })
            api.shuffleDeck(inv.seat)
            api.directHorror(inv.seat, 1)
            api.info(`「${api.cardName(code)}」被混洗回牌库，${inv.name} 受到 1 点恐惧。`)
          },
        })
      },
    },
  ],
  modifiers: [],
}
