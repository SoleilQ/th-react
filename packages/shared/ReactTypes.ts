export type Type = any;
export type Key = any;
export type Ref = any;
export type Props = any;
export type ElementType = any;

export interface ReactElementType {
	/**
	 * 内部字段，用于标识当前对象是一个 ReactElement。
	 * 需要通过 Symbol 来保证唯一性
	 */
	$$typeof: symbol | number;
	type: Type;
	key: Key;
	props: Props;
	ref: Ref;
	__mark: string;
}

/**
 * 支持传递一个值或者函数，函数的返回值作为新的 state
 */
export type Action<State> = State | ((prevState: State) => State);
