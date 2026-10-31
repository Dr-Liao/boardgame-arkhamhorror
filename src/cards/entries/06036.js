// 06036 偷窃癖（基础弱点）
// 卡面：多人游戏专用。
//       显现 - 将偷窃癖放置入场，放到你的游戏区域。
//       [action]：控制你所在地点另一位调查员的一张[[道具]]支援或2资源。然后，将偷窃癖混洗入你的牌库。
//       强制 - 当你的回合结束时：受到1点恐惧。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 06036 偷窃癖：
//   · 显现：资产型弱点放在游戏区域（weaknessPlaysAsAsset + weakness type threat 的资产分支）。
//   · [action]：在同地点另一位调查员的「[[道具]]支援 / 2 资源」中二选一并夺取（api.giveAsset /
//     api.loseResources + api.gainResources），然后把自身从场上洗回牌库（api.moveCard → api.shuffleDeck）。
//   · 显式简化：「当你的回合结束时受到 1 点恐惧」未接线——引擎的回合结束强制只读威胁区
//     (threatEffect.forced.onTurnEnd / forcedTurnEndPayOrDiscard)，游戏区域里的资产没有回合结束读点。

export default {
  code: '06036',
  simplified: true,
  // 资产型弱点放在游戏区域（weakness.js 的 weaknessPlaysAsAsset 分支）。
  weaknessPlaysAsAsset: true,
  note: '未实现：「当你的回合结束时受到 1 点恐惧」——引擎的回合结束强制读点只覆盖威胁区，游戏区域的资产没有读点；'
    + '已实现放置入场、[action] 夺取道具/资源并洗回牌库。',
  abilities: [
    {
      kind: 'weakness',
      label: '显现：放置入场，放到你的游戏区域',
      weakness: { type: 'threat' },
    },
    {
      kind: 'action',
      label: '夺取同地点另一位调查员的 1 张道具支援或 2 资源，然后洗回牌库',
      cost: { action: true },
      resolve: ({ state, inv, source, api }) => {
        const others = api.investigatorsAt(inv.location).filter(other => other.seat !== inv.seat)
        const options = []
        for (const other of others) {
          if ((other.resources || 0) >= 2) options.push({ id: `resource:${other.seat}`, label: `${other.name} 的 2 资源` })
          for (const card of other.assets || []) {
            const traits = api.cardTraits(card.code).map(trait => String(trait).toLowerCase())
            if (traits.includes('item')) options.push({ id: `asset:${card.id}`, label: `${api.cardName(card.code)}（${other.name}）` })
          }
        }
        if (options.length) {
          const answer = options.length === 1 ? options[0].id : api.choice({
            kind: 'target', source: '06036', seat: inv.seat,
            prompt: '选择要夺取的[[道具]]支援或 2 资源。',
            options,
          })
          if (String(answer).startsWith('resource:')) {
            const seat = Number(String(answer).split(':')[1])
            const victim = state.investigators[seat]
            if (victim) {
              api.loseResources(seat, 2)
              api.gainResources(inv.seat, 2)
              api.info(`「偷窃癖」：从 ${victim.name} 处夺取 2 资源。`)
            }
          } else if (String(answer).startsWith('asset:')) {
            const assetId = String(answer).slice('asset:'.length)
            const victim = others.find(other => (other.assets || []).some(card => card.id === assetId))
            const card = victim?.assets.find(item => item.id === assetId)
            if (card && api.giveAsset(card, inv.seat)) {
              api.info(`「偷窃癖」：夺取 ${victim.name} 的「${api.cardName(card.code)}」。`)
            }
          }
        } else {
          api.info('「偷窃癖」：同地点没有可夺取的道具或资源。')
        }
        if (source && (inv.assets || []).includes(source)) {
          api.moveCard({ id: source.id, from: 'play', to: 'deckTop' })
          api.shuffleDeck(inv.seat)
          api.info('「偷窃癖」洗回牌库。')
        }
      },
    },
  ],
  modifiers: [],
}
