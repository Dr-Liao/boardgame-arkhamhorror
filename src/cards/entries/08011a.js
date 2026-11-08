// 08011a 演武·意志（Unbroken 面，陈丽丽专属）
// 卡面：陈丽丽牌组专用；永久。你获得 +1 意志。
// [行动]：承受 1 点直接伤害以治愈 3 点恐惧，或承受 1 点直接恐惧以治愈 3 点伤害。将此支援翻面。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
const UNBROKEN = '08011a'
const BROKEN = '08011b'

// 演武是「同一张印刷卡的两面」：场上的物理实例换成 Broken 面，战役层的演武面同步翻转
// （读点 api.mechanics.disciplines；未登记演武时只翻物理面，保持旧存档可用）。
const flipToBroken = (api, asset) => {
  api.flipAsset(asset, BROKEN)
  if (api.mechanics?.disciplines?.faceCode?.(UNBROKEN) != null) api.mechanics.disciplines.flip(UNBROKEN, { to: 'broken' })
}

export default {
  code: UNBROKEN,
  modifiers: [
    { target: 'skill:willpower', amount: 1 },
  ],
  abilities: [
    {
      kind: 'action',
      label: '演武·意志：承受 1 点直接伤害治愈 3 点恐惧，或承受 1 点直接恐惧治愈 3 点伤害；然后翻面',
      cost: { action: true },
      resolve: ({ inv, source, api }) => {
        const choice = api.choice({
          kind: 'effect', source: source.id, seat: inv.seat,
          prompt: '选择要承受的代价，然后翻面。',
          options: [
            { id: 'damage', label: '承受 1 点直接伤害，治愈 3 点恐惧' },
            { id: 'horror', label: '承受 1 点直接恐惧，治愈 3 点伤害' },
          ],
        })
        if (choice === 'damage') {
          api.directDamage(inv.seat, 1)
          api.healHorror(inv.seat, 3)
        } else if (choice === 'horror') {
          api.directHorror(inv.seat, 1)
          api.healDamage(inv.seat, 3)
        } else return false
        flipToBroken(api, source)
        return true
      },
    },
  ],
}
