import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { createSession } from '@/lib/auth'
import { appUrl } from '@/lib/app-url'

type SafeError = {
  name?: string
  prismaCode?: string
}

function safeError(error: unknown): SafeError {
  if (!error || typeof error !== 'object') return {}
  const candidate = error as { name?: unknown; code?: unknown }
  return {
    ...(typeof candidate.name === 'string' ? { name: candidate.name.slice(0, 80) } : {}),
    ...(typeof candidate.code === 'string' && /^P\d{4}$/.test(candidate.code)
      ? { prismaCode: candidate.code }
      : {}),
  }
}

function safeGoogleError(value: unknown): string | undefined {
  if (
    typeof value === 'string' &&
    /^(access_denied|invalid_request|invalid_grant|unauthorized_client|unsupported_grant_type|invalid_client)$/.test(value)
  ) {
    return value
  }
  return undefined
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const providerError = safeGoogleError(searchParams.get('error'))
  const jar = await cookies()
  const expected = jar.get('jh_oauth_state')?.value
  let stage = 'callback_validation'

  const fail = (reason: string, details: Record<string, unknown> = {}) => {
    const { error, ...safeDetails } = details
    const forwardedProto = req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim().toLowerCase()
    console.error('[google-oauth] callback failed', JSON.stringify({
      stage,
      reason,
      ...safeError(error),
      ...safeDetails,
      requestProtocol: req.nextUrl.protocol.replace(':', ''),
      forwardedProto: forwardedProto === 'https' || forwardedProto === 'http' ? forwardedProto : undefined,
      stateParameterPresent: Boolean(state),
      stateCookiePresent: Boolean(expected),
    }))
    const response = NextResponse.redirect(appUrl('/login?error=auth_failed'))
    response.cookies.delete('jh_oauth_state')
    return response
  }

  if (providerError) return fail('google_returned_error', { providerError })
  if (!code || !state || !expected) return fail('missing_callback_parameter_or_state_cookie')
  if (state !== expected) return fail('state_mismatch')

  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const redirectUri = process.env.GOOGLE_REDIRECT_URI
  const missingConfiguration = [
    !clientId && 'GOOGLE_CLIENT_ID',
    !clientSecret && 'GOOGLE_CLIENT_SECRET',
    !redirectUri && 'GOOGLE_REDIRECT_URI',
  ].filter((value): value is string => Boolean(value))
  if (missingConfiguration.length) {
    stage = 'configuration'
    return fail('missing_oauth_configuration', { missingConfiguration })
  }

  try {
    stage = 'authorization_code_exchange'
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId!,
        client_secret: clientSecret!,
        redirect_uri: redirectUri!,
        grant_type: 'authorization_code',
      }),
      cache: 'no-store',
    })
    if (!tokenRes.ok) {
      let providerError: string | undefined
      try {
        providerError = safeGoogleError((await tokenRes.json() as { error?: unknown }).error)
      } catch { /* The status is sufficient when Google returns a non-JSON error. */ }
      return fail('token_exchange_http_error', {
        httpStatus: tokenRes.status,
        ...(providerError ? { providerError } : {}),
      })
    }

    const tokenData = await tokenRes.json() as { access_token?: string }
    if (!tokenData.access_token) return fail('token_response_missing_access_token')

    stage = 'google_profile_fetch'
    const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
      cache: 'no-store',
    })
    if (!profileRes.ok) return fail('profile_http_error', { httpStatus: profileRes.status })

    stage = 'google_profile_validation'
    const profile = await profileRes.json() as {
      id?: string
      email?: string
      name?: string
      picture?: string
      verified_email?: boolean
    }
    if (!profile.id || !profile.email || !profile.verified_email) {
      return fail('profile_missing_required_verified_fields', {
        hasId: Boolean(profile.id),
        hasEmail: Boolean(profile.email),
        verifiedEmail: profile.verified_email === true,
      })
    }

    const email = profile.email.trim().toLowerCase()
    stage = 'account_lookup'
    const account = await db.account.findUnique({
      where: { provider_providerAccountId: { provider: 'google', providerAccountId: profile.id } },
      include: { user: true },
    })
    let user = account?.user

    if (!user) {
      stage = 'user_upsert'
      user = await db.user.upsert({
        where: { email },
        create: {
          id: crypto.randomUUID().replaceAll('-', '').slice(0, 30),
          email,
          name: profile.name,
          image: profile.picture,
          profile: { create: { displayName: profile.name, avatarUrl: profile.picture } },
        },
        update: { name: profile.name, image: profile.picture },
      })

      stage = 'account_link'
      await db.account.create({ data: { userId: user.id, provider: 'google', providerAccountId: profile.id } })
    }

    if (user.status !== 'active') return fail('user_not_active')

    const bootstrapEmail = process.env.INITIAL_SUPERADMIN_EMAIL?.trim().toLowerCase()
    const bootstrapEmailMatched = Boolean(bootstrapEmail && bootstrapEmail === email)
    if (bootstrapEmailMatched) {
      stage = 'initial_admin_assignment'
      await db.adminUser.upsert({
        where: { userId: user.id },
        create: { userId: user.id, role: 'superadmin' },
        update: { role: 'superadmin' },
      })
    }

    stage = 'admin_role_lookup'
    const adminRecord = await db.adminUser.findUnique({ where: { userId: user.id }, select: { role: true } })
    const isAdmin = Boolean(adminRecord)
    console.info('[google-oauth] role resolved', JSON.stringify({
      bootstrapEmailConfigured: Boolean(bootstrapEmail),
      bootstrapEmailMatched,
      adminRecordPresent: isAdmin,
      adminRole: adminRecord?.role ?? null,
    }))

    stage = 'session_creation'
    await createSession(user.id)

    stage = 'activity_log'
    await db.userActivityLog.create({ data: { userId: user.id, action: 'google_login' } })

    const response = NextResponse.redirect(appUrl(isAdmin ? '/admin' : '/chat'))
    response.cookies.delete('jh_oauth_state')
    return response
  } catch (error) {
    return fail('unexpected_exception', { error })
  }
}
