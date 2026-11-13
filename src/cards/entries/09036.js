// 09036 最坏的打算（Prepared for the Worst）· 守卫者事件（2 级）· 0 费。
// 卡面：选择你所在地点的一位调查员。该调查员查找其牌库顶 9 张牌，找出一张[[武器]]支援，
//       将其加入自己手牌或打出（支付其资源费用），并混洗其牌库。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 口径：候选 = 牌库顶 9 张（deck 末尾是牌库顶）里的[[武器]]支援；拿走用 api.takeFromDeck +
// api.putInHand，打出用 api.playCard(seat, code, { noAction: true })（由该调查员付费）；
// 最后 api.shuffleDeck 混洗（与卡面「并混洗其牌库」一致）。
//
// P1-8（2026-11-13）：api.playCard 只对「在该座位手牌里 / fromDiscard」的卡生效（api-clue.js:115），
// 旧实现武器还在牌库里就调 playCard → 恒 false，却照打「打出」成功日志（空转 + 谎报）。
// 现在「打出」分支先把牌从牌库取进手牌再走正常打出管线；playCard 返回 false 时给出原因并
// 把牌留在手里（等价于卡面的「加入手牌」分支），不再打印成功日志。
const SOURCE = '09036'
const weaponAsset = (api, code) => api.cardType(code) === 'asset'
  && (api.cardTraits(code) || []).some(trait => String(trait).toLowerCase() === 'weapon')

export default {
  code: '09036',
  abilities: [
    {
      kind: 'played',
      label: '选择同地点一位调查员：查找牌库顶 9 张的[[武器]]支援，加入手牌或打出，然后混洗牌库',
      resolve: ({ state, inv, api }) => {
        const candidates = api.investigatorsAt(inv.location)
        if (!candidates.length) {
          api.info('最坏的打算：这里没有调查员。')
          return
        }
        const seat = candidates.length === 1 ? candidates[0].seat : Number(api.choice({
          kind: 'investigator', source: SOURCE, seat: inv.seat,
          prompt: '最坏的打算：选择要查找牌库的调查员。',
          options: candidates.map(other => ({ id: String(other.seat), label: other.name })),
        }))
        const owner = state.investigators[seat]
        if (!owner) return
        const top = (owner.deck || []).slice(-9)
        const weapons = [...new Set(top.filter(code => weaponAsset(api, code)))]
        if (!weapons.length) {
          api.info(`最坏的打算：${owner.name} 的牌库顶 9 张没有[[武器]]支援。`)
          api.shuffleDeck(seat)
          return
        }
        const code = weapons.length === 1 ? weapons[0] : api.choice({
          kind: 'card', source: SOURCE, seat: inv.seat,
          prompt: '最坏的打算：选择找到的[[武器]]支援。',
          options: weapons.map(item => ({ id: item, label: api.cardName(item), cardCode: item })),
        })
        const picked = weapons.includes(code) ? code : weapons[0]
        const mode = api.choice({
          kind: 'effect', source: SOURCE, seat: inv.seat,
          prompt: `最坏的打算：如何处理「${api.cardName(picked)}」？`,
          options: [{ id: 'hand', label: '加入手牌' }, { id: 'play', label: '支付其资源费用打出' }],
        })
        if (mode === 'play') {
          // 卡面允许「从牌库顶找到后直接打出」：先取进手牌，再走统一打出管线。
          api.takeFromDeck(seat, [picked])
          api.putInHand(seat, picked)
          const played = api.playCard(seat, picked, { noAction: true })
          if (played === false) {
            api.info(`最坏的打算：${owner.name} 目前无法打出「${api.cardName(picked)}」（资源不足或打出限制），改为加入手牌。`)
          } else {
            api.info(`最坏的打算：${owner.name} 打出「${api.cardName(picked)}」。`)
          }
        } else {
          api.takeFromDeck(seat, [picked])
          api.putInHand(seat, picked)
          api.info(`最坏的打算：${owner.name} 把「${api.cardName(picked)}」加入手牌。`)
        }
        api.shuffleDeck(seat)
      },
    },
  ],
  modifiers: [],
}
