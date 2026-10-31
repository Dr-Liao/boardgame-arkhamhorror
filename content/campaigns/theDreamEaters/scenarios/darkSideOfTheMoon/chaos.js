// 月之暗面（06206）· 混乱标记的逐章取值与失败后果（参考 DarkSideOfTheMoon.hs:49-173）。
//
// 卡面（en locale tokens）：
//   简单/普通：skull -X（X = 你警报等级的一半，向上取整）；cultist 无修正（再揭示一个标记；失败且警报等级 >
//            修正后技能值时，检定结束后抽遭遇牌库顶）；tablet -1（失败：警报等级 +1）；
//            elder_thing +1（若在躲避检定中成功：对躲过的敌人造成 2 点伤害）。
//   困难/专家：skull -X（X = 你的警报等级）；tablet -2；elder_thing 0。
const ALARM = 'alarmLevel'
const hardSide = state => state?.difficulty === 'hard' || state?.difficulty === 'expert'

export function dsmChaosToken(state, inv, token, api) {
  const hard = hardSide(state)
  const seats = state?.investigatorCounters?.alarmLevel?.seats || []
  const fallbackAlarm = Number(seats[Number(inv?.seat)] || 0)
  const alarm = api?.counters?.get
    ? Math.max(0, Number(api.counters.get(inv?.seat, ALARM)) || 0)
    : Math.max(0, fallbackAlarm)
  switch (token) {
    case 'skull':
      return hard ? -alarm : -Math.ceil(alarm / 2)
    case 'cultist':
      return null // 无修正；后续在 afterTest 结算。
    case 'tablet':
      return hard ? -2 : -1
    case 'elder_thing':
      return hard ? 0 : 1
    default:
      return null
  }
}

export function dsmChaosAfterTest(state, inv, result, api) {
  if (!result || !inv) return
  if (result.dsmChaosHandled) return
  result.dsmChaosHandled = true
  const cancelled = new Set(result.cancelledTokens || [])
  const tokens = (result.drawn || []).filter(token => !cancelled.has(token))
  const has = token => tokens.includes(token)
  const failed = !result.success
  if (failed && has('cultist')) {
    // 失败且警报等级高于修正后的技能值：本次技能检定结束后抽遭遇牌库顶。
    const alarm = Math.max(0, Number(api.counters?.get?.(inv.seat, ALARM)) || 0)
    const modifiedSkill = Number(result.value) || 0
    if (alarm > modifiedSkill) {
      api.drawEncounter?.(inv.seat)
      api.info?.(`🌙 [cultist]：警报等级（${alarm}）高于修正后技能值（${modifiedSkill}），抽取遭遇牌库顶。`)
    }
  }
  if (failed && has('tablet')) {
    api.counters.add(inv.seat, ALARM, 1)
    api.info?.(`🌙 [tablet]：${inv.name} 检定失败，警报等级 +1（当前 ${api.counters.get(inv.seat, ALARM)}）。`)
  }
  if (result.success && has('elder_thing') && result.source?.label === '躲避' && result.source?.enemyId) {
    const enemy = (state.enemies || []).find(candidate => String(candidate.id) === String(result.source.enemyId))
    if (enemy) {
      api.damageEnemy?.(enemy.id, 2, inv.seat, '06206-elderthing')
      api.info?.(`🐈 [elder_thing]：黑猫召唤猫群，对「${enemy.name}」造成 2 点伤害。`)
    }
  }
}
