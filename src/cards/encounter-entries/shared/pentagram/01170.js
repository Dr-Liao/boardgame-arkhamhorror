// 01170 密会巫师
// 归属：跨战役通用
// 遭遇组：pentagram
// 卡面：生成 - 任意无人地点。
// 卡面：反击。
// 卡面：强制 - 当神话阶段结束时：在密会巫师上放置1个毁灭标记。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 第 7 批：核心遭遇卡在失落时代牌堆里的显现规则（原来写在 TFA encounter-rules.js）。

export default {
  code: '01170', implemented: true, scope: 'enemy', enemyRule: { retaliate: true, spawnAnyEmpty: true, mythosEndDoom: 1 },
  encounterResolveCampaigns: ['tfa'],
  encounterResolve(state, inv, card, api) {
    const code = card.originalCode || card.code
    const active = state.investigators.filter(entry => !entry.defeated && !entry.resigned)
    const empty = state.locations.filter(entry => !active.some(owner => owner.location === entry.id))
    if (!empty.length) { api.drawEncounter(inv.seat); return false }
    const target = empty.length === 1 ? empty[0].id : api.choose({
      kind: 'target', source: code, seat: inv.seat,
      prompt: '密会巫师：选择生成它的无人地点。',
      options: empty.map(entry => ({ id: entry.id, label: entry.name })),
    })
    api.spawn(code, empty.some(entry => entry.id === target) ? target : empty[0].id)
    return false
  },
}
