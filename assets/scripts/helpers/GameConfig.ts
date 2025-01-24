export interface IEnemy {
    /** 怪物id */
    readonly _id: string;
    /** 名称 */
    readonly name: string;
    /** 伤害 */
    readonly attack: number;
    /** 冷却 */
    readonly cooling: number;
    /** 技能 */
    readonly skill: any;
    /** 移速 */
    readonly speed: number;
}
export interface IEnemySkill {
    /** 怪物技能id */
    readonly _id: string;
    /** 飞行速度 */
    readonly speed: number;
    /** 伤害 */
    readonly power: number;
    /** 冷却 */
    readonly cooling: number;
}
export interface IHero {
    /** 英雄id */
    readonly _id: string;
    /** 名称 */
    readonly name: string;
    /** 生命 */
    readonly hp: number;
    /** 移速 */
    readonly speed: number;
    /** 技能 */
    readonly skill: any;
}
export interface IHeroSkill {
    /** 技能id */
    readonly _id: string;
    /** 名称 */
    readonly name: string;
    /** 伤害 */
    readonly power: number;
    /** 技能冷却 */
    readonly skill_cooling: number;
    /** 技能持续时间 */
    readonly skill_duration: number;
    /** 发射冷却 */
    readonly launch_cooling: number;
    /** 类型 */
    readonly type: string;
    /** 瞄准模式 */
    readonly aim_mode: string;
    /** 伤害范围 */
    readonly damge_range: any;
    /** 子弹飞行距离 */
    readonly bullet_distance: number;
    /** 子弹穿透个数 */
    readonly bullet_trigger_count: number;
    /** 子弹飞行速度 */
    readonly bullet_speed: number;
    /** 陷阱持续时间 */
    readonly trap_duration: number;
    /** 陷阱触发冷却 */
    readonly trap_trigger_cooling: number;
}

export interface IGameData {
    readonly version: number;
    readonly config: IConfig;
    readonly enemy: {[_id: string]: IEnemy};
    readonly enemy_skill: {[_id: string]: IEnemySkill};
    readonly hero: {[_id: string]: IHero};
    readonly hero_skill: {[_id: string]: IHeroSkill};
}

export type TEnemyKey = 'enemy_1' | 'undefined' | 'enemy_2' | 'enemy_3' | 'enemy_4';
export type TEnemySkillKey = 'enemy_skill_1' | 'undefined' | 'enemy_skill_2' | 'enemy_skill_3';
export type THeroKey = 'hero_1' | 'undefined' | 'hero_2' | 'hero_3';
export type THeroSkillKey = 'hero_skill_1' | 'undefined' | 'hero_skill_2' | 'hero_skill_3' | 'hero_skill_4';
