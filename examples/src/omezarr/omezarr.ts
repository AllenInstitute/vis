import { createRoot } from 'react-dom/client';
import { OmezarrDemo } from './app';

const uiroot = createRoot(document.getElementById('main')!);
uiroot.render(OmezarrDemo());
