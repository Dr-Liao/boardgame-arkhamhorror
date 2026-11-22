// 51030 行李车厢（重返疯狂列车）
// 归属：关卡专用 · returnToTheEssexCountyExpress
// 遭遇组：return_to_the_essex_county_express
// 卡面：行李车厢不能被调查；[action] 选择 1 张手牌弃掉：发现行李车厢的 1 个线索。
// 说明：调查限制已接线；弃手牌换线索的行动待通用原语（见 dossier 已知近似）。
export default {
  code: '51030', scope: 'location',
  implemented: true,
  locationRule: {
    investigationError() { return '行李车厢不能被调查。' },
  },
}
