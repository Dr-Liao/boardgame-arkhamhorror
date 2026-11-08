// 08012b 演武·智力（Broken 面，陈丽丽专属）
// 卡面：陈丽丽牌组专用；永久。
// [反应] 在一轮结束后，若你本轮的手牌在任一时刻都未达到 2 张或更多：将此支援翻回 Unbroken 面。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
const UNBROKEN = '08012a'
const BROKEN = '08012b'

const lockedThisRound = (state, source) => (state.effects || []).some(effect =>
  effect.sourceCode === '08015' && effect.sourceInstanceId === source.id)

export default {
  code: BROKEN,
  modifiers: [],
  abilities: [
    {
      kind: 'reaction',
      trigger: 'roundEnds',
      label: '轮末：若本轮手牌从未达到 2 张，翻回 Unbroken 面',
      criteria: ({ inv, source, state }) => {
        const events = state.investigators?.[inv.seat]?.roundEvents || {}
        return events.handTwoPlus !== true && !lockedThisRound(state, source)
      },
      resolve: ({ source, api }) => {
        api.flipAsset(source, UNBROKEN)
        if (api.mechanics?.disciplines?.faceCode?.(UNBROKEN) != null) api.mechanics.disciplines.flip(UNBROKEN, { to: 'unbroken' })
      },
    },
  ],
}
