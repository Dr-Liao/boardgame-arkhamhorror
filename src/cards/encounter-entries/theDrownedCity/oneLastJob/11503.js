// 11503 漫漫长夜 · 议程 2（金盆洗手 2/2）
// 归属：关卡专用 · theDrownedCity/oneLastJob。
// 卡面：[reaction] 一处[[阿卡姆]]地点最后一个线索被发现后：弃掉遭遇牌库顶的 3 张卡牌。
//       依次将以此方式弃掉的每名[[罪犯]]敌人生成在最近的空地点。
// 印刷：毁灭阈值 7；背面「好奇害死猫」（每位存活调查员被击败并承受 1 点肉体创伤）。
// 读点与 11502 同一句模板（引擎既有窗口，无需新原语）：
//   clueDiscovered 窗口（locations.js#discoverClueAt，context.lastClue）→
//   location traits 判定 [[阿卡姆]] → api.discardEncounterTop(3) → api.cardType/cardTraits 筛[[罪犯]]敌人
//   → api.mechanics.map.nearest 最近空地点 → api.spawnEnemyAt。
//   doomThreshold 由 definition.stage() 从卡表 doom=7 读取；背面在 behavior.agendaReveal。
const ARKHAM_TRAIT = 'arkham'

function arkhamLocation(state, context, helpers) {
  const location = (state.locations || []).find(item => item.id === context?.location)
  if (!location) return null
  const traits = (location.traits || []).length
    ? location.traits
    : (helpers?.cardTraits?.(location.originalCode || location.code) || [])
  return traits.some(trait => String(trait).toLowerCase() === ARKHAM_TRAIT) ? location : null
}

function resolveDiscardAndSpawn(state, context, api) {
  const discarded = api.discardEncounterTop?.(3) || []
  const criminals = discarded.filter(code => api.cardType?.(code) === 'enemy'
    && (api.cardTraits?.(code) || []).some(trait => String(trait).toLowerCase() === 'criminal'))
  const emptyFor = location => Boolean(location) && location.id !== context.location
    && !(state.investigators || []).some(inv => inv.location === location.id && !inv.defeated && !inv.resigned)
  const spawnFor = () => {
    if (typeof api.mechanics?.map?.nearest === 'function') {
      const [nearest] = api.mechanics.map.nearest(context.location, emptyFor) || []
      if (nearest) return nearest
    }
    return (state.locations || []).find(emptyFor)?.id || context.location
  }
  const spawned = []
  for (const code of criminals) {
    const locationId = spawnFor()
    if (typeof api.spawnEnemyAt === 'function') api.spawnEnemyAt(code, locationId)
    else api.scenario?.spawn?.(code, locationId)
    spawned.push({ code, locationId })
  }
  api.info?.(`🌑 「漫漫长夜」：弃掉遭遇牌库顶 ${discarded.length} 张，`
    + `把其中 ${spawned.length} 名[[罪犯]]敌人生成在最近的空地点。`)
  return { discarded, spawned }
}

const ABILITY = {
  kind: 'reaction',
  trigger: 'clueDiscovered',
  label: '漫漫长夜：[[阿卡姆]]地点最后一个线索被发现后弃遭遇顶 3 张并生成其中的罪犯敌人',
  criteria: ({ state, context, helpers }) => context?.lastClue === true
    && Boolean(arkhamLocation(state, context, helpers)),
  resolve: ({ state, context, api }) => { resolveDiscardAndSpawn(state, context, api) },
}

export default {
  code: '11503',
  scope: 'agenda',
  implemented: true,
  flags: { doomThreshold: 7 },
  abilities: [ABILITY],
  note: '印刷反应已改为条目 abilities（与 11502 同句模板；trigger clueDiscovered + context.lastClue + Arkham 判定）；'
    + '背面「好奇害死猫」在 behavior.agendaReveal。阈值 7 由 definition.stage() 读取。',
}
