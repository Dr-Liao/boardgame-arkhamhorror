// 04105 劝服
// 卡面：谈判。选择你所在地点的一个非弱点[[类人]]敌人并检定[intellect](3)。本次检定得到+X难度，X等于该敌人的恐惧值。如果你检定成功，将所选敌人洗入遭遇牌库。如果所选敌人为[[精英]]，改为自动躲避它。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 04105 劝服：人形敌人；精英自动躲避，其余做智识检定，成功洗回遭遇牌库。
//
// 2026-10-27 修复（白吞卡）：这张事件必须选择一名非弱点的[[类人]]敌人才能结算。旧实现无目标
// 时只写一行日志就弃牌，费用/行动照付。补 playCondition，并与 resolve 共用同一份候选。
// 弱点判定读 cards-data 的 subtype（player 弱点敌人都在该表里；cards-data 是纯数据表，无环）。
import { ALL_CARDS } from '../../cards/cards-data.js'

const isWeaknessCode = code => ['weakness', 'basicweakness'].includes(ALL_CARDS[code]?.subtype)
const isHumanoid = enemy => (enemy.traits || []).some(trait => String(trait).toLowerCase() === 'humanoid')

function persuadableEnemies(state, inv) {
  return state.enemies.filter(enemy => enemy.location === inv.location
    && isHumanoid(enemy) && !isWeaknessCode(enemy.code))
}

export default {
  code: '04105',
  playCondition: [{
    when: ({ state, inv }) => persuadableEnemies(state, inv).length > 0,
    message: '所在地点没有可劝服的非弱点[[类人]]敌人',
  }],
  abilities: [
    {
      kind: 'played', label: '劝服',
      // 卡面「谈判。」= Parley 行动：打出按谈判结算，不引发借机攻击。
      countsAs: 'parley',
      resolve: ({ state, inv, api }) => {
        const targets = persuadableEnemies(state, inv)
        if (!targets.length) { api.info('这里没有可劝服的人形敌人。'); return }
        const chosen = targets.length === 1 ? targets[0].id
          : api.choice({ kind: 'target', source: '04105', seat: inv.seat, prompt: '选择要劝服的敌人。',
            options: targets.map(enemy => ({ id: enemy.id, label: enemy.name })) })
        const enemy = targets.find(item => item.id === chosen) || targets[0]
        api.test(inv.seat, 'intellect', 3 + (enemy.horror || 0), {
          source: { label: '劝服', enemyId: enemy.id, name: enemy.name, code: '04105' },
          resolve: result => {
            if (!result.success) return
            if (enemy.elite) {
              // 精英仍要检定成功，成功后才改为自动躲避。
              api.autoEvade(enemy)
              api.info('「' + enemy.name + '」是精英，改为自动躲避。')
              return
            }
            api.removeEnemy(enemy)
            api.shuffleIntoEncounterDeck(enemy.code)
            api.info('「' + enemy.name + '」被劝服并洗回遭遇牌库。')
          },
        })
      },
    },
  ],
  modifiers: [

  ],
}
