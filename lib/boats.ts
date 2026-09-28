// Shared config for the boat booking system (public site + admin).

export type BoatId = 'odyssey' | 'odyssey-ii' | 'odyssey-iii'
export type TripTypeId = 'big-game' | 'sport-fishing' | 'charter' | 'excursion'
export type BookingStatus = 'pending' | 'confirmed' | 'declined' | 'blocked'

export type Boat = {
  id: BoatId
  name: string
  tagline: string
  specs: string
  description: string
  /** Photo of the boat (public path), optional. */
  image?: string
  /** Video of the boat (public path). Shown instead of the image when set. */
  video?: string
  /** Trip types this boat is offered for. */
  trips: TripTypeId[]
  /**
   * Internal-only boats never appear on the public site or in the booking
   * manager — guests cannot reserve them. They DO appear everywhere operational
   * (fleet, maintenance, fuel, trips, compliance). Use PUBLIC_BOATS for any
   * bookable-boat list.
   */
  internal?: boolean
}

export type TripType = {
  id: TripTypeId
  label: string
  description: string
}

export const TRIP_TYPES: TripType[] = [
  {
    id: 'big-game',
    label: 'Big game fishing',
    description: 'Offshore sport fishing for tuna, marlin, wahoo and dorado.',
  },
  {
    id: 'sport-fishing',
    label: 'Sport & inshore fishing',
    description: 'Lighter tackle and inshore fishing, ideal for all levels.',
  },
  {
    id: 'charter',
    label: 'Private charter / transfer',
    description: 'Private passages between islands, resorts and marinas.',
  },
  {
    id: 'excursion',
    label: 'Excursion / cruise',
    description: 'Day trips, island tours and sunset cruises.',
  },
]

export const BOATS: Boat[] = [
  {
    id: 'odyssey',
    name: 'ODYSSEY',
    tagline: 'Big game catamaran',
    specs: 'Catamaran · 2× 200 hp Suzuki',
    description:
      'Our offshore big-game platform. A stable twin-hull catamaran powered by two 200 hp Suzuki engines — built to reach the blue water fast and fish it in comfort.',
    image: '/images/odyssey.png',
    video: '/videos/odyssey.mp4',
    trips: ['big-game'],
  },
  {
    id: 'odyssey-ii',
    name: 'ODYSSEY II',
    tagline: 'Charters, excursions & sport fishing',
    specs: 'Center console · 60 hp Suzuki',
    description:
      'Our versatile smaller vessel for inshore sport fishing, private charters, island transfers and coastal excursions — nimble, quick and comfortable.',
    image: '/images/odyssey-ii.png',
    video: '/videos/odyssey-ii.mp4',
    trips: ['sport-fishing', 'charter', 'excursion'],
  },
  {
    id: 'odyssey-iii',
    name: 'ODYSSEY III',
    tagline: 'Support & inshore vessel',
    specs: 'Center console · 60 hp Yamaha',
    description:
      'Internal support vessel powered by a 60 hp Yamaha — used for operations, not offered for guest bookings.',
    // Internal only: no guest bookings, no public listing. Still tracked for
    // fleet, maintenance and fuel.
    trips: [],
    internal: true,
  },
]

/** Boats guests can book — excludes internal vessels. Use this anywhere a
 *  bookable-boat list is shown (public site + admin booking manager). */
export const PUBLIC_BOATS: Boat[] = BOATS.filter((b) => !b.internal)

export function getBoat(id: string): Boat | undefined {
  return BOATS.find((b) => b.id === id)
}

export function getTripType(id: string): TripType | undefined {
  return TRIP_TYPES.find((t) => t.id === id)
}

export function boatName(id: string): string {
  return getBoat(id)?.name ?? id
}

// Fuel-tank / engine layout for fuel readings.
//
// A twin-engine catamaran (Odyssey) has two hulls, each with its own tank and
// engine, so its fuel is read per side: 'left' and 'right'. Every other boat
// is a single center-console with one tank, returned here as an empty list —
// callers treat an empty list as "one whole-boat reading, no split".
export type EngineSlot = 'left' | 'right'

export function boatEngineSlots(id: string): EngineSlot[] {
  return id === 'odyssey' ? ['left', 'right'] : []
}

export function hasSplitFuel(id: string): boolean {
  return boatEngineSlots(id).length > 0
}

export function tripLabel(id: string): string {
  return getTripType(id)?.label ?? id
}
