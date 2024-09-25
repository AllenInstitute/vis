import { createRoot } from "react-dom/client";
import { AppUi } from "./app";


const uiroot = createRoot(document.getElementById('main')!);
uiroot.render(AppUi());