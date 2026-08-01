import { z } from "zod";

const databaseName = "focused-focus-commands";
const storeName = "commands";

const offlineFocusCommandSchema = z
  .object({
    clientCommandId: z.uuid(),
    sessionId: z.uuid(),
    action: z.enum(["completion", "abandonment"]),
    expectedVersion: z.int().positive(),
    outcome: z.string().max(2_000).nullable(),
  })
  .strict();

export type OfflineFocusCommand = z.infer<typeof offlineFocusCommandSchema>;

export async function enqueueFocusCommand(command: OfflineFocusCommand) {
  const database = await openDatabase();
  await transact(database, "readwrite", (store) => store.put(command));
  database.close();
}

export async function pendingFocusCommands(): Promise<
  readonly OfflineFocusCommand[]
> {
  const database = await openDatabase();
  const values = await transact<unknown[]>(database, "readonly", (store) =>
    store.getAll(),
  );
  database.close();
  return values.flatMap((value) => {
    const result = offlineFocusCommandSchema.safeParse(value);
    return result.success ? [result.data] : [];
  });
}

export async function removeFocusCommand(clientCommandId: string) {
  const database = await openDatabase();
  await transact(database, "readwrite", (store) =>
    store.delete(clientCommandId),
  );
  database.close();
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(storeName))
        request.result.createObjectStore(storeName, {
          keyPath: "clientCommandId",
        });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Focus command storage failed."));
  });
}

function transact<T = void>(
  database: IDBDatabase,
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, mode);
    const request = operation(transaction.objectStore(storeName));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Focus command storage failed."));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("Focus command was aborted."));
  });
}
