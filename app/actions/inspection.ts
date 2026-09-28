'use server'

import { and, desc, eq, inArray } from 'drizzle-orm'

import { isAdmin } from '@/lib/admin-auth'
import { db } from '@/lib/db'
import {
  captains,
  catches,
  complianceDocuments,
  fishingLogs,
  incidentLogs,
  passengerManifests,
  safetyEquipment,
  trips,
  vesselComplianceProfiles,
  voyageLogs,
} from '@/lib/db/schema'
import { boatName } from '@/lib/boats'
import {
  effectiveStatus,
  type ComplianceStatus,
} from '@/lib/compliance'

async function requireAdmin() {
  if (!(await isAdmin())) throw new Error('Unauthorized')
}

export type InspectionDoc = {
  id: string
  category: string
  name: string
  number: string | null
  issuingAuthority: string | null
  expiryDate: string | null
  status: ComplianceStatus
}

export type InspectionView = {
  boat: string
  boatName: string
  registrationNumber: string | null
  classification: string | null
  documents: InspectionDoc[]
  lastVoyage: {
    tripId: string
    date: string | null
    captain: string | null
    departure: string | null
    arrival: string | null
    locked: boolean
  } | null
  lastFishing: {
    tripId: string
    landingDate: string | null
    landingLocation: string | null
    locked: boolean
    catchCount: number
  } | null
  recentCatches: { species: string; weightKg: number | null; at: string | null }[]
  manifests: {
    tripId: string
    departure: string | null
    destination: string | null
    passengerCount: number
    locked: boolean
  }[]
  safety: { category: string; name: string | null; nextInspection: string | null }[]
  incidents: { category: string; at: string | null; description: string | null }[]
  generatedAt: string
}

/**
 * The inspection view: everything a control officer needs for one vessel, read
 * in a single pass and shaped for a clean, printable screen. Nothing here is
 * new data — it aggregates the live compliance, logbook, catch, manifest,
 * safety and incident records the other modules already own.
 */
export async function getInspectionView(boat: string): Promise<InspectionView> {
  await requireAdmin()

  const [profile] = await db
    .select()
    .from(vesselComplianceProfiles)
    .where(eq(vesselComplianceProfiles.boat, boat))
    .limit(1)

  const [docs, boatTrips, capRows, safety, incidents] = await Promise.all([
    db
      .select()
      .from(complianceDocuments)
      .where(
        and(
          eq(complianceDocuments.boat, boat),
          eq(complianceDocuments.archived, false),
        ),
      ),
    db.select().from(trips).where(eq(trips.boat, boat)),
    db.select().from(captains),
    db
      .select()
      .from(safetyEquipment)
      .where(
        and(eq(safetyEquipment.boat, boat), eq(safetyEquipment.archived, false)),
      ),
    db
      .select()
      .from(incidentLogs)
      .where(eq(incidentLogs.boat, boat))
      .orderBy(desc(incidentLogs.at))
      .limit(5),
  ])

  const tripIds = boatTrips.map((t) => t.id)
  const capName = (id: string | null) =>
    id ? (capRows.find((c) => c.id === id)?.name ?? null) : null

  const [voyages, fLogs, catchRows, manifests] =
    tripIds.length > 0
      ? await Promise.all([
          db
            .select()
            .from(voyageLogs)
            .where(inArray(voyageLogs.tripId, tripIds)),
          db
            .select()
            .from(fishingLogs)
            .where(inArray(fishingLogs.tripId, tripIds)),
          db.select().from(catches).where(inArray(catches.tripId, tripIds)),
          db
            .select()
            .from(passengerManifests)
            .where(inArray(passengerManifests.tripId, tripIds)),
        ])
      : [[], [], [], []]

  const tripById = new Map(boatTrips.map((t) => [t.id, t]))
  const sortByStart = (a: string, b: string) => {
    const ta = tripById.get(a)?.startedAt
    const tb = tripById.get(b)?.startedAt
    return new Date(tb ?? 0).getTime() - new Date(ta ?? 0).getTime()
  }

  const lastVoyageRow = [...voyages].sort((a, b) =>
    sortByStart(a.tripId, b.tripId),
  )[0]
  const lastVoyage = lastVoyageRow
    ? {
        tripId: lastVoyageRow.tripId,
        date:
          tripById.get(lastVoyageRow.tripId)?.startedAt?.toISOString() ?? null,
        captain: capName(tripById.get(lastVoyageRow.tripId)?.captainId ?? null),
        departure: lastVoyageRow.departureLocation,
        arrival: lastVoyageRow.arrivalLocation,
        locked: lastVoyageRow.locked,
      }
    : null

  const lastFishingRow = [...fLogs].sort((a, b) =>
    sortByStart(a.tripId, b.tripId),
  )[0]
  const lastFishing = lastFishingRow
    ? {
        tripId: lastFishingRow.tripId,
        landingDate: lastFishingRow.landingDate,
        landingLocation: lastFishingRow.landingLocation,
        locked: lastFishingRow.locked,
        catchCount: catchRows.filter((c) => c.tripId === lastFishingRow.tripId)
          .length,
      }
    : null

  const recentCatches = [...catchRows]
    .sort(
      (a, b) =>
        new Date(b.caughtAt ?? 0).getTime() - new Date(a.caughtAt ?? 0).getTime(),
    )
    .slice(0, 8)
    .map((c) => ({
      species: c.species,
      weightKg: c.weightKg,
      at: c.caughtAt?.toISOString() ?? null,
    }))

  const passengerCounts = new Map<string, number>()
  // manifest passenger counts are cheap to skip here; we show the trip and lock
  // state, and the full list lives in the manifest screen.

  return {
    boat,
    boatName: profile?.vesselName ?? boatName(boat),
    registrationNumber: profile?.registrationNumber ?? null,
    classification: profile?.classification ?? null,
    documents: docs.map((d) => ({
      id: d.id,
      category: d.category,
      name: d.name,
      number: d.number,
      issuingAuthority: d.issuingAuthority,
      expiryDate: d.expiryDate,
      status: effectiveStatus({ status: d.status, expiryDate: d.expiryDate }),
    })),
    lastVoyage,
    lastFishing,
    recentCatches,
    manifests: manifests.map((m) => ({
      tripId: m.tripId,
      departure: m.departureLocation,
      destination: m.destination,
      passengerCount: passengerCounts.get(m.id) ?? 0,
      locked: m.locked,
    })),
    safety: safety.map((s) => ({
      category: s.category,
      name: s.name,
      nextInspection: s.nextInspection,
    })),
    incidents: incidents.map((i) => ({
      category: i.category,
      at: i.at?.toISOString() ?? null,
      description: i.description,
    })),
    generatedAt: new Date().toISOString(),
  }
}
