'use client'

import { useEffect } from 'react'
import { Printer } from 'lucide-react'

/**
 * Print controls for the official voyage-journal A4 page.
 * `autoPrint` (from ?print=1) fires the browser print dialog once on load —
 * that is how "Télécharger PDF" works: print → "Save as PDF".
 */
export function PrintControls({ autoPrint }: { autoPrint: boolean }) {
  useEffect(() => {
    if (autoPrint) {
      // A short delay lets fonts/layout settle before the print dialog opens.
      const t = setTimeout(() => window.print(), 500)
      return () => clearTimeout(t)
    }
  }, [autoPrint])

  return (
    <div className="mx-auto flex max-w-[800px] justify-end px-6 py-4 print:hidden">
      <button
        type="button"
        onClick={() => window.print()}
        className="flex min-h-11 cursor-pointer items-center gap-2 rounded-full bg-[#1e3a5f] px-5 text-[12px] font-semibold uppercase tracking-[0.14em] text-white hover:bg-[#274b78]"
      >
        <Printer className="h-4 w-4" aria-hidden />
        Imprimer / Enregistrer en PDF
      </button>
    </div>
  )
}
