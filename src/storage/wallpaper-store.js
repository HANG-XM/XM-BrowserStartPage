/**
 * wallpaper-store.js —— 本地图片壁纸的 IndexedDB 封装
 *
 * 数据库：xm-startpage
 * 对象仓库：wallpapers（keyPath: id）
 * 记录结构：{ id: string, blob: Blob, createdAt: number }
 *
 * 全部方法返回 Promise，不依赖任何第三方库。
 * IndexedDB 不可用时（file://、部分隐私模式）isAvailable() 返回 false，
 * 其余方法会 reject，调用方需自行降级。
 */

const DB_NAME = 'xm-startpage';
const DB_VERSION = 1;
const STORE_NAME = 'wallpapers';

/** 已打开的数据库连接（模块级单例） */
let dbPromise = null;

/** 检测 IndexedDB 是否可用 */
export function isAvailable() {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null;
  } catch {
    return false;
  }
}

/** 打开数据库连接（幂等，失败后可重试） */
function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  // 打开失败时清除缓存，允许下次重试
  dbPromise.catch(() => {
    dbPromise = null;
  });
  return dbPromise;
}

/**
 * 在事务中执行单个请求并 Promise 化
 * @param {'readonly' | 'readwrite'} mode 事务模式
 * @param {(store: IDBObjectStore) => IDBRequest} executor
 */
function run(mode, executor) {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, mode);
        const store = tx.objectStore(STORE_NAME);
        let result;
        tx.oncomplete = () => resolve(result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
        const request = executor(store);
        request.onsuccess = () => {
          result = request.result;
        };
      })
  );
}

/** 生成记录 ID（优先 UUID，降级时间戳+随机数） */
function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * 保存图片 Blob，返回记录 id
 * @param {Blob} blob
 * @returns {Promise<string>}
 */
export function saveImage(blob) {
  const record = { id: generateId(), blob, createdAt: Date.now() };
  return run('readwrite', (store) => store.put(record)).then(() => record.id);
}

/**
 * 按 id 取图片 Blob；不存在时返回 null
 * @param {string} id
 * @returns {Promise<Blob | null>}
 */
export async function getImage(id) {
  const record = await run('readonly', (store) => store.get(id));
  return record ? record.blob : null;
}

/** 删除指定 id 的图片 */
export function deleteImage(id) {
  return run('readwrite', (store) => store.delete(id));
}

/** 清空所有图片 */
export function clearAll() {
  return run('readwrite', (store) => store.clear());
}
