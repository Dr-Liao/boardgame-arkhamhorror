// falseLead 错误指示
// 归属：跨战役通用
// 遭遇组：arkham
// 卡面：显现 - 如果你没有线索，错误指示获得涌动。否则智力（4）检定，每低于难度 1 点，将你的 1 个线索放到所在地点。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 错误指示（01136）：没有线索时获得涌动。
// 迁移自 treachery-tokens.js 的 `t.code === 'falseLead'` 分支；标记放条目，不写关卡定义（避免改 state 指纹）。

export default {
  code: 'falseLead',
  name: '错误指示',
  scope: 'treachery',
  text: '显现 - 如果你没有线索，错误指示获得涌动。否则智力（4）检定，每低于难度 1 点，将你的 1 个线索放到所在地点。',
  surgeIfNoClues: true,
}
