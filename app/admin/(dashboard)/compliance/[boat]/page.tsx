import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

import { getVesselDocuments } from '@/app/actions/compliance'
import { DocumentRegister } from '@/components/compliance/document-register'
import { BOATS } from '@/lib/boats'

export const dynamic = 'force-dynamic'

export default async function DocumentRegisterPage({
  params,
}: {
  params: Promise<{ boat: string }>
}) {
  const { boat } = await params
  const vessel = BOATS.find((b) => b.id === boat)
  if (!vessel) notFound()

  const { live, archived } = await getVesselDocuments(boat)

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link
        href="/admin/compliance"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to compliance
      </Link>
      <DocumentRegister
        boat={boat}
        boatName={vessel.name}
        live={live}
        archived={archived}
      />
    </div>
  )
}
