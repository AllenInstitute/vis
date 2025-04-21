import React from 'react';
import { Link } from 'react-router';

export function Home() {
    return (
        <>
            EXAMPLES
            <br />
            <ul>
                <li>
                    <Link to="dzi">Deep Zoom Image</Link>
                    <br />
                </li>
                <li>
                    <Link to="omezarr">OMEZARR</Link>
                    <br />
                </li>
                <li>
                    {/* NOT A REACT ROUTER LINK until we migrate it to a React component */}
                    <a href="/vis/layers">Layers</a>
                    <br />
                </li>
            </ul>
        </>
    );
}
