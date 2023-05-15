import { FiberRootNode } from './fiber';

export type Lane = number;
export type Lanes = number;

export const NoLane = 0b0000;
export const NoLanes = 0b0000;
export const SyncLane = 0b0001;

export function mergeLane(laneA: Lane, laneB: Lane): Lanes {
	return laneA | laneB;
}

export function requestUpdateLane() {
	return SyncLane;
}

/**
 * 获取最高优先级的lane
 * @param lanes
 * @returns
 */
export function getHighestPriorityLane(lanes: Lanes): Lane {
	return lanes & -lanes;
}

export function markRootFinished(root: FiberRootNode, lane: Lane) {
	root.pendingLanes &= ~lane;
}
