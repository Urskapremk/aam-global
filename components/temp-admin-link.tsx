import Link from 'next/link'
import { Shield } from 'lucide-react'

/**
 * TEMPORARY: floating shortcut to the admin panel from the public site.
 * Remove this component (and its usage in app/page.tsx) once no longer needed.
 */
export function TempAdminLink() {
  return (
    <Link
      href="/admin"
      className="fixed bottom-5 right-5 z-50 inline-flex items-center gap-2 rounded-full border border-border bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-lg transition-opacity hover:opacity-90"
    >
      <Shield className="h-4 w-4" strokeWidth={1.5} />
      Admin
    </Link>
  )
}
