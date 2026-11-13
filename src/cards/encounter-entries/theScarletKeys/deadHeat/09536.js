// 09536 拯救平民
// 归属：关卡专用 · theScarletKeys/deadHeat（P7 死亡酷暑）。
// 卡面：马拉喀什的平民正受到攻击！把他们带离险境，或许能避免一场屠杀。
// （注：仍在地点上的平民既不算获救，也不算被杀害。）
// [action] 花费 1 线索：从你所在地点救出 1 名平民（放到本卡上）。
// 强制 - 游戏结束时：翻面本卡（保留其上所有标记）。
//
// 一张卡一个文件：平民资源与获救计数在章节 behavior（rescueCivilian / resolution）；
// 本条目声明剧情卡身份、行动费用与游戏结束翻面读点。
export default {
  code: '09536',
  scope: 'storyAsset',
  implemented: true,
  flags: {
    saveTheCivilians: true,
    global: true,
    rescueAction: { costClues: 1 },
    flipAtGameEnd: true,
    aftermathCode: '09536b',
  },
  note: '近似：获救平民记在剧本标记（deadHeatRescued），不生成实体 token；引擎没有剧情卡资源区的通用读点。',
}
