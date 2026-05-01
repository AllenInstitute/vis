const VALIDATE = true; // todo turn me off for prod...
export function beginValidate(device: GPUDevice) {
    if (VALIDATE) {
        device.pushErrorScope('validation');
    }
}
export function endValidate(device: GPUDevice) {
    if (VALIDATE) {
        device.popErrorScope().then((errs) => {
            if (errs) {
                console.error(errs);
            }
        });
    }
}
