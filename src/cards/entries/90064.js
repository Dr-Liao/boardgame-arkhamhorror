// 90064 被埋葬的秘密（Buried Secrets · Advanced）· 中立 · 诡计/弱点 · 蒙特雷专属弱点。
//
// 卡面（cards-data 90064）：
//   Advanced.
//   Revelation - Put Buried Secrets into play in your threat area.
//   If your location can be investigated, you cannot move except by scenario card effects.
//   [action] [action]: Investigate. If you succeed, instead of discovering clues, discard Buried Secrets.
//
// 引擎读点（与基础版 08009 同族的读点）：
//   · 显现入场：弱点档案 `{ type: 'threat' }`（weakness.js 威胁分支）。
//   · 移动锁：条目级 `threatEffect.blocksMovementWhileInvestigable`（hidden-rules.js#movementError
//     唯一读点；剧本卡效果例外由 movementError 的 byScenarioEffect 放行）。
//   · 调查（成功不发现线索、改为弃掉）：`api.investigate(seat, { noClueDiscovery: true })` +
//     `api.removeThreat(source)`（与 08009 相同管线）。
//   · 代价 [action][action]：描述子 `cost: { action: 2 }` 引擎只扣 1 个行动（ability-exec.js
//     对 cost.action 的布尔判断）；本条目用 `cost:{action:true}` + `criteria` 要求行动点 ≥2，
//     结算时 `api.loseActions(seat, 1)` 补扣第二个行动（近似，见 note）。
//     已在 primitive-requests/core-inv-90064-multi-action-cost.json 请求真正的「多行动费用」。

const code = '90064'

export default {
  code,
  threatEffect: { blocksMovementWhileInvestigable: true },
  abilities: [
    { kind: 'weakness', label: '被埋葬的秘密（进阶）', weakness: { type: 'threat' } },
    {
      kind: 'action',
      label: '调查（花 2 个行动；成功则弃掉本卡）',
      cost: { action: true },
      criteria: [({ inv }) => (inv.actionsLeft || 0) >= 2],
      resolve: ({ inv, source, api }) => {
        const result = api.investigate(inv.seat, { noClueDiscovery: true })
        if (!result) return
        api.loseActions(inv.seat, 1)
        if (result.success) api.removeThreat(source)
      },
    },
  ],
  modifiers: [],
  note: '近似：多行动费用用「criteria 要求 ≥2 行动 + 结算后 loseActions 1」实现（primitive-requests/core-inv-90064-multi-action-cost.json）；失败不保留额外选项（进阶版卡面无失败条款，已与卡面一致）。',
}
