// 05089 魔鬼的笛声
// 归属：战役共用 · theCircleUndone；遭遇组：agents_of_azathoth
// 卡面：涌动。
// 卡面：显现 - 如果阿撒托斯的吹笛手在场，对其所在地点和每个连接地点的每位调查员造成 1 点恐惧。
//   否则，将魔鬼的笛声放置入场，放在密谋牌库旁边。
// 卡面：如果场上有 3 张魔鬼的笛声，弃掉这 3 张卡牌，阿撒托斯的吹笛手生成与其猎物交战
//   （从场外的任意区域生成）。
//
// 「放在密谋牌库旁边」用纯 JSON 的 state.scenarioZones.agendaAside = [{ id, code }] 表示
// （见 encounter-rules.js 的同名共享区注释）；3 张的计数也读同一份数据。
// 猎物「剩余神智值最低的调查员」：走引擎 scenario-runtime 的 api.preyTarget（card-ops.PREY_RANK
// 的 lowestSanity = getMaxSanity − 恐惧，含支援/威胁等神智修正，并列时由队长选择）。
// 旧实现读印刷神智 inv.sanity，会忽略神智修正；单测桩没有 preyTarget 时保留一个纯印刷值兜底。

import { activeInvestigators, originalOf } from '../../../_shared.js'

const PIPER = '05088'

// 兜底：单测桩/旧接口没有 api.preyTarget 时，按印刷神智 − 恐惧选最低（运行时不会走到这里）。
function printedLowestRemainingSanity(investigators) {
  if (!investigators.length) return null
  const remaining = inv => (Number(inv.sanity) || 0) - (Number(inv.horror) || 0)
  return investigators.reduce((best, inv) => (remaining(inv) < remaining(best) ? inv : best))
}

function lowestRemainingSanityPrey(state, api) {
  const candidates = activeInvestigators(state)
  if (!candidates.length) return null
  const seat = api?.preyTarget?.({ prey: 'lowestSanity' }, candidates.map(one => one.seat))
  if (Number.isInteger(seat)) {
    return (state.investigators || []).find(one => one.seat === seat) || null
  }
  return printedLowestRemainingSanity(candidates)
}

export default {
  code: '05089',
  scope: 'treachery',
  implemented: true,
  // 涌动由 definition.js 的印刷文本解析器给出（英文卡面 Surge.），这里再显式声明一次防御。
  treacheryRule: { surge: true },
  encounterResolve(state, inv, card, api) {
    const piper = (state.enemies || []).find(enemy => originalOf(enemy) === PIPER)
    if (piper) {
      const piperLocation = (state.locations || []).find(entry => entry.id === piper.location)
      const horrorLocations = new Set([piper.location, ...(piperLocation?.connections || [])])
      for (const target of activeInvestigators(state).filter(one => horrorLocations.has(one.location))) {
        api.horror(target.seat, 1)
      }
      api.info?.('魔鬼的笛声：阿撒托斯的吹笛手在场，其所在地点与连接地点的调查员各受到 1 点恐惧。')
      return false // 进遭遇弃牌堆
    }
    const zones = (state.scenarioZones ||= {})
    const aside = (zones.agendaAside ||= [])
    const entry = { id: `${'05089'}:${state.round}:${aside.length}`, code: '05089' }
    aside.push(entry)
    api.info?.('「魔鬼的笛声」被放到密谋牌库旁边。')
    const copies = aside.filter(item => item.code === '05089')
    if (copies.length < 3) return true // 已放置入场（牌库旁），不进弃牌堆
    // 3 张齐了：弃掉这 3 张，吹笛手与猎物交战生成（从场外任意区域）。
    zones.agendaAside = aside.filter(item => item.code !== '05089')
    state.encounterDiscard.push('05089', '05089', '05089')
    const prey = lowestRemainingSanityPrey(state, api)
    if (!prey) {
      api.info?.('没有可成为猎物的调查员，阿撒托斯的吹笛手无法生成。')
      return true
    }
    // 从场外任意区域生成：把它从牌库/弃牌堆/放在一边区移出。
    for (const pile of [state.encounterDeck, state.encounterDiscard]) {
      const index = pile.lastIndexOf(PIPER)
      if (index >= 0) pile.splice(index, 1)
    }
    const setAside = state.scenarioZones?.setAside
    if (Array.isArray(setAside)) state.scenarioZones.setAside = setAside.filter(code => code !== PIPER)
    const spawned = api.spawnEngaged?.(PIPER, prey.location, prey.seat)
    if (spawned) spawned.preySeat = prey.seat // 参考实现：与「剩余神智最低者」交战并以其为猎物。
    api.info?.('三张「魔鬼的笛声」被弃掉：阿撒托斯的吹笛手从场外生成，与其猎物交战！')
    if (!spawned) api.info?.('没有合法生成地点，阿撒托斯的吹笛手无法生成。')
    return true
  },
}
