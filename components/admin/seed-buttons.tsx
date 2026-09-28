'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Download } from 'lucide-react'
import { seedProducts, seedExcursions } from '@/app/actions/seed'

function SeedButton({
  label,
  action,
}: {
  label: string
  action: () => Promise<{ skipped: boolean; inserted: number }>
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  return (
    <button
      type="button"
      onClick={async () => {
        setLoading(true)
        try {
          await action()
          router.refresh()
        } finally {
          setLoading(false)
        }
      }}
      disabled={loading}
      className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground hover:bg-secondary disabled:opacity-60"
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Download className="h-4 w-4" />
      )}
      {label}
    </button>
  )
}

export function ImportProductsButton() {
  return <SeedButton label="Import starter catalogue" action={seedProducts} />
}

export function ImportExcursionsButton() {
  return <SeedButton label="Add starter excursions" action={seedExcursions} />
}
