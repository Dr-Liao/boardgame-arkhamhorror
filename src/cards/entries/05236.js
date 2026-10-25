// 05236 指路鬼魂（幸存者 · 1 经验）
// 卡面：你得到+1[intellect]。
// 卡面：非直接恐惧在分配到你的调查员卡牌之前，必须先分配给指路鬼魂。
// 卡面：强制 - 在指路鬼魂因为恐惧而被击败时：将其放逐。
// 卡面数据：3 神智（盟友）。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 05236 指路鬼魂：+1 智慧；「沉静」（非直接恐惧必须先分给它）；因恐惧被击败时放逐。
//
// 第五轮修复（2026-10-25）：
//   · 「因恐惧被击败时放逐」改由 leavesPlay 钩子按离场时的恐惧值判定：
//     引擎在恐惧/伤害把支援打到上限后先调用 leaveAsset（assets.js:247-288，
//     enemies.js:557-573 / scenario-runtime.js:272-281），钩子拿到的 source 仍带 horror，
//     因此 `source.horror >= 卡面神智(3)` 即「因恐惧被击败」；此时写 removeFromGame + 战役放逐账本
//     state.exiled / state.exiledBySeat（与引擎 exilePlayerCard 同一记账口径）。
//   · 不再使用条目级 removeFromGameOnLeave（那会把「被效果弃掉/槽位移除」等任何离场都移出游戏）。
//   · 残余近似（登记）：引擎 harm-threat.js:146-149 的 composure 会把可分配候选收窄到本支援
//     （其他己方支援也不能先分），卡面只要求先于调查员卡。

export default {
  code: '05236',
  simplified: true,
  note: '「因恐惧被击败时放逐」已改为 leavesPlay 钩子：仅在离场时 horror ≥ 卡面神智(3) 时判为「因恐惧被击败」，'
    + '写 removeFromGame 与 state.exiled/exiledBySeat（不再用 removeFromGameOnLeave 的「任何离场都移出游戏」近似）。'
    + '残余近似：「沉静」的分配由引擎 harm-threat.js:146-149 把候选收窄到本支援（其他己方支援也不能先分），'
    + '卡面只要求先于调查员卡。',
  composure: true,
  modifiers: [
    { target: 'skill:intellect', amount: 1 },
  ],
  abilities: [
    {
      kind: 'leavesPlay',
      label: '因恐惧被击败：将其放逐',
      resolve: ({ state, inv, source, api }) => {
        const sanity = Number(api.cardSanity?.('05236')) || 3
        const horror = Number(source?.horror) || 0
        if (horror < sanity) return
        // 离场时仍在场上实例里读到的恐惧已达神智上限 → 因恐惧被击败。
        if (source) source.removedFromGame = true
        state.removedFromGame ||= []
        if (!state.removedFromGame.includes('05236')) state.removedFromGame.push('05236')
        state.exiled ||= []
        if (!state.exiled.includes('05236')) state.exiled.push('05236')
        state.exiledBySeat ||= []
        state.exiledBySeat.push({ seat: inv.seat, code: '05236' })
        api.info(`${inv.name} 的「指路鬼魂」因恐惧被击败，被放逐（本关结束后从战役牌组移除）。`)
      },
    },
  ],
}
