// 09589 虚空幽光（Light Out of Void）· 诡计 · dealings_in_the_dark
// 卡面：险境。
//   显现 - 你必须（选择一项）：
//     · 在场上躲避值最高的[[异教徒]]敌人上放置 1 个毁灭标记。
//     · 受到 1 点伤害和 1 点恐惧。
//   如果调查员共同拥有的线索多于教派，或如果是场景 3，再一次结算该显现能力。
// 读点：
//   · 显现入口 = 条目的 `encounterResolve`（第 4 参是场景运行时窄接口）。
//   · 教派线索总数 = api.resolveScenarioEvent('dealingsCultClues')（本章唯一口径：
//     场上异教徒线索 + 彰显的线索）。
//   · 场景 3 = 幕牌库走完（本章「追逐」同时充当最终幕）；条目只读 state.acts / agenda.chapterFlow。
//   · 险境（Peril）由定义表的 treachery 字段 `peril` 解析（card-data 读取卡文 `Peril.`）。
const CODE = '09589'

const cultists = state => (state.enemies || []).filter(enemy => enemy
  && !enemy.defeated && !enemy.removedFromGame
  && (enemy.traits || []).some(trait => String(trait).toLowerCase() === 'cultist'))

/** 场景 3：当前密谋是「追逐」，或幕指针已越过最后一张幕。 */
function isActThree(state) {
  const agenda = state.agendas?.[state.agendaIndex]
  if (agenda?.chapterFlow === 'theChase') return true
  const acts = state.acts || []
  return acts.length > 0 && Number(state.actIndex) >= acts.length
}

export default {
  code: CODE,
  scope: 'treachery',
  implemented: true,
  encounterResolve(state, inv, card, api) {
    const resolveOnce = () => {
      const candidates = cultists(state)
      const highest = candidates.reduce((best, enemy) =>
        (Number(enemy.evade) || 0) > (Number(best?.evade) || 0) ? enemy : best, null)
      const options = []
      if (highest) options.push({ id: 'doom', label: `在躲避值最高的[[异教徒]]「${highest.name}」上放 1 毁灭` })
      options.push({ id: 'harm', label: '受到 1 点伤害和 1 点恐惧' })
      const answer = options.length === 1 ? 'harm' : api.choice({
        kind: 'story', source: CODE, seat: inv.seat, prompt: '虚空幽光：选择一项。', options,
      })
      if (answer === 'doom' && highest) {
        api.doomOn(highest, 1)
        api.info?.(`🌑 「虚空幽光」：在「${highest.name}」上放 1 个毁灭。`)
        return
      }
      api.damage(inv.seat, 1)
      api.horror(inv.seat, 1)
      api.info?.(`💥 「虚空幽光」：${state.investigators[inv.seat]?.name || '调查员'} 受到 1 点伤害和 1 点恐惧。`)
    }
    resolveOnce()
    const cultClues = Number(api.resolveScenarioEvent('dealingsCultClues')) || 0
    const playerClues = (state.investigators || []).reduce((sum, who) => sum + (Number(who?.clues) || 0), 0)
    if (isActThree(state) || playerClues > cultClues) {
      api.info?.('「虚空幽光」：调查员线索多于教派（或场景 3），再次结算显现能力。')
      resolveOnce()
    }
    return { resolved: true }
  },
}
