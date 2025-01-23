import { _decorator, Component, Node } from 'cc';
const { ccclass, property } = _decorator;

interface BulletData {
    speed: number,
    power: number,
    range: number,
    attackTarget: 'hero' | 'enemy',
    damageRange: number,
    duration: number,
}

@ccclass('Bullet')
export class Bullet extends Component {
    private data: BulletData;

    initState(data: BulletData) {
        this.data = data;
    }
}


