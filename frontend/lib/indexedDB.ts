// IndexedDB utility for image storage
import { toast } from 'sonner';

const DB_NAME = 'StudioImageDB';
const DB_VERSION = 1;
const STORE_NAME = 'images';

export interface ImageData {
  id: string;
  sceneId: string;
  type: 'lineart' | 'art';
  fileName: string;
  fileSize: number;
  mimeType: string;
  data: Blob;
  uploadedAt: Date;
  dimensions?: {
    width: number;
    height: number;
  };
}

export class ImageDB {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        reject(new Error('Failed to open IndexedDB'));
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('sceneId', 'sceneId', { unique: false });
          store.createIndex('type', 'type', { unique: false });
          store.createIndex('uploadedAt', 'uploadedAt', { unique: false });
        }
      };
    });
  }

  async saveImage(image: ImageData): Promise<void> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.add(image);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to save image'));
    });
  }

  async getImagesByScene(sceneId: string): Promise<ImageData[]> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('sceneId');
      const request = index.getAll(sceneId);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error('Failed to fetch images'));
    });
  }

  async getImage(id: string): Promise<ImageData | undefined> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error('Failed to fetch image'));
    });
  }

  async deleteImage(id: string): Promise<void> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to delete image'));
    });
  }
}

export const imageDB = new ImageDB();
