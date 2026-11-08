// 08054 金钱万能（Money Talks）· 游荡者（Rogue）事件 · 2 经验（05029 的升级版）。
//
// 卡面：快速。在任意地点一位调查员发动技能检定时打出。
//       本次检定不是其标识的技能类型，而是改为资源技能检定。执行检定的调查员的基础技能值
//       等于你资源池内资源数的一半(向下取整)。抽取 1 张卡牌。
//
// 一卡一文件：这张卡的行为只在这里维护。
// 读点：api.convertTestToResourceSkill(seat)（testBegins 窗口，与 05029 同一原语；传自己座位
// 表示基础值取自己的资源池），随后 api.drawCards 抽 1。跨地点/他人的检定选择由快速事件窗口
// 归属决定（见 primitive request m2-2-08054.json：多座位 testBegins 候选归属待主进程确认）。
export default {
  code: '08054',
  abilities: [
    {
      kind: 'played',
      fast: true,
      trigger: 'testBegins',
      label: '金钱万能：本次检定改为资源技能检定，基础值 = 你资源的一半；抽 1 张牌',
      criteria: [({ state }) => Boolean(state.skillTest)],
      resolve: ({ inv, api }) => {
        const converted = api.convertTestToResourceSkill(inv.seat)
        if (!converted) {
          api.info('「金钱万能」：当前没有进行中的技能检定。')
          return
        }
        api.drawCards(inv.seat, 1)
        api.info(`💰 ${inv.name} 打出「金钱万能」：本次检定改为资源技能检定，基础值 ${converted.base}（资源 ${inv.resources} 的一半），并抽取 1 张牌。`)
      },
    },
  ],
  modifiers: [],
}
