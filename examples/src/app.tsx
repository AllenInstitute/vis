import React from 'react';
import { BrowserRouter, Route, Routes } from 'react-router';
import { DziDemo } from './dzi/dzi-demo';
import { Home } from './home';
import { OmezarrDemo } from './omezarr/omezarr-demo';
import { RedirectToLayersHTML } from './layers/tempLayers';

export function App() {
    return (
        <BrowserRouter basename="/vis">
            <Routes>
                <Route index element={<Home />} />
                <Route path="dzi" element={<DziDemo />} />
                <Route path="omezarr" element={<OmezarrDemo />} />
                <Route path="layers" />
            </Routes>
        </BrowserRouter>
    );
}
