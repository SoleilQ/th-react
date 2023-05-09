import { Key, Props, ReactElementType, Ref } from 'shared/ReactTypes';
import { FunctionComponent, HostComponent, WorkTag } from './workTags';
import { Flags, NoFlags } from './fiberFlags';
import { Container } from 'hostConfig';

export class FiberNode {
	tag: WorkTag; // 实例属性
	/**
	 * 从 ReactElement 中取得 type
	 * 对于 FunctionComponent，() => {} 函数本身就是其 type。
	 * 对于 div DOM，type 就是 'div'。
	 */
	type: any;
	key: Key;
	/**
	 * 比如对于 HostComponent <div>，div 这个 DOM 就是其 stateNode。
	 * 对于 hostRootFiber，stateNode 就是 FiberRootNode。
	 */
	stateNode: any;
	ref: Ref;

	// 构成树状结构
	return: FiberNode | null;
	sibling: FiberNode | null;
	child: FiberNode | null;
	index: number;

	// 将要发生变化的 props
	pendingProps: Props;
	// 工作结束后确定下的 props
	memoizedProps: Props | null;
	memoizedState: Props | null;
	alternate: FiberNode | null; // 双缓存树指向(workInProgress 和 current切换）
	flags: Flags; // 副作用标识
	subtreeFlags: Flags; // 子树的副作用标识
	updateQueue: unknown;
	deletions: FiberNode[] | null;

	constructor(tag: WorkTag, pendingProps: Props, key: Key) {
		// 实例的属性
		this.tag = tag;
		this.key = key;
		// HostComponent <div>  div DOM
		this.stateNode = null;
		// FunctionComponent () => {}
		this.type = null;

		// 构成树状结构
		this.return = null;
		this.sibling = null;
		this.child = null;
		this.index = 0;

		this.ref = null;

		// 作为工作单元
		this.pendingProps = pendingProps;
		this.memoizedProps = null;
		this.memoizedState = null;
		this.updateQueue = null;

		this.alternate = null;
		// 副作用
		this.flags = NoFlags;
		this.subtreeFlags = NoFlags;
		this.deletions = null;
	}
}

export class FiberRootNode {
	container: Container; // 不同环境  在浏览器环境就是root节点
	current: FiberNode;
	finishedWork: FiberNode | null;
	constructor(container: Container, hostRootFiber: FiberNode) {
		this.container = container;
		this.current = hostRootFiber;
		hostRootFiber.stateNode = this; // FiberRootNode
		this.finishedWork = null;
	}
}

/**
 * 根据双缓存机制，应当返回 current 对应的 FiberNode。
 * 对于同一个 fibernode，在多次更新时，会在双缓存中来回切换，避免重复创建。
 * @param current
 * @param pendingProps
 * @returns
 */
export const createWorkInProgress = (
	current: FiberNode,
	pendingProps: Props
): FiberNode => {
	let workInProgress = current.alternate;

	if (workInProgress === null) {
		// mount
		// 需要新建一个 FiberNode
		workInProgress = new FiberNode(current.tag, pendingProps, current.key);
		workInProgress.stateNode = current.stateNode;
		workInProgress.alternate = current;
		current.alternate = workInProgress;
	} else {
		// update
		workInProgress.pendingProps = pendingProps;
		// 清除副作用 （上一次更新遗留下来的）
		workInProgress.flags = NoFlags;
		workInProgress.subtreeFlags = NoFlags;
		workInProgress.deletions = null;
	}
	workInProgress.type = current.type;
	workInProgress.updateQueue = current.updateQueue;
	workInProgress.child = current.child;
	workInProgress.memoizedProps = current.memoizedProps;
	workInProgress.memoizedState = current.memoizedState;

	return workInProgress;
};

export function createFiberFromElement(element: ReactElementType): FiberNode {
	const { type, key, props } = element;
	let fiberTag: WorkTag = FunctionComponent;

	if (typeof type === 'string') {
		// <div> type: div
		fiberTag = HostComponent;
	} else if (typeof type !== 'function' && __DEV__) {
		console.warn('createFiberFromElement 未定义的type类型', element);
	}
	const fiber = new FiberNode(fiberTag, props, key);
	fiber.type = type;
	return fiber;
}
