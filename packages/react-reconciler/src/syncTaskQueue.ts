let syncQueue: ((...args: any) => void)[] | null = null;
let isFlushingSyncQueue = false;

export function scheduleSyncCallback(callback: (...args: any) => void) {
	if (syncQueue === null) {
		syncQueue = [callback];
	} else {
		syncQueue.push(callback);
	}
}

export function flushSyncCallbacks() {
	// 只会遍历一次并执行
	if (!isFlushingSyncQueue && syncQueue) {
		isFlushingSyncQueue = true;
		try {
			syncQueue.forEach((callback) => callback());
		} catch (error) {
			if (__DEV__) {
				console.warn('isFlushingSyncQueue报错', error);
			}
		} finally {
			isFlushingSyncQueue = false;
		}
	}
}
