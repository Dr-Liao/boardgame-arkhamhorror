// 05029 金钱万能
// 卡面：快速。在你发动技能检定时打出。
// 卡面：本次检定不是其标识的技能类型([willpower]、[intellect]、[combat]或[agility])，
//       而是改为资源技能检定。本次检定你的基础技能值等于你资源池内资源数的一半(向下取整)。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// R7：05029 金钱万能——testBegins 窗口的快速事件，调用 api.convertTestToResourceSkill 把
// 已发起的检定改为资源技能检定：skill=[]、基值=floor(资源/2)、投入只匹配万能图标（引擎读点 tests.js）。

export default {
  code: '05029',
  abilities: [
    {
      kind: 'played',
      fast: true,
      trigger: 'testBegins',
      // 审计 R4：卡面是「在你发动技能检定时」，收窄为本人发起的检定（快速事件候选会读数组 criteria）。
      criteria: [({ state, inv }) => state.skillTest?.seat === inv.seat],
      label: '金钱万能：本次检定基础技能值改为资源数的一半',
      resolve: ({ inv, api }) => {
        // R7：把已发起的检定转换为资源技能检定（基值 = floor(资源/2)；投入只匹配万能图标）。
        const converted = api.convertTestToResourceSkill(inv.seat)
        if (!converted) { api.info('当前没有进行中的技能检定。'); return }
        api.info(`💰 ${inv.name} 打出「${api.cardName('05029')}」：本次检定改为资源技能检定，基础值 ${converted.base}（资源 ${inv.resources} 的一半）。`)
      },
    },
  ],
  modifiers: [

  ],
}
