# Capture meeting recording pilot

Vimbre records the device microphone in the current tab. Users confirm that everyone agreed before starting, then stop, play, download or discard the recording. At 30 minutes the recorder stops while the tab is running. After the user selects Transcribe recording, the browser sends the audio to the authenticated Capture function. That function passes the recording to ElevenLabs Scribe v2 and returns text without creating a Capture or storing the audio in Vimbre. The user reviews the transcript and chooses whether to draft tasks and decisions with the existing Capture workflow.

## Pilot setup

1. Apply the Capture recording allowance and pilot membership migrations to the pilot Supabase project and deploy the `capture-transcribe` Edge Function there.
2. In ElevenLabs, create an API key restricted to Speech to Text and set an account or key spend limit where available. In Supabase Edge Function Secrets, set `ELEVENLABS_API_KEY`. Add the approved Auth user ID to `private.capture_recording_pilot_members` through the database administrator. Use an active account with Capture AI and billing eligibility.
3. Set `VITE_CAPTURE_RECORDING_ENABLED=true` on the pilot frontend and rebuild. The switch is public. Keep the API key exclusively in Supabase secrets. The function accepts browser requests from Vimbre's known deployment origins.
4. Before using a customer recording, confirm the ElevenLabs account's data terms. Set `ELEVENLABS_ZERO_RETENTION=true` only if the account supports the enterprise zero-retention option. By default, provider retention follows the account's settings and terms.
5. Open Capture directly on the pilot URL. Verify microphone permission, playback, provider transcription and explicit drafting with a short synthetic or approved recording. Repeat in desktop Chrome and Safari on an iPhone. Run a full-length session to measure processing time and confirm whether a synchronous response is reliable. If entering the workspace from a public page leaves the previous document's microphone policy in effect, reload Capture before starting.

Pilot limits are 16 MiB per upload and three submitted transcriptions per account each UTC day. A provider error may still consume an attempt. The 30-minute timer is enforced by the app; the upload endpoint checks bytes and container headers, not decoded audio duration. Keep the allowlist and provider spend limit in place. Review server-side duration validation, long recordings and provider retention before broad rollout.
