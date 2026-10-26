import test from 'node:test'
import assert from 'node:assert/strict'
import { createGameState, allCardDefs, applyMove, embeddedCardDefs, legalMoves } from '../src/engine/engine.js'
import { isAutomaticReward, EFFECTS } from '../src/cards/card-effects.js'
import { investigatorRule } from '../src/cards/investigator-abilities.js'
import { allDescriptors, registeredCodes, registeredEntry } from '../src/engine/ability.js'
import { requestChoice, resolveTransaction, setAutoReactionHosted } from '../src/engine/resolution.js'
import { reactionChoices, reactionView, reactionEnabled, setReactionEnabled, reactionPassPlan } from '../web/reaction-preferences.js'

test('免费且不限次的资源反应自动领取，有成本、目标或次数限制的反应保留选择',()=>{
  // Phase 5（5b-6）：01033 的反应搬到能力层，读点改成描述子（数据形状不变）。
  const milan = allDescriptors('01033').find(descriptor => descriptor.kind === 'reaction')
  assert.equal(isAutomaticReward({ effect: milan.effect, cost: milan.cost, id: milan.id }), true)
  const reward={effect:{type:'gainResource',amount:1}}
  for(const r of [{...reward,cost:{resources:1}},{...reward,cost:{exhaust:true}},
    {...reward,limit:'round'},{effect:{type:'gainResource',target:'location'}},
    {effect:{type:'draw',amount:1}},{effect:{type:'dealDamage',amount:1}}])assert.equal(isAutomaticReward(r),false)
  const defs=allCardDefs({runtimeOnly:true})
  assert.equal(defs['01033'].hasReactionPrompt,false)
  assert.equal(defs['01073'].hasReactionPrompt,true)
  assert.equal(defs['01075'].hasReactionPrompt,true)
})

test('迁到条目层的天赋与免费能力仍显示快速反应开关',()=>{
  const defs=allCardDefs({runtimeOnly:true})
  // 15 张「花资源提高检定」天赋：freeTriggers 已搬到条目，boost 询问仍要能关掉／重新打开。
  for(const code of ['01017','01034','01049','01062','01077','02187','02189','02191','02193',
    '03035','03107','03109','03111','03113','03115'])
    assert.equal(defs[code].hasReactionPrompt,true,`${code} ${defs[code].name}`)
  // 免费能力（cost.action === false）：进入 playerWindow 询问，同样要留下开关。
  for(const code of ['01018','01027','01040','02185','03149'])
    assert.equal(defs[code].hasReactionPrompt,true,`${code} ${defs[code].name}`)
  // 自动领取的资源反应不打扰玩家，保持无开关。
  assert.equal(defs['01033'].hasReactionPrompt,false)
  assert.equal(defs['02188'].hasReactionPrompt,false)
})

test('凡声明了天赋或免费能力的条目都带快速反应开关',()=>{
  const defs=allCardDefs({runtimeOnly:true})
  const missing=[]
  for(const code of registeredCodes()){
    const entry=registeredEntry(code), def=defs[code]
    if(!entry||!def) continue
    const wants=entry.freeTriggers.length>0
      || entry.abilities.some(descriptor=>descriptor.kind==='free'||descriptor.cost?.action===false)
    if(wants&&def.hasReactionPrompt!==true) missing.push(code)
  }
  assert.deepEqual(missing,[])
})

test('剧情奖赏卡进牌组或场上后仍带快速反应开关',()=>{
  // 02040 亨利·阿米蒂奇博士由敦威治幕间奖励加入牌组，目录可用性是 catalog-only；
  // 但本局确实会抽到/打出它，state.cards 必须保留 hasReactionPrompt 与 reactionIds。
  const st=createGameState({seed:'story-card-reaction',campaignId:'theDunwichLegacy',playerInvestigator:'02001'},[{seat:0,role:'human'}])
  st.investigators[0].assets.push({id:'armitage',code:'02040'})
  st.storyAssets=[{id:'story-armitage',code:'02040'}]
  const defs=embeddedCardDefs(st,'theDunwichLegacy')
  assert.equal(defs['02040']?.hasReactionPrompt,true)
  assert.ok(defs['02040'].reactionIds.length)
  // 没有在本局出现的 catalog-only 卡仍然不进入 state.cards，避免存档膨胀。
  assert.equal(defs['05023'],undefined)
  // 02217 的反应写在敦威治战役规则里、没有单卡描述子：显式开关清单要补上它。
  assert.equal(allCardDefs({runtimeOnly:true,campaignId:'theDunwichLegacy'})['02217'].hasReactionPrompt,true)
})

test('剧情支援的抽牌反应提示同样受快速反应开关控制',()=>{
  // 02040 的抽牌询问可能来自敦威治战役规则，也可能来自能力层窗口；两条路径都必须
  // 声明 canSkip，并把选项映射回卡号，否则前端开关虽然显示，却既过滤不掉也不会自动跳过。
  const st=createGameState({seed:'story-asset-skip',campaignId:'theDunwichLegacy',playerInvestigator:'02001',campaignHub:false},[{seat:0,role:'human'}])
  for(let guard=0;st.pendingChoice;guard++){
    assert.ok(guard<30)
    const choice=st.pendingChoice
    const optionId=['done','skip','0'].find(id=>choice.options.some(option=>option.id===id))||choice.options[0].id
    applyMove(st,choice.seat,{action:'choose',choiceId:choice.id,optionId})
  }
  const inv=st.investigators[0]
  inv.assets.push({id:'armitage',code:'02040',exhausted:false})
  inv.hand=[];inv.deck=['01088','01088']
  st.currentSeat=0;st.phase='investigation';st.legalMoves=legalMoves(st)
  applyMove(st,0,{action:'draw'})
  assert.ok(st.pendingChoice)
  assert.equal(st.pendingChoice.canSkip,true)
  const s={sessionId:'story-asset-skip',state:st}
  assert.ok(reactionChoices(st).some(item=>item.code==='02040'))
  setReactionEnabled(s.sessionId,0,['02040'],false)
  assert.deepEqual(reactionView(s).state.legalMoves.map(move=>move.optionId),['skip'])
  setReactionEnabled(s.sessionId,0,['02040'],true)
  assert.equal(reactionView(s),s)
})

test('搬进描述子的反应仍能把窗口映射回卡号，开关才对它有作用',()=>{
  const defs=allCardDefs({runtimeOnly:true})
  assert.ok(defs['01073'].reactionIds.includes('scavenging'))
  assert.ok(defs['01075'].reactionIds.includes('rabbitsFoot'))
  const st=createGameState({seed:'descriptor-reaction-switch',playerInvestigator:'01001'},[{seat:0,role:'human'}])
  st.cards['01073']={...defs['01073'],code:'01073'}
  st.investigators[0].assets=[{id:'scav',code:'01073'}]
  st.pendingChoice={id:'scav',kind:'reaction',seat:0,canSkip:true,source:'scavenging',
    options:[{id:'skip',label:'跳过反应'},{id:'trigger',label:'触发反应'}]}
  st.legalMoves=st.pendingChoice.options.map(option=>({action:'choose',choiceId:'scav',optionId:option.id}))
  const s={sessionId:'descriptor-reaction-switch',state:st}
  assert.deepEqual(reactionChoices(st).map(item=>item.code),['01073'])
  setReactionEnabled(s.sessionId,0,['01073'],false)
  assert.deepEqual(reactionView(s).state.legalMoves.map(move=>move.optionId),['skip'])
  setReactionEnabled(s.sessionId,0,['01073'],true)
  assert.equal(reactionView(s),s)
})

test('自动跳过计划在联机忙碌快照里仍然成立，只是暂不提交',()=>{
  const defs=allCardDefs({runtimeOnly:true})
  const st=createGameState({seed:'reaction-pass-plan',playerInvestigator:'01001'},[{seat:0,role:'human'},{seat:1,role:'ai'}])
  st.cards['01073']={...defs['01073'],code:'01073'}
  st.investigators[0].assets=[{id:'scav',code:'01073'}]
  st.pendingChoice={id:'scav',kind:'reaction',seat:0,canSkip:true,source:'scavenging',
    options:[{id:'skip',label:'跳过反应'},{id:'trigger',label:'触发反应'}]}
  st.legalMoves=st.pendingChoice.options.map(option=>({action:'choose',choiceId:'scav',optionId:option.id}))
  const s={sessionId:'reaction-pass-plan',state:st}
  // 反应还开着：不该自动过。
  assert.equal(reactionPassPlan(s,0,true),null)
  setReactionEnabled(s.sessionId,0,['01073'],false)
  // 联机快照先以 busy 到达：不能提交，但计划仍要给出，前端据此继续藏住窗口。
  const held=reactionPassPlan(s,0,false)
  assert.equal(held?.submit,false)
  assert.equal(held?.skip.optionId,'skip')
  assert.deepEqual(held?.items.map(item=>item.code),['01073'])
  assert.equal(held?.key,`${s.sessionId}:${st.revision}:scav`)
  assert.equal(reactionPassPlan(s,0,true)?.submit,true)
  // 不是本人座位的窗口、没有跳过选项时都不该接管。
  assert.equal(reactionPassPlan(s,1,true),null)
  st.legalMoves=st.legalMoves.filter(move=>move.optionId!=='skip')
  assert.equal(reactionPassPlan(s,0,true),null)
  setReactionEnabled(s.sessionId,0,['01073'],true)
  assert.equal(reactionPassPlan(s,0,true),null)
})

test('米兰调查奖励不询问，后续反应读档恢复不重复领取',()=>{
  const st=createGameState({playerInvestigator:'01001',seed:'milan-auto'},[{seat:0,role:'human'}])
  const answer=(s,id)=>applyMove(s,s.pendingChoice.seat,{action:'choose',choiceId:s.pendingChoice.id,optionId:id})
  for(let i=0;st.pendingChoice;i++){
    assert.ok(i<40)
    answer(st,['done','skip','self'].find(id=>st.pendingChoice.options.some(o=>o.id===id))||st.pendingChoice.options[0].id)
  }
  const inv=st.investigators[0]
  inv.hand=[];inv.assets=[{id:'milan',code:'01033'},{id:'scavenge',code:'01073'}];inv.discard=['01087']
  inv.actionsLeft=3;st.chaosBag=['0']
  const loc=st.locations.find(l=>l.id===inv.location);loc.shroud=0;loc.clues=5
  const resources=inv.resources,events=applyMove(st,0,{action:'investigate'})
  for(let i=0;st.pendingChoice?.source!=='scavenging';i++){
    assert.ok(i<20);assert.ok(st.pendingChoice)
    if(st.pendingChoice.source==='milan'){
      // 真人现在拿到带 autoOptionId 的窗口，由大厅在发布前代答成 trigger。
      assert.equal(st.pendingChoice.autoOptionId,'trigger')
      assert.equal(st.pendingChoice.cardCode,'01033')
      events.push(...answer(st,'trigger'))
      continue
    }
    events.push(...answer(st,['done','skip'].find(id=>st.pendingChoice.options.some(o=>o.id===id))))
  }
  assert.equal(st.investigators[0].resources,resources+1)
  assert.ok(st.continuation.answers.some(a=>a.source==='milan'&&a.optionId==='trigger'))
  const resumed=JSON.parse(JSON.stringify(st))
  answer(resumed,'skip')
  assert.equal(resumed.investigators[0].resources,resources+1)
  assert.equal(resumed.investigators[0].actionsLeft,2)
  assert.equal(events.filter(e=>e.text?.includes('触发「米兰')).length,1)
})

test('自动奖励保留 AI 非本人回合跳过策略和已保存答案',()=>{
  for(const currentSeat of [0,1]){
    const st={revision:0,currentSeat,phase:'investigation',humanSeats:[0],resources:0}
    const execute=draft=>{
      const answer=requestChoice(draft,{kind:'reaction',source:'milan',seat:1,canSkip:true,autoOptionId:'trigger',options:[{id:'skip'},{id:'trigger'}]})
      if(answer==='trigger')draft.resources++
      requestChoice(draft,{kind:'target',source:'next',seat:1,options:[{id:'done'}]})
    }
    resolveTransaction(st,currentSeat,{action:'test'},execute)
    assert.equal(st.pendingChoice.source,'next')
    assert.equal(st.resources,currentSeat===1?1:0)
    const restored=JSON.parse(JSON.stringify(st))
    resolveTransaction(restored,1,{optionId:'done'},execute)
    assert.equal(restored.resources,st.resources)
  }
  const st={revision:0,currentSeat:0,phase:'investigation',humanSeats:[0]}
  const execute=auto=>draft=>{draft.answer=requestChoice(draft,{kind:'reaction',source:'milan',seat:0,canSkip:true,autoOptionId:auto?'trigger':null,options:[{id:'skip'},{id:'trigger'}]})}
  resolveTransaction(st,0,{action:'test'},execute(false))
  resolveTransaction(st,0,{optionId:'skip'},execute(true))
  assert.equal(st.answer,'skip','已存储的选择仍按原答案恢复')
})

test('反应开关按本局、角色与卡牌记忆，混合窗口保留开启项，可重新开启',()=>{
  const st=createGameState({seed:'reaction-preferences',playerInvestigator:'01001'},[{seat:0,role:'human'},{seat:1,role:'ai'}])
  st.investigators[0].hand=['01023','01065']
  st.pendingChoice={id:'r',kind:'reaction',seat:0,canSkip:true,source:{type:'window'},options:[{id:'skip'},{id:'0'},{id:'1'}]}
  st.legalMoves=st.pendingChoice.options.map(option=>({action:'choose',choiceId:'r',optionId:option.id}))
  const s={sessionId:'preference-unit',state:st}
  assert.deepEqual(reactionChoices(st).map(item=>item.code),['01023','01065'])
  setReactionEnabled(s.sessionId,0,['01023'],false)
  assert.deepEqual(reactionView(s).state.legalMoves.map(m=>m.optionId),['skip','1'])
  assert.equal(st.legalMoves.length,3,'不修改权威选择')
  assert.ok(reactionEnabled('another-game',0,'01023'))
  assert.ok(reactionEnabled(s.sessionId,1,'01023'))
  setReactionEnabled(s.sessionId,0,['01023'],true)
  assert.equal(reactionView(s),s)
  st.pendingChoice={id:'cop',kind:'reaction',seat:0,source:'rolandClue',canSkip:true}
  st.legalMoves=[{action:'choose',choiceId:'cop',optionId:'trigger'}]
  assert.equal(reactionChoices(st)[0].code,'01001')
})

test('AI 只在自己的调查回合接受可选反应；自动跳过后仍可恢复强制选择',()=>{
  for(const phase of ['investigation','mythos','enemy','upkeep'])for(const currentSeat of [0,1]){
    const st={revision:0,currentSeat,phase,humanSeats:[0]}
    const execute=draft=>{
      draft.answer=requestChoice(draft,{kind:'reaction',source:'card',seat:1,canSkip:true,prompt:'反应？',options:[{id:'skip'},{id:'trigger'}]})
      draft.harm=requestChoice(draft,{kind:'assign-damage',source:'harm',seat:1,prompt:'分配伤害',options:[{id:'self'}]})
    }
    resolveTransaction(st,currentSeat,{action:'test'},execute)
    const own=phase==='investigation'&&currentSeat===1
    assert.equal(st.pendingChoice.kind,own?'reaction':'assign-damage')
    const restored=JSON.parse(JSON.stringify(st))
    if(own)resolveTransaction(restored,1,{optionId:'skip'},execute)
    resolveTransaction(restored,1,{optionId:'self'},execute)
    assert.equal(restored.answer,'skip');assert.equal(restored.harm,'self');assert.equal(restored.pendingChoice,null)
  }
})

test('人类跨回合反应和强制结算不被 AI 策略关闭',()=>{
  for(const kind of ['reaction','playerWindow','boost','assign-horror']){
    const st={revision:0,currentSeat:1,phase:'enemy',humanSeats:[0]}
    resolveTransaction(st,1,{action:'test'},draft=>requestChoice(draft,{kind,source:'card',seat:0,canSkip:true,prompt:'选择',options:[{id:'skip'},{id:'trigger'}]}))
    assert.equal(st.pendingChoice.kind,kind)
  }
})

test('反应入口由卡面数据自动推导：新增 legacy 反应会自带快速/自动入口',()=>{
  const defs=allCardDefs({runtimeOnly:false})
  for(const [code,def] of Object.entries(defs)){
    if(!['asset','event','skill','investigator'].includes(def.type)) continue
    const abilities=registeredEntry(code)?.abilities||[]
    if(abilities.some(ability=>ability.kind==='reaction')){
      assert.ok(def.hasReactionPrompt||def.hasAutoReaction,`${code} 反应描述子没有生成入口`)
    }
    if(abilities.some(ability=>ability.kind==='reaction'&&ability.legacyReaction)){
      assert.ok(def.hasAutoReaction,`${code} legacy 反应没有生成自动入口`)
    }
    if(abilities.some(ability=>ability.kind==='reaction'&&!ability.legacyReaction
      &&ability.fromHand!==true&&def.type!=='event')){
      assert.ok(def.hasAutoReaction,`${code} 新式非手牌反应没有生成自动入口`)
    }
    if(abilities.some(ability=>ability.kind==='reaction'&&!ability.legacyReaction&&ability.fromHand===true)){
      assert.equal(def.hasAutoReaction,false,`${code} 手牌快速事件不应自动打出`)
    }
    if(def.hasAutoReaction) assert.equal(typeof def.autoByDefault,'boolean',`${code} 缺少 autoByDefault`)
    if(def.autoByDefault) assert.equal(def.hasAutoReaction,true,`${code} 默认 auto 但没有自动入口`)
  }
})

test('安全口径的纯收益反应会默认 auto（新增卡也不能漏）',()=>{
  const defs=allCardDefs({runtimeOnly:false})
  const safeEffects=new Set(['gainResource','discoverClue','draw','addCurrentTest','dealDamage'])
  const targetKind=value=>typeof value==='string'?value:value?.kind
  const hasTarget=value=>{const kind=targetKind(value);return !!kind&&kind!=='none'}
  for(const d of Object.values(defs)){
    if(!d.hasAutoReaction) continue
    const reactions=[
      ...(registeredEntry(d.code)?.abilities||[]).filter(ability=>ability.kind==='reaction'),
      ...(EFFECTS[d.code]?.reactions||[]),
      ...(investigatorRule(d.code)?.reactions||[]),
    ]
    const safe=reactions.some(reaction=>{
      if(!reaction.effect||reaction.resolve) return false
      const cost=reaction.cost
      if(cost&&(typeof cost!=='object'||Object.keys(cost).some(key=>key!=='exhaust'))) return false
      if(hasTarget(reaction.target)||hasTarget(reaction.effect.target)) return false
      return safeEffects.has(reaction.effect.type)
    })
    if(safe) assert.equal(d.autoByDefault,true,`${d.code} 符合安全口径但没有默认 auto`)
  }
})

test('托管模式下旧式反应窗口带 autoTriggerOptionId/cardCode，且不默认 auto',()=>{
  setAutoReactionHosted(true)
  try{
    const st={revision:0,currentSeat:0,phase:'investigation',humanSeats:[0],cards:{}}
    resolveTransaction(st,0,{action:'test'},draft=>requestChoice(draft,{
      kind:'reaction',source:'rolandClue',seat:0,canSkip:true,
      autoTriggerOptionId:'trigger',cardCode:'01001',
      options:[{id:'skip'},{id:'trigger'}],
    }))
    assert.equal(st.pendingChoice.autoTriggerOptionId,'trigger')
    assert.equal(st.pendingChoice.cardCode,'01001')
    assert.equal(st.pendingChoice.autoOptionId,undefined,'罗兰不是默认自动奖励')
  }finally{setAutoReactionHosted(false)}
})

