// 09723 乔装卧底（Undercover） · 诡计 · shadow_of_a_doubt
// 归属：战役共用 · theScarletKeys/_shared/shadowOfADoubt。
// 卡面：显现 - 如果阴影中没有敌人，乔装卧底获得涌动。否则，检定 [intellect] 或 [agility](4)。
//   如果你检定失败，将一张诱饵放到隐匿迷你卡牌最多的地点，将其翻至正面朝下，并混洗该地点的每张隐匿迷你卡牌。
//   Revelation - If there are no enemies in the shadows, Undercover gains surge. Otherwise, test
//   [intellect] or [agility] (4). If you fail, place a decoy at the location with the most concealed
//   mini-cards, flip it facedown, and shuffle each concealed mini-card at that location.
// 读点：
//   · 「阴影中的敌人」= 该敌人有一张未揭露的非诱饵迷你卡（kind === 敌人卡号）；只读，不泄露身份；
//   · 「获得涌动」= encounterResolve 返回 { gainSurge: true }；
//   · 技能二选一 = api.choose 后 api.test（同一个检定入口）；
//   · 放诱饵 = api.mechanics.tsk.concealed.place({ kind: 'decoy', decoy: true, locationId })；
//     迷你卡放置原语要求 kind 是字母开头标识串，诱饵用 'decoy' 与真身 kind（敌人卡号）区分；
//   · 混洗该地点的迷你卡：现原语只有全局 reshuffleConcealed（在当前地点集合间重排，不增删），
//     没有「只混洗一个地点」的入口，因此调用全局重排并逐条披露（见 note 与 primitive-requests/09723.json）。
const CODE = '09723'
const DIFFICULTY = 4

const miniCardsIn = state => state.scenarioFlags?.mechanics?.tsk?.concealed?.miniCards || []

export default {
  code: CODE, scope: 'treachery', implemented: true,
  encounterResolve(state, inv, card, api) {
    const cards = miniCardsIn(state)
    const miniKind = code => `enemy${code}` // 迷你卡 kind 只允许字母开头，敌人真身记作 enemy<卡号>
    const enemyKinds = new Set(state.enemies.map(enemy => miniKind(enemy.originalCode || enemy.code)))
    const enemiesInShadows = cards.filter(entry => !entry.decoy && enemyKinds.has(entry.kind))
    if (!enemiesInShadows.length) {
      api.info?.('「乔装卧底」：阴影中没有敌人，获得涌动。')
      return { gainSurge: true }
    }
    const skill = api.choose({
      kind: 'skill', source: CODE, seat: inv.seat,
      prompt: '乔装卧底：选择本次显现检定的技能。',
      options: [{ id: 'intellect', label: '智力' }, { id: 'agility', label: '敏捷' }],
    })
    const chosen = skill === 'agility' ? 'agility' : 'intellect'
    api.test(inv.seat, chosen, DIFFICULTY, result => {
      if (result.success) {
        api.info?.(`🕵️ ${inv.name} 没有暴露「乔装卧底」。`)
        return
      }
      onFail(state, inv, api)
    })
    return false
  },
  note: 'approximation: 失败后的「混洗该地点的隐匿迷你卡」用 tsk-concealed 的全局重排（只在地点/位置间重排，'
    + '不增删）；缺「按地点混洗」读点，请求见 primitive-requests/09723.json。'
    + '诱饵的 kind 记为 decoy（与真身卡号区分），符合迷你卡身份不泄露口径。',
}

function onFail(state, inv, api) {
  const cards = api.mechanics.tsk.concealed.miniCards()
  if (!cards.length) return
  const counts = new Map()
  for (const entry of cards) counts.set(entry.locationId, (counts.get(entry.locationId) || 0) + 1)
  const most = Math.max(...counts.values())
  const candidates = state.locations.filter(location => (counts.get(location.id) || 0) === most)
  const target = candidates.length === 1 ? candidates[0] : candidates.find(location => location.id === api.choose({
    kind: 'location', source: CODE, seat: inv.seat,
    prompt: '乔装卧底：选择放置诱饵的地点（迷你卡最多且并列）。',
    options: candidates.map(location => ({ id: location.id, label: location.name || location.id })),
  })) || candidates[0]
  if (!target) return
  api.mechanics.tsk.concealed.place({ kind: 'decoy', decoy: true, locationId: target.id })
  api.mechanics.tsk.concealed.reshuffle()
  api.info?.(`🕵️ 「乔装卧底」：一张诱饵正面朝下放到「${api.locationName(target.id)}」，该处的隐匿迷你卡被混洗。`)
}
