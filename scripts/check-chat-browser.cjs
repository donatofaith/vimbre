const { chromium } = require('playwright')
const assert = require('node:assert/strict')
;(async () => {
  const { createServer } = await import('vite')
  const server = await createServer({
    server: { host: '127.0.0.1', port: 5173, strictPort: true },
  })
  await server.listen()
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
    })
    page.setDefaultTimeout(12000)
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    const uid = '11111111-1111-4111-8111-111111111111',
      bob = '33333333-3333-4333-8333-333333333333',
      cara = '44444444-4444-4444-8444-444444444444'
    const user = {
      id: uid,
      email: 'chat@example.invalid',
      role: 'authenticated',
      aud: 'authenticated',
      email_confirmed_at: new Date().toISOString(),
      app_metadata: {},
      user_metadata: {},
    }
    const profile = {
      id: uid,
      company_id: '22222222-2222-4222-8222-222222222222',
      full_name: 'Alice Test',
      email: user.email,
      active: true,
      role: 'employee',
      department_id: null,
    }
    const people = [
      { id: bob, full_name: 'Bob Example', role: 'employee', active: true },
      { id: cara, full_name: 'Cara Example', role: 'manager', active: true },
    ]
    let taskAlerts=[];let workRows = [], notificationTasks = [], notificationRecords = []
    const conversations = [],
      messageMap = new Map(),
      read = new Map()
    let seq = 0,
      failAfterSave = false,
      denied = false
    const message = (sender, body, extra = {}) => ({
      id: crypto.randomUUID(),
      seq: ++seq,
      sender_id: sender,
      sender_name:
        sender === uid
          ? 'Alice Test'
          : sender === bob
            ? 'Bob Example'
            : 'Cara Example',
      body,
      reply_to: null,
      reply: null,
      mentions: [],
      mention_names: [],
      record_path: null,
      created_at: new Date().toISOString(),
      ...extra,
    })
    const inbox = () => {
      const items = []
      for (const c of conversations)
        for (const m of messageMap.get(c.id) || [])
          if (m.sender_id !== uid && m.seq > (read.get(c.id) || 0))
            items.push({
              id: m.seq,
              conversation_id: c.id,
              message_id: m.id,
              mentioned: m.mentions.includes(uid),
              created_at: m.created_at,
              sender_name: m.sender_name,
              preview: m.body,
              title: c.title,
            })
      return {
        unread: items.length,
        mentions: items.filter((n) => n.mentioned).length,
        items: items.reverse(),
      }
    }
    const roleFixture=require('./role-workspace-fixture.cjs')(user)
    await page.route('https://*.supabase.co/**', async (route) => {
      const req = route.request(),
        path = new URL(req.url()).pathname
      let a = {}
      try {
        a = req.postDataJSON() || {}
      } catch {}
      let body = {},
        status = 200
      if(path.endsWith('/role_workspace')){roleFixture.state.items=notificationRecords;body=roleFixture.handle(a)}
      else if (path.endsWith('/token'))
        body = {
          access_token: 'chat-test-token',
          refresh_token: 'chat-test-refresh',
          token_type: 'bearer',
          expires_in: 3600,
          user,
        }
      else if (path.endsWith('/user')) body = user
      else if (path.endsWith('/profiles')) body = profile
      else if (path.endsWith('/companies'))
        body = {
          id: profile.company_id,
          name: 'Chat fixture',
          team_mode: 'small',
        }
      else if (path.endsWith('/my_invitation')) body = []
      else if(path.endsWith('/myday_valid_recurrence'))body=true;
      else if(path.endsWith('/myday_alerts'))body=taskAlerts;
      else if(path.endsWith('/myday_preferences'))body={timezone:'Europe/London',reminder_time:'09:00',email_enabled:true,email_delivery_ready:false};
      else if(path.endsWith('/myday_notes'))body={rows:[],count:0};
      else if(path.endsWith('/myday_tasks'))body={rows:notificationTasks.filter(t=>!a.p_task||a.p_task===t.id),count:notificationTasks.length,today:'2026-10-22',timezone:'Europe/London',counts:{todo:0,progress:0,overdue:0},has_work:false,context_waiting:[]};
      else if (path.endsWith('/my_day_summary'))
        body = {
          pending_drafts: 0,
          completed_sections: [],
          forwarding_address: null,
        }
      else if (path.endsWith('/actions')) { const id=new URL(req.url()).searchParams.get('id')?.replace('eq.',''); body=notificationTasks.filter(row=>!id||row.id===id) }
      else if (path.endsWith('/role_items')) {const url=new URL(req.url()), id=url.searchParams.get('id')?.replace('eq.',''), kind=url.searchParams.get('kind')?.replace('eq.',''); body=notificationRecords.filter(row=>(!id||row.id===id)&&(!kind||row.kind===kind))}
      else if (path.endsWith('/work_notification_inbox')) body={count:workRows.length,unread:workRows.filter(r=>!r.read_at).length,items:workRows}
      else if (path.endsWith('/work_notification_read')) {const row=workRows.find(r=>r.notification_key===a.p_key);if(row)row.read_at=new Date().toISOString();body=Boolean(row)}
      else if (path.endsWith('/chat_inbox')) body = inbox()
      else if (path.endsWith('/chat_team')) {
        let c = conversations.find(c => c.is_team)
        if (!c) {
          c = {id:crypto.randomUUID(),kind:'group',is_team:true,title:'Team chat',updated_at:new Date().toISOString(),members:[{id:uid,full_name:profile.full_name,active:true},...people]}
          conversations.unshift(c)
          messageMap.set(c.id, [])
        }
        body = c.id
      }
      else if (path.endsWith('/chat_people'))
        body = people.filter((p) =>
          p.full_name.toLowerCase().includes(a.p_search.toLowerCase()),
        )
      else if (path.endsWith('/chat_list'))
        body = conversations.map((c) => ({
          ...c,
          preview: (messageMap.get(c.id) || []).at(-1)?.body ?? null,
          unread: (messageMap.get(c.id) || []).filter(
            (m) => m.sender_id !== uid && m.seq > (read.get(c.id) || 0),
          ).length,
        }))
      else if (path.endsWith('/chat_create')) {
        let c =
          a.p_kind === 'direct'
            ? conversations.find(
                (c) =>
                  c.kind === 'direct' &&
                  c.members.some((p) => p.id === a.p_members[0]),
              )
            : null
        if (!c) {
          c = {
            id: crypto.randomUUID(),
            kind: a.p_kind,
            title:
              a.p_kind === 'direct'
                ? people.find((p) => p.id === a.p_members[0]).full_name
                : a.p_title,
            updated_at: new Date().toISOString(),
            members: [
              { id: uid, full_name: profile.full_name, active: true },
              ...people.filter((p) => a.p_members.includes(p.id)),
            ],
          }
          conversations.unshift(c)
          messageMap.set(c.id, [])
        }
        body = c.id
      } else if (path.endsWith('/chat_detail')) {
        const c = conversations.find((c) => c.id === a.p_conversation)
        if (denied || !c) {
          status = 403
          body = { message: 'Not available' }
        } else {
          let messages = messageMap.get(c.id)
          if (a.p_before) messages = messages.filter((m) => m.seq < a.p_before)
          if (a.p_anchor) {
            const anchor = messages.find((m) => m.id === a.p_anchor)
            messages = messages.filter((m) => m.seq <= anchor.seq)
          }
          body = {
            messages: messages.slice(-50),
            members: c.members,
            title: c.title,
            kind: c.kind,
          }
        }
      } else if (path.endsWith('/chat_send')) {
        const messages = messageMap.get(a.p_conversation)
        if (!messages.some((m) => m.id === a.p_id)) {
          const parent = messages.find((m) => m.id === a.p_reply)
          messages.push(
            message(uid, a.p_body, {
              id: a.p_id,
              reply_to: a.p_reply,
              reply: parent
                ? {
                    id: parent.id,
                    body: parent.body,
                    sender_name: parent.sender_name,
                  }
                : null,
              mentions: a.p_mentions,
              mention_names: people
                .filter((p) => a.p_mentions.includes(p.id))
                .map((p) => ({ id: p.id, name: p.full_name })),
              record_path: a.p_record_path,
            }),
          )
        }
        body = a.p_id
        if (failAfterSave) {
          failAfterSave = false
          status = 500
          body = { message: 'Simulated lost acknowledgement' }
        }
      } else if (path.endsWith('/chat_read')) {
        read.set(
          a.p_conversation,
          Math.max(read.get(a.p_conversation) || 0, a.p_through),
        )
        body = null
      }
      await route.fulfill({
        status,
        headers: Array.isArray(body) && (path.endsWith('/actions') || path.endsWith('/role_items')) ? {'content-range': body.length ? `0-${body.length-1}/${body.length}` : '*/0', 'access-control-expose-headers': 'content-range'} : {},
        contentType: 'application/json',
        body: JSON.stringify(body),
      })
    })
    await page.goto('http://127.0.0.1:5173/login')
    await page.getByLabel('Work email').fill(user.email)
    await page
      .getByLabel('Password', { exact: true })
      .fill('chat-test-password')
    await page.getByRole('button', { name: 'Log in', exact: true }).click()
    await page
      .getByRole('heading', { name: /^Good (morning|afternoon|evening),/ })
      .waitFor()
    assert.equal(await page.getByRole('navigation', {name: 'Workspace', exact: true}).getByRole('link', {name: /^Chat/}).count(), 0)
    await page.locator('.vw-topbar').getByRole('link', { name: 'Chat', exact: true }).click()
    await page
      .getByRole('button', { name: /Team chat/ })
      .waitFor()
    await page.getByRole('button', { name: 'New chat', exact: true }).click()
    let dialog = page.getByRole('dialog', { name: 'New chat', exact: true })
    await dialog.getByLabel('Conversation type').selectOption('group')
    assert.equal(await dialog.getByLabel('Group name').count(), 0)
    assert.equal(await dialog.getByRole('group', {name:'Choose teammates'}).count(), 0)
    await dialog
      .getByRole('button', { name: 'Open Team chat', exact: true })
      .click()
    await page
      .getByRole('heading', { name: 'Team chat', exact: true })
      .waitFor()
    const cid = conversations[0].id
    assert.equal(conversations.filter(c=>c.is_team).length, 1)
    assert.equal(conversations[0].members.length, 3)
    await page
      .getByLabel('Message', { exact: true })
      .fill('Please review the handover')
    await page.getByRole('button', { name: '@ Mention', exact: true }).click()
    await page
      .getByRole('group', { name: 'Mention a participant' })
      .getByLabel('Bob Example', { exact: true })
      .check()
    await page.getByRole('button', { name: 'Link record', exact: true }).click()
    await page
      .getByLabel('Record link', { exact: true })
      .fill('https://vimbre.com/app/role-record?section=decision')
    await page.getByRole('button', { name: 'Send', exact: true }).click()
    await page.locator('.chat-messages')
      .getByText('Please review the handover', { exact: true })
      .waitFor()
    assert.deepEqual(messageMap.get(cid)[0].mentions, [bob])
    assert.equal(
      await page
        .getByRole('link', { name: 'Open linked record' })
        .getAttribute('href'),
      '/app/role-record?section=decision',
    )
    const incoming = message(bob, 'I will review it today', { mentions: [uid] })
    messageMap.get(cid).push(incoming)
    await page.evaluate(() => window.dispatchEvent(new Event('focus')))
    await page.locator('.chat-messages').getByText('I will review it today', { exact: true }).waitFor()
    await page
      .getByRole('article', { name: 'Message from Bob Example' })
      .getByRole('button', { name: 'Reply to Bob Example', exact: true })
      .click()
    await page.getByLabel('Message', { exact: true }).fill('Thank you')
    await page.getByRole('button', { name: 'Send', exact: true }).click()
    await page.locator('.chat-messages').getByText('Thank you', { exact: true }).waitFor()
    assert.equal(messageMap.get(cid).at(-1).reply_to, incoming.id)
    failAfterSave = true
    await page.getByLabel('Message', { exact: true }).fill('Safe retry')
    await page.getByRole('button', { name: 'Send', exact: true }).click()
    await page
      .getByRole('alert')
      .filter({ hasText: 'not confirmed as sent' })
      .waitFor()
    assert.equal(
      await page.getByLabel('Message', { exact: true }).inputValue(),
      'Safe retry',
    )
    await page.getByRole('button', { name: 'Send', exact: true }).click()
    await page.locator('.chat-messages').getByText('Safe retry', { exact: true }).waitFor()
    assert.equal(
      messageMap.get(cid).filter((m) => m.body === 'Safe retry').length,
      1,
    )
    await page
      .getByLabel('Message', { exact: true })
      .fill('<img src=x onerror="window.chatXss=true">')
    await page.getByRole('button', { name: 'Send', exact: true }).click()
    await page.locator('.chat-messages')
      .getByText('<img src=x onerror="window.chatXss=true">', { exact: true })
      .waitFor()
    assert.equal(await page.evaluate(() => window.chatXss), undefined)
    await page.getByRole('button', { name: 'New chat', exact: true }).click()
    dialog = page.getByRole('dialog', { name: 'New chat', exact: true })
    await dialog.getByLabel(/Bob Example/).check()
    await dialog
      .getByRole('button', { name: 'Create chat', exact: true })
      .click()
    await page
      .getByRole('heading', { name: 'Bob Example', exact: true })
      .waitFor()
    assert.equal(conversations[0].kind, 'direct')
    const notification = message(cara, 'Can you check the dates?', {
      mentions: [uid],
    })
    messageMap.get(cid).push(message(bob, 'Private message text for notification test'), notification)
    await page.evaluate(() => window.dispatchEvent(new Event('focus')))
    await page
      .getByRole('button', { name: 'Notifications, 2 unread', exact: true })
      .click()
    const notifications = page.getByRole('dialog', {
      name: 'Notifications',
      exact: true,
    })
    await notifications
      .getByText('Cara Example mentioned you', { exact: true })
      .waitFor()
    await notifications.getByText('New message from Bob Example', {exact: true}).waitFor()
    await notifications.getByText('in Team chat', {exact: true}).first().waitFor()
    assert.equal(await notifications.getByText('Private message text for notification test', {exact: true}).count(), 0)
    assert.equal(await notifications.getByText('Can you check the dates?', {exact: true}).count(), 0)
    assert.equal(await notifications.getByRole('link', {name: 'Open chat', exact: true}).count(), 0)
    await notifications
      .getByRole('link')
      .filter({ hasText: 'Cara Example mentioned you' })
      .click()
    await page.locator('.chat-messages').getByText('Can you check the dates?', { exact: true }).waitFor()
    assert(new URL(page.url()).searchParams.get('message') === notification.id)
    await page
      .getByRole('button', { name: 'Back to latest messages', exact: false })
      .click()
    for (const width of [320, 360, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 950 })
      await page.getByLabel('Message', { exact: true }).waitFor()
      assert(await page.locator('.vw-topbar .chat-launcher').isVisible())
      assert(
        !(await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        )),
        `Page overflow at ${width}`,
      )
      assert(
        await page.locator('.chat-composer').isVisible(),
        `Composer hidden at ${width}`,
      )
      const fit = await page
        .locator('.chat-thread')
        .evaluate((el) => el.scrollWidth <= el.clientWidth + 1)
      assert(fit, `Thread overflow at ${width}`)
    }
    await page.setViewportSize({ width: 390, height: 844 })
    await page.getByRole('button', { name: '← Chats', exact: true }).click()
    await page.getByRole('button', { name: /Team chat/ }).click()
    await page.getByLabel('Message', { exact: true }).waitFor()
    denied = true
    await page.evaluate(() => window.dispatchEvent(new Event('focus')))
    await page
      .getByRole('alert')
      .filter({ hasText: 'conversation could not be opened' })
      .waitFor()
    assert.equal(await page.getByLabel('Message', { exact: true }).count(), 0)
    assert.equal(
      await page
        .getByText('Please review the handover', { exact: true })
        .count(),
      0,
    )
    denied=false
    await page.goto('http://127.0.0.1:5173/app')
    const taskId=crypto.randomUUID(),recordId=crypto.randomUUID()
    const due='2026-10-20'
    notificationTasks=[{id:taskId,company_id:profile.company_id,owner_id:uid,title:'Submit the budget',details:'',due_date:due,status:'open',deleted_at:null,completion_note:'',created_at:new Date().toISOString()}, {id:crypto.randomUUID(),company_id:profile.company_id,owner_id:uid,title:'Another task',details:'',due_date:due,status:'open',deleted_at:null,completion_note:'',created_at:new Date().toISOString()}]
    notificationRecords=[{id:recordId,company_id:profile.company_id,owner_id:uid,title:'Approve payroll',kind:'responsibility',details:'',due_date:due,recurrence:null,deleted_at:null,created_at:new Date().toISOString()}]
    taskAlerts=[{id:crypto.randomUUID(),task_id:taskId,title:'Submit the budget',phase:'due',created_at:new Date().toISOString()}]
    workRows=[{notification_key:'role-reminder',source_kind:'role_item',source_id:recordId,title:'Approve payroll',due_date:due,stage:'approaching',section:'responsibility',read_at:null}]
    await page.evaluate(()=>window.dispatchEvent(new Event('vimbre:work-changed')))
    await page.getByRole('button',{name:/Notifications/}).click()
    let alerts=page.getByRole('dialog',{name:'Notifications',exact:true})
    await alerts.getByText('Due now: Submit the budget',{exact:true}).waitFor()
    await alerts.getByText('Due soon',{exact:true}).waitFor()
    assert.equal(await alerts.getByRole('link').filter({hasText:'Submit the budget'}).getAttribute('href'),`/app?task=${taskId}`)
    await alerts.getByRole('button',{name:'Mark Approve payroll as read',exact:true}).click()
    await alerts.getByRole('button',{name:'Mark Approve payroll as read',exact:true}).waitFor({state:'detached'})
    await alerts.getByRole('link').filter({hasText:'Submit the budget'}).click()
    await page.getByRole('link',{name:'All tasks',exact:true}).waitFor()
    await page.getByRole('button',{name:'Submit the budget',exact:true}).waitFor()
    assert.equal(await page.getByRole('button',{name:'Another task',exact:true}).count(),0)
    await page.getByRole('link',{name:'All tasks',exact:true}).click()
    await page.getByRole('button',{name:/Notifications/}).click()
    alerts=page.getByRole('dialog',{name:'Notifications',exact:true})
    await alerts.getByRole('link').filter({hasText:'Approve payroll'}).click()
    await page.getByRole('heading',{name:'Approve payroll',exact:true}).waitFor()
    assert.equal(new URL(page.url()).searchParams.get('record'),recordId)
    await page.getByRole('link',{name:'All records',exact:true}).click()
    assert.equal(await page.getByRole('button',{name:'Add a responsibility',exact:true}).count(),0)
    assert.equal(await page.getByLabel('Deadline (optional)',{exact:true}).count(),0)
    assert(await page.getByRole('button',{name:'Save notes',exact:true}).isVisible())
    assert.deepEqual(errors, [])
    console.log(
      JSON.stringify({
        deadlineReminders: 'passed',
        exactReminderLinks: 'passed',
        legacyDeadlineReminderAndReadOnlyResponsibility: 'passed',
        groups: 'passed',
        directMessages: 'passed',
        replyContext: 'passed',
        mentions: 'passed',
        notifications: 'passed',
        idempotentRetry: 'passed',
        recordLinks: 'passed',
        safeTextRendering: 'passed',
        responsiveWidths: [320, 360, 390, 768, 1024, 1440],
        accessRevocation: 'passed',
      }),
    )
  } finally {
    await browser.close()
    await server.close()
  }
})().catch((e) => {
  console.error(e)
  process.exit(1)
})

