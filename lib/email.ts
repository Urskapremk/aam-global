import 'server-only'

/**
 * Central email config + a graceful send() helper.
 *
 * Sending uses Resend's HTTP API directly (no SDK needed).
 * If RESEND_API_KEY is not set yet, send() becomes a safe no-op that logs a
 * warning and returns { skipped: true } — so the preview and forms keep working
 * before the key is added.
 */

// Who notifications about new inquiries/orders go to.
export const NOTIFY_EMAIL =
  process.env.NOTIFY_EMAIL || 'islandadventuresmadagascar@gmail.com'

// The "from" address. Uses the verified aamglobalgroup.com domain in Resend.
// Override with EMAIL_FROM env var if you want a different sender.
export const EMAIL_FROM =
  process.env.EMAIL_FROM || 'AAM <info@aamglobalgroup.com>'

export const EMAIL_CONFIGURED = Boolean(process.env.RESEND_API_KEY)

export type EmailAttachment = {
  filename: string
  /**
   * A hosted URL Resend downloads the file from (preferred). Used for large
   * files like phone photos, which are uploaded to Blob first.
   */
  path?: string
  /** Base64-encoded file contents (no data: prefix). Legacy / small files. */
  content?: string
  /** Optional MIME type, e.g. "image/jpeg". */
  contentType?: string
}

type SendArgs = {
  to: string | string[]
  subject: string
  html: string
  text?: string
  replyTo?: string
  attachments?: EmailAttachment[]
}

type SendResult =
  | { ok: true; id: string | null }
  | { ok: false; skipped?: boolean; error: string }

export async function sendEmail({
  to,
  subject,
  html,
  text,
  replyTo,
  attachments,
}: SendArgs): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY
  if (!key) {
    console.warn('[v0] RESEND_API_KEY not set — email send skipped:', subject)
    return { ok: false, skipped: true, error: 'RESEND_API_KEY not set' }
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
        ...(text ? { text } : {}),
        ...(replyTo ? { reply_to: replyTo } : {}),
        ...(attachments && attachments.length
          ? {
              // Resend accepts either a hosted `path` (URL it downloads) or
              // inline base64 `content`. We prefer `path` for large files.
              attachments: attachments.map((a) => ({
                filename: a.filename,
                ...(a.path ? { path: a.path } : { content: a.content }),
                ...(a.contentType ? { content_type: a.contentType } : {}),
              })),
            }
          : {}),
      }),
    })

    if (!res.ok) {
      const detail = await res.text()
      console.error('[v0] Resend send failed:', res.status, detail)
      return { ok: false, error: `Resend ${res.status}: ${detail}` }
    }

    const data = (await res.json()) as { id?: string }
    return { ok: true, id: data.id ?? null }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[v0] Resend send error:', msg)
    return { ok: false, error: msg }
  }
}

// Brand constants used across emails.
export const BRAND_NAME = 'African Adventures Madagascar'
export const BRAND_LOCATION = 'Nosy Komba, Madagascar'

/**
 * Branded HTML wrapper for outgoing emails. Mirrors the website: deep ocean
 * navy (#1e3a5f), a serif "anchor + AAM" logo lockup with wide tracking, a
 * steel-blue accent divider, and a serif brand name (Cormorant → Georgia
 * fallback in email clients). bgcolor attributes are set alongside inline
 * styles so the palette holds up better in dark-mode mail clients.
 */
export function emailShell(title: string, bodyHtml: string): string {
  // Mirror the website exactly: light throughout, brand navy header, and the
  // Cormorant Garamond serif wordmark. Always light — never a dark theme.
  const NAVY = '#1e3a5f' // --primary (brand ocean navy, same as the site)
  const INK = '#3a4653' // body text (soft, not pure black)
  const MUTED_C = '#8592a0' // --muted-foreground
  // Cormorant Garamond is loaded below; the wordmark + brand name use it, just
  // like the site header. Body copy uses the system sans (like the site body).
  const SERIF = `'Cormorant Garamond', Cormorant, Georgia, 'Times New Roman', serif`
  const SANS = `-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`
  // Thin, line-drawn anchor matching the site's lucide icon (stroke 1.5).
  const anchor = (color: string, size: number) =>
    `<img width="${size}" height="${size}" alt="" style="display:inline-block;vertical-align:middle" src="https://api.iconify.design/lucide/anchor.svg?color=${encodeURIComponent(color)}&width=${size}&height=${size}" />`
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light only" />
    <meta name="supported-color-schemes" content="light only" />
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&display=swap');
      :root { color-scheme: light only; supported-color-schemes: light only; }

      /* Stop Outlook.com / new Outlook from inverting the palette in dark mode.
         Outlook tags recoloured elements with data-ogsc (text) / data-ogsb
         (background); we re-assert the exact light colours on those elements. */
      [data-ogsc] .dm-navy,  [data-ogsb] .dm-navy  { background-color:#1e3a5f !important; }
      [data-ogsc] .dm-white, [data-ogsb] .dm-white { background-color:#ffffff !important; }
      [data-ogsc] .dm-foot,  [data-ogsb] .dm-foot  { background-color:#f6f8fb !important; }
      [data-ogsc] .dm-onnavy { color:#ffffff !important; }
      [data-ogsc] .dm-eyebrow { color:#b7c7d8 !important; }
      [data-ogsc] .dm-ink   { color:#3a4653 !important; }
      [data-ogsc] .dm-muted { color:#8592a0 !important; }
      [data-ogsc] .dm-brand { color:#1e3a5f !important; }

      /* Keep it light in Apple Mail / iOS dark mode too. */
      @media (prefers-color-scheme: dark) {
        .dm-navy  { background-color:#1e3a5f !important; }
        .dm-white { background-color:#ffffff !important; }
        .dm-foot  { background-color:#f6f8fb !important; }
        .dm-onnavy { color:#ffffff !important; }
        .dm-eyebrow { color:#b7c7d8 !important; }
        .dm-ink   { color:#3a4653 !important; }
        .dm-muted { color:#8592a0 !important; }
        .dm-brand { color:#1e3a5f !important; }
      }
    </style>
    <!--[if !mso]><!-->
    <link
      rel="stylesheet"
      href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&display=swap"
    />
    <!--<![endif]-->
  </head>
  <body style="margin:0;padding:0;background-color:#eef3f8;font-family:${SANS};color:${INK};-webkit-text-size-adjust:100%">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#eef3f8" style="background-color:#eef3f8">
      <tr>
        <td align="center" style="padding:32px 16px">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="width:100%;max-width:560px;background-color:#ffffff;border:1px solid #e6ebf1;border-radius:14px;overflow:hidden">
            <!-- Header -->
            <tr>
              <td bgcolor="${NAVY}" class="dm-navy" style="background-color:${NAVY};padding:34px 36px 30px">
                <div>
                  ${anchor('#ffffff', 20)}
                  <span class="dm-onnavy" style="color:#ffffff;font-family:${SERIF};font-size:24px;font-weight:600;letter-spacing:0.2em;vertical-align:middle;margin-left:10px">AAM</span>
                </div>
                <div class="dm-onnavy" style="color:#ffffff;font-family:${SERIF};font-size:28px;font-weight:500;letter-spacing:0.5px;line-height:1.2;margin-top:22px">${BRAND_NAME}</div>
                <div class="dm-eyebrow" style="color:#b7c7d8;font-size:10px;letter-spacing:2.5px;text-transform:uppercase;margin-top:10px">${escapeAttr(title)}</div>
              </td>
            </tr>
            <!-- Body -->
            <tr>
              <td bgcolor="#ffffff" class="dm-white dm-ink" style="background-color:#ffffff;padding:36px;color:${INK};font-family:${SANS};font-size:15px;font-weight:400;line-height:1.7">${bodyHtml}</td>
            </tr>
            <!-- Footer -->
            <tr>
              <td bgcolor="#f6f8fb" class="dm-foot dm-muted" style="background-color:#f6f8fb;border-top:1px solid #e6ebf1;padding:24px 36px;color:${MUTED_C};font-family:${SANS};font-size:12px;line-height:1.7">
                <div>
                  ${anchor(NAVY, 15)}
                  <span class="dm-brand" style="font-family:${SERIF};font-size:17px;font-weight:600;letter-spacing:0.2em;color:${NAVY};vertical-align:middle;margin-left:8px">AAM</span>
                </div>
                <div class="dm-ink" style="margin-top:8px;color:${INK}">${BRAND_NAME}</div>
                <div style="margin-top:1px">${BRAND_LOCATION}</div>
                <div class="dm-ink" style="margin-top:8px;color:${INK}">Team Mike Schneider</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

/** Escape a string for safe use inside an HTML attribute/text node. */
function escapeAttr(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
