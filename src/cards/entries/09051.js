// 09051 俄耳甫斯教信条（Orphic Theory）· 探寻者（Seeker）资产 · 1 经验 · 法术 · 奥术。
//
// 卡面：使用(4 秘密)。
//       [fast] 花费 1 秘密：选择任意一个未附属到[[精英]]敌人的非弱点诡计。将所选卡牌的印刷文本框
//       视为如同空白（除[[特性]]外），直到本轮结束。
//
// 一卡一文件：这张卡的行为只在这里维护。
//
// 读点：
//   · 「选择一个非弱点、未附属到精英敌人的诡计」→ api.cardsInPlayTreacheries（威胁区 / 地点附属 /
//     敌人附属 / 幕与议程附属的统一只读枚举）。
//   · api.blankTreacheryInPlay 将选中的实体文本视为空白，直到本轮结束。
const CODE = '09051'

const isAttachedToElite = item => item.hostType === 'enemy' && item.host?.elite === true

export default {
  code: CODE,
  uses: 4,
  usesType: 'secrets',
  abilities: [
    {
      kind: 'free',
      cost: { uses: 1 },
      label: '花费 1 秘密：选择一个非弱点且未附属到[[精英]]敌人的诡计，本轮其印刷文本框视为空白',
      criteria: [({ source }) => (source?.uses || 0) > 0],
      resolve: ({ inv, api }) => {
        const candidates = api.cardsInPlayTreacheries()
          .filter(item => Boolean(item.code))
          .filter(item => !isAttachedToElite(item))
          .filter(item => api.isNonWeakness(item.code))
        if (!candidates.length) {
          api.info('「俄耳甫斯教信条」：场上没有可指定的诡计。')
          return false
        }
        const options = candidates.map((item, index) => ({
          id: String(index), cardCode: item.code,
          label: `${api.cardName(item.code)}（${item.hostType === 'investigator' ? item.host.name : item.hostType === 'location' ? api.locationName(item.hostId) : '附属中'}）`,
        }))
        const picked = Number(api.choice({
          kind: 'target', source: CODE, seat: inv.seat,
          prompt: '「俄耳甫斯教信条」：选择要抹消印刷文本框的诡计。', options,
        }))
        const target = candidates[picked]
        if (!target) return false
        if (!api.blankTreacheryInPlay(target.attachment, { duration: 'endOfRound' })) return false
        api.info(`📜 「俄耳甫斯教信条」：花费 1 秘密，「${api.cardName(target.code)}」的印刷文本框视为空白直到本轮结束。`)
        return true
      },
    },
  ],
  modifiers: [],
}
