// 52066 渗血墙壁（重返最后的王者 / 重返往事回声等多章共用）
// 归属：战役共用 · returnToThePathToCarcosa（重返卡尔克萨之路）
// 遭遇组：decaying_reality
// 卡面：显现 - 检定[willpower](X)，X 为你所在地点的隐藏值。如果失败，失去 1 个行动并受到 1 点恐惧。
//
// 已知近似：声明式检定只能表达失败惩罚 `takeHorror`；「失去 1 个行动」需 api.loseActions，
// 由剧本运行时在结算后补（见 artifacts/migration/batch-2-remaining/ret-carcosa-dossier.md）。
export default {
  code: '52066',
  name: '渗血墙壁',
  scope: 'treachery',
  implemented: true,
  treacheryRule: {
    test: {
      skill: 'willpower',
      // X = 你所在地点的隐藏值（declarativeTestDifficulty 的 plus:'shroud'）。
      difficulty: { base: 0, plus: 'shroud' },
      fail: { kind: 'takeHorror', amount: 1 },
    },
    note: '失败还会失去 1 个行动（近似：只结算恐惧）。',
  },
}
