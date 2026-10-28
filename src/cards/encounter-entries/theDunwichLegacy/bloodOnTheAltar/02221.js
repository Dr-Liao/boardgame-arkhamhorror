// 02221 灵魂之歌
// 归属：关卡专用 · bloodOnTheAltar（血色祭坛）
// 遭遇组：blood_on_the_altar
// 卡面：涌动。险境。
// 卡面：显现 - 将灵魂之歌加入到任意调查员的威胁区域。
// 卡面：强制 - 在你将要受到伤害时：受到额外2点伤害并弃掉灵魂之歌。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '02221', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['dunwich'],
  // 卡面强制「当你将受到伤害时：额外受到 2 点伤害并弃掉本卡」：数据化声明，
  // 读点是 enemies.js 的 applyHarm（威胁区 harmInterceptor），不再用没人读的 treacheryRule.song。
  harmInterceptor: { trigger: 'damage', extra: 2, discard: true },
  encounterResolve(state, inv, card, api) {
    const code = card.originalCode || card.code
    const candidates = state.investigators.filter(target => !target.defeated && !target.resigned)
    const seat = candidates.length === 1 ? String(candidates[0].seat) : api.choose({
      kind: 'investigator', source: code, seat: inv.seat, prompt: '选择承受灵魂之歌的调查员。',
      options: candidates.map(target => ({ id: String(target.seat), label: target.name })),
    })
    const chosen = candidates.find(target => String(target.seat) === seat)
    if (!chosen) throw new Error('必须选择一名调查员')
    api.threat(chosen.seat, code)
    api.drawEncounter(inv.seat)
    return { placed: true, surgeHandled: true }
  },
}
