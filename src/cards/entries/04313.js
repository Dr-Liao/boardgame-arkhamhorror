// 04313 改变命运
// 卡面：快速。在任意[free]玩家时间段期间打出。
// 卡面：选择并弃掉场上一张没有附属到[[精英]]敌人上的非弱点诡计卡牌。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 04313 改变命运：快速事件；弃掉一名调查员威胁区里的一张非弱点、未附属精英的诡计。

export default {
  code: '04313',
  abilities: [
    {
      kind: 'played', fast: true, label: '改变命运',
      resolve: ({ state, inv, api }) => {
        const threats = state.investigators.flatMap(owner => owner.threat.map(card => ({ owner, card })))
          .filter(({ card }) => api.isNonWeakness(card.code) && !card.attachedElite)
        if (!threats.length) { api.info('场上没有可弃掉的诡计。'); return }
        const chosen = threats.length === 1 ? threats[0].card.id
          : api.choice({ kind: 'target', source: '04313', seat: inv.seat, prompt: '选择要弃掉的诡计。',
            options: threats.map(({ owner, card }) => ({ id: card.id, label: `${api.cardName(card.code)}（${owner.name}）` })) })
        const entry = threats.find(({ card }) => card.id === chosen) || threats[0]
        api.removeThreat(entry.card)
        api.info(`「${api.cardName(entry.card.code)}」被「改变命运」弃掉。`)
      },
    },
  ],
  modifiers: [

  ],
}
