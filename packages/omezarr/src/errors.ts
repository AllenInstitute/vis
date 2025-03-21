export class VisZarrError extends Error {
    constructor(message: string) {
        super(message);
    }
}

export class VisZarrDataError extends VisZarrError {
    constructor(message: string) {
        super(message);
    }
}


export class VisZarrIndexError extends VisZarrError {
    constructor(message: string) {
        super(message);
    }
}
