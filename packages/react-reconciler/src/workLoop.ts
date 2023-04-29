import { beginWork } from './beginWork';
import { commitMutationEffects } from './commitWork';
import { completeWork } from './completeWork';
import { FiberNode, FiberRootNode, createWorkInProgress } from './fiber';
import { MutationMask, NoFlags } from './fiberFlags';
import { HostRoot } from './workTags';

// 当前正在调和的子节点
let workInProgress: FiberNode | null = null;

/**
 * 初始化 让workInProgress指向第一个fiberNode
 * @param fiber
 */
function prepareFreshStack(root: FiberRootNode) {
	workInProgress = createWorkInProgress(root.current, {});
}

/**
 * 找到hostFiberNode, 然后开始reconciler过程
 * @param fiber
 */
export function scheduleUpdateOnFiber(fiber: FiberNode) {
	// 调度功能
	// 触发更新未必从根节点，所以向上一直找到 fiberRootNode
	const root = markUpdateFromFiberToRoot(fiber);
	renderRoot(root);
}

/**
 * 从当前触发更新的fiber向上遍历到根节点fiber
 * @param fiber
 * @returns
 */
function markUpdateFromFiberToRoot(fiber: FiberNode) {
	let node = fiber;
	let parent = node.return;
	// 正常的 fiberNode 都有 return 但是 hostRootFiber 没有 return
	while (parent !== null) {
		node = parent;
		parent = node.return;
	}
	if (node.tag === HostRoot) {
		return node.stateNode;
	}
	return null;
}

function renderRoot(root: FiberRootNode) {
	// 初始化 将workInProgress 指向第一个fiberNode
	prepareFreshStack(root);

	do {
		try {
			workLoop();
			break;
		} catch (e) {
			if (__DEV__) {
				console.warn('workLoop发生错误', e);
			}
			workInProgress = null;
		}
	} while (true);

	const finishedWork = root.current.alternate;
	root.finishedWork = finishedWork;

	// workInProgress树，树中的flags
	commitRoot(root);
}

function commitRoot(root: FiberRootNode) {
	const finishedWork = root.finishedWork;

	if (finishedWork === null) {
		return;
	}

	if (__DEV__) {
		console.warn('commit阶段开始', finishedWork);
	}

	// 重置
	root.finishedWork = null;

	// 判断是否存在3个子阶段需要执行的操作
	// root flags root subtreeFlags
	const subtreeHasEffect =
		(finishedWork.subtreeFlags & MutationMask) !== NoFlags;
	const rootHasEffect = (finishedWork.flags & MutationMask) !== NoFlags;

	if (subtreeHasEffect || rootHasEffect) {
		// beforeMutation
		// mutation
		commitMutationEffects(finishedWork);
		// finishedWork是本次更新的workInProgress
		root.current = finishedWork;

		// layout
	} else {
		root.current = finishedWork;
	}
}

function workLoop() {
	while (workInProgress !== null) {
		performUnitOfWork(workInProgress);
	}
}

function performUnitOfWork(fiber: FiberNode) {
	const next = beginWork(fiber); // next是fiber的子fiber 或者是 null
	// 工作完成，需要将pendingProps 复制给 已经渲染的props
	fiber.memoizedProps = fiber.pendingProps;

	// 没有子节点 遍历兄弟节点
	if (next === null) {
		completeUnitOfWork(fiber);
	} else {
		// 有子节点 遍历子节点  继续执行 workLoop()
		workInProgress = next;
	}
}

function completeUnitOfWork(fiber: FiberNode) {
	let node: FiberNode | null = fiber;

	do {
		completeWork(node);
		const sibling = node.sibling;
		if (sibling !== null) {
			workInProgress = sibling;
			return;
		} else {
			node = node.return;
			workInProgress = node; // 向上遍历到hostFiberNode 没有return 返回null 退出循环
		}
	} while (node !== null);
}
