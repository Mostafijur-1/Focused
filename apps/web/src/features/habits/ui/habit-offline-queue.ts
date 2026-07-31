import { z } from "zod";

const databaseName = "focused-habit-commands";
const storeName = "commands";

export const offlineHabitCommandSchema = z
  .object({
    clientCommandId: z.uuid(),
    habitId: z.uuid(),
    localDate: z.iso.date(),
    value: z.number().min(0).max(1_000_000).nullable(),
    completed: z.boolean().nullable(),
    expectedVersion: z.number().int().positive().optional(),
  })
  .strict();

export type OfflineHabitCommand = z.infer<typeof offlineHabitCommandSchema>;

export async function enqueueHabitCommand(
  command: OfflineHabitCommand,
): Promise<void> {
  const database = await openDatabase();
  await transactionPromise(database, "readwrite", (store) =>
    store.put(command),
  );
  database.close();
}

export async function pendingHabitCommands(): Promise<
  readonly OfflineHabitCommand[]
> {
  const database = await openDatabase();
  const values = await transactionPromise<unknown[]>(
    database,
    "readonly",
    (store) => store.getAll(),
  );
  database.close();
  return values.flatMap((value) => {
    const parsed = offlineHabitCommandSchema.safeParse(value);
    return parsed.success ? [parsed.data] : [];
  });
}

export async function removeHabitCommand(
  clientCommandId: string,
): Promise<void> {
  const database = await openDatabase();
  await transactionPromise(database, "readwrite", (store) =>
    store.delete(clientCommandId),
  );
  database.close();
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(storeName)) {
        request.result.createObjectStore(storeName, {
          keyPath: "clientCommandId",
        });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Habit command storage failed."));
  });
}

function transactionPromise<T = void>(
  database: IDBDatabase,
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, mode);
    const request = operation(transaction.objectStore(storeName));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Habit command storage failed."));
    transaction.onabort = () =>
      reject(
        transaction.error ?? new Error("Habit command storage was aborted."),
      );
  });
}
