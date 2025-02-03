export interface IConfig {
    /** 帧率 */
    readonly frame_rate: number;
    /** 最大速度 */
    readonly max_speed: number;
    /** 忽略英雄 */
    readonly init_heroes: any;
    /** 锁定英雄 */
    readonly lock_hero: string;
}
export interface IHero {
    /** id */
    readonly _id: string;
    /** 力量 */
    readonly power: number;
    /** 速度 */
    readonly speed: number;
}

export interface IGameData {
    readonly config: IConfig;
    readonly hero: { [_id: string]: IHero };
}

 
export type THeroKey = 'hero_1' | 'hero_2';
