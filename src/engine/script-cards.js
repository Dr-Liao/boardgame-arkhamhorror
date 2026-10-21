// 剧本卡行动归属：幕／议程卡面上的 [action] / [free] 能力必须能在剧本书对应卡片旁执行。
// 声明放在关卡数据的 scenario.scriptCards 里，引擎不认场景 id：
//
//   scriptCards: {
//     explore: { card: 'agenda' },                        // 引擎自带的探索归当前密谋
//     // 或 explore: { card: 'act', codes: [当前幕的卡号] } —— 只有这些幕印着探索
//     rules: { resignAgenda: 'agenda', repossessionDraw: 'act' }
//   }
//
// `explore` 只描述引擎自带的探索行动；`rules` 按 scenarioAction / encounterAction 的
// rule 匹配。地点、敌人、剧情支援赋予的行动不要写进这里——它们用 locationId/enemyId
// 表达归属，标成幕／密谋会让按钮跑到错误的位置。返回 null 表示这个行动不属于剧本卡。

const cardCode = card => card?.originalCode || card?.code || null

function currentCard(state, kind) {
  return kind === 'act'
    ? state.acts?.[state.actIndex]
    : kind === 'agenda' ? state.agendas?.[state.agendaIndex] : null
}

export function scriptCardOwner(state, move) {
  const declared = state.scenario?.scriptCards
  if (!declared || !move) return null
  if (move.action === 'explore') {
    const owner = declared.explore
    if (!owner || !['act', 'agenda'].includes(owner.card)) return null
    const card = currentCard(state, owner.card)
    if (!card) return null
    if (owner.codes && !owner.codes.includes(cardCode(card))) return null
    return owner.card
  }
  if (move.rule && declared.rules) {
    const owner = declared.rules[move.rule]
    if (!owner) return null
    // rules 可写成 'act' / 'agenda'，也可写成 { card, codes } 限定只在某几张
    // 当前剧本卡印着该行动时归属；当前卡不在 codes 里就回退到普通动作栏。
    const card = typeof owner === 'string' ? owner : owner.card
    if (!['act', 'agenda'].includes(card)) return null
    if (typeof owner === 'object' && owner.codes) {
      const current = currentCard(state, card)
      if (!current || !owner.codes.includes(cardCode(current))) return null
    }
    return card
  }
  return null
}
