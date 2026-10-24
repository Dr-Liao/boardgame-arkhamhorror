// 04313 改变命运
// 卡面：快速。在任意[free]玩家时间段期间打出。
// 卡面：选择并弃掉场上一张没有附属到[[精英]]敌人上的非弱点诡计卡牌。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 04313 改变命运：快速事件；弃掉场上（威胁区 / 地点 / 敌人等宿主附属）一张
// 非弱点、且没有附属在[[精英]]敌人上的诡计。

export default {
  code: '04313',
  abilities: [
    {
      kind: 'played', fast: true, label: '改变命运',
      resolve: ({ state, inv, api }) => {
        const hostLabel = entry => {
          if (entry.hostType === 'investigator') return entry.host?.name || '调查员'
          if (entry.hostType === 'location') return entry.host?.name || '地点'
          if (entry.hostType === 'enemy') return entry.host?.name || '敌人'
          return entry.hostType === 'agenda' ? '密谋' : '冒险'
        }
        const cards = api.cardsInPlayTreacheries()
          .filter(entry => api.isNonWeakness(entry.code)
            && !(entry.hostType === 'enemy' && entry.host?.elite))
        if (!cards.length) { api.info('场上没有可弃掉的诡计。'); return }
        const chosen = cards.length === 1 ? cards[0].attachment.id
          : api.choice({ kind: 'target', source: '04313', seat: inv.seat, prompt: '选择要弃掉的诡计。',
            options: cards.map(entry => ({ id: entry.attachment.id,
              label: `${api.cardName(entry.code)}（${hostLabel(entry)}）` })) })
        const entry = cards.find(item => item.attachment.id === chosen) || cards[0]
        if (!api.discardCardInPlay(entry)) { api.info('这张诡计已经不在场上了。'); return }
        api.info(`「${api.cardName(entry.code)}」被「改变命运」弃掉。`)
      },
    },
  ],
  modifiers: [

  ],
}
