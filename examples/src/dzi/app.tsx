import { useContext } from 'react';
import { ReglProvider } from './offscreen-renderer';
import React from 'react';
import { DziView } from './dziView';

export function AppUi(props: {}) {
    return (
        <ReglProvider>
            <DziView />
        </ReglProvider>
    );
}
