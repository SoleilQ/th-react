import { Container, appendChildToContainer } from 'hostConfig';
import { FiberNode, FiberRootNode } from './fiber';
import { MutationMask, NoFlags, Placement } from './fiberFlags';
import { HostComponent, HostRoot, HostText } from './workTags';

let nextEffect: FiberNode | null = null;

export const commitMutationEffects = (finishedWork: FiberNode) => {
	nextEffect = finishedWork;

	while (nextEffect !== null) {
		// 向下遍历
		const child: FiberNode | null = nextEffect.child;

		// 找到最底部的subtreeFlags不为0的fiberNode的子fiberNode节点
		if (
			(nextEffect.subtreeFlags & MutationMask) !== NoFlags &&
			child !== null
		) {
			nextEffect = child;
		} else {
			// 向上遍历 DFS
			while (nextEffect !== null) {
				commitMutationEffectsOnFiber(nextEffect);
				// 要么没有子节点，要么子节点没有 flags
				// 向上遍历 查找对应的sibling节点。
				const sibling: FiberNode | null = nextEffect.sibling;
				if (sibling !== null) {
					nextEffect = sibling;
					break;
				}
			}
		}
	}
};

const commitMutationEffectsOnFiber = (finishedWork: FiberNode) => {
	const flags = finishedWork.flags;
	if ((flags & Placement) !== flags) {
		commitPlacement(finishedWork);
		finishedWork.flags &= ~Placement; // 移除Placement
	}
	// flags Update

	// flags ChildDeletion
};

const commitPlacement = (finishedWork: FiberNode) => {
	if (__DEV__) {
		console.warn('执行Placement操作', finishedWork);
	}

	// parentDom 插入 finishWork对应的dom
	const hostParent = getHostParent(finishedWork);
	// finsihedWork.stateNode 对应的dom节点 appendChild parent Dom
	appendPlacementNodeIntoContainer(finishedWork, hostParent);
};

const getHostParent = (fiber: FiberNode) => {
	let parent = fiber.return;
	if (parent !== null) {
		const parentTag = parent.tag;
		// hostComponent
		if (parentTag === HostComponent) {
			return parent.stateNode;
		}
		// hostRoot
		if (parentTag === HostRoot) {
			return (parent.stateNode as FiberRootNode).container;
		}
		parent = parent.return;
	}
	if (__DEV__) {
		console.warn('未找到host parent');
	}
	return null;
};

const appendPlacementNodeIntoContainer = (
	finishedWork: FiberNode,
	hostParent: Container
) => {
	// fiber host
	if (finishedWork.tag === HostComponent || finishedWork.tag === HostText) {
		appendChildToContainer(finishedWork.stateNode, hostParent);
		return;
	}
	const child = finishedWork.child;
	if (child !== null) {
		appendPlacementNodeIntoContainer(child, hostParent);
		let sibling = child.sibling;
		while (sibling !== null) {
			appendPlacementNodeIntoContainer(sibling, hostParent);
			sibling = sibling.sibling;
		}
	}
};
