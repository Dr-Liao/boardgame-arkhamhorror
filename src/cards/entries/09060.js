// 09060 狐朋狗友（Friends in Low Places）· 游荡者（Rogue）事件 · 0 经验 · 定制。
//
// 卡面：定制。当你购买狐朋狗友时，选择并记录一个[[特性]]。
//       查看你牌库顶的 6 张卡牌。每查看一张具有所选[[特性]]的卡牌，你可以花费 1 资源，以将该卡牌
//       加入你的手牌。将剩下的卡牌洗入你的牌库。
// 定制栏（逐项实现在 resolve 里读 api.tsk.customizable.checked）：
//       1 格 Helpful / 2 格 Versatile / 2 格 Bolstering / 2 格 Clever / 2 格 Prompt / 3 格 Experienced / 3 格 Swift。
//
// 一卡一文件：这张卡的行为只在这里维护。
//
// 读点：
//   · 看牌库顶 / 取走 / 加手 / 洗牌 → api.topDeckCodes（只读）、api.takeFromDeck、api.putInHand、api.shuffleDeck。
//   · 「购买时选择并记录的特性」→ 战役记录读点 api.campaignRecord / api.setCampaignRecord
//     （构筑期还没有写入时，打出本卡时补选一次并记录，见下方 approximation）。
//   · 勾选状态 → api.tsk.customizable.checked（只读）。
// approximation: ①「购买时记录特性」由首次打出时补选并写入战役记录（构筑期接口在 src/campaign，
//   子进程不得改）；②Bolstering（加入的牌获得 [wild] 图标到阶段结束）与 Prompt（快速）没有
//   逐实例图标/时机的读点，见 primitive-requests/09060.json；③Clever 的「任意顺序放回牌库顶」
//   只实现「不洗牌、按原顺序留在牌库顶」。
const CODE = '09060'
const TRAIT_RECORD = '09060:trait'
const SECOND_TRAIT_RECORD = '09060:trait2'

const OPTIONS = [
  { name: 'Helpful', checks: 1, text: 'When you play Friends in Low Places, you may choose another investigator at your location to resolve its effects.' },
  { name: 'Versatile', checks: 2, text: 'Choose another [[Trait]]: _____. When you play Friends in Low Places, you may choose one of the looked-at cards with both chosen [[Traits]] to add to your hand without spending 1 resource.' },
  { name: 'Bolstering', checks: 2, text: 'Each card added to your hand by Friends in Low Places gains a [wild] icon until the end of the phase.' },
  { name: 'Clever', checks: 2, text: 'Instead of shuffling the remaining cards into your deck, you may place each of them on the top of your deck, in any order.' },
  { name: 'Prompt', checks: 2, text: 'Friends in Low Places gains fast and "play during any [fast] window".' },
  { name: 'Experienced', checks: 3, text: 'Increase the number of cards looked at by 3.' },
  { name: 'Swift', checks: 3, text: 'You may play one of the cards added to your hand (paying its cost).' },
]

export default {
  code: CODE,
  simplified: true,
  note: 'approximation: 特性在首次打出时补选并写入战役记录；Bolstering/Prompt 无逐实例读点、Clever 只保留原顺序（primitive-requests/09060.json）。',
  customizationOptions: OPTIONS,
  abilities: [
    {
      kind: 'played',
      label: '查看牌库顶 6 张：具有所选[[特性]]的牌可花 1 资源加入手牌，其余洗回牌库',
      resolve: ({ inv, api }) => {
        const checked = api.tsk.customizable.checked(inv.seat, CODE)
        const fully = index => checked.filter(item => item === index).length >= OPTIONS[index].checks
        const count = 6 + (fully(5) ? 3 : 0)
        const codes = api.topDeckCodes(inv.seat, count)
        if (!codes.length) {
          api.info('「狐朋狗友」：你的牌库没有可以查看的卡牌。')
          return
        }
        // Helpful：由同地点另一位调查员结算「加入手牌」这一半效果。
        let recipient = inv.seat
        if (fully(0)) {
          const others = api.investigatorsAt(inv.location).filter(other => other.seat !== inv.seat)
          if (others.length) {
            const picked = api.choice({
              kind: 'investigator', source: CODE, seat: inv.seat, canSkip: true,
              prompt: '「狐朋狗友」：是否改由同地点另一位调查员结算这些效果？',
              options: [{ id: 'self', label: '由自己结算' }, ...others.map(other => ({ id: String(other.seat), label: other.name }))],
            })
            if (picked !== 'self') recipient = Number(picked)
          }
        }
        const traitsOf = code => api.cardTraits(code).map(trait => String(trait))
        // 购买时记录的特性；没有记录时按查看的牌补选一次并写入战役记录。
        let trait = api.campaignRecord(TRAIT_RECORD)
        if (!trait) {
          const present = [...new Set(codes.flatMap(traitsOf))]
          if (!present.length) {
            api.info('「狐朋狗友」：查看的卡牌没有特性可选。')
            return
          }
          trait = api.choice({
            kind: 'effect', source: CODE, seat: inv.seat,
            prompt: '「狐朋狗友」：选择并记录一个[[特性]]（购买时记录的特性）。',
            options: present.map(name => ({ id: name, label: name })),
          })
          api.setCampaignRecord(TRAIT_RECORD, trait)
        }
        let secondTrait = null
        if (fully(1)) {
          secondTrait = api.campaignRecord(SECOND_TRAIT_RECORD)
          if (!secondTrait) {
            const present = [...new Set(codes.flatMap(traitsOf))]
            secondTrait = api.choice({
              kind: 'effect', source: CODE, seat: inv.seat,
              prompt: '「狐朋狗友」：Versatile 生效，再选择一个[[特性]]并记录。',
              options: present.map(name => ({ id: name, label: name })),
            })
            api.setCampaignRecord(SECOND_TRAIT_RECORD, secondTrait)
          }
        }
        const wanted = String(trait).toLowerCase()
        const wantedSecond = secondTrait ? String(secondTrait).toLowerCase() : null
        const added = []
        for (const code of codes) {
          const traits = traitsOf(code).map(name => name.toLowerCase())
          const matches = traits.includes(wanted)
          const matchesBoth = Boolean(wantedSecond) && matches && traits.includes(wantedSecond)
          if (!matches) continue
          const free = matchesBoth
          const answer = api.choice({
            kind: 'effect', source: CODE, seat: inv.seat, canSkip: true,
            prompt: free
              ? `「狐朋狗友」：「${api.cardName(code)}」具有两个所选[[特性]]，免费加入手牌？`
              : `「狐朋狗友」：花费 1 资源把「${api.cardName(code)}」加入手牌？`,
            options: [{ id: 'take', label: free ? '免费加入手牌' : '花费 1 资源加入手牌' }, { id: 'skip', label: '不加入' }],
          })
          if (answer !== 'take') continue
          if (!free && api.spendResources(inv.seat, 1) < 1) {
            api.info(`「狐朋狗友」：资源不足，无法加入「${api.cardName(code)}」。`)
            continue
          }
          if (api.takeFromDeck(inv.seat, [code]) < 1) continue
          api.putInHand(recipient, code)
          added.push(code)
          api.info(`🃏 「狐朋狗友」：「${api.cardName(code)}」加入${api.investigatorsAt(inv.location).find(other => other.seat === recipient)?.name || '你的'}手牌。`)
        }
        // Experienced 之外的余牌：按卡面洗回牌库；Clever 时不洗、保留原顺序。
        if (!fully(3)) {
          api.shuffleDeck(inv.seat)
          api.info('「狐朋狗友」：其余查看过的卡牌洗回牌库。')
        } else {
          api.info('「狐朋狗友」：Clever 生效，其余查看过的卡牌按原顺序留在牌库顶。')
        }
        if (fully(6) && added.length) {
          const picked = api.choice({
            kind: 'card', source: CODE, seat: inv.seat, canSkip: true,
            prompt: '「狐朋狗友」：Swift 生效，是否打出其中一张（支付其费用）？',
            options: [{ id: 'skip', label: '不打出' }, ...added.map(code => ({ id: code, cardCode: code, label: api.cardName(code) }))],
          })
          if (picked !== 'skip') {
            if (!api.playCard(recipient, picked, { noAction: true })) {
              api.info(`「狐朋狗友」：「${api.cardName(picked)}」当前不能打出。`)
            } else {
              api.info(`🃏 「狐朋狗友」：Swift 生效，打出「${api.cardName(picked)}」。`)
            }
          }
        }
      },
    },
  ],
  modifiers: [],
}
