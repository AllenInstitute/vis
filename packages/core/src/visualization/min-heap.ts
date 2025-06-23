// TS note: T extends {} is saying "T may not be null"
export class MinHeap<T extends {}> {
    private entries: T[];
    private score: (t: T) => number;
    private curSize: number
    constructor(size: number, scoreSystem: (t: T) => number) {
        this.score = scoreSystem
        this.entries = new Array<T>(size);
        this.curSize = 0;
    }
    private parent(i: number) {
        return Math.floor((i - 1) / 2);
    }
    private left(i: number) {
        return Math.floor(2 * i + 1);
    }
    private right(i: number) {
        return Math.floor(2 * i + 2);
    }
    private swap(i: number, j: number) {
        const tmp = this.entries[i];
        this.entries[i] = this.entries[j];
        this.entries[j] = tmp;
    }
    addItem(t: T) {
        this.entries[this.curSize] = t;
        this.curSize += 1;
        let i = this.curSize - 1;
        while (
            i !== 0 &&
            this.score(this.entries[this.parent(i)]) >
            this.score(this.entries[i])
        ) {
            this.swap(i, this.parent(i));
            i = this.parent(i);
        }
    }
    private heapify(i: number) {
        const l = this.left(i);
        const r = this.right(i);
        let smallest = i;
        if (
            l < this.curSize &&
            this.score(this.entries[l]) <
            this.score(this.entries[i])
        ) {
            smallest = l;
        }
        if (
            r < this.curSize &&
            this.score(this.entries[r]) <
            this.score(this.entries[smallest])
        ) {
            smallest = r;
        }
        if (smallest !== i) {
            this.swap(i, smallest);
            this.heapify(smallest);
        }
    }
    rebuild() {
        for (let i = this.curSize - 1; i >= 0; i -= 1) {
            this.heapify(i);
        }
    }
    popItem(i: number): T | null {
        while (i !== 0) {
            this.swap(i, this.parent(i));
            i = this.parent(i);
        }
        return this.popMinItem();
    }
    peekMinItem(): T | null {
        if (this.curSize < 1) {
            return null;
        }
        return this.entries[0];
    }
    popMinItem(): T | null {
        if (this.curSize < 1) {
            return null;
        }
        const item = this.entries[0];
        this.curSize -= 1;
        if (this.curSize > 0) {
            this.entries[0] = this.entries[this.curSize];
            this.heapify(0);
        }
        return item;
    }
}