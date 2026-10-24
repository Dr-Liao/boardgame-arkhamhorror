// 05194 恐怖图腾（探求者 · 3 经验）
// 卡面：[reaction]在你将卡牌投入技能检定后，横置恐怖图腾：你选择该卡牌已有的任意一个技能图标，
//       该卡牌额外获得该图标。如果该次技能检定成功，执行检定的调查员抽取1张卡牌。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 05194 恐怖图腾（探求者）：投入后横置 → 投入卡再获得 1 个图标（本检定 +1）；检定成功则执行者抽 1。
//
// 实现备注：引擎的「投入后」时机是玩家窗口 test.afterCommit（没有非玩家窗口），因此用 free 描述子
// 承载 [reaction]；「再获得 1 个图标」在检定值上等价 +1（图标本身没有其它读点）。

const SKILL_LABELS = Object.freeze({
  willpower: '意志', intellect: '智慧', combat: '战斗', agility: '敏捷', wild: '万能',
})

export const testSkillList = state => {
  const skill = state.skillTest?.skill
  if (Array.isArray(skill)) return skill
  return skill ? [skill] : []
}

export function chooseCommittedCard(state, inv, api, sourceCode) {
  const own = (state.skillTest?.committed || []).filter(item => item.seat === inv.seat)
  if (!own.length) return null
  if (own.length === 1) return own[0]
  const answer = api.choice({
    kind: 'card', source: sourceCode, seat: inv.seat,
    prompt: '选择本次检定中你投入的一张卡牌。',
    options: own.map((item, index) => ({ id: String(index), cardCode: item.code, label: api.cardName(item.code) })),
  })
  return own[Number(answer)] || own[0]
}

export function chooseCommittedIcon(state, inv, api, sourceCode, cardCode) {
  const icons = api.cardIcons(cardCode)
  const available = Object.keys(icons).filter(key => (icons[key] || 0) > 0)
  if (!available.length) return null
  const skills = testSkillList(state)
  const matching = available.filter(key => key === 'wild' || skills.includes(key))
  const options = matching.length ? matching : available
  if (options.length === 1) return options[0]
  return api.choice({
    kind: 'skill', source: sourceCode, seat: inv.seat,
    prompt: '选择该卡牌已有的一个技能图标，为它增加 1 个该图标。',
    options: options.map(key => ({ id: key, label: SKILL_LABELS[key] || key })),
  })
}

export default {
  code: '05194',
  abilities: [
    {
      kind: 'free',
      trigger: 'test.afterCommit',
      duringOwnSkillTest: true,
      label: '横置：投入的卡牌再获得 1 个技能图标；检定成功则执行者抽 1 张',
      cost: { action: false, exhaust: true },
      resolve: ({ state, inv, api }) => {
        const committed = chooseCommittedCard(state, inv, api, '05194')
        if (!committed) { api.info('本次检定中你没有投入卡牌。'); return }
        const icon = chooseCommittedIcon(state, inv, api, '05194', committed.code)
        if (!icon) { api.info(`「${api.cardName(committed.code)}」没有可选技能图标。`); return }
        const matched = icon === 'wild' || testSkillList(state).includes(icon)
        if (matched) api.addPendingTestBonus(1)
        api.info(`🪬 「恐怖图腾」让「${api.cardName(committed.code)}」再获得 1 个${SKILL_LABELS[icon] || icon}图标`
          + `${matched ? '（本次检定 +1）' : ''}。`)
        api.addExtraOnSuccess({ type: 'draw', amount: 1 })
        api.info('本次检定成功时，执行检定的调查员抽取 1 张牌。')
      },
    },
  ],
}
