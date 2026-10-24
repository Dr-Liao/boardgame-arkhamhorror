// 05195 恐怖图腾（幸存者 · 3 经验）
// 卡面：[reaction]在你将卡牌投入技能检定后，横置恐怖图腾：你选择该卡牌已有的任意一个技能图标，
//       该卡牌额外获得该图标。如果该次技能检定失败，将该卡牌返回你手牌。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 05195 恐怖图腾（幸存者）：投入后横置 → 投入卡再获得 1 个图标（本检定 +1）；检定失败则该卡回手。
//
// 实现备注：
//   · 「投入后」时机用玩家窗口 test.afterCommit 承载（没有非玩家窗口）。
//   · 「失败返回手牌」在 skillTestFail 窗口由同一张卡的 forced 描述子结算；两个描述子之间用支援实例上的
//     窄字段 grislyReturn 传「本次投入了哪张卡」（纯 JSON、随存档往返），成功/失败窗口各自清掉该标记。

const SKILL_LABELS = Object.freeze({
  willpower: '意志', intellect: '智慧', combat: '战斗', agility: '敏捷', wild: '万能',
})

const testSkillList = state => {
  const skill = state.skillTest?.skill
  if (Array.isArray(skill)) return skill
  return skill ? [skill] : []
}

function chooseCommittedCard(state, inv, api) {
  const own = (state.skillTest?.committed || []).filter(item => item.seat === inv.seat)
  if (!own.length) return null
  if (own.length === 1) return own[0]
  const answer = api.choice({
    kind: 'card', source: '05195', seat: inv.seat,
    prompt: '选择本次检定中你投入的一张卡牌。',
    options: own.map((item, index) => ({ id: String(index), cardCode: item.code, label: api.cardName(item.code) })),
  })
  return own[Number(answer)] || own[0]
}

function chooseCommittedIcon(state, inv, api, cardCode) {
  const icons = api.cardIcons(cardCode)
  const available = Object.keys(icons).filter(key => (icons[key] || 0) > 0)
  if (!available.length) return null
  const skills = testSkillList(state)
  const matching = available.filter(key => key === 'wild' || skills.includes(key))
  const options = matching.length ? matching : available
  if (options.length === 1) return options[0]
  return api.choice({
    kind: 'skill', source: '05195', seat: inv.seat,
    prompt: '选择该卡牌已有的一个技能图标，为它增加 1 个该图标。',
    options: options.map(key => ({ id: key, label: SKILL_LABELS[key] || key })),
  })
}

export default {
  code: '05195',
  abilities: [
    {
      kind: 'free',
      trigger: 'test.afterCommit',
      duringOwnSkillTest: true,
      label: '横置：投入的卡牌再获得 1 个技能图标；检定失败则该卡返回手牌',
      cost: { action: false, exhaust: true },
      resolve: ({ state, inv, api, source }) => {
        const committed = chooseCommittedCard(state, inv, api)
        if (!committed) { api.info('本次检定中你没有投入卡牌。'); return }
        const icon = chooseCommittedIcon(state, inv, api, committed.code)
        if (!icon) { api.info(`「${api.cardName(committed.code)}」没有可选技能图标。`); return }
        const matched = icon === 'wild' || testSkillList(state).includes(icon)
        if (matched) api.addPendingTestBonus(1)
        if (source) source.grislyReturn = committed.code
        api.info(`🪬 「恐怖图腾」让「${api.cardName(committed.code)}」再获得 1 个图标`
          + `${matched ? '（本次检定 +1）' : ''}；本次检定失败时该卡返回手牌。`)
      },
    },
    {
      kind: 'forced',
      trigger: 'skillTestFail',
      label: '检定失败：把投入的卡牌返回手牌',
      criteria: [({ source }) => Boolean(source?.grislyReturn)],
      resolve: ({ state, inv, source, api }) => {
        const code = source?.grislyReturn
        if (source) delete source.grislyReturn
        if (!code) return
        const committed = state.skillTest?.committed || []
        const index = committed.findIndex(item => item.seat === inv.seat && item.code === code)
        if (index < 0) return
        committed.splice(index, 1)
        inv.hand.push(code)
        api.info(`🪬 「恐怖图腾」：检定失败，把投入的「${api.cardName(code)}」返回 ${inv.name} 的手牌。`)
      },
    },
    {
      kind: 'forced',
      trigger: 'skillTestSuccess',
      label: '检定成功：清除待返回标记',
      criteria: [({ source }) => Boolean(source?.grislyReturn)],
      resolve: ({ source }) => {
        if (source) delete source.grislyReturn
      },
    },
  ],
}
