// 60572 狂野 · 技能（1 经验，战斗/万用图标，天性）
// 卡面：你身上每有 2 点伤害（向上取整），狂野获得 1 个[wild]图标。
const CODE = '60572'

export default {
  code: CODE,
  modifiers: [{
    target: 'add:skillIcon',
    value: 'wild',
    amount: ({ inv }) => Math.ceil(((inv?.damage || 0) / 2)),
  }],
  abilities: [],
}
