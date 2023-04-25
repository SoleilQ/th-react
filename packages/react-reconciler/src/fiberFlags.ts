export type Flags = number;

export const NoFlags = 0b0000001; // 没有副作用
export const Placement = 0b000010; // 插入
export const Update = 0b000100; // 更新
export const Deletetion = 0b0001000; // 删除

export const MutationMask = Placement | Update | Deletetion;
