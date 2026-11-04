// 07297 玄密仪式 · 达贡巢穴
//
// 印刷（中文）：
//   显现 - 检定[意志](4)。如果你检定失败，选择并弃掉你 2 张手牌，或弃掉一个你控制的支援
//   （如果本次检定期间揭示了[诅咒]标记，改为两者都执行）。
//
// 引擎读点：
//   · 本章遭遇卡由 content/.../card-data.js 打上 entryRevelation，显现时
//     treachery-tokens.js#resolveTreacheryBody 调用本条的 encounterResolve(state, inv, t, api)
//     （与 04091 / 05145 / 07296 同一入口）。
//   · 检定走 api.test(seat, skill, difficulty, resolve)（scenario-runtime 的剧本检定入口）；
//     回调参数是标准检定结果契约（test-result.js），result.drawn 是本次揭示的标记数组，
//     用 includes('curse') 判定诅咒标记（与 07296 同口径）。
//   · 「弃 2 张手牌」走 api.discardChosen（逐张询问，内部按 canDiscardFromHand 过滤隐私牌）；
//     「弃一个你控制的支援」走 api.canDiscardAsset / api.discardAsset + api.choose 选目标，
//     与 01167 地窖寒风的失败分支同口径。
//   · 分支数量与参考实现一致（chooseNM）：揭示了诅咒标记时两个分支都执行；否则只执行
//     玩选择的一个分支；仅一个分支可执行时直接执行它。
//   · 返回 false = 结算完由引擎按默认去向放进遭遇弃牌堆（与 04091 / 07296 一致）。
//
// 一卡一文件：本卡行为只在这里维护；不要写回 encounter-abilities.js。

export default {
  code: '07297', scope: 'treachery', implemented: true,
  encounterResolve(state, inv, card, api) {
    api.test(inv.seat, 'willpower', 4, result => {
      if (result.success) return
      const curseRevealed = (result.drawn || []).includes('curse')
      const discardableAssets = (inv.assets || []).filter(asset => api.canDiscardAsset(inv.seat, asset.id))
      const branches = []
      if ((inv.hand || []).length > 0) branches.push({ id: 'hand', label: '弃掉你的2张手牌' })
      if (discardableAssets.length > 0) branches.push({ id: 'asset', label: '弃掉一个你控制的支援' })
      if (!branches.length) return
      const discardAsset = () => {
        const id = discardableAssets.length === 1 ? discardableAssets[0].id : api.choose({
          kind: 'asset', source: '07297', seat: inv.seat,
          prompt: '玄密仪式：选择并弃掉一个你控制的支援。',
          options: discardableAssets.map(asset => ({ id: asset.id, label: asset.name || asset.code })),
        })
        const asset = discardableAssets.find(item => item.id === id) || discardableAssets[0]
        api.discardAsset(inv.seat, asset.id)
      }
      const run = branch => {
        if (branch === 'hand') api.discardChosen(inv.seat, 2, '07297')
        else discardAsset()
      }
      const chosen = curseRevealed || branches.length === 1
        ? branches.map(branch => branch.id)
        : [api.choose({
            kind: 'effect', source: '07297', seat: inv.seat,
            prompt: '玄密仪式：弃掉你的2张手牌，或弃掉一个你控制的支援。',
            options: branches,
          })]
      for (const branch of chosen) run(branch)
    })
    return false
  },
}
