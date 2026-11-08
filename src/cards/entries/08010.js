// 08010 陈丽丽（调查员）
// 卡面：你以每张演武的 Unbroken 面朝上开始游戏（演武在牌组中，开局由永久卡进场规则放入场）。
// [旧印] 效果：+2。在此次技能检定结束后，将你控制的一张 Broken 演武翻回 Unbroken 面。
// 卡背：潜修 0 / 守卫 1–5 / 中立 0–5 / 最多 5 张其他守卫 0 级；禁 [[Firearm]]；
//        起始选择 1 张演武，每累计 15 点经验可再加 1 张不同演武；每张演武配 1 张命运重担 08015。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
const BROKEN_PATTERN = /^0801[1-4]b$/

// Broken 面卡号 → Unbroken 面卡号（演武是 a/b 成对的双面印刷）。
const unbrokenOf = code => `${String(code).slice(0, -1)}a`

const flipToUnbroken = (api, asset) => {
  const unbroken = unbrokenOf(asset.code)
  api.flipAsset(asset, unbroken)
  if (api.mechanics?.disciplines?.faceCode?.(unbroken) != null) api.mechanics.disciplines.flip(unbroken, { to: 'unbroken' })
}

export default {
  code: '08010',
  kind: 'investigator',
  investigator: {
    elderSign: { bonus: 2 },
    // P5 引擎支持读点：本调查员需要本轮事件记账（四张 Broken 演武的轮末条件）。
    // 开局演武集合从 content/campaigns/edgeOfTheEarth/investigator-data.js 读取，不在条目里重复声明。
    roundEvents: true,
  },
  elderSign: {
    label: '旧印：+2；此次技能检定结束后，将一张 Broken 演武翻回 Unbroken 面',
    resolve: () => ({ delta: 2 }),
  },
  abilities: [
    {
      kind: 'forced',
      trigger: 'testEnds',
      label: '旧印：检定结束后翻回一张 Broken 演武',
      criteria: ({ inv, context }) => context.seat === inv.seat
        && (context.result?.drawn || []).includes('eldersign')
        && (inv.assets || []).some(asset => BROKEN_PATTERN.test(String(asset.code || ''))),
      resolve: ({ inv, api }) => {
        const broken = (inv.assets || []).filter(asset => BROKEN_PATTERN.test(String(asset.code || '')))
        if (!broken.length) return
        let asset = broken[0]
        if (broken.length > 1) {
          const index = Number(api.choice({
            kind: 'effect', source: '08010', seat: inv.seat,
            prompt: '选择要翻回 Unbroken 面的 Broken 演武。',
            options: broken.map((candidate, i) => ({ id: String(i), label: api.cardName(candidate.code) })),
          }))
          asset = broken[index] || broken[0]
        }
        flipToUnbroken(api, asset)
      },
    },
  ],
}
