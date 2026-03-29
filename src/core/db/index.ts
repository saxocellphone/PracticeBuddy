import { PGlite } from '@electric-sql/pglite'
import { runMigrations } from './migrations.ts'
import { seedJazzStandards } from './seeds/jazzStandards.ts'

let db: PGlite | null = null

export async function getDb(): Promise<PGlite> {
  if (!db) {
    db = new PGlite('idb://practicebuddy')
    await db.waitReady
    await runMigrations(db)
    await seedJazzStandards(db)
  }
  return db
}
