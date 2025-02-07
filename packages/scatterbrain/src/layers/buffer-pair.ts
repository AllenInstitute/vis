export type BufferPair<T> = {
	writeTo: T;
	readFrom: T;
};
export function swapBuffers<T>(doubleBuffer: BufferPair<T>) {
	const { readFrom, writeTo } = doubleBuffer;
	return { readFrom: writeTo, writeTo: readFrom };
}
