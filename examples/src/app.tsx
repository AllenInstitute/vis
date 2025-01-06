import React from 'react';
import { BrowserRouter, Route, Routes } from 'react-router';
import { Home } from './home';
import { TwoClientsPOC } from './dzi/double';
import { OmezarrDemo } from './omezarr/app';

export function App() {
    console.log('app');
    return (
        <BrowserRouter>
            <Routes>
                <Route
                    index
                    element={<Home />}
                />
                <Route
                    path="/dzi"
                    element={<TwoClientsPOC />}
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
