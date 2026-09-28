import { getAllContent } from '@/app/actions/site-content'
import { mergeContent } from '@/lib/site-content'
import { ContentEditor } from '@/components/admin/content-editor'

export const dynamic = 'force-dynamic'

export default async function AdminContentPage() {
  const overrides = await getAllContent()
  const initial = mergeContent(overrides)
  return <ContentEditor initial={initial} />
}
