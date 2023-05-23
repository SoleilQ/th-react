import {
	Container,
	Instance,
	appendChildToContainer,
	commitUpdate,
	inserChildInToContainer,
	removeChild
} from 'hostConfig';
import { FiberNode, FiberRootNode, PendingPassiveEffects } from './fiber';
import {
	ChildDeletion,
	Flags,
	MutationMask,
	NoFlags,
	PassiveEffect,
	PassiveMask,
	Placement,
	Update
} from './fiberFlags';
import {
	FunctionComponent,
	HostComponent,
	HostRoot,
	HostText
} from './workTags';
import { HookHasEffect, Passive } from './hookEffectTags';
import { Effect, FCUpdateQueue } from './fiberHooks';

let nextEffect: FiberNode | null = null;

export const commitMutationEffects = (
	finishedWork: FiberNode,
	root: FiberRootNode
) => {
	nextEffect = finishedWork;

	while (nextEffect !== null) {
		// 向下遍历
		const child: FiberNode | null = nextEffect.child;

		// 找到最底部的subtreeFlags不为0的fiberNode的子fiberNode节点
		if (
			(nextEffect.subtreeFlags & (MutationMask | PassiveMask)) !== NoFlags &&
			child !== null
		) {
			nextEffect = child;
		} else {
			// 向上遍历 DFS
			while (nextEffect !== null) {
				commitMutationEffectsOnFiber(nextEffect, root);
				// 要么没有子节点，要么子节点没有 flags
				// 向上遍历 查找对应的sibling节点。
				const sibling: FiberNode | null = nextEffect.sibling;
				if (sibling !== null) {
					nextEffect = sibling;
					break;
				}
				nextEffect = nextEffect.return;
			}
		}
	}
};

const commitMutationEffectsOnFiber = (
	finishedWork: FiberNode,
	root: FiberRootNode
) => {
	const flags = finishedWork.flags;
	if ((flags & Placement) !== NoFlags) {
		commitPlacement(finishedWork);
		finishedWork.flags &= ~Placement; // 移除Placement
	}
	// flags Update
	if ((flags & Update) !== NoFlags) {
		commitUpdate(finishedWork);
		finishedWork.flags &= ~Update;
	}
	// flags ChildDeletion
	if ((flags & ChildDeletion) !== NoFlags) {
		const deletions = finishedWork.deletions;
		if (deletions !== null) {
			deletions.forEach((childToDelete) => {
				commitDeletion(childToDelete, root);
			});
		}
		finishedWork.flags &= ~ChildDeletion;
	}
	if ((flags & PassiveEffect) !== NoFlags) {
		// 收集因deps变化而需要执行的useEffect
		commitPassiveEffect(finishedWork, root, 'update');
		finishedWork.flags &= ~PassiveEffect;
	}
};

// 收集effect
function commitPassiveEffect(
	fiber: FiberNode,
	root: FiberRootNode,
	type: keyof PendingPassiveEffects
) {
	// update unmount
	if (
		fiber.tag !== FunctionComponent ||
		(type === 'update' && (fiber.flags & PassiveEffect) === NoFlags) // update 应该包含 PassiveEffect
	) {
		return;
	}

	const updateQueue = fiber.updateQueue as FCUpdateQueue<any>;
	if (updateQueue !== null) {
		if (updateQueue.lastEffect === null && __DEV__) {
			console.warn(
				'当FC存在Passive effect时，updateQueue.lastEffect不应该为null'
			);
		}
		root.pendingPassiveEffects[type].push(updateQueue.lastEffect as Effect);
	}
}

// 遍历effect链表
function commitHookEffectList(
	flags: Flags,
	lastEffect: Effect,
	callback: (effect: Effect) => void
) {
	let effect = lastEffect.next as Effect; // 第一个effect

	do {
		// TODO: 为什么要判断flags
		if ((effect.tag & flags) === flags) {
			callback(effect);
		}
		effect = effect.next as Effect;
	} while (effect !== lastEffect.next);
}

// 用于effect create执行前触发上一次的destroy effect 组件卸载
export function commitHookEffectListUnMount(flags: Flags, lastEffect: Effect) {
	commitHookEffectList(flags, lastEffect, (effect) => {
		const desotry = effect.destory;
		if (typeof desotry === 'function') {
			desotry(); // 函数组件已经卸载 create不会被触发
		}
		effect.tag &= ~HookHasEffect; // 防止后续继续触发
	});
}

// 用于组件解绑前触发destroy effect  也就是 return () => {}
export function commitHookEffectListDesotry(flags: Flags, lastEffect: Effect) {
	commitHookEffectList(flags, lastEffect, (effect) => {
		const desotry = effect.destory;
		if (typeof desotry === 'function') {
			desotry();
		}
	});
}

export function commitHookEffectListCreate(flags: Flags, lastEffect: Effect) {
	commitHookEffectList(flags, lastEffect, (effect) => {
		const create = effect.create;
		if (typeof create === 'function') {
			// useEffect(() => {
			// 	console.log('create');
			// 	return () => {
			// 		console.log('destory');
			// 	};
			// }, []);
			// 最外层函数是create
			// return () => {} 对应destory
			effect.destory = create();
		}
	});
}

function recordHostChildrenToDelete(
	childrenToDelete: FiberNode[],
	unmountFiber: FiberNode
) {
	// 1. 找到第一个host节点
	const lastOne = childrenToDelete[childrenToDelete.length - 1];

	if (!lastOne) {
		childrenToDelete.push(unmountFiber);
	} else {
		let node = lastOne.sibling;
		while (node !== null) {
			if (unmountFiber === node) {
				childrenToDelete.push(unmountFiber);
				node = node.sibling;
			}
		}
	}
}

function commitDeletion(childToDelete: FiberNode, root: FiberRootNode) {
	const rootChildrenToDelete: FiberNode[] = [];
	// 递归子树
	commitNestedComponent(childToDelete, (unmountFiber) => {
		switch (unmountFiber.tag) {
			case HostComponent:
				recordHostChildrenToDelete(rootChildrenToDelete, unmountFiber);
				// TODO: 解绑ref
				return;
			case HostText:
				recordHostChildrenToDelete(rootChildrenToDelete, unmountFiber);
				return;
			case FunctionComponent:
				// TODO:解绑ref
				commitPassiveEffect(unmountFiber, root, 'unmount');
				return;
			default:
				if (__DEV__) {
					console.warn('未处理的unmount类型', unmountFiber);
				}
				break;
		}
	});
	// 移除rootHostComponent的DOM
	if (recordHostChildrenToDelete.length) {
		const hostParent = getHostParent(childToDelete);
		if (hostParent !== null) {
			rootChildrenToDelete.forEach((node) => {
				removeChild(node.stateNode, hostParent);
			});
		}
	}
	childToDelete.return = null;
	childToDelete.child = null;
}

function commitNestedComponent(
	root: FiberNode,
	onCommitUnmount: (fiber: FiberNode) => void
) {
	let node = root;
	while (true) {
		onCommitUnmount(node);

		if (node.child !== null) {
			// 向下遍历
			node.child.return = node;
			node = node.child;
			continue;
		}

		if (node === root) {
			// 终止条件
			return;
		}

		while (node.sibling === null) {
			if (node.return === null || node.return === root) {
				return;
			}
			// 向上归
			node = node.return;
		}
		node.sibling.return = node.return;
		node = node.sibling;
	}
}

const commitPlacement = (finishedWork: FiberNode) => {
	if (__DEV__) {
		console.warn('执行Placement操作', finishedWork);
	}

	// parentDom 插入 finishWork对应的dom
	const hostParent = getHostParent(finishedWork);

	// host sibling 目标兄弟Host节点
	const sibling = getHostSibling(finishedWork);

	// finsihedWork.stateNode 对应的dom节点 appendChild parent Dom
	if (hostParent !== null) {
		insertOrAppendPlacementNodeIntoContainer(finishedWork, hostParent, sibling);
	}
};

function getHostSibling(fiber: FiberNode) {
	let node: FiberNode = fiber;

	findSibling: while (true) {
		// 向上遍历 父节点的兄弟节点
		while (node.sibling === null) {
			const parent = node.return;

			if (
				parent === null ||
				parent.tag === HostComponent ||
				parent.tag === HostRoot
			) {
				return null;
			}
			node = parent;
		}

		// 遍历同级的兄弟节点
		node.sibling.return = node.return;
		node = node.sibling;

		while (node.tag !== HostText && node.tag !== HostComponent) {
			// 向下遍历找子孙节点的Host类型
			if ((node.flags & Placement) !== NoFlags) {
				// 不稳定的节点  有可能node已经移动了
				continue findSibling;
			}
			if (node.child === null) {
				continue findSibling;
			} else {
				node.child.return = node;
				node = node.child;
			}
		}

		if ((node.flags & Placement) === NoFlags) {
			return node.stateNode;
		}
	}
}

function getHostParent(fiber: FiberNode): Container | null {
	let parent = fiber.return;
	while (parent !== null) {
		const parentTag = parent.tag;
		// hostRoot
		if (parentTag === HostRoot) {
			return (parent.stateNode as FiberRootNode).container;
		}
		// hostComponent
		if (parentTag === HostComponent) {
			return parent.stateNode as Container;
		}
		parent = parent.return;
	}
	if (__DEV__) {
		console.warn('未找到host parent', fiber);
	}
	return null;
}

/**
 * 将标记Placement的fiber节点对应的宿主环境节点插入到父宿主节点中
 * 传入的 fiber 不一定有对应宿主环境节点，需要向下递归找到实际的 host node。
 * @param finishedWork
 * @param hostParent
 * @returns
 */
const insertOrAppendPlacementNodeIntoContainer = (
	finishedWork: FiberNode,
	hostParent: Container,
	before?: Instance
) => {
	// fiber host
	if (finishedWork.tag === HostComponent || finishedWork.tag === HostText) {
		if (before) {
			inserChildInToContainer(finishedWork.stateNode, hostParent, before);
		} else {
			appendChildToContainer(hostParent, finishedWork.stateNode);
		}
		return;
	}
	const child = finishedWork.child;
	if (child !== null) {
		insertOrAppendPlacementNodeIntoContainer(child, hostParent);
		let sibling = child.sibling;
		while (sibling !== null) {
			insertOrAppendPlacementNodeIntoContainer(sibling, hostParent);
			sibling = sibling.sibling;
		}
	}
};
