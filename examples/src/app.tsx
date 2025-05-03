import { BrowserRouter, Route, Routes } from 'react-router';
import { DziDemo } from './dzi/dzi-demo';
import { Home } from './home';
import { OmezarrDemo } from './omezarr/omezarr-demo';
import { Layout } from './layout';

export function App() {
    return (
        <BrowserRouter basename="/vis">
            <Routes>
                <Route path="/" element={<Layout />}>
                    <Route index element={<Home />} />
                    <Route path="dzi" element={<DziDemo />} />
                    <Route path="omezarr" element={<OmezarrDemo />} />
                    {/* LAYERS intentionally missing, needs to be migrated to a React component */}
                </Route>
            </Routes>
        </BrowserRouter>
    );
}
