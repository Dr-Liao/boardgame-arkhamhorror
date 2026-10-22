// 03164 真正可怕的人(版本一)
// 归属：关卡专用 · theUnspeakableOath（卡尔克萨之路 · 邪秽誓约）
// 遭遇组：the_unspeakable_oath
// 卡面：忽略阿卡姆疯人院地点未揭示面上的文字。
// 卡面：目标 - 找到关着丹尼尔·契斯特菲尔德的病人拘禁室地点。(要推进场景时，你会收到指示)。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '03164', scope: 'act',
  actRule: {
    onReveal(state, act, api) {
      const atCell = state.investigators.filter(inv => !inv.defeated && !inv.resigned && inv.location === 'danielsCell')
      const seat = atCell.length === 1 ? atCell[0].seat : Number(api.choose({
        kind: 'storyAsset', source: '03182a', seat: state.campaign.leadSeat,
        prompt: '选择一位位于丹尼尔牢房的调查员控制丹尼尔。',
        options: atCell.map(inv => ({ id: String(inv.seat), label: inv.name })),
      }))
      api.giveAsset(seat, '03182a')
      state.encounterDeck.push(...state.scenarioZones.underAct.splice(0))
      api.shuffleDiscard()
    },
  },
}
