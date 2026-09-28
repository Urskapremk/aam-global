import { redirect } from 'next/navigation'

// "Send email" now lives inside the inbox. Keep this old route working by
// redirecting to the inbox compose view.
export default function ComposePage() {
  redirect('/admin/inbox?folder=compose')
}
