import { createRoot } from "react-dom/client";
import { AppUi } from "./app";


const uiroot = createRoot(document.getElementById('main')!);
const eachFrame = () => {
    uiroot.render(AppUi({}))
    window.requestAnimationFrame(eachFrame);
}
function demoTime() {
    window.requestAnimationFrame(eachFrame)
}
demoTime();