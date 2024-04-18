export function whenDefined<T>(result: T | undefined, action: (result: T) => void): T | undefined {
    if (result !== undefined) {
        Promise.resolve().then(() => action(result))
    }
    return result;
}