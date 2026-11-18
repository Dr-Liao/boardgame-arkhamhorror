// 10677 第二日 / 第二夜 · 剧情（时间标记卡）· 共享遭遇组 the_second_day
// 归属：战役共用 · theFeastOfHemlockVale/_shared/the_second_day。
// 卡面（cards-data 10677，双面）：正面「第二日 Day Two」——「大雨倾盆当头浇，盛宴还得准备好。」；
//   背面「第二夜 Night Two」——「宇宙何等广袤，我们位置已知晓。」印刷没有能力，只是当前日期指示卡。
//
// 读点（数据型条目，规则在章节层）：日历写读同 10675——scenario.mechanics.calendar 的
//   { maximumDay: 3, record: 'hemlockDate' }，behavior 调 api.mechanics.calendar.set，duringPeriod 读同一份；
//   dawnOfTheSecondDay / theLongestNight 等章按第 2 日取本卡进剧本区并翻到 day / night 面。
export default {
  code: '10677',
  scope: 'storyAsset',
  implemented: true,
  flags: {
    timeMarker: true,
    day: 2,
    doubleSided: true,
    facePeriods: { front: 'day', back: 'night' },
    frontName: 'Day Two',
    backName: 'Night Two',
    calendarRecord: 'hemlockDate',
    calendarMaximumDay: 3,
  },
  note: '数据型时间标记条目：日期写入与读取都在引擎 scenario-calendar.js（duringPeriod 读同一份日期）；条目只声明第几日与两面时段。',
  abilities: [],
}
