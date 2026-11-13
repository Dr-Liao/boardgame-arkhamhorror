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
//   · 选择结果写成一条 endOfRound 的持续效果记录（state.effects，随存档往返、按统一过期点清理），
//     由 api.addEffect 写入，条目文件不碰 state。
// approximation: 引擎还没有「把一张在场诡计的印刷文本框清空」的读点（敌人有 entityBlanked/
//   enemyTextBlanked，玩家卡有 assetTextBlanked，但 treacheryRule.* 的每条消费点都直接读条目）。
//   因此本轮只完成「选择 + 花费秘密 + 本轮持续」这一部分，真正的文本清空见原语请求
//   artifacts/migration/tsk/primitive-requests/09051.json（new.blankCardText）。测试断言的是
//   近似后的真实行为：秘密减少、效果记录带当选卡号与 endOfRound。
const CODE = '09051'

const isAttachedToElite = item => item.hostType === 'enemy' && item.host?.elite === true

export default {
  code: CODE,
  uses: 4,
  usesType: 'secrets',
  simplified: true,
  note: 'approximation: 只实现「选择诡计 + 花费 1 秘密 + 本轮持续记录」，印刷文本清空需要 new.blankCardText 读点（primitive-requests/09051.json）。',
  abilities: [
    {
      kind: 'free',
      cost: { uses: 1 },
      label: '花费 1 秘密：选择一个非弱点且未附属到[[精英]]敌人的诡计，本轮其印刷文本框视为空白',
      criteria: [({ source }) => (source?.uses || 0) > 0],
      resolve: ({ inv, source, api }) => {
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
        api.addEffect({
          duration: 'endOfRound', sourceCode: CODE, sourceInstanceId: source?.id ?? null,
          controllerSeat: inv.seat,
          label: `「${api.cardName(target.code)}」的印刷文本框视为空白（除[[特性]]）`,
        })
        api.info(`📜 「俄耳甫斯教信条」：花费 1 秘密，「${api.cardName(target.code)}」的印刷文本框视为空白直到本轮结束。`)
        return true
      },
    },
  ],
  modifiers: [],
}
