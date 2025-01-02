import React from 'react';

export function Home() {
    return (
        <>
            EXAMPLES
            <br />
            <ul>
                <li>
                    <a href="/dzi">Deep Zoom Image</a>
                    <br />
                </li>
                <li>
                    <a href="/omezarr">OMEZARR</a>
                    <br />
                </li>
                {/* layers is not in the AC to be converted to a react component
                    maybe we'll convert it at some point though so I'll leave this here
                 <li>
                    <a href="/layers">Layers</a>
                    <br />
                </li> */}
            </ul>
        </>
    );
}
