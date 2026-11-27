// 10123 求生技术（Survival Technique）· 生存者资产 · 2 经验 · 无槽位
// 卡面：[fast] 选择一张附属在你地点且归你所有的卡牌并横置求生技术：将该卡牌加入你的手牌。
//       [fast] 在地点上的技能检定期间，或附属在你地点的诡计上的技能检定期间，横置求生技术：
//       你本次检定得到技能值 +2。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点（卡面 → 引擎）：
//   · 模式 2 的时机：「在地点上的技能检定 / 附属在你地点的诡计上的技能检定期间」= 玩家窗口
//     test.beforeCommit / test.afterCommit（performTest 内开窗）+ `duringOwnSkillTest`（只限本人检定），
//     criteria 读 `state.skillTest.source`：source.code 命中你所在地点的 code（runInvestigate 传地点 code；
//     参考实现为 SkillTestOnLocation YourLocation），或命中你所在地点 `location.attachments` 里的诡计 code。
//     加值写 `api.addPendingTestBonus(2)`。
// 模式 1 通过玩家地点附属的统一搬运入口把卡牌加入所有者手牌。
const CODE = '10123'

const isLocationTreacheryHere = (state, inv, code) => Boolean(code)
  && ((state.locations || []).find(location => location.id === inv.location)?.attachments || [])
    .some(card => (card.originalCode || card.code) === code)

const ownedAttachmentsHere = (state, inv) => {
  const here = state.locations.find(location => location.id === inv.location)
  const playerAttachments = (state.playerLocationAttachments || []).filter(card => card.location === inv.location)
  return [...playerAttachments, ...(here?.attachments || [])]
    .filter(card => card.ownerSeat === inv.seat && !card.assetReference && !card.encounterAttached)
}

const testOnLocationOrHereTreachery = ({ state, inv }) => {
  const source = state.skillTest?.source
  const code = source?.code || source?.originalCode
  if (!code) return false
  // 参考实现：SkillTestOnLocation YourLocation —— 只有「你所在地点」上的地点检定才算。
  const here = (state.locations || []).find(location => location.id === inv.location)
  if (here && (here.code === code || here.originalCode === code)) return true
  return isLocationTreacheryHere(state, inv, code)
}

export default {
  code: CODE,
  name: 'Survival Technique',
  abilities: [
    {
      kind: 'free',
      label: '横置：将你拥有的一张附属在你地点的卡牌加入手牌',
      cost: { exhaust: true },
      criteria: [({ state, inv }) => ownedAttachmentsHere(state, inv).length > 0],
      resolve: ({ state, inv, api }) => {
        const attachments = ownedAttachmentsHere(state, inv)
        const index = attachments.length === 1 ? 0 : Number(api.choice({
          kind: 'card', source: CODE, seat: inv.seat,
          prompt: '「求生技术」：选择要取回手牌的地点附属。',
          options: attachments.map((card, index) => ({ id: String(index), cardCode: card.code, label: api.cardName(card.code) })),
        }))
        if (attachments[index]) api.movePlayerAttachment(attachments[index], 'hand')
      },
    },
    {
      kind: 'free',
      trigger: ['test.beforeCommit', 'test.afterCommit'],
      duringOwnSkillTest: true,
      label: '横置：地点上的检定，或附属在你地点的诡计上的检定 +2 技能值',
      cost: { exhaust: true },
      criteria: [testOnLocationOrHereTreachery],
      resolve: ({ api }) => api.addPendingTestBonus(2),
    },
  ],
  modifiers: [],
}
