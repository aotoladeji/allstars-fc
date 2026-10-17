import { useEffect, useState } from 'react'

export const BASE = '/api'

// Makes Cloudinary links load faster (automatic format and quality)
export const img = p => {
  if (!p || !p.startsWith('http')) return ''
  return p.includes('/image/upload/')
    ? p.replace('/upload/', '/upload/f_auto,q_auto/').replace(/\.\w+$/, '')
    : p.replace('/upload/', '/upload/q_auto/')
}

export async function api(r, { method = 'GET', body, params = {} } = {}) {
  const opt = { method, credentials: 'include' }
  if (body) { opt.headers = { 'Content-Type': 'application/json' }; opt.body = JSON.stringify(body) }
  const res = await fetch(BASE + '?' + new URLSearchParams({ r, ...params }), opt)
  const d = await res.json().catch(() => ({ error: 'Server error. Please try again.' }))
  if (!res.ok) throw new Error(d.error || 'Something went wrong')
  return d
}

export function useApi(r, params = {}, dep = 0) {
  const [d, setD] = useState(null)
  useEffect(() => { api(r, { params }).then(setD).catch(() => setD(undefined)) }, [r, JSON.stringify(params), dep])
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