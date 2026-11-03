// 荒芜海岸：只禁止卡牌效果增加屏障；初始化和移除仍由原语允许。
export default {
  code: '07143', scope: 'location', implemented: true,
  locationRule: { cannotPlaceBarriers: true },
}
