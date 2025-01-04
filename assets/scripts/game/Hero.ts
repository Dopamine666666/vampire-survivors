import { _decorator, Component, EventKeyboard, input, Input, KeyCode, Node, UITransform, v3 } from 'cc';
import { GetLimitPos, SetPosInLimit } from '../CommonFunc';
const { ccclass, property } = _decorator;
const SPEED = 300;
const FRAME_RATE = 60;

interface HeroData {
    hp: number,
    power: number
}

@ccclass('Hero')
export class Hero extends Component {
    private isUp: boolean = false;
    private isDown: boolean = false;
    private isLeft: boolean = false;
    private isRight: boolean = false;

    private speedX: number = 0;
    private speedY: number = 0;

    private data: HeroData = null;
    private _damage: number = 0;
    set damage(val: number) {
        if((this._damage += val) >= this.data.hp) {
            console.log('hero is dead');
        }
    }

    private limitPos: {xMin: number, xMax: number, yMin: number, yMax: number};

    protected onLoad(): void {
        input.on(Input.EventType.KEY_DOWN, this.onKeyDown, this);
        input.on(Input.EventType.KEY_UP, this.onKeyUp, this);
    }
    
    initState(data: HeroData, mapNode: Node) {
        this.isUp = false;
        this.isDown = false;
        this.isLeft = false;
        this.isRight = false;
        this.data = data;
        this._damage = 0;

        this.limitPos = GetLimitPos(this.node, mapNode);
    }

    onKeyDown(e: EventKeyboard) {
        if(e.keyCode == KeyCode.KEY_W) {
            if(this.isUp) return;
            this.isUp = true;
            this.isDown = false;
        }
        else if(e.keyCode == KeyCode.KEY_S) {
            if(this.isDown) return;
            this.isDown = true;
            this.isUp = false;
        }
        else if(e.keyCode == KeyCode.KEY_A) {
            if(this.isLeft) return;
            this.isLeft = true;
            this.isRight = false;
        }
        else if(e.keyCode == KeyCode.KEY_D) {
            if(this.isRight) return;
            this.isRight = true;
            this.isLeft = false;
        }
        this.updateSpeedByKeyCode();
    }

    onKeyUp(e: EventKeyboard) {
        if(e.keyCode == KeyCode.KEY_W) {
            if(!this.isUp) return;
            this.isUp = false;
        }
        else if(e.keyCode == KeyCode.KEY_S) {
            if(!this.isDown) return;
            this.isDown = false;
        }
        else if(e.keyCode == KeyCode.KEY_A) {
            if(!this.isLeft) return;
            this.isLeft = false;
        }
        else if(e.keyCode == KeyCode.KEY_D) {
            if(!this.isRight) return;
            this.isRight = false;
        }
        this.updateSpeedByKeyCode();
    }

    updateSpeedByKeyCode() {
        if(!this.isUp && !this.isDown && !this.isLeft && !this.isRight) {
            this.speedX = this.speedY = 0;
            return;
        }

        if(this.isRight && !this.isUp && !this.isDown) {
            this.speedX = SPEED;
            this.speedY = 0;
            return;
        }

        if(this.isLeft && !this.isUp && !this.isDown) {
            this.speedX = -SPEED;
            this.speedY = 0;
            return;
        }

        if(this.isUp && !this.isLeft && !this.isRight) {
            this.speedX = 0;
            this.speedY = SPEED;
            return;
        }

        if(this.isDown && !this.isLeft && !this.isRight) {
            this.speedX = 0;
            this.speedY = -SPEED;
            return;
        }

        if(this.isRight && this.isUp) {
            this.speedX = SPEED / 1.4;
            this.speedY = SPEED / 1.4;
            return;
        }

        if(this.isRight && this.isDown) {
            this.speedX = SPEED / 1.4;
            this.speedY = -SPEED / 1.4;
            return;
        }

        if(this.isLeft && this.isUp) {
            this.speedX = -SPEED / 1.4;
            this.speedY = SPEED / 1.4;
            return;
        }

        if(this.isLeft && this.isDown) {
            this.speedX = -SPEED / 1.4;
            this.speedY = -SPEED / 1.4;
            return;
        }
    }

    updateMove() {
        const offsetX = this.speedX / FRAME_RATE;
        const offsetY = this.speedY / FRAME_RATE;
        const oriPos = this.node.worldPosition;
        this.node.setWorldPosition(SetPosInLimit(this.limitPos, v3(oriPos.x + offsetX, oriPos.y + offsetY, oriPos.z)));
    }

    protected update(dt: number): void {
        this.updateMove();
    }

    onDestroy() {
        input.off(Input.EventType.KEY_DOWN, this.onKeyDown, this);
        input.off(Input.EventType.KEY_UP, this.onKeyUp, this);
    }
}