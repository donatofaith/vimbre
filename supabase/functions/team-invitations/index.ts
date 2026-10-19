import { createClient } from '@supabase/supabase-js'

const origins = new Set(['https://vimbre.vercel.app', 'http://localhost:5173', 'http://127.0.0.1:5173'])
const redirectTo = 'https://vimbre.vercel.app/auth/callback'
Deno.serve(async (request: Request) => {
  const origin = request.headers.get('origin')
  const headers = {
    'Access-Control-Allow-Origin': origin && origins.has(origin) ? origin : 'https://vimbre.vercel.app',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
    'Vary': 'Origin',
  }
  const respond = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers })
  if (origin && !origins.has(origin)) return respond(403, { error: 'This app address is not allowed.' })
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })
  if (request.method !== 'POST') return respond(405, { error: 'Use POST.' })
  const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1]
  if (!token) return respond(401, { error: 'Sign in to invite your team.' })
  const url = Deno.env.get('SUPABASE_URL')!
  const key = Deno.env.get('SUPABASE_ANON_KEY')!
  const caller = createClient(url, key, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } })
  const { data: identity, error: authError } = await caller.auth.getUser(token)
  if (authError || !identity.user?.email_confirmed_at) return respond(401, { error: 'Sign in with a confirmed email.' })
  try {
    const text = await request.text()
    if (text.length > 4096) return respond(413, { error: 'Invitation details are too long.' })
    const body = JSON.parse(text)
    if (!body || !['create', 'resend'].includes(body.action)) return respond(400, { error: 'Choose an invitation action.' })
    const { data, error: preparationError } = await caller.rpc('prepare_invitation', {
      p_action: body.action, p_id: body.id ?? null, p_email: body.email ?? null,
      p_full_name: body.full_name ?? null, p_role: body.role ?? null, p_department: body.department_id ?? null,
    })
    if (preparationError) {
      console.error('Invitation preparation rejected', { code: preparationError.code, message: preparationError.message })
      const known = [
        'An active HR Admin account is required', 'Check the name, email and role', 'Department is unavailable',
        'Choose a department for this person', 'This invitation cannot be resent', 'Wait one minute before resending',
        'Invitation email limit reached. Please try again later', 'An invitation is already pending for this email',
        'This email already belongs to a workspace. Existing members can be managed on the Team page', 'This email already belongs to a workspace',
      ]
      return respond(preparationError.code === '42501' ? 403 : 400, { error: known.includes(preparationError.message) ? preparationError.message : 'Could not prepare the invitation. Check the details and retry.' })
    }
    const invite = data?.[0]
    if (!invite) return respond(500, { error: 'Could not prepare the invitation.' })
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } })
    // These are display details only. Membership and role still come from the
    // verified database invitation, never editable user metadata or request fields.
    const { data: context, error: contextError } = await caller.from('invitations')
      .select('company_id,role,invited_user_id').eq('id', invite.invitation_id).single()
    const [company, inviter] = contextError || !context ? [] : await Promise.all([
      caller.from('companies').select('name').eq('id', context.company_id).single(),
      caller.from('profiles').select('full_name').eq('id', identity.user.id).single(),
    ])
    const metadata = {
      invitation_id: invite.invitation_id,
      invitation_email_purpose: 'team_invitation',
      full_name: invite.full_name,
      invitation_company_name: company?.data?.name,
      invitation_inviter_name: inviter?.data?.full_name,
      invitation_role_label: context?.role === 'hr_admin' ? 'HR Admin' : context?.role === 'manager' ? 'Manager' : context?.role === 'employee' ? 'Employee' : null,
    }
    if (contextError || company?.error || inviter?.error || !metadata.invitation_company_name || !metadata.invitation_inviter_name || !metadata.invitation_role_label) {
      await admin.rpc('complete_invitation_delivery', { p_id: invite.email_log_id, p_status: 'failed', p_error_code: 'invitation_context_unavailable' })
      return respond(502, { invitation_id: invite.invitation_id, error: 'The invitation is saved, but its email details could not be prepared. Please try Resend.' })
    }
    // OTP options populate metadata for a new account. Refresh the display details
    // on an existing pending account as well, so resends reflect the current role.
    if (context.invited_user_id) {
      const { error: updateError } = await admin.auth.admin.updateUserById(context.invited_user_id, { user_metadata: metadata })
      if (updateError) {
        await admin.rpc('complete_invitation_delivery', { p_id: invite.email_log_id, p_status: 'failed', p_error_code: updateError.code ?? 'invitation_metadata_failed' })
        return respond(502, { invitation_id: invite.invitation_id, error: 'The invitation is saved, but its email details could not be prepared. Please try Resend.' })
      }
    }
    // The recipient starts on another device: email sign-in uses an implicit link.
    // Membership remains inactive until the verified recipient explicitly accepts it.
    const mailer = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, flowType: 'implicit' } })
    const { error: mailError } = await mailer.auth.signInWithOtp({
      email: invite.email,
      options: { shouldCreateUser: true, emailRedirectTo: redirectTo, data: metadata },
    })
    const { error: logError } = await admin.rpc('complete_invitation_delivery', {
      p_id: invite.email_log_id, p_status: mailError ? 'failed' : 'accepted', p_error_code: mailError?.code ?? null,
    })
    if (logError) console.error('Invitation email status could not be recorded', { code: logError.code })
    if (mailError) {
      console.error('Invitation email request failed', { code: mailError.code, status: mailError.status })
      return respond(502, { invitation_id: invite.invitation_id, error: 'The invitation is saved, but its email could not be sent. Wait one minute and try Resend.' })
    }
    return respond(200, { invitation_id: invite.invitation_id, delivery: 'accepted' })
  } catch (error) {
    console.error('Invitation request failed', { kind: error instanceof Error ? error.name : 'UnknownError' })
    return respond(400, { error: 'Could not process the invitation. Check your connection and retry.' })
  }
})
