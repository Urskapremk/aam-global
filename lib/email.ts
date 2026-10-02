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
 * Soft sky header + white body + pale footer so messages stay pleasant in
 * typical mail apps (and resist dark-mode inversion better than a navy block).
 */
export function emailShell(title: string, bodyHtml: string): string {
  const NAVY = '#1e3a5f'
  const INK = '#2f3b48'
  const MUTED = '#6b7a8a'
  const SKY = '#eef5fb'
  const PAPER = '#ffffff'
  const FOOT = '#f7fafc'
  const LINE = '#dce6f0'
  const OUTER = '#e4eef6'
  const SERIF = `'Cormorant Garamond', Cormorant, Georgia, 'Times New Roman', serif`
  const SANS = `-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`
  const anchor = (color: string, size: number) =>
    `<img width="${size}" height="${size}" alt="" style="display:inline-block;vertical-align:middle;border:0" src="https://api.iconify.design/lucide/anchor.svg?color=${encodeURIComponent(color)}&width=${size}&height=${size}" />`

  // Wrap reply body so text colour/background stay light even if a client
  // tries to invert the outer table cells.
  const body = `<div class="dm-white dm-ink" style="background-color:${PAPER};color:${INK};font-family:${SANS};font-size:16px;font-weight:400;line-height:1.75">${bodyHtml}</div>`

  return `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light only" />
    <meta name="supported-color-schemes" content="light only" />
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&display=swap');
      :root { color-scheme: light only; supported-color-schemes: light only; }
      body, table, td, div, p, a, span { color-scheme: light only; }

      /* Outlook.com / new Outlook dark mode */
      [data-ogsc] .dm-sky,   [data-ogsb] .dm-sky   { background-color:${SKY} !important; }
      [data-ogsc] .dm-white, [data-ogsb] .dm-white { background-color:${PAPER} !important; }
      [data-ogsc] .dm-foot,  [data-ogsb] .dm-foot  { background-color:${FOOT} !important; }
      [data-ogsc] .dm-outer, [data-ogsb] .dm-outer { background-color:${OUTER} !important; }
      [data-ogsc] .dm-ink   { color:${INK} !important; }
      [data-ogsc] .dm-muted { color:${MUTED} !important; }
      [data-ogsc] .dm-brand { color:${NAVY} !important; }
      [data-ogsc] .dm-eyebrow { color:${MUTED} !important; }

      /* Apple Mail / iOS / some webmail dark modes */
      @media (prefers-color-scheme: dark) {
        .dm-sky   { background-color:${SKY} !important; }
        .dm-white { background-color:${PAPER} !important; }
        .dm-foot  { background-color:${FOOT} !important; }
        .dm-outer { background-color:${OUTER} !important; }
        .dm-ink   { color:${INK} !important; }
        .dm-muted { color:${MUTED} !important; }
        .dm-brand { color:${NAVY} !important; }
        .dm-eyebrow { color:${MUTED} !important; }
      }
    </style>
    <!--[if !mso]><!-->
    <link
      rel="stylesheet"
      href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&display=swap"
    />
    <!--<![endif]-->
  </head>
  <body class="dm-outer" bgcolor="${OUTER}" style="margin:0;padding:0;background-color:${OUTER};font-family:${SANS};color:${INK};-webkit-text-size-adjust:100%">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${OUTER}" class="dm-outer" style="background-color:${OUTER}">
      <tr>
        <td align="center" style="padding:36px 16px">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" bgcolor="${PAPER}" class="dm-white" style="width:100%;max-width:560px;background-color:${PAPER};border:1px solid ${LINE};border-radius:16px;overflow:hidden">
            <!-- Soft light header (not a dark navy block) -->
            <tr>
              <td bgcolor="${SKY}" class="dm-sky" style="background-color:${SKY};padding:32px 36px 28px;border-bottom:1px solid ${LINE}">
                <div>
                  ${anchor(NAVY, 20)}
                  <span class="dm-brand" style="color:${NAVY};font-family:${SERIF};font-size:22px;font-weight:600;letter-spacing:0.22em;vertical-align:middle;margin-left:10px">AAM</span>
                </div>
                <div class="dm-brand" style="color:${NAVY};font-family:${SERIF};font-size:26px;font-weight:500;letter-spacing:0.3px;line-height:1.25;margin-top:18px">${BRAND_NAME}</div>
                <div class="dm-eyebrow" style="color:${MUTED};font-size:11px;letter-spacing:0.18em;text-transform:uppercase;margin-top:10px">${escapeAttr(title)}</div>
              </td>
            </tr>
            <!-- Body -->
            <tr>
              <td bgcolor="${PAPER}" class="dm-white dm-ink" style="background-color:${PAPER};padding:36px;color:${INK};font-family:${SANS};font-size:16px;font-weight:400;line-height:1.75">
                ${body}
              </td>
            </tr>
            <!-- Footer -->
            <tr>
              <td bgcolor="${FOOT}" class="dm-foot dm-muted" style="background-color:${FOOT};border-top:1px solid ${LINE};padding:26px 36px;color:${MUTED};font-family:${SANS};font-size:12px;line-height:1.7">
                <div>
                  ${anchor(NAVY, 15)}
                  <span class="dm-brand" style="font-family:${SERIF};font-size:16px;font-weight:600;letter-spacing:0.2em;color:${NAVY};vertical-align:middle;margin-left:8px">AAM</span>
                </div>
                <div class="dm-ink" style="margin-top:10px;color:${INK};font-size:13px">${BRAND_NAME}</div>
                <div style="margin-top:2px">${BRAND_LOCATION}</div>
                <div class="dm-ink" style="margin-top:10px;color:${INK}">Team Mike Schneider</div>
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
