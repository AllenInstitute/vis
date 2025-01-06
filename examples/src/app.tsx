import React from 'react';
import { BrowserRouter, Route, Routes } from 'react-router';
import { Home } from './home';
import { OmezarrDemo } from './omezarr/omezarr';
import { DziViewerPair } from './dzi/double';

export function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route
                    index
                    element={<Home />}
                />
                <Route
                    path="/dzi"
                    element={<DziViewerPair />}
                />
                <Route
                    path="/omezarr"
                    element={<OmezarrDemo />}
                />
                <Route path="/layers" />
            </Routes>
        </BrowserRouter>
    );
}
