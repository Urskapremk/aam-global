'use client'

import { officialDocTitle } from '@/lib/compliance'
import { useT } from '@/lib/i18n/context'

// Slovenian shows the translated title, with the filed official name underneath.
// English keeps the filed title and has no secondary line.
export function OfficialTitle({ name }: { name: string }) {
  const t = useT()
  const { primary, official } = officialDocTitle(t, name)
  if (!official) return <>{primary}</>
  return (
    <span className="inline-flex min-w-0 flex-col">
      <span>{primary}</span>
      <span className="text-[11px] font-normal normal-case tracking-normal text-muted-foreground">
        {official}
      </span>
    </span>
  )
}
