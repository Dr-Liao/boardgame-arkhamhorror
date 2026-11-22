// 60264 精神分析（Psychoanalysis）
// 卡面：选择你所在地点的一位调查员并揭示其牌库顶 3 张。该调查员可以抽取 1 张揭示的卡并混洗其余入牌库，
// 或治愈 2 点恐惧并把揭示的卡以任意顺序放回其牌库顶。
// 读点：api.lookAt（看牌唯一读点，targetSeat/arrange/returnStrategy）+ api.healHorror。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

const CODE = '60264'

export default {
  code: CODE,
  abilities: [{
    kind: 'played',
    label: '选择调查员：看牌库顶 3 张，抽 1 洗回其余，或治愈 2 恐惧并放回',
    resolve: ({ state, inv, api }) => {
      const targets = state.investigators.filter(owner => !owner.defeated && !owner.resigned
        && owner.location === inv.location)
      if (!targets.length) return
      const id = targets.length === 1 ? String(targets[0].seat) : api.choice({
        kind: 'investigator', source: CODE, seat: inv.seat, prompt: '选择要分析的调查员。',
        options: targets.map(owner => ({ id: String(owner.seat), label: owner.name })),
      })
      const target = targets.find(owner => String(owner.seat) === String(id)) || targets[0]
      const mode = api.choice({
        kind: 'choice', source: CODE, seat: inv.seat,
        prompt: '选择精神分析的处理方式。',
        options: [
          { id: 'draw', label: '揭示牌库顶 3 张：抽取 1 张，其余混洗回牌库' },
          { id: 'heal', label: '治愈 2 点恐惧，并把揭示的卡以任意顺序放回牌库顶' },
        ],
      })
      if (mode === 'heal') {
        api.healHorror(target.seat, 2)
        api.lookAt(inv.seat, {
          zone: 'investigatorDeck', targetSeat: target.seat, count: 3, choose: 0,
          arrange: true, returnStrategy: 'top', source: CODE,
          prompt: '把牌库顶 3 张按任意顺序放回牌库顶。',
        })
        return
      }
      api.lookAt(inv.seat, {
        zone: 'investigatorDeck', targetSeat: target.seat, count: 3, choose: 1,
        returnStrategy: 'shuffle', source: CODE,
        prompt: '揭示牌库顶 3 张，选择 1 张抽取；其余混洗回牌库。',
      })
    },
  }],
  modifiers: [],
}
