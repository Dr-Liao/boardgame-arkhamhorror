import { STORY_TEXT } from './story-text.js'
import { recordSetAdd } from '../../../src/campaign/record-sets.js'

const FLASHBACKS = {
  flashback1: ['thePitOfDespair','AMeetingWithThomasDawson'],
  flashback2: ['thePitOfDespair','ABattleWithAHorrifyingDevil','cultist'],
  flashback3: ['thePitOfDespair','ADecisionToStickTogether','tablet'],
  flashback4: ['thePitOfDespair','AnEncounterWithASecretCult','elderthing'],
  flashback5: ['inTooDeep','ADealWithJoeSargent'],
  flashback6: ['inTooDeep','AFollowedLead'],
  flashback7: ['inTooDeep','AnIntervention'],
  flashback8: ['inTooDeep','AJailbreak'],
  flashback9: ['devilReef','DiscoveryOfAStrangeIdol'],
  flashback10: ['devilReef','DiscoveryOfAnUnholyMantle'],
  flashback11: ['devilReef','DiscoveryOfAMysticalRelic'],
  flashback12: ['aLightInTheFog','AConversationWithMrMoore'],
  flashback13: ['aLightInTheFog','TheLifecycleOfADeepOne'],
  // 《暗潮之下》第八章：达贡巢穴的「记忆闪回 XIV」——选择帮助/违抗哈珀，把 07317/07318
  // 作为并行幕（额外活动目标）入场；无永久混乱标记变化。
  flashback14: ['intoTheMaelstrom','AStingingBetrayal'],
}
export function story(state, api, id, { scenario = state.scenario.id, locale = 'zh' } = {}) {
  const raw = id.split('.').reduce((value,key)=>value?.[key], STORY_TEXT[locale]?.scenarios?.[scenario])
  if (!raw) throw new Error(`Missing Innsmouth story ${scenario}.${id}`)
  const html = typeof raw === 'string' ? raw : raw.body
  if (typeof html !== 'string') throw new Error(`Missing Innsmouth story body ${scenario}.${id}`)
  const text = html.replace(/<\/(?:p|div|ul|h[1-6])>/g,'\n\n').replace(/<li>/g,'\n• ').replace(/<br\s*\/?>/g,'\n')
    .replace(/<[^>]+>/g,'').replaceAll('&nbsp;',' ').replaceAll('&amp;','&').replaceAll('&lt;','<').replaceAll('&gt;','>')
    .replace(/\n{3,}/g,'\n\n').trim()
  api.present(text, { kind: 'story', title: typeof raw === 'string' ? id : raw.title || id, text })
}
function changePermanentToken(state, token, amount) {
  state.campaign.chaosBag ||= [...state.chaosBag]
  if (amount > 0) { state.chaosBag.push(token); state.campaign.chaosBag.push(token); return true }
  const index=state.chaosBag.indexOf(token)
  if (index < 0) return false
  state.chaosBag.splice(index,1)
  const permanent=state.campaign.chaosBag.indexOf(token)
  if (permanent >= 0) state.campaign.chaosBag.splice(permanent,1)
  return true
}
function removeChosenSymbol(state, seat, api) {
  const tokens=['cultist','tablet','elderthing'].filter(token=>state.chaosBag.includes(token))
  if (!tokens.length) return false
  const token=tokens.length===1?tokens[0]:api.choose({ kind:'effect',seat,source:'flashback',prompt:'永久移除袋中的一个混乱标记。',
    options:tokens.map(token=>({id:token,label:api.tokenLabel(token)})) })
  return changePermanentToken(state,token,-1)
}
function chooseLocalInvestigator(state, seat, api, printedCode) {
  const location=state.locations.find(loc=>(loc.originalCode||loc.code)===printedCode)
  const candidates=state.investigators.filter(inv=>!inv.defeated&&!inv.resigned&&inv.location===location?.id)
  if (!candidates.length) return null
  return candidates.length===1?candidates[0].seat:Number(api.choose({kind:'investigator',seat,source:'flashback',prompt:'选择一位在此处的调查员。',
    options:candidates.map(inv=>({id:String(inv.seat),label:inv.name}))}))
}
export function resolveFlashback(state, seat, id, api) {
  const spec=FLASHBACKS[id]
  if (!spec || spec[0]!==state.scenario.id) throw new Error(`Unknown flashback ${state.scenario.id}.${id}`)
  const inv=state.investigators[seat]
  if (!inv || inv.defeated || inv.resigned) return false
  state.scenarioFlags.resolvedFlashbacks ||= []
  if (state.scenarioFlags.resolvedFlashbacks.includes(id)) return false
  state.scenarioFlags.resolvedFlashbacks.push(id)
  story(state,api,id)
  recordSetAdd(state.campaign,'memoriesRecovered',spec[1])
  if(spec[2])changePermanentToken(state,spec[2],-1)
  if(id==='flashback14') {
    // 《暗潮之下》记忆闪回 XIV（07328 达贡巢穴）：帮助哈珀 → 并行幕 07317（重获宝藏）；
    // 违抗哈珀 → 移除每张「艾莲娜·哈珀」实体卡 + 并行幕 07318（摧毁财富宝库）。
    // 只 addParallelAct，**不再** setActDeckCards：07316 是线性幕组（正常 advanceAct+onReveal 完成），
    // 同一张卡不能同时有「线性幕 + 并行幕」两个身份（w8 明确警告）。
    const answer=api.choose({kind:'effect',seat,source:id,prompt:'帮助哈珀特工，还是违抗她？',
      options:[{id:'helpHarper',label:'帮助哈珀特工（新目标：重获深潜者的宝藏）'},
               {id:'defyHarper',label:'违抗哈珀（移除艾莲娜·哈珀，新目标：摧毁财富宝库）'}]})
    if(answer==='helpHarper') addParallelActForContent(state,api,'07317')
    else {
      const removed=removeEveryPhysicalCopy(state,'07083')
      addParallelActForContent(state,api,'07318')
      if(removed)api.info?.(`🃏 从各区域移除 ${removed} 张「艾莲娜·哈珀」实体卡。`)
    }
  }
  if(id==='flashback5') {
    const owner=chooseLocalInvestigator(state,seat,api,'07139')
    if(owner!=null&&api.takeFromSetAside('07150'))api.giveAsset(owner,'07150',{uses:3,usesType:'ticket'})
  }
  if(id==='flashback6') {
    const answer=api.choose({kind:'effect',seat,source:id,prompt:'是否带上深潜者的教诲？',options:[{id:'decline',label:'放下教诲'},{id:'take',label:'带上教诲'}]})
    if(answer==='take') {
      const owner=chooseLocalInvestigator(state,seat,api,'07135')
      if(owner!=null&&api.takeFromSetAside('07151')) {api.campaignCard('07151',owner,'恢复的记忆');api.giveAsset(owner,'07151')}
    }
  }
  if(id==='flashback7')changePermanentToken(state,'+1',1)
  if(['flashback8','flashback12','flashback13'].includes(id))removeChosenSymbol(state,seat,api)
  if(id==='flashback12')api.gainClues(state.campaign.leadSeat??0,state.numInvestigators)
  if(['flashback9','flashback10','flashback11'].includes(id)) {
    const [color,code]={flashback9:['purple','07179'],flashback10:['white','07180'],flashback11:['black','07181']}[id]
    if(!api.mechanics.keys.transfer(color,`location:${inv.location}`,`investigator:${seat}`,{reveal:true}))throw new Error('Flashback relic key is absent')
    if(!api.takeFromSetAside(code))throw new Error('Flashback physical relic is absent')
    const asset=api.giveAsset(seat,code)
    api.mechanics.keys.linkAsset(color,asset.id)
  }
  return true
}

// ---- 记忆闪回 XIV（并行幕入场）辅助 ----------------------------------------
const printedCode = value => (typeof value === 'string' ? value : value?.originalCode || value?.code || null)

// 把 07317/07318 作为「额外的活动幕」入场。入口是引擎 api.scenario.addParallelAct（w8 提供：
// 实例来自 state.scenario.stageCards，进 state.parallelActs；不改变 state.acts/actIndex）。
// 完成判定由内容层 checkParallelActs（entry-rules.js 薄委托 parallel-acts.js）负责。
// 注意：**不要**再 setActDeckCards，否则同一张卡会同时有「线性幕 + 并行幕」两个身份。
function addParallelActForContent(state, api, code) {
  if (typeof api.addParallelAct !== 'function') {
    api.info?.(`⚠️ 场景运行时缺少 addParallelAct：并行幕 ${code} 未入场。`)
    return false
  }
  if (api.addParallelAct(String(code)) === true) {
    const name = state.scenario?.stageCards?.[String(code)]?.name || code
    api.info?.(`📜 新的场景目标：${name}`)
    return true
  }
  if ((state.parallelActs || []).some(act => printedCode(act) === String(code))) return false
  api.info?.(`⚠️ 并行幕 ${code} 入场失败（缺少场景定义或已入场）。`)
  return false
}

// 移除某卡号的每一张物理副本（手牌/牌库/弃牌/场上/存放区），返回移除数量。
// 只服务 flashback14「违抗哈珀」；07083 是故事资产，实际可能在控制者资产区、手牌/牌堆/弃牌堆、
// 藏身处地点下方等，逐区扫一遍避免漏卡。
function removeEveryPhysicalCopy(state, code) {
  const target = String(code)
  const matches = item => item != null && (typeof item === 'string'
    ? item === target : String(item.code || item.originalCode || '') === target)
  let removed = 0
  const sweep = list => {
    if (!Array.isArray(list)) return
    for (let index = list.length - 1; index >= 0; index--) {
      if (!matches(list[index])) continue
      list.splice(index, 1)
      removed += 1
    }
  }
  for (const inv of state.investigators || []) {
    for (const zone of ['hand','deck','discard','assets','threat']) sweep(inv[zone])
  }
  for (const zone of ['storyAssets','victoryDisplay','agendaAside']) sweep(state[zone])
  sweep(state.scenarioZones?.setAside)
  for (const location of state.locations || []) {
    sweep(location.beneath)
    sweep(location.attachments)
  }
  for (const enemy of state.enemies || []) sweep(enemy.attachments)
  return removed
}
