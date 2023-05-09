import {
	Container,
	appendInitialChild,
	createInstance,
	createTextInstance
} from 'hostConfig';
import { FiberNode } from './fiber';
import {
	FunctionComponent,
	HostComponent,
	HostRoot,
	HostText
} from './workTags';
import { NoFlags, Update } from './fiberFlags';

function markUpdate(fiber: FiberNode) {
	fiber.flags |= Update;
}

export const completeWork = (workInProgress: FiberNode) => {
	// 递归中的归

	const newProps = workInProgress.pendingProps;
	const current = workInProgress.alternate;

	switch (workInProgress.tag) {
		// 构建离屏DOM树
		case HostComponent:
			if (current !== null && workInProgress.stateNode) {
				// update
				// 属性变化
			} else {
				// mount
				// 1. 构建DOM
				const instance = createInstance(workInProgress.type, newProps);
				// 2. 将DOM插入到DOM树中
				appendAllChildren(instance, workInProgress);
				// 指向生成的Dom节点
				workInProgress.stateNode = instance;
			}
			bubbleProperties(workInProgress);
			return null;
		case HostText:
			if (current !== null && workInProgress.stateNode) {
				// update
				const oldText = current.memoizedProps.content;
				const newText = newProps.content;
				if (oldText !== newText) {
					markUpdate(workInProgress);
				}
			} else {
				// mount
				// 1. 构建DOM
				const instance = createTextInstance(newProps.content);
				workInProgress.stateNode = instance;
			}
			bubbleProperties(workInProgress);
			return null;
		case HostRoot:
			bubbleProperties(workInProgress);
			return null;
		case FunctionComponent:
			bubbleProperties(workInProgress);
			return null;
		default:
			if (__DEV__) {
				console.warn('未处理的completeWork情况', workInProgress);
			}
			break;
	}

	return null;
};

/**
 * 把产生的dom节点，插入到刚刚产生的父dom节点上，形成一个局部的小dom树
 * @param parent workInProgress的type生成的DOM节点
 * @param workInProgress
 * @returns
 */
function appendAllChildren(parent: Container, workInProgress: FiberNode) {
	let node = workInProgress.child;
	while (node !== null) {
		if (node.tag === HostComponent || node.tag === HostText) {
			appendInitialChild(parent, node.stateNode);
		} else if (node.child !== null) {
			node.child.return = node;
			// 向下遍历
			node = node.child;
			continue;
		}

		if (node === workInProgress) {
			return;
		}

		while (node.sibling === null) {
			if (node.return === null || node.return === workInProgress) {
				return;
			}
			// 向上查找
			node = node.return;
		}
		node.sibling.return = node.return;
		node = node.sibling;
	}
}

function bubbleProperties(workInProgress: FiberNode) {
	let subtreeFlags = NoFlags;
	let child = workInProgress.child;

	while (child !== null) {
		// 当前节点的副作用
		// 当前节点的子节点的副作用
		subtreeFlags |= child.subtreeFlags;
		subtreeFlags |= child.flags;

		child.return = workInProgress;
		child = child.sibling;
	}
	// 附加到当前fiberNode的标记中
	workInProgress.subtreeFlags = subtreeFlags;
}
