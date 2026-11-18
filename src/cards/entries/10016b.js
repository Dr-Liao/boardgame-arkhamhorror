// 10016b 汉克·萨姆森（坚毅·监守面）· 求生者 · 6 生命 / 4 理智 · 监守 / 坚毅
// 卡面：
//   绑定（汉克·萨姆森）。
//   你不能被治愈。
//   你所在地点其他调查员和[[盟友]]支援受到的伤害和/或恐惧，可以分配给你。
//   [reaction] 在伤害放置到你身上后：获得 2 资源。
//   [旧印] 效果：+1。将 1 点伤害从汉克·萨姆森身上移动到你控制的支援上。
//
// 读点：
//   · 「绑定」/「你不能被治愈」：绑定关系来自 cards-data 的 bondedTo/bondedCards；治疗禁止由
//     10015 的濒败替换写入 inv.formHealingProhibited（harm-threat.js#healDamageFrom /
//     healHorrorFrom 的唯一读点）。
//   · 同地点伤恐承接 → flags.assignInvestigatorHarmAtLocation（harm-assignment.js）。
//   · 伤害放置到本人后得 2 资源 → harmAssigned 窗口（reactionWindow）的 context.damage 是
//     真正落在本人（或本人承接）的伤害数；不像 damagePlaced 那样把分配给支援的份额也算进来。
//   · 旧印 +1 并把 1 点伤害移到受控支援 → api.harmRoomOf + api.moveHarm（移动不是治疗）。
//   · 《“爹爹在哪儿？”》轮末直接恐惧 → 与 10015 同一份强制能力（原因见 10015.js 文件头）。
const WHERES_PA = '10018'

const wheresPaAttached = state => (state.enemies || []).some(enemy =>
  (enemy.attachments || []).some(card => (card.originalCode || card.code) === WHERES_PA))

const wheresPaRoundEnd = {
  kind: 'forced',
  trigger: 'roundEnds',
  label: '《“爹爹在哪儿？”》轮末：汉克·萨姆森受到 1 点直接恐惧',
  criteria: [({ state }) => wheresPaAttached(state)],
  resolve: ({ inv, api }) => api.directHorror(inv.seat, 1),
}

// 旧印的「移动 1 点伤/恐到受控支援」：只枚举还有对应容量的支援；唯一候选不询问。
const moveOneHarmToAsset = (inv, api, kind) => {
  if ((inv[kind] || 0) < 1) return 0
  const candidates = (inv.assets || []).filter(asset =>
    (api.harmRoomOf({ seat: inv.seat, assetId: asset.id })[kind] || 0) > 0)
  if (!candidates.length) return 0
  const asset = candidates.length === 1 ? candidates[0] : (() => {
    const picked = api.choice({
      kind: 'effect', source: inv.code, seat: inv.seat,
      prompt: `选择承接 1 点${kind === 'horror' ? '恐惧' : '伤害'}的支援。`,
      options: candidates.map(item => ({ id: item.id, label: api.cardName(item.code) })),
    })
    return candidates.find(item => item.id === picked) || null
  })()
  if (!asset) return 0
  const applied = api.moveHarm({ seat: inv.seat }, { seat: inv.seat, assetId: asset.id }, { [kind]: 1 })
  return applied[kind] || 0
}

export default {
  code: '10016b',
  name: 'Hank Samson',
  kind: 'investigator',
  investigator: { elderSign: { bonus: 1 } },
  flags: { assignInvestigatorHarmAtLocation: true },
  note: '「你不能被治愈」由 10015 濒败替换写入 inv.formHealingProhibited（治疗统一读点）；条目本身没有独立的不能被治愈规则字段。',
  elderSign: {
    id: '10016b-eldersign',
    label: '坚毅·监守面旧印：+1；可将 1 点伤害从汉克移动到其控制的有剩余生命的支援上',
    resolve: ({ inv, api }) => {
      moveOneHarmToAsset(inv, api, 'damage')
      return { delta: 1 }
    },
  },
  abilities: [
    {
      kind: 'reaction',
      trigger: 'harmAssigned',
      label: '伤害放置到汉克身上后：获得 2 资源',
      criteria: [({ inv, context }) => context?.seat === inv.seat && (context?.damage || 0) >= 1],
      resolve: ({ inv, api }) => api.gainResources(inv.seat, 2),
    },
    wheresPaRoundEnd,
  ],
  modifiers: [],
}
