import { scheduleMicroTask } from 'hostConfig';
import { beginWork } from './beginWork';
import {
	commitHookEffectListCreate,
	commitHookEffectListDesotry,
	commitHookEffectListUnMount,
	commitMutationEffects
} from './commitWork';
import { completeWork } from './completeWork';
import {
	FiberNode,
	FiberRootNode,
	PendingPassiveEffects,
	createWorkInProgress
} from './fiber';
import { MutationMask, NoFlags, PassiveMask } from './fiberFlags';
import {
	Lane,
	NoLane,
	SyncLane,
	getHighestPriorityLane,
	markRootFinished,
	mergeLane
} from './fiberLanes';
import { HostRoot } from './workTags';
import { flushSyncCallbacks, scheduleSyncCallback } from './syncTaskQueue';
import {
	unstable_scheduleCallback as scheduleCallback,
	unstable_NormalPriority as NormalPriority
} from 'scheduler';
import { HookHasEffect, Passive } from './hookEffectTags';

// 当前正在调和的子节点
let workInProgress: FiberNode | null = null;
let workInProgressRenderLane: Lane = NoLane;
let rootDoesHasPassiveEffects = false;

/**
 * 初始化 让workInProgress指向第一个fiberNode
 * @param fiber
 */
function prepareFreshStack(root: FiberRootNode, lane: Lane) {
	workInProgress = createWorkInProgress(root.current, {});
	workInProgressRenderLane = lane;
}

/**
 * 找到hostFiberNode, 然后开始reconciler过程
 * @param fiber
 */
export function scheduleUpdateOnFiber(fiber: FiberNode, lane: Lane) {
	// 调度功能
	// 触发更新未必从根节点，所以向上一直找到 fiberRootNode
	const root = markUpdateFromFiberToRoot(fiber);
	markRootUpdated(root, lane);
	ensureRootIsScheduled(root);
}

/**
 * schedule调度阶段入口
 * @param root
 * @returns
 */
function ensureRootIsScheduled(root: FiberRootNode) {
	const updateLane = getHighestPriorityLane(root.pendingLanes);
	// 没有更新
	if (updateLane === NoLane) {
		return;
	}
	if (updateLane === SyncLane) {
		// 同步优先级 用微任务调度
		if (__DEV__) {
			console.log('在微任务中调度, 优先级:', updateLane);
		}
		// [preformSyncWorkOnRoot]
		scheduleSyncCallback(performSyncWorkOnRoot.bind(null, root, updateLane));
		scheduleMicroTask(flushSyncCallbacks);
	} else {
		// 其他优先级 用宏任务调度
	}
}

function markRootUpdated(root: FiberRootNode, lane: Lane) {
	root.pendingLanes = mergeLane(root.pendingLanes, lane);
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

/**
 * 同步更新入口
 * @param root
 */
function performSyncWorkOnRoot(root: FiberRootNode, lane: Lane) {
	const nextLane = getHighestPriorityLane(root.pendingLanes);

	if (nextLane !== SyncLane) {
		// 其他比SyncLane低的优先级
		// NoLane
		ensureRootIsScheduled(root);
		return;
	}

	if (__DEV__) {
		console.warn('render阶段开始');
	}
	// 初始化 将workInProgress 指向第一个fiberNode
	prepareFreshStack(root, lane);

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

	// 结束
	const finishedWork = root.current.alternate;
	root.finishedWork = finishedWork;
	root.finishedLane = lane;
	workInProgressRenderLane = NoLane;

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
	const lane = root.finishedLane;

	if (lane === NoLane && __DEV__) {
		console.error('commit阶段finishedLane不应该是NoLane');
	}

	// 重置
	root.finishedWork = null;
	root.finishedLane = NoLane;

	// 移除本次更新消费的lane
	markRootFinished(root, lane);

	/*
		useEffect的执行包括2种情况：
			1. deps变化导致的
			2. 组件卸载，触发destory
			首先在这里调度回调
	*/
	if (
		(finishedWork.flags & PassiveMask) !== NoFlags ||
		(finishedWork.subtreeFlags & PassiveMask) !== NoFlags
	) {
		if (!rootDoesHasPassiveEffects) {
			rootDoesHasPassiveEffects = true;
			// 调度副作用
			scheduleCallback(NormalPriority, () => {
				// 执行副作用
				flushPassiveEffects(root.pendingPassiveEffects);
				return;
			});
		}
	}

	// 判断是否存在3个子阶段需要执行的操作
	// root flags root subtreeFlags
	const subtreeHasEffect =
		(finishedWork.subtreeFlags & (MutationMask | PassiveMask)) !== NoFlags;
	const rootHasEffect =
		(finishedWork.flags & (MutationMask | PassiveMask)) !== NoFlags;

	if (subtreeHasEffect || rootHasEffect) {
		// beforeMutation
		// mutation
		commitMutationEffects(finishedWork, root);
		// finishedWork是本次更新的workInProgress
		root.current = finishedWork;

		// layout
	} else {
		root.current = finishedWork;
	}

	rootDoesHasPassiveEffects = false;
	ensureRootIsScheduled(root);
}

function flushPassiveEffects(pendingPassiveEffects: PendingPassiveEffects) {
	// 首先触发所有 unmount effect
	// 且对于某一个 fiber，如果触发了 unmount destroy，本次更新不会再触发 update create
	pendingPassiveEffects.unmount.forEach((effect) => {
		commitHookEffectListUnMount(Passive, effect);
	});
	pendingPassiveEffects.unmount = [];
	// 触发所有上次更新的 destroy
	pendingPassiveEffects.update.forEach((effect) => {
		commitHookEffectListDesotry(Passive | HookHasEffect, effect);
	});
	// 上一次更新的desotry执行完毕后，执行本次更新的create
	pendingPassiveEffects.update.forEach((effect) => {
		commitHookEffectListCreate(Passive | HookHasEffect, effect);
	});
	pendingPassiveEffects.update = [];
	// 在回调过程中（useEffect执行过程中）也有新的更新
	flushSyncCallbacks();
}

function workLoop() {
	while (workInProgress !== null) {
		performUnitOfWork(workInProgress);
	}
}

function performUnitOfWork(fiber: FiberNode) {
	const next = beginWork(fiber, workInProgressRenderLane); // next是fiber的子fiber 或者是 null
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
