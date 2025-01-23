import { _decorator, Component, Node, UITransform, v3, Vec3 } from 'cc';
import { Hero } from './Hero';
import { GetLimitPos, SetPosInLimit } from '../CommonFunc';
import GameTsCfg from '../../resources/data/client/GameTsCfg';
const { ccclass, property } = _decorator;
const SPEED = 200;
const FRAME_RATE = 60;

interface EnemyData {
    hp: number,
    power: number,
    cooling: number,
    skills?: string[],
}

@ccclass('Enemy')
export class Enemy extends Component {
    private _damage: number = 0;
    set damage(val: number) {
        if((this._damage += val) >= this.data.hp) {
            console.log('enemy is dead');
        }
    }
    private data: EnemyData = null;
    private meleeCooling: number = 0;

    private _chaseTarget: Node = null;
    set chaseTarget(target: Node) {
        this._chaseTarget = target;
    }

    private _attackTarget: Hero = null;
    set attackTarget(target: Hero) {
        this._attackTarget = target;
    }

    private limitPos: {xMin: number, xMax: number, yMin: number, yMax: number};

    static createEnemy(enemyId: string) {
        const { hp,  } = GameTsCfg.EnemyConfig[enemyId];
    }

    initState(data: EnemyData, mapNode: Node) {
        this.data = data;
        this._damage = 0;
        this.meleeCooling = 0;

        this.limitPos = GetLimitPos(this.node, mapNode);
    }

    updateChase() {
        if(!this._chaseTarget) return;
        const curPos = this.node.worldPosition;
        const targetPos = this._chaseTarget.worldPosition;
        const subVec = targetPos.clone().subtract(curPos);
        const normalizeVec = subVec.normalize();
        const offsetX = SPEED * normalizeVec.x / FRAME_RATE;
        const offsetY = SPEED * normalizeVec.y / FRAME_RATE;
        if(this.getManhattanDis(curPos, targetPos) < (offsetX ** 2 + offsetY ** 2)) {
            this.node.setWorldPosition(SetPosInLimit(this.limitPos, targetPos));
        }else {
            this.node.setWorldPosition(SetPosInLimit(this.limitPos, v3(curPos.x + offsetX, curPos.y + offsetY, curPos.z)));
        }
    }

    updateMelee(dt: number) {
        if(!this._attackTarget) return;
        const myRect = this.node.getComponent(UITransform).getBoundingBox();
        const targetRect = this._attackTarget.node.getComponent(UITransform).getBoundingBox();
        if((this.meleeCooling -= dt * 1000) <= 0 && myRect.intersects(targetRect)) {
            this.meleeCooling = this.data.cooling;
            this._attackTarget.damage = this.data.power;
        }
    }

    protected update(dt: number): void {
        this.updateChase();
        this.updateMelee(dt);
    }

    getManhattanDis(a: Vec3, b: Vec3) {
        return (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
    }
}