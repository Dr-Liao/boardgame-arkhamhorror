// 08012a 演武·智力（Unbroken 面，陈丽丽专属）
// 卡面：陈丽丽牌组专用；永久。你获得 +1 智力。
// [行动]：若你手牌少于 5 张，抽牌直到手牌为 5 张。将此支援翻面。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
const UNBROKEN = '08012a'
const BROKEN = '08012b'

const flipToBroken = (api, asset) => {
  api.flipAsset(asset, BROKEN)
  if (api.mechanics?.disciplines?.faceCode?.(UNBROKEN) != null) api.mechanics.disciplines.flip(UNBROKEN, { to: 'broken' })
}

export default {
  code: UNBROKEN,
  modifiers: [
    { target: 'skill:intellect', amount: 1 },
  ],
  abilities: [
    {
      kind: 'action',
      label: '演武·智力：若手牌少于 5 张，抽到手牌 5 张；然后翻面',
      cost: { action: true },
      resolve: ({ inv, source, api }) => {
        const missing = 5 - (inv.hand || []).length
        if (missing > 0) api.drawCards(inv.seat, missing)
        flipToBroken(api, source)
        return true
      },
    },
  ],
}
