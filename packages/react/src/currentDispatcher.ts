// 当前使用hooks集合

import { Action } from 'shared/ReactTypes';

export interface Dispatcher {
	useState: <T>(initialState: (() => T) | T) => [T, Dispatch<T>];
	useEffect: any;
}

export type Dispatch<State> = (
	action: Action<State>
) => [State, Dispatch<State>];

const currentDispatcher: { current: Dispatcher | null } = {
	current: null
};

export const resolveDispatcher = (): Dispatcher => {
	const dispatcher = currentDispatcher.current;

	if (dispatcher === null) {
		throw new Error('Hook只能在函数组件中执行');
	}

	return dispatcher;
};

export default currentDispatcher;
