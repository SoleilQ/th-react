// ReactElement

import { REACT_ELEMENT_TYPE } from 'shared/ReactSymbols';
import {
	ElementType,
	Key,
	Props,
	ReactElementType,
	Ref,
	Type
} from 'shared/ReactTypes';

const ReactElement = function (
	type: Type,
	key: Key,
	ref: Ref,
	props: Props
): ReactElementType {
	const element = {
		$$typeof: REACT_ELEMENT_TYPE,
		type,
		key,
		ref,
		props,
		__mark: 'th'
	};

	return element;
};

export const jsx = (
	type: ElementType,
	config: any,
	...maybeChildren: any[]
) => {
	let key: Key = null;
	const props: Props = {};
	let ref: Ref = null;
	// 筛选出 key 和 ref，其他的都作为 props
	for (const prop in config) {
		const val = config[prop];
		if (prop === 'key') {
			if (val !== undefined) {
				key = '' + val;
			}
			continue;
		}
		if (prop === 'ref') {
			if (val !== undefined) {
				ref = val;
			}
			continue;
		}

		// 排除原型链上的属性
		if ({}.hasOwnProperty.call(config, prop)) {
			props[prop] = val;
		}
	}

	const mybeChildrenLength = maybeChildren.length;
	if (mybeChildrenLength) {
		// [child]
		if (mybeChildrenLength === 1) {
			props.children = maybeChildren[0];
		} else {
			// [child, child, child]
			props.children = maybeChildren;
		}
	}

	return ReactElement(type, key, ref, props);
};

export const jsxDev = (type: ElementType, config: any) => {
	let key: Key = null;
	const props: Props = {};
	let ref: Ref = null;
	// 筛选出 key 和 ref，其他的都作为 props
	for (const prop in config) {
		const val = config[prop];
		if (prop === 'key') {
			if (val !== undefined) {
				key = '' + val;
			}
			continue;
		}
		if (prop === 'ref') {
			if (val !== undefined) {
				ref = val;
			}
			continue;
		}

		// 排除原型链上的属性
		if ({}.hasOwnProperty.call(config, prop)) {
			props[prop] = val;
		}
	}

	return ReactElement(type, key, ref, props);
};
