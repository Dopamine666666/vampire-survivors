import { _decorator, Camera, Component, instantiate, loader, Node, Prefab, resources, UITransform, v3, Vec3, view } from 'cc';
import { Enemy } from './Enemy';
import { Hero } from './Hero';
import { GetSelfBoundingBox } from '../CommonFunc';
import { EventManager } from '../manager/EventManager';
const { ccclass, property } = _decorator;

@ccclass('Field')
export class Field extends Component {
    @property({ type: Node })
    fieldMap: Node = null;

    @property({ type: Camera })
    gameCamera: Camera = null;

    @property({ type: Node })
    unitLayer: Node = null;

    @property({ type: Node })
    bulletLayer: Node = null;

    @property({ type: Enemy })
    enemy: Enemy = null;

    @property({ type: Hero })
    hero: Hero = null;

    private enemies: Enemy[] = [];
    private mine: Hero = null;

    protected onLoad(): void {
        this.initState();
        this.initMapLimit();
        this.onEvent();
    }

    onEvent() {
        EventManager.On('createEnemy', this.createEnemy, this);
        EventManager.On('createBullet', this.createBullet, this);
    }

    initState() {
        this.hero.initState({
            hp: 100,
            power: 10,
        }, this.fieldMap);
    }

    private mapMinX: number = 0;
    private mapMinY: number = 0;
    private mapMaxX: number = 0;
    private mapMaxY: number = 0;
    initMapLimit() {
        const ortho = this.gameCamera.orthoHeight;
        const { width: viewW, height: viewH } = view.getVisibleSize();
        const scale = viewH / (2 * ortho);
        const cameraHeight = viewH / scale;
        const cameraWidth = viewW / scale;
        const { xMin, xMax, yMin, yMax } = GetSelfBoundingBox(this.fieldMap);
        this.mapMinX = xMin + cameraWidth / 2;
        this.mapMaxX = xMax - cameraWidth / 2;
        this.mapMinY = yMin + cameraHeight / 2;
        this.mapMaxY = yMax - cameraHeight / 2;
    }

    private createEnemy(enemyId: keyof typeof GameTsCfg.EnemyConfig, pos: Vec3) {
        const { hp, power, cooling, skills } = GameTsCfg.EnemyConfig[enemyId];
        // let enemy: Node = null;
        resources.load(`prefab/Enemy`, Prefab, (err, res) => {
            if(err) {
                console.log(err);
                return;
            }
            const node = instantiate(res);
            const enemy = node.getComponent(Enemy);
            enemy.initState({  hp, power, cooling, skills }, this.fieldMap);
            enemy.chaseTarget = this.hero.node;
            enemy.attackTarget = this.hero;
            node.active = false;
            node.setParent(this.unitLayer);
            node.setWorldPosition(pos);
            this.enemies.push(enemy);
            node.active = true;
        })
    }

    private createBullet() {

    }

    updateCamera() {
        if(!this.hero) return;
        let pos: Vec3 = this.hero.node.worldPosition.clone();
        pos.x = Math.min(Math.max(pos.x, this.mapMinX), this.mapMaxX);
        pos.y = Math.min(Math.max(pos.y, this.mapMinY), this.mapMaxY); 
        this.gameCamera.node.setWorldPosition(pos);
    }

    protected update(dt: number): void {
        this.updateCamera();
    }
}


