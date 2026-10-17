import mysql from 'mysql2/promise'
import bcrypt from 'bcryptjs'
import CA from '../lib/ca.js'

const E = process.env
const pw = process.argv[2]
if (!pw || pw.length < 8) {
  console.log('Usage: node --env-file=.env scripts/set-admin.js YourNewPassword   (8 or more characters)')
  process.exit(1)
}
const c = await mysql.createConnection({ host: E.DB_HOST, port: +E.DB_PORT, user: E.DB_USER, password: E.DB_PASS, database: E.DB_NAME, ssl: { ca: CA } })
await c.query('DELETE FROM admins')
await c.query('INSERT INTO admins(username,password) VALUES(?,?)', ['admin', await bcrypt.hash(pw, 10)])
console.log('Done. Admin username: admin')
await c.end()