import { ReactElementType } from 'shared/ReactTypes';
import { FiberNode } from './fiber';
import { UpdateQueue, processUpdateQueue } from './updateQueue';
import { HostComponent, HostRoot, HostText } from './workTags';
import { mountChildFibers, reconcileChildFibers } from './childFibers';

// 递归中的递阶段

/**
 * 1.根据当前fiberNode创建子fiberNode
 * 2.在update时标记placement（新增、移动）ChildDeletion(删除)
 * @param workInPorgress
 * @returns
 */
export const beginWork = (workInPorgress: FiberNode) => {
	// 比较, 返回子fiberNode
	switch (workInPorgress.tag) {
		// 1.计算状态的最新值
		// 2.创造子fiberNode
		case HostRoot:
			return updateHostRoot(workInPorgress);
		// 1.创造子fiberNode
		case HostComponent:
			return updateHostComponent(workInPorgress);
		case HostText:
			return null;
		default:
			if (__DEV__) {
				console.warn('beginWork未实现的类型');
			}
			break;
	}
	return null;
};

function updateHostRoot(workInProgress: FiberNode) {
	const baseState = workInProgress.memoizedState;
	const updateQueue = workInProgress.updateQueue as UpdateQueue<Element>;
	// 获取之前的更新队列
	const pending = updateQueue.shared.pending;
	updateQueue.shared.pending = null;
	const { memoizedState } = processUpdateQueue(baseState, pending); // 最新状态
	workInProgress.memoizedState = memoizedState; // 其实就是传入的element <App />

	const nextChildren = workInProgress.memoizedState; // ReactElement对象
	reconcileChildren(workInProgress, nextChildren);
	return workInProgress.child;
}

function updateHostComponent(workInProgress: FiberNode) {
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
		// update
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
