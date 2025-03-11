export type Interval = {
    min: number;
    max: number;
};

/**
 *
 * @param i the inteval to return the size of
 * @returns the size of the interval, aka the distance between its start and end. note this value may be negative
 */
export function size(i: Interval) {
    return i.max - i.min;
}
/**
 *
 * @param i a given VALID interval
 * @param x  a value
 * @returns true iff the x is within (double-inclusive) the interval i
 */
export function within(i: Interval, x: number): boolean {
    return i.min <= x && i.max >= x;
}
/**
 *
 * @param i a given interval
 * @returns true iff its min and max values are both finite, non-NaN values
 */
export function isFiniteInterval(i: Interval) {
    return Number.isFinite(i.min) && Number.isFinite(i.max);
}
/**
 *
 * @param i
 * @param minSize
 * @return true iff the given interval i is at least as big as minSize, and min <= max, and isFinite(i)
 */
export function isValid(i: Interval, minSize: number) {
    return size(i) >= Math.abs(minSize) && isFiniteInterval(i) && i.max >= i.min;
}
/**
 *
 * @param i an interval
 * @return a copy of i, with min&max swapped, if the given i had a negative size
 */
export function fixOrder(i: Interval) {
    return { min: Math.min(i.max, i.min), max: Math.max(i.min, i.max) };
}
/**
 *
 * @param a a valid interval
 * @param b a valid interval
 * @return the interval where a and b overlap, or undefined if there is no such interval
 */
export function intersection(a: Interval, b: Interval): Interval | undefined {
    const result = { min: Math.max(a.min, b.min), max: Math.min(a.max, b.max) };
    if (size(result) > 0) return result;

    return undefined;
}
/**
 *
 * @param interval a given VALID interval
 * @param x  a finite number
 * @returns x iff x is within interval (or if interval is invalid), interval.min if x<interval.min, interval.max else
 */
export function limit(interval: Interval, x: number) {
    return isValid(interval, 0) ? Math.min(Math.max(x, interval.min), interval.max) : x;
}
