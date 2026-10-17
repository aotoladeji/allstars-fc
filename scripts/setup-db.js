import mysql from 'mysql2/promise'
import fs from 'fs'
import CA from '../lib/ca.js'

const E = process.env
const c = await mysql.createConnection({ host: E.DB_HOST, port: +E.DB_PORT, user: E.DB_USER, password: E.DB_PASS, database: E.DB_NAME, ssl: { ca: CA }, multipleStatements: true })
await c.query(fs.readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'))
console.log('Tables created.')
await c.end()