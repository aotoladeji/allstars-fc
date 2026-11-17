import { useEffect, useState } from 'react'

export const BASE = '/api'
export const DATA_CHANGED = 'allstars-data-changed'
export const ACTION_START = 'allstars-action-start'
export const ACTION_END = 'allstars-action-end'
export const ACTION_MESSAGE = 'allstars-action-message'
const emit = (name, detail) => window.dispatchEvent(detail === undefined ? new Event(name) : new CustomEvent(name, { detail }))
export const notifySuccess = text => emit(ACTION_MESSAGE, { type: 'success', text })
export const notifyError = text => emit(ACTION_MESSAGE, { type: 'error', text })
export const runAction = async (task, success = 'Saved.') => {
  emit(ACTION_START)
  try {
    const result = await task()
    notifySuccess(typeof success === 'function' ? success(result) : success)
    return result
  } catch (e) {
    notifyError(e.message || 'Something went wrong. Please try again.')
    throw e
  } finally { emit(ACTION_END) }
}
export const notifyDataChanged = () => {
  emit(DATA_CHANGED)
  try { localStorage.setItem(DATA_CHANGED, String(Date.now())) } catch {}
}

// Makes Cloudinary links load faster (automatic format and quality)
export const img = p => {
  if (!p || !p.startsWith('http')) return ''
  return p.includes('/image/upload/')
    ? p.replace('/upload/', '/upload/f_auto,q_auto/').replace(/\.\w+$/, '')
    : p.replace('/upload/', '/upload/q_auto/')
}

export async function api(r, { method = 'GET', body, params = {} } = {}) {
  if (body instanceof FormData) throw new Error('Pass formData(form) instead of a raw FormData as the body.')
  const opt = { method, credentials: 'include', cache: 'no-store' }
  if (body) { opt.headers = { 'Content-Type': 'application/json' }; opt.body = JSON.stringify(body) }
  const res = await fetch(BASE + '?' + new URLSearchParams({ r, ...params }), opt)
  const d = await res.json().catch(() => ({ error: 'Server error. Please try again.' }))
  if (!res.ok) throw new Error(d.error || 'Something went wrong')
  return d
}

export function useApi(r, params = {}, dep = 0) {
  const [d, setD] = useState(null)
  useEffect(() => {
    let live = true
    const load = () => api(r, { params }).then(x => { if (live) setD(x) }).catch(() => { if (live) setD(undefined) })
    const onStorage = e => { if (e.key === DATA_CHANGED) load() }
    load()
    window.addEventListener(DATA_CHANGED, load)
    window.addEventListener('storage', onStorage)
    return () => {
      live = false
      window.removeEventListener(DATA_CHANGED, load)
      window.removeEventListener('storage', onStorage)
    }
  }, [r, JSON.stringify(params), dep])
  return d
}

// Sends one file straight from the browser to Cloudinary and returns its link
export async function uploadToCloud(file, resource) {
  resource = resource || (file.type.startsWith('video') ? 'video' : 'image')
  const s = await api('sign', { params: { resource } })
  const fd = new FormData()
  fd.append('file', file)
  ;['api_key', 'timestamp', 'signature', 'folder', 'allowed_formats'].forEach(k => fd.append(k, s[k]))
  const r = await fetch(`https://api.cloudinary.com/v1_1/${s.cloud_name}/${resource}/upload`, { method: 'POST', body: fd })
  const d = await r.json()
  if (!r.ok) throw new Error(d.error?.message || 'Upload failed')
  return d.secure_url
}

// Turns a form into a plain object, uploading any chosen files to Cloudinary first
export async function formData(form, skipFiles = false) {
  const out = {}
  for (const el of form.elements) {
    if (!el.name || el.disabled || el.type === 'submit' || el.type === 'button') continue
    if (el.type === 'file') {
      if (skipFiles || !el.files.length) continue
      const urls = []
      for (const f of el.files) urls.push(await uploadToCloud(f))
      out[el.name.replace('[]', '')] = el.multiple ? urls : urls[0]
    } else if (el.type === 'checkbox') {
      if (el.checked) out[el.name] = el.value
    } else out[el.name] = el.value
  }
  return out
}