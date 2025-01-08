import { useRef, useEffect } from 'react';

interface ChangesObj<P> {
    [key: string]: {
        from: P[keyof P];
        to: P[keyof P];
    };
}

/**
 * NOT TO BE USED IN PRODUCTION
 *
 * This is a useful debugging and performance hook
 * It will log what parts of props caused the functional component to update.
 *
 * See: https://usehooks.com/useWhyDidYouUpdate/
 *
 * @param {string} name - name will show up in console log
 * @param {Object} props - entire props object of the component being tested
 */
export function useWhyDidYouUpdate<P extends object>(name: string, props: P) {
    // Get a mutable ref object where we can store props ...
    // ... for comparison next time this hook runs.
    const previousProps = useRef<P>();

    useEffect(() => {
        if (previousProps.current) {
            // Get all keys from previous and current props
            const allKeys = Object.keys({ ...previousProps.current, ...props }) as Array<keyof P>;
            // Use this object to keep track of changed props
            const changesObj: ChangesObj<P> = {};
            // Iterate through keys
            allKeys.forEach((key) => {
                // If previous is different from current
                if (previousProps.current && key in previousProps.current && props && key in props) {
                    if (previousProps.current[key] !== props[key]) {
                        // Add to changesObj
                        const changeKey = key as string;
                        changesObj[changeKey] = {
                            from: previousProps.current[key],
                            to: props[key],
                        };
                    }
                }
            });

            // If changesObj not empty then output to console
            if (Object.keys(changesObj).length) {
                // eslint-disable-next-line no-console
                console.log('[why-did-you-update]', name, changesObj);
            }
        }

        // Finally update previousProps with current props for next hook call
        previousProps.current = props;
    });
}
