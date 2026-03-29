import type { PGlite } from '@electric-sql/pglite'

export async function runMigrations(db: PGlite): Promise<void> {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS jazz_standards (
      id              TEXT PRIMARY KEY,
      title           TEXT NOT NULL,
      composer        TEXT NOT NULL,
      key             TEXT NOT NULL,
      time_sig_beats  INTEGER NOT NULL DEFAULT 4,
      time_sig_value  INTEGER NOT NULL DEFAULT 4,
      tempo           INTEGER,
      form            TEXT NOT NULL,
      melody_clef     TEXT NOT NULL DEFAULT 'treble',
      tags            TEXT[],
      measures        JSONB NOT NULL
    );
  `)
}
