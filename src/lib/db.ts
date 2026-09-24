import * as SQLite from 'expo-sqlite';

let dbInstance: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!dbInstance) {
    dbInstance = await SQLite.openDatabaseAsync('fitlog_offline.db');
    await initDatabase(dbInstance);
  }
  return dbInstance;
}

async function initDatabase(db: SQLite.SQLiteDatabase): Promise<void> {
  // Schema preparation for future offline workout logging & offline sync queue
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS offline_sync_queue (
      id TEXT PRIMARY KEY NOT NULL,
      endpoint TEXT NOT NULL,
      method TEXT NOT NULL,
      payload TEXT,
      created_at TEXT NOT NULL,
      synced INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS offline_workouts (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      routine_id TEXT,
      started_at TEXT NOT NULL,
      completed_at TEXT,
      duration_seconds INTEGER DEFAULT 0,
      notes TEXT,
      exercises_json TEXT,
      synced INTEGER NOT NULL DEFAULT 0
    );
  `);
}

export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    const db = await getDatabase();
    const result = await db.getFirstAsync<{ count: number }>('SELECT count(*) as count FROM offline_sync_queue');
    return result !== null;
  } catch (error) {
    console.error('Offline database health check failed:', error);
    return false;
  }
}
