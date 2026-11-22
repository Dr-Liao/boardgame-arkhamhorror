// 81035 河口野兽 · 诡计（狼人诅咒 / Curse of the Rougarou 遭遇组）
// 归属：关卡专用 · curseOfTheRougarou/curseOfTheRougarou。
// 卡面：显现 - 狼人立刻攻击其所在地点和每个连接地点的每位调查员。
//       如果本效果没有进行攻击，在当前密谋上放置 1 个毁灭标记。
// 读点（引擎既有）：api.attack（enemyAttack 剧本效果口径）、api.addDoom、地点连接图。
function codeOf(card) {
  return String(card?.originalCode || card?.code || '')
}

function traitOf(state, id, trait) {
  const location = (state.locations || []).find(item => item.id === id)
  const traits = location?.traits || state.cards?.[location?.originalCode || location?.code]?.traits || []
  return traits.some(value => String(value).toLowerCase() === String(trait).toLowerCase())
}

export default {
  code: '81035',
  scope: 'treachery',
  implemented: true,
  encounterResolve(state, inv, card, api) {
    const rougarou = (state.enemies || []).find(enemy => codeOf(enemy) === '81028' && !enemy.defeated)
    if (!rougarou) {
      api.addDoom?.(1)
      api.info?.('🐺 「河口野兽」：狼人不在场，没有进行攻击——在当前密谋上放置 1 个毁灭标记。')
      return true
    }
    const site = (state.locations || []).find(location => location.id === rougarou.location)
    const connected = site?.connections || []
    const targets = (state.investigators || []).filter(candidate => !candidate.defeated && !candidate.resigned
      && (candidate.location === rougarou.location || connected.includes(candidate.location)))
    if (!targets.length) {
      api.addDoom?.(1)
      api.info?.('🐺 「河口野兽」：狼人所在地点及连接地点没有调查员——在当前密谋上放置 1 个毁灭标记。')
      return true
    }
    for (const target of targets) api.attack?.(rougarou, target)
    api.info?.(`🐺 「河口野兽」：狼人立刻攻击 ${targets.length} 位调查员（所在地点与连接地点）。`)
    return true
  },
  note: '显现由 encounterResolve 结算：按狼人所在地点 + 连接地点枚举调查员，逐个 api.attack；没有攻击时 api.addDoom(1)。',
}
