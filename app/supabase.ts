import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(url, key)

// ── 預約相關 ──────────────────────────────────────────────────────────────────
export async function getBookings() {
  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) { console.error(error); return [] }
  return data.map((b: any) => ({
    id: b.id, code: b.code, name: b.customer_name,
    phone: b.phone, cid: b.cid, cname: b.cname,
    date: b.booking_date, slot: b.slot,
    groups: b.groups, status: b.status,
  }))
}

export async function addBooking(b: any) {
  const { error } = await supabase.from('bookings').insert({
    id: b.id, code: b.code, customer_name: b.name,
    phone: b.phone, cid: b.cid, cname: b.cname,
    booking_date: b.date, slot: b.slot,
    groups: b.groups, status: b.status,
  })
  if (error) console.error('addBooking:', error)
}

export async function updateBookingStatus(id: string, status: string) {
  const { error } = await supabase
    .from('bookings').update({ status }).eq('id', id)
  if (error) console.error('updateStatus:', error)
}

// ── 課程相關 ──────────────────────────────────────────────────────────────────
export async function getCourses() {
  const { data, error } = await supabase
    .from('courses').select('*').order('created_at')
  if (error) { console.error(error); return [] }
  return data.map((c: any) => ({
    id: c.id, name: c.name, icon: c.icon,
    iconImg: c.icon_img, price: c.price,
    maxGroups: c.max_groups, minWd: c.min_wd,
    minHd: c.min_hd, fallbackWd: c.fallback_wd,
    slots: c.slots || [], active: c.active,
  }))
}

export async function upsertCourse(c: any) {
  const { error } = await supabase.from('courses').upsert({
    id: c.id, name: c.name, icon: c.icon,
    icon_img: c.iconImg, price: c.price,
    max_groups: c.maxGroups, min_wd: c.minWd,
    min_hd: c.minHd, fallback_wd: c.fallbackWd,
    slots: c.slots, active: c.active,
  })
  if (error) console.error('upsertCourse:', error)
}

// ── 設定相關 ──────────────────────────────────────────────────────────────────
export async function getSettings() {
  const { data, error } = await supabase.from('settings').select('*')
  if (error) { console.error(error); return {} }
  const obj: any = {}
  data.forEach((row: any) => {
    try { obj[row.key] = JSON.parse(row.value) }
    catch { obj[row.key] = row.value }
  })
  return obj
}

export async function saveSetting(key: string, value: any) {
  const { error } = await supabase.from('settings').upsert({
    key, value: JSON.stringify(value)
  })
  if (error) console.error('saveSetting:', error)
}

// ── 員工白名單驗證 ────────────────────────────────────────────────────────────
export async function isStaffEmail(email: string) {
  const { data } = await supabase
    .from('staff_emails').select('email').eq('email', email).single()
  return !!data
}