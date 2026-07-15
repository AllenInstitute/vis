import { useEffect } from 'react';

// Little React helper to load the layers script client-side
export function ClientLayersScript() {
    useEffect(() => {
        // Dynamic import ensures the script only runs in the browser
        import('../layers.ts').catch((err) => console.error('Error loading layers script:', err));
    }, []);

    return null; // This component doesn't render anything
}
