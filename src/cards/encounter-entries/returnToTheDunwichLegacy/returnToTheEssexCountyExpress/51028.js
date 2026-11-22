// 51028 车头（重返疯狂列车）
// 归属：关卡专用 · returnToTheEssexCountyExpress
// 遭遇组：return_to_the_essex_county_express
// 卡面：车头不能被调查；强制 - 你揭示车头后：将放在一边的火车机修工放置入场，放到车头。
// 说明：机修工入场由章节 behavior.locationRevealed 接线；本条目只声明调查限制。
export default {
  code: '51028', scope: 'location',
  implemented: true,
  locationRule: {
    investigationError() { return '车头不能被调查。' },
  },
}
