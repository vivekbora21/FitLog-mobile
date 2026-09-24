// Web-compatible stub for future offline database
// On native iOS and Android, db.ts uses expo-sqlite.

export async function getDatabase(): Promise<any> {
  return {
    execAsync: async () => {},
    getFirstAsync: async () => ({ count: 0 }),
    getAllAsync: async () => [],
  };
}

export async function checkDatabaseHealth(): Promise<boolean> {
  // Always healthy on web
  return true;
}
