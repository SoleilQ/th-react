import { ReactElementType } from 'shared/ReactTypes';
import { FiberNode } from './fiber';
import { UpdateQueue, processUpdateQueue } from './updateQueue';
import {
	Fragment,
	FunctionComponent,
	HostComponent,
	HostRoot,
	HostText
} from './workTags';
import { mountChildFibers, reconcileChildFibers } from './childFibers';
import { renderWithHooks } from './fiberHooks';
import { Lane } from './fiberLanes';

// 递归中的递阶段

// <A><B/></A>
// 当进入A的beginWork时，通过对比B的current fiberNode 和 B reactElement
// 生成B对应的workInProgress fiberNode

// 构造离屏DOM树，只需要执行一次Placement

/**
 * 1.根据当前fiberNode创建子fiberNode
 * 2.在update时标记placement（新增、移动）ChildDeletion(删除)
 * @param workInPorgress
 * @returns
 */
export const beginWork = (workInPorgress: FiberNode, renderLane: Lane) => {
	// 比较, 返回子fiberNode
	switch (workInPorgress.tag) {
		// 1.计算状态的最新值
		// 2.创造子fiberNode
		case HostRoot:
			return updateHostRoot(workInPorgress, renderLane);
		// 1.创造子fiberNode
		case HostComponent:
			return updateHostComponent(workInPorgress);
		case HostText:
			// 没有子节点
			return null;
		case FunctionComponent:
			return updateFunctionComponent(workInPorgress, renderLane);
		case Fragment:
			return updateFragment(workInPorgress);
		default:
			if (__DEV__) {
				console.warn('beginWork未实现的类型', workInPorgress);
			}
			break;
	}
	return null;
};

function updateFunctionComponent(workInProgress: FiberNode, renderLane: Lane) {
	// 调用Component函数 得到children
	const nextChildren = renderWithHooks(workInProgress, renderLane);
	reconcileChildren(workInProgress, nextChildren);
	return workInProgress.child;
}

function updateFragment(workInProgress: FiberNode) {
	const nextChildren = workInProgress.pendingProps;
	reconcileChildren(workInProgress, nextChildren);
	return workInProgress.child;
}

function updateHostRoot(workInProgress: FiberNode, renderLane: Lane) {
	// 对于 HostRoot
	// 1. 计算状态最新值
	// 2. 创建子 fiberNode

	// 首屏渲染时不存在
	const baseState = workInProgress.memoizedState;
	const updateQueue = workInProgress.updateQueue as UpdateQueue<Element>;
	// 获取之前的更新队列
	const pending = updateQueue.shared.pending;
	updateQueue.shared.pending = null;
	const { memoizedState } = processUpdateQueue(baseState, pending, renderLane); // 最新状态
	workInProgress.memoizedState = memoizedState; // 其实就是传入的element <App />

	const nextChildren = workInProgress.memoizedState; // ReactElement对象
	reconcileChildren(workInProgress, nextChildren);
	return workInProgress.child;
}

function updateHostComponent(workInProgress: FiberNode) {
	// 对于HostComponent，只有创建子fiberNode
	// <div>{children}</div> -> div.props.children
	const nextProps = workInProgress.pendingProps;
	const nextChildren = nextProps.children;
	reconcileChildren(workInProgress, nextChildren);
	return workInProgress.child;
}

/**
 * 对比子节点的current fiberNode和子节点的reactElement 生成对应的子节点的fiberNode
 * @param workInProgress
 * @param children
 */
function reconcileChildren(
	workInProgress: FiberNode,
	children?: ReactElementType
) {
	const current = workInProgress.alternate;
	if (current !== null) {
		// update hostRootFiber Placement
		workInProgress.child = reconcileChildFibers(
			workInProgress,
			current.child,
			children
		);
	} else {
		//mount
		workInProgress.child = mountChildFibers(workInProgress, null, children);
	}
}
