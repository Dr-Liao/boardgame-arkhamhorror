// 10518 深掘混种 · 敌人（writtenInRock）
// 卡面：猎手。强制 - 深掘混种入场后，如果矿车正朝向一个连接地点：把该地点滑入相邻空格。
// 如果无法滑动，把它与相邻的一个地点交换。
// 数值由 definition.encounterDefinitions 取印刷数据；入场效果在 behavior.enemySpawned →
// burrowingHybridEntered。
export default {
  code: '10518',
  scope: 'enemy',
  implemented: true,
  flags: {
    burrowingHybrid: true,
    hunter: true,
    forcedSlideOnEnter: true,
    slideOrSwapOnEnter: true,
  },
  note: '近似：目标地点由「矿车朝向的连接地点」决定；引擎没有 VehicleEnters 之外的入场窗口，因此挂在 enemySpawned。',
}
