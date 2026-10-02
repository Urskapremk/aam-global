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
 * Branded HTML wrapper for outgoing emails — soft coastal light theme.
 *
 * Uses hosted PNG brand marks (not Iconify SVG — often missing in mail apps)
 * and off-white #fffffe cells so Gmail/Apple dark mode is less likely to
 * invert the whole message to near-black.
 */
export function emailShell(title: string, bodyHtml: string): string {
  const NAVY = '#1e3a5f'
  const INK = '#2f3b48'
  const MUTED = '#5c6b7a'
  // Slightly off-white / tinted lights — many clients skip full inversion.
  const SKY = '#e8f2fa'
  const PAPER = '#fffffe'
  const FOOT = '#f3f7fb'
  const LINE = '#c9d7e6'
  const OUTER = '#dceaf4'
  const SERIF = `'Cormorant Garamond', Cormorant, Georgia, 'Times New Roman', serif`
  const SANS = `-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`
  // Production PNG (works in Gmail/Apple/Outlook). Alt text keeps “sidro” readable if blocked.
  const logo = (size: number) =>
    `<img src="https://www.aamglobalgroup.com/images/aam-icon-192.png" width="${size}" height="${size}" alt="⚓" style="display:inline-block;vertical-align:middle;border:0;outline:none;text-decoration:none;width:${size}px;height:${size}px" />`

  const body = `<div style="background-color:${PAPER};color:${INK};font-family:${SANS};font-size:16px;font-weight:400;line-height:1.75">${bodyHtml}</div>`

  return `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light only" />
    <meta name="supported-color-schemes" content="light only" />
    <style type="text/css">
      @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&display=swap');
      :root { color-scheme: light only !important; supported-color-schemes: light only !important; }
      body, table, td, div, p, a, span, img {
        color-scheme: light only !important;
        -webkit-text-size-adjust: 100%;
      }
      u + .body .force-light { background-color: ${PAPER} !important; color: ${INK} !important; }
      [data-ogsc] .force-sky,  [data-ogsb] .force-sky  { background-color: ${SKY} !important; }
      [data-ogsc] .force-paper,[data-ogsb] .force-paper{ background-color: ${PAPER} !important; }
      [data-ogsc] .force-foot, [data-ogsb] .force-foot { background-color: ${FOOT} !important; }
      [data-ogsc] .force-outer,[data-ogsb] .force-outer{ background-color: ${OUTER} !important; }
      [data-ogsc] .force-ink { color: ${INK} !important; }
      [data-ogsc] .force-brand { color: ${NAVY} !important; }
      [data-ogsc] .force-muted { color: ${MUTED} !important; }
      @media (prefers-color-scheme: dark) {
        .force-sky   { background-color: ${SKY} !important; }
        .force-paper { background-color: ${PAPER} !important; }
        .force-foot  { background-color: ${FOOT} !important; }
        .force-outer { background-color: ${OUTER} !important; }
        .force-ink   { color: ${INK} !important; }
        .force-brand { color: ${NAVY} !important; }
        .force-muted { color: ${MUTED} !important; }
      }
    </style>
    <!--[if !mso]><!-->
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&display=swap" />
    <!--<![endif]-->
  </head>
  <body class="body force-outer" bgcolor="${OUTER}" style="margin:0;padding:0;background-color:${OUTER};font-family:${SANS};color:${INK}">
    <div style="display:none;max-height:0;overflow:hidden;mso-hide:all">&nbsp;</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${OUTER}" class="force-outer" style="background-color:${OUTER}">
      <tr>
        <td align="center" bgcolor="${OUTER}" class="force-outer" style="padding:36px 16px;background-color:${OUTER}">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" bgcolor="${PAPER}" class="force-paper" style="width:100%;max-width:560px;background-color:${PAPER};border:1px solid ${LINE};border-radius:16px">
            <tr>
              <td bgcolor="${SKY}" class="force-sky" style="background-color:${SKY};padding:28px 32px 24px;border-bottom:3px solid ${NAVY}">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td valign="middle" style="padding-right:12px">${logo(36)}</td>
                    <td valign="middle" class="force-brand" style="color:${NAVY};font-family:${SERIF};font-size:26px;font-weight:700;letter-spacing:0.18em">AAM</td>
                  </tr>
                </table>
                <div class="force-brand" style="color:${NAVY};font-family:${SERIF};font-size:24px;font-weight:500;line-height:1.3;margin-top:16px">${BRAND_NAME}</div>
                <div class="force-muted" style="color:${MUTED};font-family:${SANS};font-size:12px;letter-spacing:0.12em;text-transform:uppercase;margin-top:8px">${escapeAttr(title)}</div>
              </td>
            </tr>
            <tr>
              <td bgcolor="${PAPER}" class="force-paper force-ink" style="background-color:${PAPER};padding:32px;color:${INK};font-family:${SANS};font-size:16px;line-height:1.75">
                ${body}
              </td>
            </tr>
            <tr>
              <td bgcolor="${FOOT}" class="force-foot force-muted" style="background-color:${FOOT};border-top:1px solid ${LINE};padding:24px 32px;color:${MUTED};font-family:${SANS};font-size:12px;line-height:1.7">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td valign="middle" style="padding-right:10px">${logo(28)}</td>
                    <td valign="middle" class="force-brand" style="color:${NAVY};font-family:${SERIF};font-size:18px;font-weight:700;letter-spacing:0.18em">AAM</td>
                  </tr>
                </table>
                <div class="force-ink" style="margin-top:12px;color:${INK};font-size:13px">${BRAND_NAME}</div>
                <div style="margin-top:2px">${BRAND_LOCATION}</div>
                <div class="force-ink" style="margin-top:10px;color:${INK}">Team Mike Schneider</div>
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
