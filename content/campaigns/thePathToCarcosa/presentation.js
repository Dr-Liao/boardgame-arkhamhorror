// 敦威治《毁灭将至》的小径背面。同一组印面完全相同，正面身份不能投影。
// 分岔路（02285–02288）和迷幻小路（02289–02292）必须能分辨；缝隙空间只在组内洗牌。
const PATH_BACKS = [
  { artCode: '02285', name: '分岔路', nameEn: 'Diverging Path', codes: ['02285', '02286', '02287', '02288'] },
  { artCode: '02289', name: '迷幻小路', nameEn: 'Altered Path', codes: ['02289', '02290', '02291', '02292'] },
]

export const HIDDEN_LOCATION_ART = Object.freeze(Object.fromEntries(
  PATH_BACKS.flatMap(back => back.codes.map(code => [code, back.artCode])),
))

export function hiddenPathBack(code) {
  return PATH_BACKS.find(back => back.codes.includes(String(code)) || back.artCode === String(code)) || null
}

// 双面私人地点（谢幕的楼座 / 后台）在未揭示时是「门口」那一面。
// 卡面数据里只有正面（Revealed）的名称，直接显示会向玩家泄露「这扇门通向后台」，
// 因此未揭示时改为显示另一面印的名字（与实体卡放在桌上的那一面一致）。
export const PRIVATE_DOORWAY_NAMES = Object.freeze({
  '03051': { zh: '楼座门口', en: 'Balcony Doorway' },
  '03052': { zh: '后台门口', en: 'Backstage Doorway' },
})
