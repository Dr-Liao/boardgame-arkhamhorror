// 09117 陈旧的钥匙圈（Old Keyring）· 幸存者资产 · 3 经验 · 手槽
// 卡面：使用（3 钥匙）。如果陈旧的钥匙圈上没有钥匙，将其弃掉。
//       [action]：调查。本次调查你所在地点得到隐藏值 -2。如果你检定成功，移除陈旧的钥匙圈的 1 钥匙，
//       且如果本次检定难度为 0，你发现额外 1 个线索。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点：
//   · uses/usesType/discardWhenEmpty 是条目级使用次数元数据（实例初始化 + 用完弃置）；
//   · 调查：api.investigate（assetId / shroudMod / onInvestigateSuccess 与普通调查同一 doInvestigate）；
//   · 成功后花钥匙 api.spendUses；难度 0 的额外线索 api.discoverClue。
const code = '09117'

export default {
  code,
  uses: 3,
  usesType: 'keys',
  discardWhenEmpty: true,
  abilities: [
    {
      kind: 'action',
      label: '调查：本地点隐藏值 -2；成功后移除 1 钥匙，难度 0 时额外发现 1 线索',
      countsAs: 'investigate',
      cost: { action: true },
      resolve: ({ inv, source, api }) => {
        api.investigate(inv.seat, {
          assetId: source?.id,
          sourceCode: code,
          shroudMod: -2,
          onInvestigateSuccess: result => {
            api.spendUses(source, 1)
            if ((Number(result?.difficulty) || 0) === 0) {
              api.discoverClue(inv.seat, 1, inv.location)
              api.info('🔑 「陈旧的钥匙圈」：本次检定难度为 0，额外发现 1 个线索。')
            }
          },
        })
      },
    },
  ],
  modifiers: [],
}
