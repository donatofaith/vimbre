const assert = require('node:assert/strict')
const { start } = require('./capture-browser-fixture.cjs')

async function run() {
  process.env.VITE_CAPTURE_RECORDING_ENABLED = 'true'
  const { page, state, close } = await start()
  try {
    let posts = 0
    await page.route('**/functions/v1/capture-transcribe', async route => {
      if (route.request().method() === 'GET') return route.fulfill({ json: { available: true } })
      posts++
      assert.match(route.request().headers()['content-type'], /^audio\//)
      assert.ok(route.request().postDataBuffer().length > 16)
      return posts === 1
        ? route.fulfill({ status: 502, json: { code: 'transcription_failed' } })
        : route.fulfill({ json: { transcript: 'Amara will send the quote. '.repeat(630) } })
    })
    await page.addInitScript(() => {
      window.recordingTracks = []
      navigator.mediaDevices.getUserMedia = async () => {
        if (window.denyMicrophone) throw new DOMException('Denied', 'NotAllowedError')
        const context = new AudioContext()
        const tone = context.createOscillator()
        const output = context.createMediaStreamDestination()
        tone.connect(output)
        tone.start()
        await context.resume()
        window.recordingTracks = output.stream.getTracks()
        return output.stream
      }
    })
    await page.reload()
    await page.setViewportSize({ width: 320, height: 700 })
    await page.getByRole('button', { name: 'Record meeting' }).click()
    const dialog = page.getByRole('dialog', { name: 'Record an in-person meeting' })
    assert.equal(await dialog.getByText(/ElevenLabs/).count(), 0)
    assert.ok(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth))
    assert.ok(await dialog.getByRole('button', { name: 'Start recording' }).isDisabled())
    await dialog.getByRole('checkbox').check()
    await page.evaluate(() => { window.denyMicrophone = true })
    await dialog.getByRole('button', { name: 'Start recording' }).click()
    await dialog.getByRole('alert').filter({ hasText: 'Microphone access was blocked' }).waitFor()
    await page.evaluate(() => { window.denyMicrophone = false })
    await dialog.getByRole('button', { name: 'Start recording' }).click()
    await dialog.getByRole('timer').filter({ hasText: '00:01' }).waitFor()
    assert.equal(await dialog.locator('.vc-record-dot').evaluate(dot => getComputedStyle(dot).backgroundColor), 'rgb(220, 38, 56)')
    await dialog.getByRole('button', { name: 'Stop recording' }).click()
    await dialog.getByRole('link', { name: 'Download recording' }).waitFor()
    assert.equal(await dialog.locator('.vc-record-dot').count(), 0)
    assert.equal(posts, 0)
    assert.equal(await page.evaluate(() => window.recordingTracks.every(track => track.readyState === 'ended')), true)
    await dialog.getByRole('button', { name: 'Transcribe recording' }).click()
    await dialog.getByRole('alert').filter({ hasText: 'Your recording is still here' }).waitFor()
    await dialog.getByRole('button', { name: 'Transcribe recording' }).click()
    const transcript = page.getByRole('textbox', { name: 'Meeting transcript' })
    await transcript.waitFor()
    assert.equal((await transcript.inputValue()).length, 'Amara will send the quote. '.repeat(630).length)
    assert.equal(await page.getByRole('button', { name: 'Draft tasks and decisions' }).isDisabled(), true)
    assert.equal(state.calls.filter(call => call.path.endsWith('/ai-run')).length, 0)
    await transcript.fill('Amara will send the quote.')
    await page.getByRole('button', { name: 'Draft tasks and decisions' }).click()
    await page.waitForFunction(() => document.querySelector('.vc-review-grid'))
    assert.equal(state.sources.at(-1).source_type, 'meeting')
    await page.getByRole('button', { name: 'New capture' }).click()
    await page.getByRole('button', { name: 'Record meeting' }).click()
    await dialog.getByRole('checkbox').check()
    await dialog.getByRole('button', { name: 'Start recording' }).click()
    await dialog.getByRole('timer').filter({ hasText: '00:01' }).waitFor()
    await page.evaluate(() => {
      const now = Date.now.bind(Date)
      Date.now = () => now() + 30 * 60_000
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await dialog.getByText('Recording stopped at 30 minutes.').waitFor()
    await dialog.getByRole('link', { name: 'Download recording' }).waitFor()
    assert.equal(posts, 2)
    page.once('dialog', browserDialog => browserDialog.accept())
    await dialog.getByRole('button', { name: 'Discard recording' }).click()
    await dialog.waitFor({ state: 'hidden' })
    console.log('Capture recorder: consent, denied permission, audio, auto-stop, retry, transcript limit and explicit meeting draft passed.')
  } finally {
    await close()
  }
}
run().catch(error => { console.error(error); process.exitCode = 1 })
