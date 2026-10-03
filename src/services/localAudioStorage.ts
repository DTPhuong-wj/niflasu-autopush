const DATABASE_NAME = "niflasu-listening-audio";
const DATABASE_VERSION = 1;
const STORE_NAME = "audio-files";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Không thể mở kho audio."));
  });
}

export async function saveLocalAudioFile(audioFileId: string, file: File): Promise<void> {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put(file, audioFileId);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Không thể lưu audio."));
      transaction.onabort = () => reject(transaction.error ?? new Error("Không thể lưu audio."));
    });
  } finally {
    database.close();
  }
}

export async function loadLocalAudioFile(audioFileId: string): Promise<Blob | null> {
  const database = await openDatabase();
  try {
    return await new Promise<Blob | null>((resolve, reject) => {
      const request = database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(audioFileId);
      request.onsuccess = () => resolve(request.result instanceof Blob ? request.result : null);
      request.onerror = () => reject(request.error ?? new Error("Không thể đọc audio."));
    });
  } finally {
    database.close();
  }
}