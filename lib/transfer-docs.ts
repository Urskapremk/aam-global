// HTML generators for the transfer VOUCHER and INVOICE.
//
// Both documents share the transfer's `reference`, so a voucher and its
// invoice are always tied together — no confusion about which belongs to whom.
// The output is a self-contained, print-friendly HTML block used both as the
// email body and as an in-app preview the admin can print to PDF.

import {
  formatEur,
  formatTransferDate,
  paymentMethodLabel,
  routeLabel,
  arrivalTime,
  formatDuration,
} from './transfers'

const NAVY = '#1e3a5f'
const INK = '#3a4653'
const MUTED = '#8592a0'
const LINE = '#e6ebf1'
const SERIF = `'Cormorant Garamond', Cormorant, Georgia, 'Times New Roman', serif`
const SANS = `-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`

export type CompanyInfo = {
  name: string
  addressLine1: string
  addressLine2: string
  city: string
  country: string
  taxId: string
  iban: string
  bankName: string
  email: string
  phone: string
}

export type TransferDoc = {
  reference: string
  fromLocation: string
  toLocation: string
  date: string
  time: string
  durationMin: number
  boatName: string
  name: string
  email: string
  phone: string
  pax: number
  priceEur: number
  status: string
  paymentMethod: string
  invoiceNumber: string
}

function esc(s: string): string {
  return (s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function row(label: string, value: string): string {
  return `<tr>
    <td style="padding:7px 18px 7px 0;color:${MUTED};font-size:13px;white-space:nowrap;vertical-align:top">${esc(label)}</td>
    <td style="padding:7px 0;color:${INK};font-size:14px;font-weight:500">${value}</td>
  </tr>`
}

/** A branded document shell (header lockup + framed card), print-friendly. */
function docShell(eyebrow: string, title: string, company: CompanyInfo, inner: string): string {
  const anchor = `<img width="18" height="18" alt="" style="display:inline-block;vertical-align:middle" src="https://api.iconify.design/lucide/anchor.svg?color=%23ffffff&width=18&height=18" />`
  const contactBits = [company.email, company.phone].filter(Boolean).map(esc).join(' &middot; ')
  return `<div style="font-family:${SANS};color:${INK};max-width:600px;margin:0 auto">
    <div style="background:${NAVY};border-radius:14px 14px 0 0;padding:28px 30px">
      <div>${anchor}<span style="color:#fff;font-family:${SERIF};font-size:22px;font-weight:600;letter-spacing:0.2em;vertical-align:middle;margin-left:9px">AAM</span></div>
      <div style="color:#fff;font-family:${SERIF};font-size:25px;font-weight:500;margin-top:16px">${esc(company.name || 'African Adventures Madagascar')}</div>
      <div style="color:#b7c7d8;font-size:10px;letter-spacing:2.5px;text-transform:uppercase;margin-top:8px">${esc(eyebrow)}</div>
    </div>
    <div style="border:1px solid ${LINE};border-top:0;border-radius:0 0 14px 14px;padding:30px">
      <h2 style="margin:0 0 4px;font-family:${SERIF};font-size:26px;font-weight:600;color:${NAVY}">${esc(title)}</h2>
      ${inner}
      <div style="margin-top:26px;border-top:1px solid ${LINE};padding-top:16px;color:${MUTED};font-size:12px;line-height:1.7">
        <div style="color:${INK};font-weight:600">${esc(company.name || 'African Adventures Madagascar')}</div>
        ${company.addressLine1 ? `<div>${esc(company.addressLine1)}</div>` : ''}
        ${company.addressLine2 ? `<div>${esc(company.addressLine2)}</div>` : ''}
        ${company.city || company.country ? `<div>${esc([company.city, company.country].filter(Boolean).join(', '))}</div>` : ''}
        ${company.taxId ? `<div>Tax / Reg. no: ${esc(company.taxId)}</div>` : ''}
        ${contactBits ? `<div style="margin-top:6px">${contactBits}</div>` : ''}
      </div>
    </div>
  </div>`
}

/** VOUCHER — the confirmation the guest receives when the transfer is booked. */
export function buildVoucherHtml(t: TransferDoc, company: CompanyInfo): string {
  const details = `<table style="border-collapse:collapse;margin-top:18px;width:100%">
    ${row('Voucher ref.', `<strong style="letter-spacing:0.5px">${esc(t.reference)}</strong>`)}
    ${row('Guest', esc(t.name))}
    ${row('Route', esc(routeLabel(t.fromLocation, t.toLocation)))}
    ${row('Date', esc(formatTransferDate(t.date)))}
    ${t.time ? row('Departure time', esc(t.time)) : ''}
    ${
      arrivalTime(t.time, t.durationMin)
        ? row(
            'Arrival time (approx.)',
            `${esc(arrivalTime(t.time, t.durationMin))} <span style="color:${MUTED};font-size:12px">(${esc(formatDuration(t.durationMin))})</span>`,
          )
        : ''
    }
    ${row('Passengers', String(t.pax))}
    ${row('Vessel', esc(t.boatName))}
    ${row('Price', `<strong>${formatEur(t.priceEur)}</strong>`)}
  </table>`

  const inner = `<p style="margin:2px 0 0;color:${MUTED};font-size:14px">Transfer confirmation</p>
    <div style="margin-top:20px;background:#f6f8fb;border:1px solid ${LINE};border-radius:12px;padding:20px">
      ${details}
    </div>
    <p style="margin:20px 0 0;font-size:14px;line-height:1.7">
      Please keep this voucher and present it (on your phone or printed) to your
      captain at the meeting point. Payment is settled directly with us in cash
      on the day, or by bank transfer where arranged in advance.
    </p>
    <p style="margin:14px 0 0;font-size:14px;line-height:1.7">
      We look forward to welcoming you aboard. If your plans change, just reply
      to this email and we will do our best to accommodate you.
    </p>`

  return docShell('Transfer voucher', 'Your transfer is booked', company, inner)
}

/** INVOICE — the official billing document for the transfer. */
export function buildInvoiceHtml(t: TransferDoc, company: CompanyInfo): string {
  const issued = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const paid = t.status === 'paid' || t.status === 'completed'
  const statusBadge = paid
    ? `<span style="display:inline-block;background:#dcfce7;color:#166534;font-size:12px;font-weight:600;padding:3px 12px;border-radius:999px">PAID${t.paymentMethod ? ` &middot; ${esc(paymentMethodLabel(t.paymentMethod))}` : ''}</span>`
    : `<span style="display:inline-block;background:#fef3c7;color:#92400e;font-size:12px;font-weight:600;padding:3px 12px;border-radius:999px">PAYMENT DUE</span>`

  const meta = `<table style="border-collapse:collapse;margin-top:16px;width:100%">
    ${row('Invoice no.', `<strong>${esc(t.invoiceNumber || '—')}</strong>`)}
    ${row('Transfer ref.', esc(t.reference))}
    ${row('Issued', esc(issued))}
    ${row('Status', statusBadge)}
  </table>`

  const billTo = `<div style="margin-top:20px">
    <div style="color:${MUTED};font-size:11px;letter-spacing:1.5px;text-transform:uppercase">Bill to</div>
    <div style="margin-top:6px;color:${INK};font-size:15px;font-weight:600">${esc(t.name || '—')}</div>
    ${t.email ? `<div style="color:${MUTED};font-size:13px">${esc(t.email)}</div>` : ''}
    ${t.phone ? `<div style="color:${MUTED};font-size:13px">${esc(t.phone)}</div>` : ''}
  </div>`

  const lineDesc = `Island transfer &mdash; ${esc(routeLabel(t.fromLocation, t.toLocation))}<br/>
    <span style="color:${MUTED};font-size:12px">${esc(formatTransferDate(t.date))}${t.time ? `, ${esc(t.time)}` : ''} &middot; ${t.pax} ${t.pax === 1 ? 'passenger' : 'passengers'} &middot; ${esc(t.boatName)}</span>`

  const items = `<table style="border-collapse:collapse;width:100%;margin-top:24px">
    <thead>
      <tr>
        <th style="text-align:left;border-bottom:2px solid ${NAVY};padding:0 0 10px;color:${MUTED};font-size:11px;letter-spacing:1.5px;text-transform:uppercase;font-weight:600">Description</th>
        <th style="text-align:right;border-bottom:2px solid ${NAVY};padding:0 0 10px;color:${MUTED};font-size:11px;letter-spacing:1.5px;text-transform:uppercase;font-weight:600">Amount</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td style="padding:16px 0;border-bottom:1px solid ${LINE};font-size:14px;line-height:1.6;color:${INK}">${lineDesc}</td>
        <td style="padding:16px 0;border-bottom:1px solid ${LINE};font-size:14px;text-align:right;white-space:nowrap;color:${INK};vertical-align:top">${formatEur(t.priceEur)}</td>
      </tr>
      <tr>
        <td style="padding:16px 0 0;text-align:right;font-family:${SERIF};font-size:18px;font-weight:600;color:${NAVY}">Total due</td>
        <td style="padding:16px 0 0;text-align:right;font-family:${SERIF};font-size:20px;font-weight:700;color:${NAVY};white-space:nowrap">${formatEur(t.priceEur)}</td>
      </tr>
    </tbody>
  </table>`

  const payNote =
    t.paymentMethod === 'bank' && company.iban
      ? `<div style="margin-top:22px;background:#f6f8fb;border:1px solid ${LINE};border-radius:12px;padding:16px 18px">
          <div style="color:${MUTED};font-size:11px;letter-spacing:1.5px;text-transform:uppercase">Bank transfer details</div>
          ${company.bankName ? `<div style="margin-top:8px;font-size:14px;color:${INK}">${esc(company.bankName)}</div>` : ''}
          <div style="font-size:14px;color:${INK}">IBAN: ${esc(company.iban)}</div>
          <div style="margin-top:6px;font-size:12px;color:${MUTED}">Please quote reference ${esc(t.reference)} with your payment.</div>
        </div>`
      : `<p style="margin:20px 0 0;font-size:13px;color:${MUTED};line-height:1.7">Payment is settled in cash on the day of the transfer unless a bank transfer has been arranged in advance.</p>`

  const inner = `<p style="margin:2px 0 0;color:${MUTED};font-size:14px">Invoice</p>
    ${meta}
    ${billTo}
    ${items}
    ${payNote}`

  return docShell('Invoice', 'Invoice', company, inner)
}
