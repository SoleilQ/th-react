import { Container } from 'hostConfig';
import { FiberNode, FiberRootNode } from './fiber';
import { HostRoot } from './workTags';
import {
	UpdateQueue,
	createUpdate,
	createUpdateQueue,
	enqueueUpdate
} from './updateQueue';
import { ReactElementType } from 'shared/ReactTypes';
import { scheduleUpdateOnFiber } from './workLoop';

/**
 * ReactDOM.createRoot()中调用
 * @param container
 * @returns
 */
export function createContainer(container: Container) {
	// 创建fiberRootNode 和 hostRootFiber 并建立联系
	const hostRootFiber = new FiberNode(HostRoot, {}, null); // rootElement对应的fiber
	const fiberRootNode = new FiberRootNode(container, hostRootFiber); //
	hostRootFiber.updateQueue = createUpdateQueue();
	return fiberRootNode;
}

/**
 * ReactDOM.createRoot().render 中调用更新
 * @param element
 * @param root
 * @returns
 */
export function updateContainer(
	element: ReactElementType | null,
	root: FiberRootNode
) {
	const hostRootFiber = root.current;
	// 首屏渲染，触发更新，在 beginWork 和 completeWork 中处理更新
	const update = createUpdate<ReactElementType | null>(element);
	enqueueUpdate(
		hostRootFiber.updateQueue as UpdateQueue<ReactElementType | null>,
		update
	);
	// 插入更新后，进入调度
	scheduleUpdateOnFiber(hostRootFiber);
	return element;
}
