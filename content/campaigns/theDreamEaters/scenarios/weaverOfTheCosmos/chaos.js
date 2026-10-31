// 《编织宇宙》（Weaver of the Cosmos，06333）· 混乱标记取值与后果
//
// 参考 WeaverOfTheCosmos.hs:51-60 / 172-195 与 en locale 的 tokens 表（cards-data 06333 卡面）。
// `behavior.resolveChaosToken` 只算数值；失败/成功的额外效果放在 `afterTest`（引擎会分别在
// 自动失败与正常路径各调一次，本文件按 result 幂等）。
//
// 口径（标准/困难两档）：
//   [skull]     -X：标准 = 场上单个地点最高毁灭；困难 = 场上地点毁灭总数。
//   [cultist]    0：再揭示一个标记；失败且所在地点有[[古神]]敌人 → 其攻击你。
//   [tablet]     标准 0 / 困难 -1；成功且超过难度 2 点 → 移除所在地点 1 毁灭。
//   [elderthing] 标准 -3 / 困难 -4；失败且本次为对[[蜘蛛]]敌人的攻击 → 该敌人地点 +1 毁灭。
import { hasTrait } from '../../encounter-rules.js'

const isHard = state => ['hard', 'expert'].includes(state?.difficulty)

function tokensOf(result) {
  const cancelled = new Set(result?.cancelledTokens || [])
  return (result?.drawn || []).filter(token => !cancelled.has(token))
}

export function locationDoomTotal(state) {
  return (state?.locations || []).reduce((sum, location) => sum + (Number(location.doom) || 0), 0)
}

export function highestLocationDoom(state) {
  return (state?.locations || []).reduce((max, location) => Math.max(max, Number(location.doom) || 0), 0)
}

// `api.resolveChaosToken` 的返回：number = 用它作为本次检定的标记修正；null = 用默认表。
export function weaverChaosToken(state, inv, token, api) {
  const hard = isHard(state)
  if (token === 'skull') {
    const doom = hard ? locationDoomTotal(state) : highestLocationDoom(state)
    return doom > 0 ? -doom : 0
  }
  if (token === 'cultist') return 0
  if (token === 'tablet') return hard ? -1 : 0
  if (token === 'elderthing') return hard ? -4 : -3
  return api?.resolveChaosTokenDefault ? null : null
}

// 检定后的额外结算。幂等：同一 result 只会携带同一组标记；对自动失败与正常路径各调一次也安全，
// 因为「攻击[[蜘蛛]]敌人」的判定只在失败且本次来源是攻击时成立（自动失败通常是检定前的失败路径）。
export function weaverChaosAfterTest(state, inv, result, api) {
  if (!result || !inv) return
  // 引擎会在「自动失败」与「正常路径」各调一次 afterTest；同一 result 对象只结算一次。
  if (result.__weaverChaosResolved) return
  result.__weaverChaosResolved = true
  const tokens = tokensOf(result)
  const has = token => tokens.includes(token)
  const failed = !result.success
  const hard = isHard(state)
  const location = (state.locations || []).find(entry => entry.id === inv.location)

  // [cultist] 失败：所在地点的[[古神]]敌人攻击你（再揭示一个标记由引擎的 DrawAnotherChaosToken 语义
  // 在 resolveChaosToken 之外无法表达；P8 以「多揭示一个」的提示 + 攻击结算推进，simplified 记录）。
  if (failed && has('cultist') && location) {
    const ancient = (state.enemies || []).find(enemy =>
      enemy.location === location.id && hasTrait(enemy, 'Ancient One'))
    if (ancient) {
      api.attack?.(ancient, inv)
      api.info?.(`[cultist]：[[古神]]「${ancient.name}」攻击 ${inv.name}。`)
    } else {
      api.info?.('[cultist]：所在地点没有[[古神]]敌人，攻击效果不结算。')
    }
  }

  // [tablet] 成功且超过难度 2 点：移除所在地点 1 毁灭（标准档同样有这句）。
  if (!failed && has('tablet') && result.value - (result.difficulty || 0) >= 2 && location) {
    api.locationDoom?.remove?.(location, 1)
    api.info?.(`[tablet]：黑猫撕开蛛网，移除「${location.name}」上的 1 个毁灭标记。`)
  }

  // [elderthing] 失败且本次是攻击[[蜘蛛]]敌人：在该敌人所在地点放 1 毁灭。
  if (failed && has('elderthing')) {
    const source = result.source || {}
    const action = source.action || source.kind || result.actionKind
    const targetEnemy = source.enemy || (result.target?.enemy)
    const spiderAttack = action === 'fight' && targetEnemy && hasTrait(targetEnemy, 'Spider')
    if (spiderAttack) {
      const at = (state.locations || []).find(entry => entry.id === targetEnemy.location)
      if (at) {
        api.locationDoom?.add?.(at, 1)
        api.info?.(`[elderthing]：在「${at.name}」上放置 1 个毁灭标记。`)
      }
    }
  }
  // hard 档数值差异已在 weaverChaosToken；此处仅保留额外效果（两档相同）。
  void hard
}
