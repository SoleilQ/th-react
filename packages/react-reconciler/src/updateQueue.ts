import { Dispatch } from 'react/src/currentDispatcher';
import { Action } from 'shared/ReactTypes';
import { Lane } from './fiberLanes';

export interface Update<State> {
	action: Action<State>;
	lane: Lane;
	next: Update<any> | null;
}

export interface UpdateQueue<State> {
	shared: {
		pending: Update<State> | null;
	};
	dispatch: Dispatch<State> | null;
}

export const createUpdate = <State>(
	action: Action<State>,
	lane: Lane
): Update<State> => {
	return {
		action,
		lane,
		next: null
	};
};

export const createUpdateQueue = <State>(): UpdateQueue<State> => {
	return {
		shared: {
			pending: null
		},
		dispatch: null
	};
};

/**
 * 往 updateQueue中插入一个update
 * @param updateQueue
 * @param update
 */
export const enqueueUpdate = <State>(
	updateQueue: UpdateQueue<State>,
	update: Update<State>
) => {
	const pending = updateQueue.shared.pending;
	if (pending === null) {
		// pending =  a -> a a和自己形成一条环状链表
		update.next = update;
	} else {
		// b.next = a.next;
		// a.next = b;
		// pending = b -> a -> b

		// c.next = b.next;
		// b.next = c;
		// pending = c -> b.next = a -> b -> c
		update.next = pending.next;
		pending.next = update;
	}
	// pending始终指向最后插入的
	updateQueue.shared.pending = update;
};

/**
 * updateQueue 消费 update
 * @param baseState 初始状态
 * @param pendingUpdate 消费的 update
 * @param renderLane 本次更新的优先级
 * @returns 最新的状态
 */
export const processUpdateQueue = <State>(
	baseState: State,
	pendingUpdate: Update<State> | null,
	renderLane: Lane
): { memoizedState: State } => {
	const result: ReturnType<typeof processUpdateQueue<State>> = {
		memoizedState: baseState
	};
	// 假设有abc3个update
	// pending -> c -> a -> b -> c
	if (pendingUpdate !== null) {
		// pendingUpdate指向最后一个update
		const first = pendingUpdate.next; // 指向链表中的第一个update
		let pending = pendingUpdate.next as Update<any>;
		do {
			const updateLane = pending.lane;
			if (updateLane === renderLane) {
				const action = pending.action;
				if (action instanceof Function) {
					// baseState 1 update (x) => 4 * x -> memoizedState 4
					baseState = action(baseState);
				} else {
					// baseState 1 update 2 -> memoizedState 2
					baseState = action;
				}
			} else {
				if (__DEV__) {
					console.warn('不应该进入这个updateLane !== renderLane逻辑');
				}
			}
			pending = pending.next as Update<any>;
		} while (pending !== first);
	}
	result.memoizedState = baseState;
	return result;
};
