import {
  pgTable,
  text,
  timestamp,
  boolean,
  serial,
  integer,
  doublePrecision,
  jsonb,
  date,
} from 'drizzle-orm/pg-core'

// --- Better Auth required tables -------------------------------------------
// Column names are camelCase to match Better Auth's defaults. Do not rename.

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('emailVerified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expiresAt').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  ipAddress: text('ipAddress'),
  userAgent: text('userAgent'),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
})

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('accountId').notNull(),
  providerId: text('providerId').notNull(),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('accessToken'),
  refreshToken: text('refreshToken'),
  idToken: text('idToken'),
  accessTokenExpiresAt: timestamp('accessTokenExpiresAt'),
  refreshTokenExpiresAt: timestamp('refreshTokenExpiresAt'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expiresAt').notNull(),
  createdAt: timestamp('createdAt').defaultNow(),
  updatedAt: timestamp('updatedAt').defaultNow(),
})

// --- App tables ------------------------------------------------------------
// Shared admin-managed content. There is no per-user scoping: every signed-in
// admin edits the same catalogue, so these tables have no `userId` column.
// Access is gated by authentication (see lib/admin.ts), not by row ownership.

// Excursions shown on the AAM Charters page.
export const excursions = pgTable('excursions', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  duration: text('duration').notNull().default(''),
  price: integer('price').notNull().default(0), // EUR, whole euros
  priceUnit: text('priceUnit').notNull().default('per person'),
  image: text('image'), // Blob URL
  sortOrder: integer('sortOrder').notNull().default(0),
  published: boolean('published').notNull().default(true),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

// Products shown in the AAM Shop.
export const shopProducts = pgTable('shop_products', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  category: text('category').notNull().default('Accessories'),
  price: integer('price').notNull().default(0), // EUR, derived from priceAr when set
  priceAr: integer('priceAr').notNull().default(0), // base price in Ariary
  // Admin-only costing (Ariary); never exposed on the public shop.
  costAr: integer('costAr').notNull().default(0),
  transportAr: integer('transportAr').notNull().default(0),
  customsAr: integer('customsAr').notNull().default(0),
  marginPct: doublePrecision('marginPct').notNull().default(0),
  // Pieces on hand; null = not tracked yet (never shown as sold out).
  stock: integer('stock'),
  image: text('image'), // Blob URL
  image2: text('image2'), // optional second photo
  alt: text('alt').notNull().default(''),
  description: text('description').notNull().default(''),
  featured: boolean('featured').notNull().default(false),
  sortOrder: integer('sortOrder').notNull().default(0),
  published: boolean('published').notNull().default(true),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

// Stock ledger per shop product: sales, receipts and stock counts.
export const shopStockMoves = pgTable('shop_stock_moves', {
  id: serial('id').primaryKey(),
  productId: integer('productId').notNull(),
  kind: text('kind').notNull(), // 'sale' | 'receipt' | 'count'
  delta: integer('delta').notNull(), // signed change in pieces
  stockAfter: integer('stockAfter').notNull(),
  priceAr: integer('priceAr').notNull().default(0), // unit selling price at time of sale
  note: text('note').notNull().default(''),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
})

// Editable site texts + images, keyed by a stable string (e.g. "home.hero.title").
export const siteContent = pgTable('site_content', {
  key: text('key').primaryKey(),
  value: text('value').notNull().default(''),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

// Address book: email addresses saved by the admin (built up as mail is sent).
export const contacts = pgTable('contacts', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull().default(''), // name/surname or company
  note: text('note').notNull().default(''),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
})

// Boat charter / fishing bookings and admin-blocked days.
export const boatBookings = pgTable('boat_bookings', {
  id: serial('id').primaryKey(),
  boat: text('boat').notNull(), // 'odyssey' | 'odyssey-ii'
  tripType: text('tripType').notNull(), // 'big-game' | 'sport-fishing' | 'charter' | 'excursion'
  date: text('date').notNull(), // YYYY-MM-DD (single-day availability)
  name: text('name').notNull().default(''),
  email: text('email').notNull().default(''),
  phone: text('phone').notNull().default(''),
  guests: integer('guests').notNull().default(1),
  message: text('message').notNull().default(''),
  departureTime: text('departureTime').notNull().default(''), // HH:MM
  priceEur: integer('priceEur'), // null = not set yet
  paymentMethod: text('paymentMethod').notNull().default(''), // 'cash' | 'card' | 'transfer' | ''
  paymentStatus: text('paymentStatus').notNull().default('unpaid'), // 'unpaid' | 'deposit' | 'paid'
  ownEquipment: boolean('ownEquipment').notNull().default(true), // false = rent gear (+50 EUR/pax)
  swimmer: text('swimmer').notNull().default(''), // 'yes' | 'no' | ''
  seasickness: text('seasickness').notNull().default(''), // 'yes' | 'no' | ''
  fishingExperience: text('fishingExperience').notNull().default(''), // big game experience: 'yes' | 'no' | ''
  // 'pending' | 'confirmed' | 'declined' | 'blocked' (admin-reserved day)
  status: text('status').notNull().default('pending'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
})

// Inbox: inbound (website forms, replies) + outbound (sent from admin) messages.
export const messages = pgTable('messages', {
  id: serial('id').primaryKey(),
  direction: text('direction').notNull().default('inbound'), // 'inbound' | 'outbound'
  source: text('source').notNull().default('contact'), // 'contact' | 'excursion' | 'order' | 'email'
  name: text('name').notNull().default(''),
  email: text('email').notNull().default(''),
  phone: text('phone').notNull().default(''),
  subject: text('subject').notNull().default(''),
  body: text('body').notNull().default(''),
  meta: text('meta').notNull().default(''), // JSON string for structured extras (order lines, etc.)
  read: boolean('read').notNull().default(false),
  archived: boolean('archived').notNull().default(false),
  // Custom folder an inbound message has been filed into. NULL = the default
  // "Prejeto" inbox. Set manually or automatically by a matching mail rule.
  folderId: integer('folderId'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
})

// Custom inbox folders the admin creates (e.g. "Rezervacije", "Agencije").
export const mailFolders = pgTable('mail_folders', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
})

// Routing rules: inbound mail from `fromEmail` is filed into `folderId`.
export const mailRules = pgTable('mail_rules', {
  id: serial('id').primaryKey(),
  fromEmail: text('fromEmail').notNull(),
  folderId: integer('folderId').notNull(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
})

// Colored labels the admin names + colors (e.g. "Nujno"), applied to messages.
export const mailLabels = pgTable('mail_labels', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  color: text('color').notNull().default('#ef4444'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
})

// Join table: which labels are applied to which messages (many-to-many).
export const messageLabels = pgTable('message_labels', {
  messageId: integer('messageId').notNull(),
  labelId: integer('labelId').notNull(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
})

// --- Transfers (Odyssey II island transfers) -------------------------------

// Reusable price list of transfer routes (e.g. Big Port Nosy Be → Ampangorina).
// Price can be a flat amount for the whole trip or per person.
export const transferRoutes = pgTable('transfer_routes', {
  id: serial('id').primaryKey(),
  fromLocation: text('fromLocation').notNull().default(''),
  toLocation: text('toLocation').notNull().default(''),
  priceEur: integer('priceEur').notNull().default(0), // EUR, whole euros
  priceType: text('priceType').notNull().default('flat'), // 'flat' | 'per_person'
  note: text('note').notNull().default(''),
  sortOrder: integer('sortOrder').notNull().default(0),
  published: boolean('published').notNull().default(true),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

// Individual transfer orders. The `reference` ties a voucher and its invoice
// together so there is never any confusion between the two documents.
export const transfers = pgTable('transfers', {
  id: serial('id').primaryKey(),
  reference: text('reference').notNull().default(''), // e.g. TR-2026-0001
  routeId: integer('routeId'), // optional link to transfer_routes
  // Snapshot of the route so it stays correct even if the price list changes.
  fromLocation: text('fromLocation').notNull().default(''),
  toLocation: text('toLocation').notNull().default(''),
  date: text('date').notNull(), // YYYY-MM-DD
  time: text('time').notNull().default(''), // HH:MM (departure time)
  durationMin: integer('durationMin').notNull().default(0), // trip length in minutes; arrival = time + duration
  boat: text('boat').notNull().default('odyssey-ii'),
  name: text('name').notNull().default(''),
  email: text('email').notNull().default(''),
  phone: text('phone').notNull().default(''),
  pax: integer('pax').notNull().default(1),
  priceEur: integer('priceEur').notNull().default(0), // final total, editable
  // 'pending' | 'confirmed' | 'paid' | 'completed' | 'cancelled'
  status: text('status').notNull().default('pending'),
  paymentMethod: text('paymentMethod').notNull().default(''), // '' | 'cash' | 'bank' | 'orange'
  paidAt: timestamp('paidAt'),
  voucherSentAt: timestamp('voucherSentAt'),
  invoiceNumber: text('invoiceNumber').notNull().default(''),
  invoiceSentAt: timestamp('invoiceSentAt'),
  notes: text('notes').notNull().default(''),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
})

// Single-row official company details used on invoices, plus the running
// invoice counter. Always stored on the row with id = 1.
export const companySettings = pgTable('company_settings', {
  id: integer('id').primaryKey().default(1),
  name: text('name').notNull().default(''),
  addressLine1: text('addressLine1').notNull().default(''),
  addressLine2: text('addressLine2').notNull().default(''),
  city: text('city').notNull().default(''),
  country: text('country').notNull().default(''),
  taxId: text('taxId').notNull().default(''), // VAT / company reg. number
  iban: text('iban').notNull().default(''),
  bankName: text('bankName').notNull().default(''),
  email: text('email').notNull().default(''),
  phone: text('phone').notNull().default(''),
  invoicePrefix: text('invoicePrefix').notNull().default('AAM'),
  invoiceCounter: integer('invoiceCounter').notNull().default(0), // last used seq
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

// Web Push: one row per subscribed device (browser/phone). Used to send
// notifications that ring even when the admin app is closed or phone locked.
export const pushSubscriptions = pgTable('push_subscriptions', {
  id: serial('id').primaryKey(),
  endpoint: text('endpoint').notNull().unique(),
  p256dh: text('p256dh').notNull(),
  auth: text('auth').notNull(),
  userAgent: text('userAgent').notNull().default(''),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
})

// Single-row store for the VAPID keypair (generated once, on first use).
export const pushConfig = pgTable('push_config', {
  id: integer('id').primaryKey().default(1),
  publicKey: text('publicKey').notNull(),
  privateKey: text('privateKey').notNull(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
})

// Odyssey charter price list — the boat sails once a day (fishing OR an
// excursion). Charter price is set by group-size tier; priceEur null = "TBD".
export const odysseyTiers = pgTable('odyssey_tiers', {
  id: serial('id').primaryKey(),
  minPax: integer('minPax').notNull().default(1),
  maxPax: integer('maxPax').notNull().default(4),
  priceEur: integer('priceEur'), // null = price not set yet
  note: text('note').notNull().default(''),
  sortOrder: integer('sortOrder').notNull().default(0),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
})

// The activities the Odyssey can run on its daily departure: big game fishing
// plus the excursions offered on the website.
export const odysseyActivities = pgTable('odyssey_activities', {
  id: serial('id').primaryKey(),
  label: text('label').notNull(),
  category: text('category').notNull().default('excursion'), // 'fishing' | 'excursion'
  note: text('note').notNull().default(''),
  priceEur: integer('priceEur'), // optional add-on price; null = included / TBD
  priceUnit: text('priceUnit').notNull().default('per_person'), // 'per_person' | 'per_trip'
  published: boolean('published').notNull().default(true),
  sortOrder: integer('sortOrder').notNull().default(0),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
})

// --- Fleet operations ------------------------------------------------------
// These five tables use TEXT ids (generated in the action layer), unlike the
// serial ids above: a captain's phone creates trips and positions offline and
// needs to know the id before the row reaches the server.
//
// The boat is stored as the BoatId string ('odyssey' | 'odyssey-ii') from
// lib/boats.ts — no separate boats table, because BOATS already holds the
// names, specs, photos and which trip types each boat is offered for.

// The people who take the boats out. Kept separate from `user` (Better Auth):
// a captain is an operational role, not someone who logs into the admin.
export const captains = pgTable('captains', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  phone: text('phone'),
  licence: text('licence'),
  // Date, not timestamp: a licence expires on a calendar day, and a timezone
  // conversion could shift it a day either way.
  licenceExpiry: date('licenceExpiry'),
  active: boolean('active').notNull().default(true),
  notes: text('notes'),
  createdAt: timestamp('createdAt', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

// An actual voyage. Deliberately NOT merged into `boat_bookings`: a booking is
// an ORDER (it can be cancelled and never sail) while a trip is a MOVEMENT (a
// boat repositioning or a staff run has no booking at all). `bookingId` and
// `reservationId` link the two when they do correspond.
export const trips = pgTable('trips', {
  id: text('id').primaryKey(),
  boat: text('boat').notNull(), // BoatId from lib/boats.ts
  captainId: text('captainId').references(() => captains.id),
  crew: jsonb('crew'), // string[] of names — free text, crew are not accounts
  // 'excursion' | 'fishing' | 'transfer' | 'supply' | 'maintenance' | 'other'
  purpose: text('purpose').notNull().default('excursion'),
  status: text('status').notNull().default('active'), // 'active' | 'completed'
  bookingId: text('bookingId'), // boat_bookings.id, when this trip fulfils one
  reservationId: text('reservationId'), // guest reservation, for transfers
  plannedDeparture: timestamp('plannedDeparture', { withTimezone: true }),
  startedAt: timestamp('startedAt', { withTimezone: true })
    .notNull()
    .defaultNow(),
  endedAt: timestamp('endedAt', { withTimezone: true }),
  guests: integer('guests').notNull().default(0),
  guestNames: jsonb('guestNames'), // string[] of guest names — optional, entered in the office
  fuelStartPct: integer('fuelStartPct'),
  fuelEndPct: integer('fuelEndPct'),
  engineHoursStart: doublePrecision('engineHoursStart'),
  engineHoursEnd: doublePrecision('engineHoursEnd'),
  distanceNm: doublePrecision('distanceNm'), // computed on end from positions
  destination: text('destination'),
  notes: text('notes'),
  createdAt: timestamp('createdAt', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

// Every GPS fix, one row each. This is the SINGLE source of position truth —
// there is no "last known position" column anywhere, because two copies of the
// same fact drift apart. The latest position is a query over this table.
export const tripPositions = pgTable('trip_positions', {
  id: text('id').primaryKey(),
  tripId: text('tripId')
    .notNull()
    .references(() => trips.id, { onDelete: 'cascade' }),
  lat: doublePrecision('lat').notNull(),
  lon: doublePrecision('lon').notNull(),
  speedKn: doublePrecision('speedKn'),
  headingDeg: doublePrecision('headingDeg'),
  accuracyM: doublePrecision('accuracyM'),
  // 'phone' (captain's browser) | 'tracker' (hardware unit, added later).
  // The ingest endpoint accepts both, so a tracker can be fitted without any
  // rework — only this value changes.
  source: text('source').notNull().default('phone'),
  // Set by the sender, not by the server: positions buffered offline are
  // uploaded later and must keep the time they were actually recorded.
  recordedAt: timestamp('recordedAt', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

// A thing allowed to report positions for a boat. The token is what makes the
// ingest endpoint safe: without it anyone could POST a fake position for our
// boats, and a false track is worse than no track at all.
export const fleetDevices = pgTable('fleet_devices', {
  id: text('id').primaryKey(),
  boat: text('boat').notNull(),
  token: text('token').notNull().unique(),
  label: text('label'), // e.g. "Dilip's phone"
  source: text('source').notNull().default('phone'),
  lastSeenAt: timestamp('lastSeenAt', { withTimezone: true }),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('createdAt', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

// Alerts are DERIVED from the data (no position for 30 min, boat at sea after
// sunset, trip with no captain) and recomputed on every read. This table only
// remembers the acknowledgement, so a dismissed alert stays dismissed — it is
// not the alert list itself.
export const fleetAlerts = pgTable('fleet_alerts', {
  id: text('id').primaryKey(),
  kind: text('kind').notNull(), // 'no-signal' | 'after-dark' | 'no-captain' | ...
  severity: text('severity').notNull().default('warning'), // 'info'|'warning'|'critical'
  boat: text('boat'),
  tripId: text('tripId'),
  message: text('message').notNull(),
  acknowledgedAt: timestamp('acknowledgedAt', { withTimezone: true }),
  acknowledgedBy: text('acknowledgedBy'),
  createdAt: timestamp('createdAt', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

// A named place worth fishing. Separate from `catches` because a spot outlives
// any single fish: it accumulates history, and that history is the asset.
export const fishingSpots = pgTable('fishing_spots', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  lat: doublePrecision('lat').notNull(),
  lon: doublePrecision('lon').notNull(),
  // 'reef' | 'dropoff' | 'pinnacle' | 'wreck' | 'fad' | 'current-line' | 'other'
  kind: text('kind').notNull().default('reef'),
  depthM: doublePrecision('depthM'),
  notes: text('notes'),
  // Hard-won spots are a competitive asset. This flags the ones that must not
  // appear on anything a guest can see; it is not a security boundary.
  secret: boolean('secret').notNull().default(false),
  active: boolean('active').notNull().default(true),
  createdBy: text('createdBy'),
  createdAt: timestamp('createdAt', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const catches = pgTable('catches', {
  id: text('id').primaryKey(),
  tripId: text('tripId')
    .notNull()
    .references(() => trips.id, { onDelete: 'cascade' }),
  // Nullable on purpose: fish are often caught while trolling between spots,
  // and forcing a spot would either invent one or block the entry.
  spotId: text('spotId').references(() => fishingSpots.id),
  // Where the fish actually took, which can be some way off the spot centre.
  lat: doublePrecision('lat'),
  lon: doublePrecision('lon'),
  species: text('species').notNull(),
  weightKg: doublePrecision('weightKg'),
  lengthCm: doublePrecision('lengthCm'),
  // Billfish are usually released, and a released fish still proves the spot
  // works — so this must never be treated as "no catch".
  released: boolean('released').notNull().default(false),
  /** Which guest landed it. Guests ask for this by name afterwards. */
  guestName: text('guestName'),
  // 'trolling' | 'jigging' | 'bottom' | 'casting' | 'live-bait' | 'other'
  method: text('method'),
  lure: text('lure'),
  photoUrl: text('photoUrl'),

  // --- Conditions AT THE MOMENT OF THE CATCH -------------------------------
  // Snapshotted, never looked up later, and this is the whole point: the
  // weather source serves a forecast window only. What the tide, pressure and
  // sea temperature actually were at 14:32 last March cannot be retrieved
  // afterwards at any price. Without these columns the question "which spot
  // produces in which conditions" is permanently unanswerable, so they are
  // written even when the captain fills in nothing else.
  tideM: doublePrecision('tideM'),
  tidePhase: text('tidePhase'), // 'rising' | 'falling'
  // km/h — the project's canonical wind unit, which the UI converts only for
  // display. Naming these "Kn" would invite a second conversion on top of a
  // value that was never in knots.
  windKmh: doublePrecision('windKmh'),
  gustsKmh: doublePrecision('gustsKmh'),
  windDir: doublePrecision('windDir'),
  pressureHpa: doublePrecision('pressureHpa'),
  sstC: doublePrecision('sstC'),
  swellM: doublePrecision('swellM'),
  currentKmh: doublePrecision('currentKmh'),
  moonPhase: text('moonPhase'),

  notes: text('notes'),
  // Set by the sender: a catch logged offline is uploaded later and must keep
  // the time the fish was landed, not the time the phone found signal.
  caughtAt: timestamp('caughtAt', { withTimezone: true }).notNull().defaultNow(),
  // A UUID minted on the phone the moment the fish is logged. It is what makes
  // the offline queue safe: a flush that half-succeeds over a weak signal gets
  // retried, and this (with a partial unique index) turns the retry into a
  // no-op instead of a duplicate fish. Null for catches entered in the office.
  clientId: text('clientId'),
  createdAt: timestamp('createdAt', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

// --- Maintenance -----------------------------------------------------------
// Engines are rows, not columns on the boat, because service intervals belong
// to the engine: Odyssey's twin outboards never share an hour meter, and one
// can be replaced without touching the other.

export const boatEngines = pgTable('boat_engines', {
  id: text('id').primaryKey(),
  boat: text('boat').notNull(), // BoatId from lib/boats.ts
  label: text('label').notNull(),
  /** 'port' | 'starboard' | 'single' — which one the mechanic is looking at. */
  position: text('position').notNull().default('single'),
  hp: integer('hp'),
  serial: text('serial'),
  /**
   * The last hour-meter reading someone actually read off the engine, and when
   * they read it. Hours since are estimated from trip durations.
   *
   * This anchor is why the feature works at all: these boats have years of
   * running that predate this app, so counting only logged trips would start
   * every engine at zero and make every interval wrong. It is the one number
   * that has to be typed in by hand.
   */
  hoursAt: doublePrecision('hoursAt'),
  readAt: timestamp('readAt', { withTimezone: true }),
  active: boolean('active').notNull().default(true),
  notes: text('notes'),
  sortOrder: integer('sortOrder').notNull().default(0),
  createdAt: timestamp('createdAt', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

// A recurring job with an interval. Due dates are DERIVED on read from the
// engine hours and the last completion — same principle as fleet alerts.
export const maintenanceTasks = pgTable('maintenance_tasks', {
  id: text('id').primaryKey(),
  boat: text('boat').notNull(),
  /** Null for whole-boat work (hull, safety gear) that is not per engine. */
  engineId: text('engineId').references(() => boatEngines.id, {
    onDelete: 'cascade',
  }),
  name: text('name').notNull(),
  /**
   * Either or both may be set; when both are, whichever falls due FIRST wins.
   * An engine that sat idle a year still needs its oil changed, and one that
   * ran 100 h in three months needs it early — hours alone misses the first
   * case, days alone misses the second.
   */
  intervalHours: doublePrecision('intervalHours'),
  intervalDays: integer('intervalDays'),
  lastDoneHours: doublePrecision('lastDoneHours'),
  lastDoneAt: timestamp('lastDoneAt', { withTimezone: true }),
  active: boolean('active').notNull().default(true),
  notes: text('notes'),
  sortOrder: integer('sortOrder').notNull().default(0),
  createdAt: timestamp('createdAt', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

// What was actually done, and what it cost. Kept as its own table rather than
// overwriting the task's `lastDone*`: the history is what proves the engine was
// serviced, and it is what a buyer or an insurer asks to see.
export const maintenanceLog = pgTable('maintenance_log', {
  id: text('id').primaryKey(),
  boat: text('boat').notNull(),
  engineId: text('engineId').references(() => boatEngines.id, {
    onDelete: 'set null',
  }),
  /** Nullable so an unplanned repair can be logged without inventing a task. */
  taskId: text('taskId').references(() => maintenanceTasks.id, {
    onDelete: 'set null',
  }),
  // Copied, not looked up: the log must still read correctly years later even
  // if the task was renamed or retired since.
  name: text('name').notNull(),
  doneAt: timestamp('doneAt', { withTimezone: true }).notNull().defaultNow(),
  atHours: doublePrecision('atHours'),
  costAr: doublePrecision('costAr'),
  partsUsed: text('partsUsed'),
  doneBy: text('doneBy'),
  notes: text('notes'),
  createdAt: timestamp('createdAt', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

// Fuel is kept in drums on land and measured in LITRES here. This is a movement
// ledger, not a stored balance: current stock is SUM(deliveries) − SUM(refuels)
// ± adjustments, computed on read, so there is never a second copy to drift.
// Deliberately NOT linked to trips.fuelStartPct/EndPct: the boats measure fuel
// as a tank PERCENTAGE and no tank capacity in litres is known, so converting a
// trip's burned % into litres pulled from a drum would be a fabricated number.
export const fuelLog = pgTable('fuel_log', {
  id: text('id').primaryKey(),
  // 'delivery' (+litres) | 'refuel' (−litres) | 'adjustment' (signed litres)
  type: text('type').notNull(),
  litres: doublePrecision('litres').notNull(), // canonical converted amount
  // How the amount was entered, so the archive can show what was really typed.
  // 'litres' | 'kg' | 'cans'; null on legacy rows (treated as litres).
  inputUnit: text('inputUnit'),
  inputQty: doublePrecision('inputQty'), // kg entered, or number of cans, or litres
  canSizeL: doublePrecision('canSizeL'), // litres per can, only when inputUnit = 'cans'
  boat: text('boat'), // which boat was refuelled; null for delivery/adjustment
  costAr: doublePrecision('costAr'), // total cost in Ariary, deliveries only
  note: text('note'),
  loggedBy: text('loggedBy'),
  occurredAt: timestamp('occurredAt', { withTimezone: true })
    .notNull()
    .defaultNow(),
  createdAt: timestamp('createdAt', { withTimezone: true })
    .notNull()
    .defaultNow(),
  // Soft-delete: entries are never hard-deleted, they move to the archive so
  // the record is auditable and restorable. Null = active.
  archivedAt: timestamp('archivedAt', { withTimezone: true }),
})

// Single row (id = 1): the litres level at or below which the office should
// reorder. Zero means "no level set" — the UI says so rather than showing a
// false all-clear.
export const fuelConfig = pgTable('fuel_config', {
  id: integer('id').primaryKey().default(1),
  reorderLitres: doublePrecision('reorderLitres').notNull().default(0),
  updatedAt: timestamp('updatedAt', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

// Single row (id = 1): the manually-entered exchange rate, used as the fallback
// whenever the live rate cannot be fetched. Ariary is the only billing
// currency; EUR and ZAR are shown alongside as a reference. arPerEur = Ar per 1
// EUR, arPerZar = Ar per 1 ZAR (Rand).
export const fxConfig = pgTable('fx_config', {
  id: integer('id').primaryKey().default(1),
  arPerEur: doublePrecision('arPerEur').notNull().default(4800),
  arPerZar: doublePrecision('arPerZar').notNull().default(250),
  updatedAt: timestamp('updatedAt', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

// Per-boat fuel ledger — separate from the shared shore stock (fuelLog).
// Each row is ONE reading for ONE boat: fuel before a trip, after a trip, or a
// surprise spot-check. Litres and kilograms are both optional (fuel is weighed
// on some checks, gauged on others) but at least one is always supplied.
// kind: 'trip-start' | 'trip-end' | 'spot-check'
export const boatFuelReadings = pgTable('boat_fuel_readings', {
  id: text('id').primaryKey(),
  boat: text('boat').notNull(), // BoatId from lib/boats.ts
  kind: text('kind').notNull(),
  // Which tank/engine on twin-engine boats: 'left' | 'right'. Null on
  // single-tank boats and on legacy whole-boat readings.
  engineSlot: text('engineSlot'),
  litres: doublePrecision('litres'),
  kilograms: doublePrecision('kilograms'),
  tripId: text('tripId'), // optional link to trips.id
  note: text('note'),
  loggedBy: text('loggedBy'),
  occurredAt: timestamp('occurredAt', { withTimezone: true })
    .notNull()
    .defaultNow(),
  createdAt: timestamp('createdAt', { withTimezone: true })
    .notNull()
    .defaultNow(),
  // Soft-delete → archive (never hard-deleted). Null = active.
  archivedAt: timestamp('archivedAt', { withTimezone: true }),
})

// Fuel PROCUREMENT — a two-step event, distinct from a plain warehouse delivery.
// Step 1 (status 'paid'): the owner pays for fuel at the station (paidLitres +
// fuelCostAr). The money is spent but the fuel is NOT in the warehouse yet.
// Step 2 (status 'received'): the employee brings it in 20 L / 25 L canisters
// (canisters20/25 → receivedLitres) and there is a transportCostAr. ONLY on
// receipt is a fuelLog 'delivery' row created (deliveryEntryId links to it) so
// the warehouse stock, archive and totals stay driven by fuelLog alone.
export const fuelProcurements = pgTable('fuel_procurements', {
  id: text('id').primaryKey(),
  status: text('status').notNull().default('paid'), // 'paid' | 'received'
  paidLitres: doublePrecision('paidLitres'),
  pricePerLitreAr: doublePrecision('pricePerLitreAr'), // Ar per 1 L
  fuelCostAr: doublePrecision('fuelCostAr'), // = paidLitres × pricePerLitreAr
  paymentMethod: text('paymentMethod'), // 'cash' | 'orange_money' | 'card'
  receiptUrl: text('receiptUrl'), // photo of the paid quote/receipt (public blob)
  transportCostAr: doublePrecision('transportCostAr'),
  canisters20: integer('canisters20').notNull().default(0),
  canisters25: integer('canisters25').notNull().default(0),
  receivedLitres: doublePrecision('receivedLitres'),
  receivedBy: text('receivedBy'),
  station: text('station'),
  note: text('note'),
  deliveryEntryId: text('deliveryEntryId'), // fuelLog row created on receipt
  paidBy: text('paidBy'),
  paidAt: timestamp('paidAt', { withTimezone: true }).notNull().defaultNow(),
  receivedAt: timestamp('receivedAt', { withTimezone: true }),
  archivedAt: timestamp('archivedAt', { withTimezone: true }),
  createdAt: timestamp('createdAt', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

// A payout ledger for captains and crew. Keyed by personName (text), NOT a
// captain id: crew are free-text names on a trip, not rows, so name is the only
// identifier every worker shares. Amounts are recorded facts in Ariary — this
// is deliberately NOT an "amount owed" calculator, because no agreed hourly
// rate exists (same honesty rule as fuel litres vs. tank %). Hours worked come
// straight from the trips they ran; what was actually paid is logged here.
export const crewPayout = pgTable('crew_payout', {
  id: text('id').primaryKey(),
  personName: text('personName').notNull(),
  role: text('role').notNull().default('crew'), // 'captain' | 'crew'
  amountAr: doublePrecision('amountAr').notNull(),
  note: text('note'),
  loggedBy: text('loggedBy'),
  paidAt: timestamp('paidAt', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('createdAt', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

// --- Compliance & Logbooks -------------------------------------------------
// Official and internal records for the vessels, built to survive an
// inspection: nothing that is completed is ever deleted, every change is
// audited, and the legal document status drives a pre-departure check. Columns
// are snake_case here (a fresh module, no Better Auth constraint) while the JS
// keys stay camelCase.

// One profile per boat. It says WHICH obligations apply — a passenger boat and
// a pure fishing boat need different documents — so the compliance check and
// the required-document list are driven from here, not hard-coded.
export const vesselComplianceProfiles = pgTable('vessel_compliance_profiles', {
  id: text('id').primaryKey(),
  boat: text('boat').notNull().unique(), // BoatId from lib/boats.ts
  vesselName: text('vessel_name'),
  registrationNumber: text('registration_number'),
  vesselId: text('vessel_id'),
  classification: text('classification'),
  commercial: boolean('commercial').notNull().default(true),
  passengerTransport: boolean('passenger_transport').notNull().default(false),
  fishingActivity: boolean('fishing_activity').notNull().default(false),
  fishingCategory: text('fishing_category'),
  navigationCategory: text('navigation_category'),
  // The hard cap the pre-departure check enforces: persons on board may not
  // exceed this, and a trip that would is blocked, not merely warned.
  maxPersons: integer('max_persons'),
  requiredDocuments: jsonb('required_documents'), // string[] of categories
  requiredReports: jsonb('required_reports'),
  requiredInspections: jsonb('required_inspections'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

// The vessel document register: registration, permis de navigation, role
// d'equipage, fishing licence, insurance, safety inspection, etc. `status` is
// stored but the UI also derives it from `expiryDate`, so an untouched row
// still turns amber then red as its expiry approaches.
export const complianceDocuments = pgTable('compliance_documents', {
  id: text('id').primaryKey(),
  boat: text('boat').notNull(),
  // 'registration' | 'permis-navigation' | 'role-equipage' | 'bon-partance'
  // | 'fishing-licence' | 'fishing-authorization' | 'insurance'
  // | 'safety-inspection' | 'radio-licence' | 'captain-licence' | 'other'
  category: text('category').notNull(),
  name: text('name').notNull(),
  number: text('number'),
  issuingAuthority: text('issuing_authority'),
  issueDate: date('issue_date'),
  expiryDate: date('expiry_date'),
  fileUrl: text('file_url'),
  // 'valid' | 'expiring' | 'expired' | 'suspended' | 'missing' | 'pending'
  status: text('status').notNull().default('valid'),
  notes: text('notes'),
  // Superseded documents are archived, never deleted, so the register keeps
  // the full history of what was valid when.
  archived: boolean('archived').notNull().default(false),
  createdBy: text('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

// The audit trail shared by every official record. A completed record is never
// edited in place: a correction writes a new row here with the old and new
// value plus a reason, so the original is always reconstructable.
export const complianceAudit = pgTable('compliance_audit', {
  id: text('id').primaryKey(),
  // 'document' | 'voyage-log' | 'fishing-log' | 'catch-declaration'
  // | 'manifest' | 'crew-role' | 'incident' | 'authority-submission' | 'profile'
  recordType: text('record_type').notNull(),
  recordId: text('record_id').notNull(),
  // 'create' | 'update' | 'amend' | 'approve' | 'lock' | 'correction'
  action: text('action').notNull(),
  field: text('field'),
  previousValue: text('previous_value'),
  newValue: text('new_value'),
  reason: text('reason'),
  userName: text('user_name'),
  at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
})

// Journal de bord (ship/voyage logbook). One row per trip — the operational
// facts (boat, captain, crew, times, engine hours, distance, guests) already
// live on `trips`, so this table carries only the compliance-specific extras:
// named departure/arrival points with GPS, the official-validation record, the
// force-majeure port-entry record, and the captain's final approval + lock.
export const voyageLogs = pgTable('voyage_logs', {
  id: text('id').primaryKey(),
  tripId: text('trip_id').notNull().unique(),
  boat: text('boat').notNull(),
  entryNumber: integer('entry_number'),
  departureLocation: text('departure_location'),
  departureLat: doublePrecision('departure_lat'),
  departureLon: doublePrecision('departure_lon'),
  arrivalLocation: text('arrival_location'),
  arrivalLat: doublePrecision('arrival_lat'),
  arrivalLon: doublePrecision('arrival_lon'),
  crewCount: integer('crew_count'),
  passengerCount: integer('passenger_count'),
  // 'not-required' | 'to-present' | 'presented' | 'validated'. This is only a
  // record that the logbook was shown to an authority — never presented as an
  // official state visa (spec is explicit about this).
  officialStatus: text('official_status').notNull().default('not-required'),
  officialAuthorityType: text('official_authority_type'),
  officialAuthorityOffice: text('official_authority_office'),
  officialOfficer: text('official_officer'),
  officialDate: date('official_date'),
  officialReference: text('official_reference'),
  officialNotes: text('official_notes'),
  officialFileUrl: text('official_file_url'),
  // Force-majeure / unscheduled port entry: reason, actual port, GPS, and any
  // authority notified. Nullable — most voyages never need it.
  unscheduled: jsonb('unscheduled'),
  // Captain review + lock. Once approved the entry is read-only; a later
  // correction must go through the audit trail, never an in-place edit.
  approvedBy: text('approved_by'),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  approvalVersion: integer('approval_version'),
  locked: boolean('locked').notNull().default(false),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

// Significant voyage events (weather, mechanical, medical, collision,
// grounding, assistance, emergency, forced landing…). Each carries its own
// time, GPS position, description, captain and action taken.
export const voyageEvents = pgTable('voyage_events', {
  id: text('id').primaryKey(),
  voyageLogId: text('voyage_log_id'),
  tripId: text('trip_id').notNull(),
  boat: text('boat').notNull(),
  type: text('type').notNull(),
  at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
  lat: doublePrecision('lat'),
  lon: doublePrecision('lon'),
  description: text('description'),
  captain: text('captain'),
  actionTaken: text('action_taken'),
  createdBy: text('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

// Journal de bord (APMF) — the standalone professional voyage logbook the
// captain fills per voyage. Unlike `voyageLogs` (derived from a GPS `trips`
// row), this is entirely self-contained: every field is entered by hand, the
// entry gets an auto voyage number per vessel per year (ODYSSEY-II-2026-0001),
// and once validated it is LOCKED — a later fix is a rectificatif appended to
// `rectificatifs` + the audit trail, never an in-place edit.
export const voyageJournals = pgTable('voyage_journals', {
  id: text('id').primaryKey(),
  boat: text('boat').notNull(), // BoatId
  voyageNumber: text('voyage_number').notNull().unique(),
  seq: integer('seq').notNull(), // per vessel per year, for the number
  year: integer('year').notNull(),
  // 'brouillon' (draft) | 'valide' (validated) | 'cloture' (closed/locked)
  status: text('status').notNull().default('brouillon'),

  // Section 2 — informations sur le voyage
  voyageDate: date('voyage_date'),
  departureLocation: text('departure_location'),
  departureTime: text('departure_time'),
  destination: text('destination'),
  stopovers: text('stopovers'),
  arrivalLocation: text('arrival_location'),
  arrivalDate: date('arrival_date'),
  arrivalTime: text('arrival_time'),
  // 'excursion' | 'transfert' | 'prive' | 'maintenance' | 'approvisionnement' | 'autre'
  purpose: text('purpose'),
  purposeOther: text('purpose_other'),

  // Section 3 — capitaine et équipage
  captainName: text('captain_name'),
  captainLicense: text('captain_license'),
  crew: jsonb('crew'), // [{ name, role }]

  // Section 4 — passagers
  passengerCount: integer('passenger_count'),
  passengers: jsonb('passengers'), // [{ name, nationality }]

  // Section 5 — conditions de navigation
  weather: text('weather'), // beau | nuageux | pluie | orage | autre
  seaState: text('sea_state'), // calme | peu-agitee | agitee | forte
  wind: text('wind'), // faible | modere | fort
  navigationZone: text('navigation_zone'),

  // Section 6 — carburant (litres); consumption is derived, not stored
  fuelDepart: doublePrecision('fuel_depart'),
  fuelAdded: doublePrecision('fuel_added'),
  fuelArrival: doublePrecision('fuel_arrival'),
  fuelObservations: text('fuel_observations'),

  // Section 7 — événements / incidents / observations
  eventsText: text('events_text'),
  noIncident: boolean('no_incident').notNull().default(false),

  // Section 8 — validation du capitaine (lock)
  certifiedBy: text('certified_by'),
  validatedAt: timestamp('validated_at', { withTimezone: true }),
  validatedByUser: text('validated_by_user'),
  captainId: text('captain_id'),
  locked: boolean('locked').notNull().default(false),

  // Section 15 — rectificatifs appended after lock. [{ id, date, reason, text, addedBy, at }]
  rectificatifs: jsonb('rectificatifs'),
  // Email audit trail. [{ id, to, copyToOperator, at, user }]
  emailLog: jsonb('email_log'),

  createdBy: text('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

// Journal de peche (fishing logbook). One row per fishing trip — the retained
// species catches already live in `catches`, so this header carries only the
// compliance layer: the landing record, the transshipment declaration (default
// NO), and the captain approval + lock.
export const fishingLogs = pgTable('fishing_logs', {
  id: text('id').primaryKey(),
  tripId: text('trip_id').notNull().unique(),
  boat: text('boat').notNull(),
  authorizationNumber: text('authorization_number'),
  landingDate: date('landing_date'),
  landingTime: text('landing_time'),
  landingLocation: text('landing_location'),
  landingLat: doublePrecision('landing_lat'),
  landingLon: doublePrecision('landing_lon'),
  landingRecipient: text('landing_recipient'),
  landingStorage: text('landing_storage'),
  landingSale: text('landing_sale'), // 'sale' | 'non-sale'
  landingNotes: text('landing_notes'),
  // Default false. Recording a transshipment is gated behind an explicit legal
  // warning + admin confirmation (Malagasy fisheries law may prohibit it).
  transshipment: boolean('transshipment').notNull().default(false),
  transshipmentAuthorization: text('transshipment_authorization'),
  transshipmentVessel: text('transshipment_vessel'),
  transshipmentAt: timestamp('transshipment_at', { withTimezone: true }),
  transshipmentLat: doublePrecision('transshipment_lat'),
  transshipmentLon: doublePrecision('transshipment_lon'),
  transshipmentDetails: text('transshipment_details'),
  transshipmentApprovedBy: text('transshipment_approved_by'),
  approvedBy: text('approved_by'),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  locked: boolean('locked').notNull().default(false),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

// Structured fishing effort — start/end, GPS, zone, depth, method, gear and
// line/hook/rod counts. `latOriginal`/`lonOriginal` preserve the auto GPS fix:
// a captain may correct the position, but only with a reason, and the original
// is never overwritten (audit requirement).
export const fishingActivities = pgTable('fishing_activities', {
  id: text('id').primaryKey(),
  tripId: text('trip_id').notNull(),
  boat: text('boat').notNull(),
  startAt: timestamp('start_at', { withTimezone: true }),
  endAt: timestamp('end_at', { withTimezone: true }),
  lat: doublePrecision('lat'),
  lon: doublePrecision('lon'),
  latOriginal: doublePrecision('lat_original'),
  lonOriginal: doublePrecision('lon_original'),
  locationAmendedReason: text('location_amended_reason'),
  zone: text('zone'),
  depthM: doublePrecision('depth_m'),
  method: text('method'),
  gear: text('gear'),
  lines: integer('lines'),
  hooks: integer('hooks'),
  rods: integer('rods'),
  operations: integer('operations'),
  trollingMinutes: integer('trolling_minutes'),
  effortNotes: text('effort_notes'),
  createdBy: text('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

// Bycatch and discards tracked separately from retained catches. `kind` splits
// the two ('bycatch' | 'discard') because they carry different fields (a
// discard needs a reason, a released bycatch needs a condition).
export const fishingBycatch = pgTable('fishing_bycatch', {
  id: text('id').primaryKey(),
  tripId: text('trip_id').notNull(),
  boat: text('boat').notNull(),
  kind: text('kind').notNull(), // 'bycatch' | 'discard'
  species: text('species').notNull(),
  faoCode: text('fao_code'),
  numberCount: integer('number_count'),
  weightKg: doublePrecision('weight_kg'),
  fate: text('fate'), // 'retained' | 'released'
  // 'undersized' | 'protected' | 'damaged' | 'unwanted' | 'regulatory' | 'other'
  discardReason: text('discard_reason'),
  condition: text('condition'),
  lat: doublePrecision('lat'),
  lon: doublePrecision('lon'),
  notes: text('notes'),
  createdBy: text('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

// Protected / sensitive species interaction. Legally the most serious record
// here — every one must be confirmed by the captain before it counts.
export const protectedSpeciesIncidents = pgTable(
  'protected_species_incidents',
  {
    id: text('id').primaryKey(),
    tripId: text('trip_id'),
    boat: text('boat').notNull(),
    species: text('species').notNull(),
    at: timestamp('at', { withTimezone: true }),
    lat: doublePrecision('lat'),
    lon: doublePrecision('lon'),
    // 'accidental-catch' | 'entangled' | 'observed' | 'other'
    interactionType: text('interaction_type'),
    outcome: text('outcome'), // 'released' | 'died' | 'unknown'
    condition: text('condition'),
    photoUrl: text('photo_url'),
    notes: text('notes'),
    captainConfirmed: boolean('captain_confirmed').notNull().default(false),
    confirmedBy: text('confirmed_by'),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
    createdBy: text('created_by'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
)

// Official catch declaration assembled from one or more fishing trips over a
// reporting period. `totals` is a computed snapshot (catch by species, bycatch,
// discards, effort) frozen at declaration time so a later trip edit cannot
// silently change what was already submitted to an authority.
export const catchDeclarations = pgTable('catch_declarations', {
  id: text('id').primaryKey(),
  boat: text('boat').notNull(),
  periodStart: date('period_start'),
  periodEnd: date('period_end'),
  tripIds: jsonb('trip_ids'),
  totals: jsonb('totals'),
  // 'draft' | 'ready' | 'captain-approved' | 'submitted' | 'accepted'
  // | 'correction-required'
  status: text('status').notNull().default('draft'),
  submittedTo: text('submitted_to'),
  submissionDate: date('submission_date'),
  submissionMethod: text('submission_method'),
  referenceNumber: text('reference_number'),
  proofUrl: text('proof_url'),
  approvedBy: text('approved_by'),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  notes: text('notes'),
  createdBy: text('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

// Passenger manifest — one per commercial passenger trip. Locked at START TRIP;
// later changes only via amendment (a new audit row), never in-place.
export const passengerManifests = pgTable('passenger_manifests', {
  id: text('id').primaryKey(),
  tripId: text('trip_id').notNull().unique(),
  boat: text('boat').notNull(),
  captainName: text('captain_name'),
  crewNames: jsonb('crew_names'), // string[]
  departureLocation: text('departure_location'),
  destination: text('destination'),
  departureTime: timestamp('departure_time', { withTimezone: true }),
  locked: boolean('locked').notNull().default(false),
  lockedAt: timestamp('locked_at', { withTimezone: true }),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const manifestPassengers = pgTable('manifest_passengers', {
  id: text('id').primaryKey(),
  manifestId: text('manifest_id').notNull(),
  fullName: text('full_name').notNull(),
  nationality: text('nationality'),
  dateOfBirth: date('date_of_birth'),
  documentId: text('document_id'),
  emergencyContact: text('emergency_contact'),
  bookingReference: text('booking_reference'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

// Safety equipment register — life jackets, extinguishers, first aid, VHF, etc.
// Status is derived from expiry/next-inspection dates, like documents.
export const safetyEquipment = pgTable('safety_equipment', {
  id: text('id').primaryKey(),
  boat: text('boat').notNull(),
  category: text('category').notNull(),
  name: text('name'),
  quantity: integer('quantity'),
  inspectionDate: date('inspection_date'),
  expiryDate: date('expiry_date'),
  condition: text('condition'),
  nextInspection: date('next_inspection'),
  notes: text('notes'),
  archived: boolean('archived').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

// Incident / accident log with a built-in authority-notification record.
export const incidentLogs = pgTable('incident_logs', {
  id: text('id').primaryKey(),
  boat: text('boat').notNull(),
  tripId: text('trip_id'),
  category: text('category').notNull(),
  captain: text('captain'),
  at: timestamp('at', { withTimezone: true }),
  lat: doublePrecision('lat'),
  lon: doublePrecision('lon'),
  description: text('description'),
  personsInvolved: text('persons_involved'),
  injuries: text('injuries'),
  damage: text('damage'),
  immediateActions: text('immediate_actions'),
  authorityNotified: boolean('authority_notified').notNull().default(false),
  authorityName: text('authority_name'),
  authorityAt: timestamp('authority_at', { withTimezone: true }),
  authorityMethod: text('authority_method'),
  authorityContact: text('authority_contact'),
  authorityReference: text('authority_reference'),
  proofUrl: text('proof_url'),
  locked: boolean('locked').notNull().default(false),
  createdBy: text('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

// A stored result of the legal & safety pre-departure check. `items` is the
// full checklist snapshot; `result` is green | yellow | red. A red result
// blocks the trip; an override must carry a documented legal reason.
export const predepartureChecks = pgTable('predeparture_checks', {
  id: text('id').primaryKey(),
  tripId: text('trip_id'),
  boat: text('boat').notNull(),
  purpose: text('purpose'),
  result: text('result').notNull(), // 'green' | 'yellow' | 'red'
  items: jsonb('items'),
  personsOnBoard: integer('persons_on_board'),
  maxPersons: integer('max_persons'),
  overrideReason: text('override_reason'),
  performedBy: text('performed_by'),
  performedAt: timestamp('performed_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})
