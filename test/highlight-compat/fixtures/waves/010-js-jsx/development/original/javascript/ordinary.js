import { read as load } from "pkg";
export const state = { count: 2 };
const next = (value = 1) => state.count + value;
load(next());
const text = `count: ${next(2)}`;
