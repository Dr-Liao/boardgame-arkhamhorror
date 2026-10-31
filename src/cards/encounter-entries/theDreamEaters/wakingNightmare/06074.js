// 06074 梯井（Stairwell）
// 归属：关卡专用 · theDreamEaters/wakingNightmare（P8-1 w-p8-a）。
// 卡面：[reaction] 当你从非[[地下室]]地点进入「梯井」后：移动到一处[[地下室]]地点。
//   然后，检定敏捷(4)。若你失败，受到 2 点伤害。
//   强制 - 「梯井」被寄生后：进行一次蛛群滋生检定。
// 读点：条目声明数据 flag；章节 behavior.locationEntered 读 entryFlags('06074').enterFromNonBasementToBasement
//   处理「进入后」反应（询问是否移动），behavior 在标记寄生后读 infestationTestOnInfest 触发滋生检定。
const CODE = '06074'

export default {
  code: CODE,
  scope: 'location',
  implemented: true,
  flags: {
    enterFromNonBasementToBasement: true,
    infestationTestOnInfest: true,
  },
}
