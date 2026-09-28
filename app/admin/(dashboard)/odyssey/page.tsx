import { getOdysseyTiers, getOdysseyActivities } from '@/app/actions/odyssey'
import { OdysseyPricingManager } from '@/components/admin/odyssey-pricing-manager'

export const dynamic = 'force-dynamic'

export default async function AdminOdysseyPage() {
  const [tiers, activities] = await Promise.all([
    getOdysseyTiers(),
    getOdysseyActivities(),
  ])
  return <OdysseyPricingManager initialTiers={tiers} initialActivities={activities} />
}
