'use server'

import { db, pool } from '@/lib/db'
import { shopProducts } from '@/lib/db/schema'
import { isAdmin } from '@/lib/admin-auth'
import { getFxRates } from './fuel'
import { asc, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

async function assertAdmin() {
  if (!(await isAdmin())) throw new Error('Unauthorized')
}

let columnReady: Promise<unknown> | null = null
function ensurePriceArColumn() {
  columnReady ??= (async () => {
    await pool.query(
      `ALTER TABLE shop_products
         ADD COLUMN IF NOT EXISTS "priceAr" integer NOT NULL DEFAULT 0,
         ADD COLUMN IF NOT EXISTS "costAr" integer NOT NULL DEFAULT 0,
         ADD COLUMN IF NOT EXISTS "transportAr" integer NOT NULL DEFAULT 0,
         ADD COLUMN IF NOT EXISTS "customsAr" integer NOT NULL DEFAULT 0,
         ADD COLUMN IF NOT EXISTS "marginPct" double precision NOT NULL DEFAULT 0,
         ADD COLUMN IF NOT EXISTS "stock" integer`,
    )
    await pool.query(
      `CREATE TABLE IF NOT EXISTS shop_stock_moves (
         id serial PRIMARY KEY,
         "productId" integer NOT NULL,
         kind text NOT NULL,
         delta integer NOT NULL,
         "stockAfter" integer NOT NULL,
         "priceAr" integer NOT NULL DEFAULT 0,
         note text NOT NULL DEFAULT '',
         "createdAt" timestamp NOT NULL DEFAULT now()
       )`,
    )
  })().catch((e) => {
    columnReady = null
    throw e
  })
  return columnReady
}

export async function getProducts() {
  await assertAdmin()
  await ensurePriceArColumn()
  return db
    .select()
    .from(shopProducts)
    .orderBy(asc(shopProducts.sortOrder), asc(shopProducts.id))
}

/** Public catalogue: only selling-price fields, never costs, margin or stock counts. */
export async function getPublishedProducts() {
  await ensurePriceArColumn()
  const rows = await db
    .select({
      stock: shopProducts.stock,
      id: shopProducts.id,
      name: shopProducts.name,
      category: shopProducts.category,
      price: shopProducts.price,
      priceAr: shopProducts.priceAr,
      image: shopProducts.image,
      alt: shopProducts.alt,
      description: shopProducts.description,
      featured: shopProducts.featured,
      published: shopProducts.published,
      sortOrder: shopProducts.sortOrder,
    })
    .from(shopProducts)
    .where(eq(shopProducts.published, true))
    .orderBy(asc(shopProducts.sortOrder), asc(shopProducts.id))
  return rows.map(({ stock, ...r }) => ({ ...r, soldOut: stock !== null && stock <= 0 }))
}

type ProductInput = {
  name: string
  category: string
  priceAr: number
  costAr: number
  transportAr: number
  customsAr: number
  marginPct: number
  image: string | null
  alt: string
  description: string
  featured: boolean
  published: boolean
  sortOrder: number
}

const nonNegInt = (v: unknown) => Math.max(0, Math.round(Number(v) || 0))

async function withEurPrice(data: ProductInput) {
  await ensurePriceArColumn()
  const costAr = nonNegInt(data.costAr)
  const transportAr = nonNegInt(data.transportAr)
  const customsAr = nonNegInt(data.customsAr)
  const marginPct = Math.max(0, Number(data.marginPct) || 0)
  const landedAr = costAr + transportAr + customsAr
  // With costs entered, the selling price is always landed cost + margin.
  const priceAr =
    landedAr > 0 ? Math.round(landedAr * (1 + marginPct / 100)) : nonNegInt(data.priceAr)
  const { arPerEur } = await getFxRates()
  const price = arPerEur > 0 ? Math.round(priceAr / arPerEur) : 0
  return { ...data, costAr, transportAr, customsAr, marginPct, priceAr, price }
}

export async function createProduct(data: ProductInput) {
  await assertAdmin()
  const values = await withEurPrice(data)
  await db.insert(shopProducts).values({ ...values, updatedAt: new Date() })
  revalidatePath('/admin/products')
  revalidatePath('/shop')
}

export async function updateProduct(id: number, data: ProductInput) {
  await assertAdmin()
  const values = await withEurPrice(data)
  await db
    .update(shopProducts)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(shopProducts.id, id))
  revalidatePath('/admin/products')
  revalidatePath('/shop')
}

export type StockMoveKind = 'sale' | 'receipt' | 'count'

export type StockMove = {
  id: number
  kind: StockMoveKind
  delta: number
  stockAfter: number
  priceAr: number
  note: string
  createdAt: string
}

/**
 * Record a stock movement atomically. Sales subtract (and are refused when
 * there isn't enough on hand), receipts add, a count sets the exact number.
 */
export async function recordStockMove(
  productId: number,
  kind: StockMoveKind,
  qty: number,
  note = '',
): Promise<{ ok: true; stock: number } | { ok: false; error: string }> {
  await assertAdmin()
  await ensurePriceArColumn()
  const n = Math.round(Number(qty))
  if (!Number.isFinite(n) || n < 0 || n > 100000 || (kind !== 'count' && n === 0)) {
    return { ok: false, error: 'Invalid quantity.' }
  }
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const cur = await client.query<{ stock: number | null; priceAr: number }>(
      `SELECT stock, "priceAr" FROM shop_products WHERE id = $1 FOR UPDATE`,
      [productId],
    )
    if (cur.rowCount === 0) {
      await client.query('ROLLBACK')
      return { ok: false, error: 'Product not found.' }
    }
    const before = cur.rows[0].stock
    if (kind === 'sale' && (before === null || before < n)) {
      await client.query('ROLLBACK')
      return {
        ok: false,
        error:
          before === null
            ? 'Stock is not set yet — record a receipt or stock count first.'
            : 'Not enough stock.',
      }
    }
    const base = before ?? 0
    const after = kind === 'sale' ? base - n : kind === 'receipt' ? base + n : n
    await client.query(`UPDATE shop_products SET stock = $1, "updatedAt" = now() WHERE id = $2`, [
      after,
      productId,
    ])
    await client.query(
      `INSERT INTO shop_stock_moves ("productId", kind, delta, "stockAfter", "priceAr", note)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        productId,
        kind,
        after - base,
        after,
        kind === 'sale' ? cur.rows[0].priceAr : 0,
        String(note).slice(0, 300),
      ],
    )
    await client.query('COMMIT')
    revalidatePath('/admin/products')
    revalidatePath('/shop')
    return { ok: true, stock: after }
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {})
    throw e
  } finally {
    client.release()
  }
}

export async function getStockMoves(productId: number): Promise<StockMove[]> {
  await assertAdmin()
  await ensurePriceArColumn()
  const res = await pool.query(
    `SELECT id, kind, delta, "stockAfter", "priceAr", note, "createdAt"
       FROM shop_stock_moves WHERE "productId" = $1
      ORDER BY "createdAt" DESC, id DESC LIMIT 30`,
    [productId],
  )
  return res.rows.map((r) => ({
    ...r,
    createdAt: new Date(r.createdAt).toISOString(),
  }))
}

export async function deleteProduct(id: number) {
  await assertAdmin()
  await pool.query(`DELETE FROM shop_stock_moves WHERE "productId" = $1`, [id])
  await db.delete(shopProducts).where(eq(shopProducts.id, id))
  revalidatePath('/admin/products')
  revalidatePath('/shop')
}
