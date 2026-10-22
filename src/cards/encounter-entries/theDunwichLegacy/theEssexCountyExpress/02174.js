// 02174 特等车
// 归属：关卡专用 · theEssexCountyExpress（疯狂列车）
// 遭遇组：essex_county_express
// 卡面：特等车与其左边和右边的地点连接。
// 卡面：特等车不能被调查。
// 卡面：[action] 花费3资源：发现特等车的1个线索。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '02174', scope: 'location',
  locationRule: {
    investigationError() { return '会客车厢不能调查' },
    actions({ state, inv, loc, add }) {
      add('parlorClue', '支付 3 资源，发现会客车厢 1 个线索',
        inv.resources < 3 ? `需要 3 资源（当前 ${inv.resources}）`
          : !(loc?.clues > 0) ? '会客车厢已经没有线索' : null)
    },
  },
}
