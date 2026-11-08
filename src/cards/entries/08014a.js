// 08014a 演武·敏捷（Unbroken 面，陈丽丽专属）
// 卡面：陈丽丽牌组专用；永久。你获得 +1 敏捷。
// [行动]：一次一个地执行至多 3 个不同的战斗或躲避行动。将此支援翻面。此行动不会引发借机攻击。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
const UNBROKEN = '08014a'
const BROKEN = '08014b'

const flipToBroken = (api, asset) => {
  api.flipAsset(asset, BROKEN)
  if (api.mechanics?.disciplines?.faceCode?.(UNBROKEN) != null) api.mechanics.disciplines.flip(UNBROKEN, { to: 'broken' })
}

export default {
  code: UNBROKEN,
  modifiers: [
    { target: 'skill:agility', amount: 1 },
  ],
  abilities: [
    {
      kind: 'action',
      label: '演武·敏捷：本回合至多 3 次战斗或躲避行动不消耗行动点且不引发借机攻击；然后翻面',
      cost: { action: true },
      noOpportunityAttack: true,
      resolve: ({ inv, source, api }) => {
        // 引擎提供「免费战斗/躲避行动额度」：结算该额度内的战斗/躲避基础行动不花行动点、
        // 不引发借机攻击；每结算一次消耗 1 次，回合结束失效。
        api.grantFreeActions(inv.seat, { count: 3, kinds: ['fight', 'evade'], noOpportunityAttack: true, source: source.id })
        flipToBroken(api, source)
        return true
      },
    },
  ],
}
