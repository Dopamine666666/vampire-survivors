

export class EventManager {
    static events: { [code: string | number]: {func: (...args) => void, target?: unknown, once?: boolean}[]} = {};

    static On(code: string | number, func: (...args) => void, target?: unknown, once?: boolean) {
        this.events[code] = this.events[code] || [];
        const fn = this.events[code].find(evt => evt.func == func && evt.target == target);
        if(!fn) {
            this.events[code].push({func, target, once});
        }
    }
    
    static Once(code: string | number, func: (...args) => void, target?: unknown) {
        this.On(code, func, target, true);
    }

    static Emit(code: string | number, ...args: any) {
        if(this.events[code]) {
            this.events[code].forEach(evt => evt.func.call(evt.target, ...args));
            this.events[code] = (this.events[code] || []).filter(evt => !evt.once);
        }
    }
}


