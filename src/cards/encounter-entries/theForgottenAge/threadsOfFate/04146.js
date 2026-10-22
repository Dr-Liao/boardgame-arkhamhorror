// 04146 鲜血阴谋
// 归属：关卡专用 · threadsOfFate（失落的时代 · 命运之线）
// 遭遇组：threads_of_fate
// 卡面：显现 - 将鲜血阴谋附属到当前密谋。
// 卡面：被附属的密谋得到-1毁灭阈值。
// 卡面：每个[[异教徒]]敌人获得：“[action]：谈判。检定[willpower](4)。如果你检定成功，从场上弃掉1张鲜血阴谋。如果你检定失败，在本敌人上放置1个毁灭标记。”
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '04146', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['tfa'],
  encounterResolve(state, inv, card, api) {
    const agenda = state.agendas?.[state.agendaIndex]
    if (!agenda) return false
    agenda.doomThreshold = Math.max(1, (agenda.doomThreshold || 0) - 1)
    agenda.attachments ||= []
    agenda.attachments.push({ id: `conspiracy:${state.round}`, code: '04146', originalCode: '04146' })
    api.info?.('「鲜血阴谋」附属到当前密谋：毁灭阈值 -1。')
    return true
  },
}
