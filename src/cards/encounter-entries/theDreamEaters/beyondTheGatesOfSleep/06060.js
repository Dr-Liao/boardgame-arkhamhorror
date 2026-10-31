// 06060 辛劳的古革巨人（Laboring Gug）
// 归属：关卡专用 · theDreamEaters/beyondTheGatesOfSleep（P8-1 w-p8-a）。
// 卡面：猎手。辛劳的古革巨人不能进入「魔幻小路」（The Enchanted Path）。
// 数值/猎手由 definition 的印刷数据提供；「不能进入某地点」引擎没有敌人入场限制读点，
// 因此条目只声明数据 flag，由章节 behavior 的 hunterMove / enemyMoved 钩子读取并拦截：
// 读点 = entryFlags('06060').cannotEnterOriginalCodes（src/cards/card-rules.js#entryFlags，
// 章节 behavior 里把被禁止的地点卡号映射成地点 id 后，猎手移动改走其它连接、其它效果移动则移回原地点）。
export default {
  code: '06060',
  scope: 'enemy',
  implemented: true,
  flags: {
    cannotEnterOriginalCodes: ['06049'],
  },
}
