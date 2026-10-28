import test from 'node:test'
import assert from 'node:assert/strict'
import { createGameState, applyMove, legalMoves, validateMove, decisionSeat } from '../src/engine/engine.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { campaignStory, introduction } from '../src/campaign/story.js'
import { contentRegistry } from '../content/registered.js'
import { viewState } from '../src/integration/observation.js'
import { PLAYER_CARD_CODES } from '../src/deck/availability.js'
import { DEFAULT_RULE_ID, RULES, RULE_INDEX, cardRuleIds, matchingRules, ruleById } from '../web/rulebook-data.js'
import { renderRulesText } from '../web/card-text.js'
import { recordValueText, recordChangeText } from '../web/campaign-records.js'
import { renderStoryReader } from '../web/story-reader.js'
import { UI_CARDS } from '../web/ui-cards.js'
import { STORY_TEXT } from '../content/campaigns/nightOfTheZealot/story-text.js'
import { midnightConclusion } from './fixtures/midnight-story.mjs'
const move=(s,m)=>{const seat=decisionSeat(s);assert.equal(validateMove(s,seat,m),null);return applyMove(s,seat,m)}
test('完整导入包含序章和每关全部正文，午夜假面只展示实际引言分支',()=>{
  const gathering=introduction(contentRegistry.getScenarioData('theGathering'))
  assert.equal(gathering.paragraphs.length,4)
  assert.deepEqual(gathering.paragraphs,[...STORY_TEXT.prologue.paragraphs,...STORY_TEXT.theGathering])
  for(const others of [true,false]) {
    const intro=introduction(contentRegistry.getScenarioData('theMidnightMasks'),{litaForcedOthers:others})
    assert.deepEqual(intro.paragraphs,[...STORY_TEXT.theMidnightMasks[others?'others':'survivors'],...STORY_TEXT.theMidnightMasks.common])
    assert.ok(!intro.paragraphs.includes(STORY_TEXT.theMidnightMasks[others?'survivors':'others'][0]))
    assert.doesNotMatch(intro.paragraphs.join(''),/继续 _|检查剧本日志|<p/)
  }
  assert.deepEqual(introduction(contentRegistry.getScenarioData('theDevourerBelow')).paragraphs,STORY_TEXT.theDevourerBelow)
})
test('历史摘要升级为完整引言时使用当时记录，局内导入与局外一致',()=>{
  const s=createGameState({seed:'full-intro'},[{seat:0,role:'human'}])
  assert.equal(viewState(s,0).scenario.intro,s.scenarioIntro.paragraphs.join('\n\n'))
  s.campaign.scenarioResults=[{scenarioId:'theMidnightMasks',scenarioIndex:1,introStory:{paragraphs:['旧摘要']},recordsBefore:{litaForcedOthers:true},resolution:'r1'}]
  s.campaign.records.litaForcedOthers=false
  const past=campaignStory(s,contentRegistry).entries.find(e=>e.kind==='intro'&&e.scenarioId==='theMidnightMasks')
  assert.ok(past.paragraphs.includes(STORY_TEXT.theMidnightMasks.others[0]))
  assert.ok(!past.paragraphs.includes(STORY_TEXT.theMidnightMasks.survivors[0]))
})
function settle(s,stop) {for(let n=0;s.pendingChoice&&s.pendingChoice.kind!==stop;n++){assert.ok(n<150);const c=s.pendingChoice;move(s,{action:'choose',choiceId:c.id,optionId:c.options.find(o=>['done','skip','self'].includes(o.id))?.id||c.options[0].id})}}
test('战役记录里的卡号按当前记录投影成卡名，未知值保持原样',()=>{
  const s=createGameState({campaignId:'theDunwichLegacy',campaignHub:true,seed:'record-card-names'},[{seat:0,role:'human'}])
  s.campaign.records.sacrificedToYogSothoth=['02217','02061','02080','not-a-card']
  s.campaign.scenarioResults=[{scenarioId:'bloodOnTheAltar',investigators:[],recordsBefore:{sacrificedToYogSothoth:['02217']},recordsAfter:{sacrificedToYogSothoth:['02217','02061']}}]
  const names=viewState(s,0).campaign.recordCardNames
  assert.equal(names['02217'],'西布伦·沃特雷')
  assert.equal(names['02061'],'沃伦·莱斯教授')
  assert.equal(names['02080'],'佛朗西斯·摩尔根博士')
  assert.equal(Object.hasOwn(names,'not-a-card'),false)
  assert.equal(recordValueText(s.campaign.records.sacrificedToYogSothoth,names),'西布伦·沃特雷、沃伦·莱斯教授、佛朗西斯·摩尔根博士、not-a-card')
  assert.equal(recordValueText(true,names),'是')
  assert.equal(recordValueText([],names),'无')
  assert.equal(recordChangeText(undefined,['02061'],names),'未记录 → 沃伦·莱斯教授')
})
test('调查纪事的结算记录按卡名显示被献祭的人',()=>{
  const h=(tag,props,...children)=>({tag,props:props||{},children})
  const campaign={id:'theDunwichLegacy',recordCardNames:{'02217':'西布伦·沃特雷','02061':'沃伦·莱斯教授'}}
  const entry={id:'result:bloodOnTheAltar',kind:'result',title:'血色祭坛',paragraphs:['结局正文'],records:{sacrificedToYogSothoth:['02217','02061']},investigators:[]}
  const s={sessionId:'record-names',state:{campaign,campaignStory:{currentId:entry.id,entries:[entry]},investigatorDefs:{},investigators:[],legalMoves:[]}}
  const game={clientData:{campaigns:[{id:'theDunwichLegacy',recordLabels:{sacrificedToYogSothoth:'献祭给犹格·索托斯的人'}}]}}
  // 图标用 createElementNS 生成 SVG；Node 侧只记录属性，够渲染函数走完。
  const previous=globalThis.document
  globalThis.document={createElementNS:(ns,tag)=>({tag,attributes:{},setAttribute(key,value){this.attributes[key]=value},append(){}})}
  let tree
  try { tree=renderStoryReader(h,s,{arkhamStoryContext:null},()=>{},()=>{},game) }
  finally { if(previous===undefined) delete globalThis.document; else globalThis.document=previous }
  const texts=[]
  const walk=node=>{if(node==null)return;if(Array.isArray(node)){node.forEach(walk);return}if(typeof node!=='object'){texts.push(String(node));return}walk(node.children)}
  walk(tree)
  assert.ok(texts.includes('献祭给犹格·索托斯的人：西布伦·沃特雷、沃伦·莱斯教授'))
})
test('新战役只投影当前导入，不发送未触发的结局和后续章节',()=>{
  const s=createGameState({campaignHub:true},[{seat:0,role:'human'}])
  const journal=viewState(s,0).campaignStory
  assert.equal(journal.entries.length,1);assert.equal(journal.entries[0].kind,'intro')
  assert.equal(journal.entries[0].scenarioId,'theGathering')
  const raw=JSON.stringify(journal)
  for(const id of ['theGathering','theMidnightMasks','theDevourerBelow']) for(const prose of Object.values(contentRegistry.getScenarioData(id).resolutions)) assert.ok(!raw.includes(prose))
  for(const branches of Object.values(STORY_TEXT.resolutions)) for(const prose of Object.values(branches).flat()) assert.ok(!raw.includes(prose))
})

test('进入关卡依次发布故事导入与初始密谋卡演出',()=>{
  const s=createGameState({campaignHub:true,playerInvestigator:'01001',seed:'opening-agenda'},[{seat:0,role:'human'}])
  move(s,{action:'hubGoSetup'})
  move(s,{action:'hubSelectInvestigator',code:'01001'})
  move(s,{action:'hubAutoDeck'})
  move(s,{action:'hubDoneSeat'})
  const events=move(s,{action:'hubBeginScenario'})
  const opening=events.map(event=>event.presentation).filter(cue=>cue?.kind==='story')
  assert.deepEqual(opening.map(cue=>cue.title),['故事导入','密谋揭示'])
  assert.equal(opening[1].code,s.agendas[0].originalCode||s.agendas[0].code)
  assert.equal(opening[1].name,s.agendas[0].name)
})

test('午夜结局2完整正文进入演出与纪事，第三章导入在关间准备、恢复和开局中一致',()=>{
  const { state:s, events }=midnightConclusion()
  const prose=STORY_TEXT.resolutions.theMidnightMasks.r2
  let journal=viewState(s,0).campaignStory
  assert.deepEqual(journal.entries.at(-1).paragraphs,prose)
  assert.equal(journal.entries.at(-1).resolutionTitle,'结局 2')
  assert.ok(events.some(e=>e.presentation?.title==='结局 2' && e.presentation.text===prose.join('\n\n')))
  assert.ok(!journal.entries.some(e=>e.scenarioId==='theDevourerBelow'))
  // A summary-only old save must gain the full reached outcome without mutation.
  s.campaign.scenarioResults.at(-1).story={paragraphs:['钟声响起，午夜已至。']}
  const old=structuredClone(s)
  assert.deepEqual(viewState(s,0).campaignStory.entries.at(-1).paragraphs,prose)
  assert.deepEqual(s,old)
  move(s,{action:'hubContinue'})
  assert.equal(s.uiState,'interlude')
  journal=viewState(s,0).campaignStory
  assert.equal(journal.currentId,'current:theDevourerBelow')
  const intro=journal.entries.at(-1)
  for(const p of STORY_TEXT.theDevourerBelow) assert.ok(intro.paragraphs.includes(p))
  assert.ok(intro.paragraphs.some(p=>p.includes('午夜已经过去')))
  assert.deepEqual(viewState(JSON.parse(JSON.stringify(s)),0).campaignStory,journal)
  for(const p of Object.values(STORY_TEXT.resolutions.theDevourerBelow).flat()) assert.ok(!JSON.stringify(journal).includes(p))
  move(s,{action:'hubDoneSeat'})
  assert.deepEqual(viewState(s,0).campaignStory.entries.at(-1),intro)
  move(s,{action:'hubBeginScenario'});settle(s)
  assert.deepEqual(viewState(s,0).campaignStory.entries.at(-1),intro)
})
for(const branch of ['r1','r2']) test(`真实结算 ${branch} 只保留实际故事，导入快照不随后续记录改写`,()=>{
  const s=createGameState({playerInvestigator:'01001',seed:'story'},[{seat:0,role:'human'}]);settle(s)
  const intro=structuredClone(s.scenarioIntro)
  s.actIndex=2;s.chaosBag=['0'];s.investigators[0].hand=[];s.enemies=[]
  move(s,{action:'resource'});settle(s,'story');move(s,{action:'choose',choiceId:s.pendingChoice.id,optionId:branch});settle(s)
  const result=s.campaign.scenarioResults[0];assert.equal(result.resolution,branch)
  const journal=campaignStory(s,contentRegistry),entry=journal.entries.find(e=>e.kind==='result')
  assert.deepEqual(entry.paragraphs,STORY_TEXT.resolutions.theGathering[branch])
  assert.ok(!JSON.stringify(journal).includes(STORY_TEXT.resolutions.theGathering[branch==='r1'?'r2':'r1'][0]))
  assert.ok(entry.investigators.every(i=>!Object.hasOwn(i,'deck')))
  s.campaign.records.houseBurned=!s.campaign.records.houseBurned
  assert.deepEqual(campaignStory(s,contentRegistry).entries[0].paragraphs,intro.paragraphs)
})
test('失败故事与幕间按实际访问顺序呈现，下一关导入读取真实记录',()=>{
  const sc=contentRegistry.getScenarioData('theGathering')
  const s={uiState:'scenarioResult',campaign:{scenarioResults:[{scenarioId:sc.id,visitId:'first:1',resolution:'r3',investigators:[]}],flow:{history:[{nodeId:'prologue',visit:1,storyText:'已发生的前言'},{nodeId:'first',visit:1},{nodeId:'aftermath',visit:1,storyText:'已发生的后记'}]}}}
  assert.deepEqual(campaignStory(s,contentRegistry).entries.map(e=>e.kind),['interlude','intro','result','interlude'])
  assert.deepEqual(campaignStory(s,contentRegistry).entries[2].paragraphs,STORY_TEXT.resolutions.theGathering.r3)
  const next=contentRegistry.getScenarioData('theMidnightMasks')
  const burned=introduction(next,{houseBurned:true}).paragraphs.join('')
  assert.match(burned,/大火/);assert.doesNotMatch(burned,/得以保留/)
})
test('起始牌组允许准备前修改，保留弱点与身份，准备后以及关间禁止重构',()=>{
  const s=createGameState({campaignHub:true,seed:'edit-deck'},[{seat:0,role:'human'}])
  move(s,{action:'hubGoSetup'});move(s,{action:'hubSelectInvestigator',code:'01001'});move(s,{action:'hubAutoDeck'})
  const record=s.campaign.investigators[0], identity=record.id
  const special=record.deck.filter(code=>!PLAYER_CARD_CODES.includes(code)), ordinary=record.deck.filter(code=>PLAYER_CARD_CODES.includes(code))
  assert.equal(ordinary.length,30)
  assert.ok(legalMoves(s).some(m=>m.action==='hubSetDeck'))
  move(s,{action:'hubSetDeck',codes:ordinary})
  assert.equal(record.id,identity);assert.deepEqual(record.deck.filter(code=>!PLAYER_CARD_CODES.includes(code)),special)
  assert.equal(record.deck.length,30+special.length)
  assert.deepEqual(record.deck.filter(code=>PLAYER_CARD_CODES.includes(code)).sort(),[...ordinary].sort())
  move(s,{action:'hubSetDeck',codes:[...ordinary].reverse()})
  assert.equal(record.deck.length,30+special.length)
  move(s,{action:'hubDoneSeat'})
  assert.ok(validateMove(s,0,{action:'hubSetDeck',codes:ordinary}))
  s.uiState='interlude';s.hubReady=false
  assert.ok(validateMove(s,0,{action:'hubSetDeck',codes:ordinary}))
})
test('关间死亡替补：自动组卡后仍可继续编辑或换用卡组，确认席位后关闭',()=>{
  const s=createGameState({campaignHub:true,seed:'interlude-replacement-deck'},[{seat:0,role:'human'}])
  move(s,{action:'hubGoSetup'});move(s,{action:'hubSelectInvestigator',code:'01001'})
  move(s,{action:'hubAutoDeck'});move(s,{action:'hubDoneSeat'})
  // 一关结束：原调查员死亡，进入关间。
  s.campaign.investigators[0].status='killed'
  s.investigators[0].defeated=true
  s.uiState='interlude';s.phase='interlude';s.campaign.phase='interlude'
  s.hubReady=false;s.hubSeatDone={};s.currentSeat=0;s.hubUpgradedSeats={}
  // 死亡席位挑选替补后先自动构筑。
  move(s,{action:'hubSelectInvestigator',code:'01002'})
  move(s,{action:'hubAutoDeck'})
  const record=s.campaign.investigators[0],identity=record.id
  const deck=record.deck.filter(code=>PLAYER_CARD_CODES.includes(code))
  assert.equal(deck.length,30)
  // 回归：自动构筑后必须保留 hubSetDeck，前端才有「编辑已保存牌组 / 本地卡组库 / ArkhamDB 导入」入口。
  assert.ok(legalMoves(s).some(m=>m.action==='hubSetDeck'),'自动组卡后仍可编辑或换用卡组')
  assert.ok(viewState(s,0).legalMoves.some(m=>m.action==='hubSetDeck'),'前端投影里保留编辑入口')
  // 换一副普通卡清单（真实界面里手动编辑、卡组库与 ArkhamDB 导入最终都提交 hubSetDeck）。
  move(s,{action:'hubSetDeck',codes:[...deck].reverse()})
  assert.equal(record.id,identity);assert.equal(record.deck.length,33)
  assert.deepEqual(record.deck.filter(code=>PLAYER_CARD_CODES.includes(code)).sort(),[...deck].sort())
  // 确认席位后关闭；下一关间的现役调查员仍不能重构起始牌组。
  move(s,{action:'hubDoneSeat'})
  assert.equal(s.hubReplacementSeats,undefined)
  s.uiState='interlude';s.phase='interlude';s.campaign.phase='interlude'
  s.hubReady=false;s.hubSeatDone={};s.currentSeat=0;s.hubUpgradedSeats={}
  assert.ok(!legalMoves(s).some(m=>m.action==='hubSetDeck'))
})
test('首关开始前可以重选调查员并重新开放准备，且不会重抽基础弱点',()=>{
  const s=createGameState({campaignHub:true,seed:'reselect-before-start'},[{seat:0,role:'human'}])
  move(s,{action:'hubGoSetup'});move(s,{action:'hubSelectInvestigator',code:'01001'});move(s,{action:'hubAutoDeck'})
  const record=s.campaign.investigators[0],identity=record.id
  const weaknesses=record.deck.filter(code=>s.cards[code]?.subtype==='basicweakness')
  assert.equal(weaknesses.length,1)
  assert.ok(legalMoves(s).some(m=>m.action==='hubSelectInvestigator'&&m.code==='01002'))
  move(s,{action:'hubSelectInvestigator',code:'01002'})
  assert.equal(s.campaign.investigators[0].id,identity)
  assert.equal(s.campaign.investigators[0].code,'01002')
  assert.deepEqual(s.campaign.investigators[0].deck,weaknesses)
  assert.equal(s.campaign.investigators[0].startingDeckReady,false)
  assert.equal(legalMoves(s).some(m=>m.action==='hubDoneSeat'),false)
  move(s,{action:'hubAutoDeck'})
  assert.deepEqual(s.campaign.investigators[0].deck.filter(code=>s.cards[code]?.subtype==='basicweakness'),weaknesses)
  move(s,{action:'hubDoneSeat'})
  assert.equal(s.hubReady,true)
  assert.ok(legalMoves(s).some(m=>m.action==='hubReopenSetup'))
  move(s,{action:'hubReopenSetup'})
  assert.equal(s.hubReady,false)
  assert.deepEqual(s.hubSeatDone,{})
  assert.ok(legalMoves(s).some(m=>m.action==='hubSelectInvestigator'))
})
test('规则索引无断链，卡牌关键字及行动符号可跳转，保留普通文本',()=>{
  const ids=new Set(RULES.map(r=>r.id));assert.equal(ids.size,RULES.length)
  for(const r of RULES)for(const id of r.related)assert.ok(ids.has(id),id)
  const h=(tag,props,...children)=>({tag,props,children})
  const nodes=renderRulesText(h,'行动点：战斗。猎手，冷漠，反击，涌动。显现后生成一名精英敌人；可谈判。胜利点。卓越。<b>普通文字</b>').flat(Infinity)
  assert.ok(nodes.some(n=>n.props?.['data-rule-id']==='actions'))
  assert.ok(nodes.some(n=>n.props?.['data-rule-id']==='hunter'))
  assert.ok(nodes.some(n=>n.props?.['data-rule-id']==='aloof'))
  for(const id of ['retaliate','surge','revelation','spawn','elite','parley','victory','upgrade'])
    assert.ok(nodes.some(n=>n.props?.['data-rule-id']===id),id)
  assert.equal(ruleById('retaliate').title,'反击')
  assert.equal(ruleById('surge').title,'涌动')
  assert.ok(nodes.includes('。普通文字'))
})
test('基础规则置顶为默认条目，规则正文不出现引擎、实现或界面操作文案',()=>{
  const first=RULE_INDEX[0]
  assert.equal(first.id,'basics')
  assert.equal(first.pinned,true)
  assert.equal(DEFAULT_RULE_ID,'basics')
  assert.ok(first.body.length>=8,'基础规则应覆盖目标、准备、阶段、行动、检定、伤害、敌人与线索')
  assert.ok(first.aliases.includes('新手入门'))
  const forbidden=/本局|本 Mod|引擎|实现|界面|按钮|面板|拖动|点击|悬浮|右键|动画|演出|存档|投影|原语|读点|接线|字段|验收|审计|playable|earlyAccess|audit|src\/|content\/|behavior|scenarioRuntime|hiddenGaps|hauntedGaps|CHAOS_BAGS|M[0-9]|P[0-9]|档案页|结算页|调查纪事|战役层状态/
  for(const rule of RULES){
    const text=rule.body.join('')
    const hit=text.match(forbidden)
    assert.equal(hit,null,`${rule.id} 正文含引擎或实现内容：${hit?.[0]}`)
    assert.equal(/<[^>]+>/.test(text),false,`${rule.id} 正文含 HTML`)
  }
})
test('敦威治新机制列入规则书，剧本卡与地点卡可直达对应条目',()=>{
  const ids=new Set(RULES.map(r=>r.id))
  for(const id of ['dunwichCampaign','dunwichZones','clubGambling','storyGuests'])assert.ok(ids.has(id))
  assert.deepEqual(cardRuleIds({originalCode:'02073'}),['clubGambling'])
  assert.deepEqual(cardRuleIds({originalCode:'02080'}),['storyGuests','clubGambling'])
  assert.deepEqual(cardRuleIds({originalCode:'01150'}),[])
  assert.ok(matchingRules('在卡牌室赌博，营救摩尔根博士').some(rule=>rule.id==='clubGambling'))
  assert.ok(matchingRules('在卡牌室赌博，营救摩尔根博士').some(rule=>rule.id==='storyGuests'))
  const h=(tag,props,...children)=>({tag,props,children})
  const nodes=renderRulesText(h,'在卡牌室赌博。放在一边的剧情资产。').flat(Infinity)
  for(const id of ['clubGambling','dunwichZones','storyGuests'])assert.ok(nodes.some(n=>n.props?.['data-rule-id']===id),id)
})
test('万象无终的自定义牌组：05 卡可保存，缺直觉牌库配额时提示用中文特性',()=>{
  // 玩家实际路径：大厅 → 乔·戴蒙德 → 自动牌组 → 改成自定义清单 → hubSetDeck。
  const s=createGameState({campaignHub:true,campaignId:'theCircleUndone',seed:'tcu-custom-deck'},[{seat:0,role:'human'}])
  move(s,{action:'hubGoSetup'})
  move(s,{action:'hubSelectInvestigator',code:'05002'})
  move(s,{action:'hubAutoDeck'})
  const ordinary=s.campaign.investigators[0].deck.filter(code=>{
    const card=ALL_CARDS[code]
    return card&&!card.signatureFor&&!card.subtype&&['asset','event','skill'].includes(card.type)
  })
  assert.ok(ordinary.some(code=>code.startsWith('05')),'本战役自动牌组应包含已开放的 05 卡')
  // 合法清单必须能保存：旧实现用默认池判许可，05 卡会误报「未获运行时许可」。
  assert.equal(validateMove(s,0,{action:'hubSetDeck',codes:ordinary}),null)
  // 缺[[洞察]]事件时，校验消息给玩家看的特性必须与卡面中文写法一致。
  const short=ordinary.filter(code=>!(ALL_CARDS[code].traits||[]).some(trait=>String(trait).toLowerCase()==='insight'))
  const error=validateMove(s,0,{action:'hubSetDeck',codes:short})
  assert.match(error,/自定义卡组无效/)
  assert.match(error,/\[\[洞察\]\]/)
  assert.doesNotMatch(error,/Insight/)
})
test('自定义牌组的预校验池与实际落库一致：开放池里的 05 卡在其它战役也不再被误拒',()=>{
  // 回归：validateHubMove 旧实现用 corePlayerPool（战役起始池）预校验，而 dispatch 的
  // hubSetDeck 实际用 availablePlayerPool（开放玩家池）落库。两者不一致时，构筑界面能选的
  // 05 卡在保存时会被误报「未获运行时许可 / 不在 playerPool 白名单内」。
  const s=createGameState({campaignHub:true,campaignId:'thePathToCarcosa',seed:'carcosa-custom-pool'},[{seat:0,role:'human'}])
  move(s,{action:'hubGoSetup'})
  move(s,{action:'hubSelectInvestigator',code:'05002'})
  move(s,{action:'hubAutoDeck'})
  const ordinary=s.campaign.investigators[0].deck.filter(code=>{
    const card=ALL_CARDS[code]
    return card&&!card.signatureFor&&!card.subtype&&['asset','event','skill'].includes(card.type)
  })
  // 用 05025（乔·戴蒙德的探求者选项内、05 循环事件）替换一张，模拟导入的 ArkhamDB 牌组。
  const mixed=[...ordinary.slice(1),'05025']
  assert.equal(validateMove(s,0,{action:'hubSetDeck',codes:mixed}),null)
})
test('每一章的桌面剧本提示卡都已登记（缺映射时提示卡整块不显示）',()=>{
  // 回归：UI_CARDS.scenarioCards 漏登记卡尔克萨 / 失落时代时，桌面上那张「剧本提示」
  // 参考卡整块不渲染（referenceCard() 取不到卡号直接返回 null），而当时没有任何测试会红。
  // 章节数据里的 originalCode 就是该章的剧本参考卡（见 content/campaigns/*/shared.js）；
  // 用注册表遍历全部战役，新增战役/章节漏登记会在这里失败。
  const scenarioIds=[]
  for(const campaign of contentRegistry.listCampaigns()){
    for(const id of campaign.scenarioIds||[]){
      const scenario=contentRegistry.getScenarioData(id)
      const card=ALL_CARDS[scenario.originalCode]
      assert.ok(card,`${id} 的剧本参考卡 ${scenario.originalCode} 不存在`)
      assert.equal(card.type,'scenario',`${id} 的 ${scenario.originalCode} 不是剧本参考卡`)
      assert.equal(UI_CARDS.scenarioCards[id],scenario.originalCode,`${id} 缺桌面提示卡映射`)
      scenarioIds.push(id)
    }
  }
  // 反向：映射表里不能混进注册表没有的章节 id（章节改名/删除后提示卡会挂到旧卡上）。
  const known=new Set(scenarioIds)
  assert.deepEqual(Object.keys(UI_CARDS.scenarioCards).filter(id=>!known.has(id)),[])
})
test('剧本区渲染：剧本提示卡随难度取面，卡尔克萨 / 失落时代的章节不再整块缺失',async()=>{
  // 直接渲染剧本区（不经浏览器）：提示卡节点由 table-regions.referenceCard() 生成，
  // 正面=简单/普通，背面=困难/专家。缺 scenarioCards 映射时整个节点是 null。
  const previous=globalThis.document
  globalThis.document={createElementNS:(namespaceURI)=>({namespaceURI,setAttribute(){},append(){}})}
  try{
    const {createTableRegions}=await import('../web/table-regions.js')
    const h=(tag,props,...children)=>({tag,props:props||{},children:children.flat(Infinity).filter(Boolean)})
    const findAll=(node,predicate,found=[])=>{
      if(!node||typeof node!=='object')return found
      if(predicate(node))found.push(node)
      for(const child of Array.isArray(node.children)?node.children:[])findAll(child,predicate,found)
      return found
    }
    const regions=createTableRegions(h,{openDetail(){},openChaosBag(){}})
    const stateOf=(id,difficulty)=>({
      scenario:{id,name:id},difficulty,investigators:[],clues:0,doom:0,agendaDoom:0,
      encounterDeckSize:0,encounterDiscard:[],chaosBag:[],status:'playing',phase:'investigation',
    })
    const referenceCard=(id,difficulty)=>{
      const tree=regions.script(stateOf(id,difficulty),null,null,[],null,{},null,{})
      const [node]=findAll(tree,candidate=>String(candidate.props?.className||'').split(/\s+/).includes('ah-reference-card'))
      return node||null
    }
    const easy=referenceCard('curtainCall','standard')
    assert.ok(easy,'卡尔克萨·谢幕 的桌面剧本提示卡没有渲染')
    assert.equal(easy.props['data-reference-code'],'03043')
    assert.equal(easy.props['data-reference-face'],'front')
    assert.equal(referenceCard('theUntamedWilds','standard').props['data-reference-code'],'04043')
    assert.equal(referenceCard('heartOfTheEldersPart2','standard').props['data-reference-code'],'04205','久远腹地上下两篇共用一张提示卡')
    // 困难/专家面：同一张提示卡翻到背面。
    assert.equal(referenceCard('curtainCall','hard').props['data-reference-face'],'back')
    assert.equal(referenceCard('curtainCall','expert').props['data-reference-face'],'back')
  }finally{
    globalThis.document=previous
  }
})
