'use client'

import { expiryNoticeText, type ExpiryTone } from '@/lib/compliance'
import { useLang } from '@/lib/i18n/context'
import { cn } from '@/lib/utils'

const TONE_CLASS: Record<ExpiryTone, string> = {
  none: 'border-border bg-muted/40 text-muted-foreground',
  current: 'border-border bg-card text-foreground',
  soon: 'border-[#8f6d3a]/35 bg-[#8f6d3a]/12 text-[#7d5f31]',
  expired: 'border-[#b0203a]/35 bg-[#b0203a]/10 text-[#8f1a2f]',
}

export function ExpiryNotice({
  expiryDate,
  days,
}: {
  expiryDate: string | null | undefined
  days?: number | null
}) {
  const { lang } = useLang()
  const { tone, text } = expiryNoticeText(lang, expiryDate, days)
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium',
        TONE_CLASS[tone],
      )}
    >
      {tone === 'soon' || tone === 'expired' ? (
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" aria-hidden />
      ) : null}
      {text}
    </span>
  )
}
