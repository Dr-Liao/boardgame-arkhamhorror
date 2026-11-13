// 09571 彰显（The Unveiling）· 剧情卡 · dealings_in_the_dark
// 卡面：强制 - 在毁灭标记放置到[[异教徒]]敌人后：将其翻至线索面。
//   如果一个敌人上有超过 3 个线索，将超出的线索移动到彰显的线索上，见下。
//   教派拥有的线索数量等于场上[[异教徒]]敌人的线索总数，加上彰显的线索上的线索数量。
// 读点：
//   · 「放置毁灭后」= 引擎的 `doomPlaced` 事件窗口（非玩家强制能力来源包含在场剧情卡）。
//   · 「翻至线索面」= api.scenario.flipMarker(target, { amount })（毁灭→线索的载体重排原语）。
//   · 「超过 3 个线索移到彰显的线索」与「教派线索总数」由本章 behavior 统一结算
//     （checkObjectives 的 trimCultistClues + chaos.js#cultCluesTotal）；本条目只声明身份与规则键。
const CODE = '09571'

const enemyOf = (state, id) => (state.enemies || []).find(enemy => enemy.id === id) || null
const isCultist = (state, card) => {
  if (!card) return false
  const definition = state.scenario?.enemies?.[card.originalCode || card.code] || null
  const traits = [...(definition?.traits || []), ...(card.traits || [])]
    .map(trait => String(trait).toLowerCase())
  return traits.includes('cultist')
}

export default {
  code: CODE,
  scope: 'storyAsset',
  implemented: true,
  // behavior 读点：教派线索总数把它上面的线索计入（scenarioFlags.cluesUnveiled）。
  flags: { storyRule: 'theUnveiling', cluesUnveiled: true, clueLimitPerCultist: 3 },
  abilities: [{
    kind: 'forced',
    trigger: 'doomPlaced',
    silent: true,
    label: '在[[异教徒]]敌人上放置毁灭后：把它翻至线索面',
    criteria: ({ state, context }) => {
      const card = context?.card
      if (!card || !(Number(context.amount) > 0)) return false
      if (!(state.enemies || []).includes(card)) return false
      // 彰显本身必须在场（剧情卡），否则只是「别的来源」在放毁灭，不触发翻面。
      const theUnveilingInPlay = (state.storyAssets || []).some(asset => (asset.originalCode || asset.code) === CODE)
      if (!theUnveilingInPlay) return false
      return isCultist(state, card)
    },
    resolve: ({ state, context, api }) => {
      const enemy = enemyOf(state, context.card.id) || context.card
      const flipped = api.scenario.flipMarker(enemy, { amount: context.amount })
      api.info?.(`🔄 「彰显」：${enemy.name} 上的 ${flipped} 个毁灭翻至线索面。`)
    },
  }],
  note: '「超过 3 个线索移到彰显的线索」与「教派线索总数」由 behavior#checkObjectives / chaos.js 统一结算；'
    + '「彰显的线索」以 scenarioFlags.cluesUnveiled 记账（引擎没有剧情卡线索计数器原语，见 primitive-requests/09571.json）。',
}
