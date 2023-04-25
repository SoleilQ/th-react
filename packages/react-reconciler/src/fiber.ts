import { Key, Props, ReactElementType, Ref } from 'shared/ReactTypes';
import { FunctionComponent, HostComponent, WorkTag } from './workTags';
import { Flags, NoFlags } from './fiberFlags';
import { Container } from 'hostConfig';

export class FiberNode {
	type: any; // 类型
	tag: WorkTag;
	key: Key;
	stateNode: any; // dom引用
	ref: Ref;

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

export const createWorkInProgress = (
	current: FiberNode,
	pendingProps: Props
): FiberNode => {
	let workInProgress = current.alternate;

	if (workInProgress === null) {
		// mount
		workInProgress = new FiberNode(current.tag, pendingProps, current.key);
		workInProgress.type = current.type;
		workInProgress.stateNode = current.stateNode;

		workInProgress.alternate = current;
		current.alternate = workInProgress;
	} else {
		// update
		workInProgress.pendingProps = pendingProps;
		// 清除副作用 （上一次更新遗留下来的）
		workInProgress.flags = NoFlags;
		workInProgress.subtreeFlags = NoFlags;
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
		console.warn('未定义的type类型', element);
	}
	const fiber = new FiberNode(type, props, key);
	fiber.type = fiberTag;
	return fiber;
}
