import { test, expect } from '@playwright/test'

for (const action of ['resource','endTurn']) test(`等待 AI 响应期间同步回合交接与中间行动：${action}`,async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('arkham-presentation',JSON.stringify({sound:false,fast:true})))
  let session, release, posted=false, complete=false, polls=0
  const gate=new Promise(resolve=>{release=resolve})
  const errors=[];page.on('pageerror',error=>errors.push(error.message))
  await page.route('**/api/start',async route=>{
    const response=await route.fetch({postData:JSON.stringify({modId:'arkhamhorror',settings:{legacyAutoStart:true,playerCount:2,seed:'handoff'}})})
    const body=await response.json();session=body.session
    session.events=[]
    Object.assign(session.state,{round:2,revision:20,currentSeat:0,turnSeat:0,phase:'investigation',pendingChoice:null,skillTest:null,turnsTaken:[],legalMoves:[{action},{action:'play',cardId:'01020'}]})
    Object.assign(session.state.investigators[0],{actionsLeft:1,hand:['01020'],resources:5})
    await route.fulfill({response,json:body})
  })
  const checkpoint=()=>{
    const {cards,investigatorDefs,legalMoves,pendingChoice,skillTest,...snapshot}=session.state
    session.events.push({seq:session.events.length,type:'presentation',kind:'checkpoint',tableState:structuredClone(snapshot)})
  }
  await page.route('**/api/session?*',async route=>{polls++;await route.fulfill({json:{ok:true,busy:posted&&!complete,session}})})
  await page.route('**/api/move',async route=>{
    posted=true
    Object.assign(session.state,{revision:21,currentSeat:1,turnSeat:1,turnsTaken:[0],legalMoves:[]})
    session.state.investigators[0].actionsLeft=0
    if(action==='resource')session.state.investigators[0].resources++
    checkpoint()
    await gate;complete=true
    await route.fulfill({json:{ok:true,session}})
  })
  try {
    await page.goto('/index.html');await page.locator('.bg-card').filter({hasText:'诡镇奇谈'}).click()
    await page.getByRole('button',{name:'开始新游戏'}).click()
    await expect(page.locator('.ah-hand-card')).toHaveAttribute('data-card-available','true')
    await page.locator('.ah-table-actions').getByRole('button',{name:action==='resource'?'资源':'结束回合',exact:true}).click()
    await expect(page.locator('.ah-hand-card')).toHaveAttribute('data-card-available','false')
    const ai=page.locator('.ah-roster-member[data-seat="1"]')
    await expect(ai.locator('.ah-roster-status')).toHaveText('AI 思考中…',{timeout:10000})
    await expect(ai).toHaveClass(/is-active/)
    await expect(page.locator('.ah-roster-member[data-seat="0"] .ah-roster-status')).toHaveText('回合已结束')
    await expect(page.locator('.bg-game-status')).toContainText('你的回合已结束')
    expect(complete).toBe(false);expect(polls).toBeGreaterThan(0)
    if(action==='resource')await expect(page.locator('.ah-pool-resource > strong')).toHaveText('6')
    // Another AI action is committed while the original POST is still held.
    session.state.revision++;session.state.investigators[1].resources++
    session.state.investigators[1].actionsLeft=2
    session.events.push({seq:session.events.length,type:'info',text:'队友已完成第一步：获得资源。'})
    checkpoint()
    await expect(page.locator('.ah-table')).toHaveAttribute('data-revision','22')
    await expect(page.locator('.ah-table-timeline')).toContainText('队友已完成第一步')
    await expect(ai.locator('.ah-roster-status')).toHaveText('AI 思考中…')
    expect(complete).toBe(false)
    await page.screenshot({path:`artifacts/arkham-polish/turn-handoff-${action}.png`,animations:'disabled'})
    Object.assign(session.state,{revision:23,round:3,currentSeat:0,turnSeat:0,turnsTaken:[],legalMoves:[{action:'play',cardId:'01020'}]})
    session.state.investigators[0].actionsLeft=3
    release()
    await expect(page.locator('.ah-roster-member[data-seat="0"]')).toHaveClass(/is-active/)
    await expect(page.locator('.ah-hand-card')).toHaveAttribute('data-card-available','true')
    await expect(ai).not.toHaveClass(/is-thinking/)
    expect(errors).toEqual([])
  } finally {release()}
})

