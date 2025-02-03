import { readFileSync, readJSONSync, writeJSONSync, readdirSync, existsSync, removeSync, renameSync, writeFileSync } from 'fs-extra';
import { join, extname, basename } from 'path';
import { createApp, App, defineProps } from 'vue';
import { render } from 'ejs';
// const xlsx = require('../../../node_modules/node-xlsx/dist/index.cjs');
// const { parse } = xlsx;
import { parse, build } from 'node-xlsx';

const EXPORT_HELPER_PATH = 'db://assets/scripts/helpers/GameConfig.ts';
const EXPORT_JSON_PATH = 'db://assets/resources/data/game-config.json';

const underlineToHump = string => string.replace(/\_(\w)/g, (_, char) => char.toUpperCase());
const humpToUnderline = string => string.replace(/([A-Z])/g, '_$1').toLowerCase();

const clone = obj => {
    if (typeof obj != 'object') {
        return obj;
    }
    const cloned: any = obj.constructor == Array ? [] : {};
    for (let key in obj) {
        cloned[key] = clone(obj[key]);
    }
    return cloned;
}

class TypeParser {
    isNumber = false;
    isString = false;
    isArray = false;
    isHash = false;
    isEnum = false;
    isAutoEnum = false;
    isJSON = false;
    isIgnore = false;
    isQuot = false;
    isGrid = false;
    isAsset = false;
    isColor = false;
    isTranslate = false;
    isText = false;
    enumKeys: string[] = [];
    gridSize: number[] = [3, 3];
    // hashKeys: string[] = [];
    hashKeyTypeParsers: TypeParser[] = [];
    arrayKeyType = '';
    type = '';
    typeKey = '';

    encodedValue = '';
    parsedValue = null;

    constructor(typeString: string, typeKey: string, enumKeys?: string[]) {
        this.typeKey = typeKey;
        if (typeString.startsWith('grid')) {
            this.isGrid = true;
            typeString = typeString.slice(typeString.indexOf('#') + 1);
            typeString.split('|').forEach((v, i) => {
                this.gridSize[i] = +v;
            });
            return;
        }

        if (typeString.startsWith('asset')) {
            this.isAsset = true;
            this.type = typeString.slice(typeString.indexOf('#') + 1);
            return;
        }

        if (typeString == 'ignore') {
            this.isIgnore = true;
            return;
        }
        
        let firstSplit = -1;
        while((firstSplit = typeString.indexOf('#')) != -1) {
            const str = typeString.substring(0, firstSplit);
            if (str == 'array') {
                this.isArray = true;
            }
            else if (str == 'hash') {
                this.isHash = true;
            }
            else if (str == 'enum') {
                this.isEnum = true;
            }
            else if (str == 'json') {
                this.isJSON = true;
            }
            else if (str == 'translate') {
                this.isTranslate = true;
            }
            else {
                break;
            }
            typeString = typeString.slice(firstSplit + 1);
        }

        if (typeString == 'text') {
            this.isText = true;
            return;
        }

        if (/^T[A-Za-z0-9]{1,}Key$/.test(typeString)) {
            this.isQuot = true;
            this.type = typeString;
            return;
        }

        if (typeString == 'number') {
            this.isNumber = true;
            if(this.isArray) this.arrayKeyType = 'number';
            return;
        }

        if (typeString == 'color') {
            this.isColor = true;
            return;
        }

        if (['string', 'translate'].includes(typeString)) {
            this.isTranslate = typeString == 'translate';
            this.isString = true;
            return;
        }
        this.enumKeys = enumKeys || [];
        if (typeString == 'enum') {
            this.isEnum = this.isAutoEnum = true;
            return;
        }
        
        if (typeString.startsWith('T')) {
            this.type = typeString;
            return;
        }

        if (this.isEnum) {
            this.enumKeys = typeString.split('|');
        }
        else if (this.isHash) {
            while(typeString != '') {
                let keySplit = typeString.indexOf(':');
                if (keySplit == -1) {
                    break;
                }
                let typeKey = typeString.substring(0, keySplit);

                typeString = typeString.slice(keySplit + 1);

                if (typeString.startsWith('[')) {
                    let count = 1;
                    let endSplit = -1;

                    for (let i = 1;i < typeString.length;++i) {
                        if (typeString[i] == '[') {
                            ++count;
                        }
                        if (typeString[i] == ']') {
                            --count;
                            if (count == 0) {
                                endSplit = i;
                                break;
                            }
                        }
                    }
                    
                    this.hashKeyTypeParsers.push(new TypeParser(typeString.substring(1, endSplit), typeKey));
                    typeString = typeString.slice(endSplit + 1);
                    if (typeString.startsWith('|')) {
                        typeString = typeString.slice(1);
                    }
                }
                else {
                    let valSplit = typeString.indexOf('|');
                    let value = valSplit == -1 ? typeString : typeString.substring(0, valSplit);
                    this.hashKeyTypeParsers.push(new TypeParser(value, typeKey));
                    typeString = valSplit == -1 ? '' : typeString.slice(valSplit + 1);
                }
            }
        }
        else if (this.isArray) {
            this.arrayKeyType = typeString;
        }
    }

    get TypeStringTS() {
        let enumType = '';
        let hashType = '';
        if (this.isEnum) {
            enumType = `"${this.enumKeys.map(key => key.split('@')[0]).join('" | "')}"`;
        }
        else if (this.isHash) {
            let kvs: string[] = [];
            this.hashKeyTypeParsers.forEach((parser: TypeParser, idx) => {
                kvs.push(`readonly ${parser.TypeKey}: ${parser.TypeStringTS}`);
            });
            hashType = `{${kvs.join(',')}}`;
        }
        if (this.isArray) {
            if (this.isNumber) {
                return 'number[]';
            }
            if (this.isString) {
                return 'string[]';
            }
            if (this.isEnum) {
                return `(${enumType})[]`;
            }
            if (this.isHash) {
                return `${hashType}[]`;
            }
            if (this.isQuot) {
                return `${this.type}[]`;
            }
            return `${this.arrayKeyType}[]`;
        }
        if (this.isNumber || this.isGrid) {
            return 'number';
        }
        if (this.isString || this.isAsset || this.isColor || this.isText) {
            return 'string';
        }
        if (this.isEnum) {
            return enumType + '| ""';
        }
        if (this.isHash){
            return hashType;
        }
        return this.type;
    }

    get TypeKey() {
        return this.typeKey.split('@')[0];
    }

    get TypeMemo() {
        return this.typeKey.split('@')[1] || '';
    }

    private _parse(valueString: string) {
        if (this.isJSON) {
            try {
                return JSON.parse(valueString);
            }
            catch(e) {
                console.log('parse json failed,parse as encode string');
            }
        }
        if (this.isText) {
            return valueString;
        }
        if (this.isArray) {
            if (this.isHash) {
                const arr: any[] = [];
                let arrIdx = 0;
                let keyIdx = 0;
                while(valueString.length > 0) {
                    arr[arrIdx] = arr[arrIdx] || {};
                    if (valueString.startsWith('[')) {

                        let count = 1;
                        let endSplit = -1;
                        for (let i = 1;i < valueString.length;++i) {
                            if (valueString[i] == '[') {
                                ++count;
                            }
                            if (valueString[i] == ']') {
                                --count;
                                if (count == 0) {
                                    endSplit = i;
                                    break;
                                }
                            }
                        }

                        arr[arrIdx][this.hashKeyTypeParsers[keyIdx].TypeKey] = this.hashKeyTypeParsers[keyIdx].Parse(valueString.substring(1, endSplit));
                        valueString = valueString.slice(endSplit + 1);
                    }
                    else {
                        const vSplit = valueString.indexOf('|');
                        const aSplit = valueString.indexOf(',');
                        let vStr = '';
                        if (vSplit == -1) {
                            if (aSplit != -1) {
                                // 单元素
                                vStr = valueString.substring(0, aSplit);
                            }
                            else {
                                // 最后一个
                                vStr = valueString;
                            }
                        }
                        else {
                            if (aSplit != -1 && aSplit < vSplit) {
                                // 本组最后一个
                                vStr = valueString.substring(0, aSplit);
                            }
                            else {
                                vStr = valueString.substring(0, vSplit);
                            }
                        }
                        arr[arrIdx][this.hashKeyTypeParsers[keyIdx].TypeKey] = this.hashKeyTypeParsers[keyIdx].Parse(vStr);
                        valueString = valueString.slice(vStr.length);
                    }
                    if (valueString.startsWith('|')) {
                        valueString = valueString.slice(1);
                        ++keyIdx;
                    }
                    if (valueString.startsWith(',')) {
                        valueString = valueString.slice(1);
                        ++arrIdx;
                        keyIdx = 0;
                    }
                }
                return arr;
            }

            const arr = String(valueString).split(',');
            if (arr.length == 1 && arr[0] === '') {
                return [];
            }
            if (this.isNumber) {
                return arr.map(v => Number(v));
            }
            return arr;
        }
        if (this.isNumber || this.isGrid) {
            return Number(valueString) || 0;
        }
        if (this.isString || this.isAsset) {
            return String(valueString) || '';
        }
        if (this.isEnum) {
            return String(valueString);
        }
        if (this.isHash) {
            const ret: any = {};
            let idx = 0;
            while(valueString.length > 0) {
                if (valueString.startsWith('[')) {
                    let count = 1;
                    let endSplit = -1;
                    for (let i = 1;i < valueString.length;++i) {
                        if (valueString[i] == '[') {
                            ++count;
                        }
                        if (valueString[i] == ']') {
                            --count;
                            if (count == 0) {
                                endSplit = i;
                                break;
                            }
                        }
                    }
                    ret[this.hashKeyTypeParsers[idx].TypeKey] = this.hashKeyTypeParsers[idx].Parse(valueString.substring(1, endSplit));
                    valueString = valueString.slice(endSplit + 1);
                    if (valueString.startsWith('|')) {
                        valueString = valueString.slice(1);
                        ++idx;
                    }
                }
                else {
                    const endSplit = valueString.indexOf('|');
                    ret[this.hashKeyTypeParsers[idx].TypeKey] = this.hashKeyTypeParsers[idx].Parse(endSplit == -1 ? valueString : valueString.substring(0, endSplit));
                    if (endSplit != -1) {
                        valueString = valueString.slice(endSplit + 1);
                        ++idx;
                    }
                    else {
                        valueString = '';
                    }
                }
            }
            return ret;
        }
        return String(valueString);
    }

    Parse(valueString: string) {
        if (!valueString) {
            return this.NewValue;
        }
        try {
            return this._parse(valueString);
        }
        catch(e) {
            return this.NewValue;
        }
    }

    async ParseAndReplaceAsset(valueString: string) {
        valueString = valueString || '';
        if (this.isJSON) {
            try {
                return JSON.parse(valueString);
            }
            catch(e) {
                console.log('parse json failed,parse as encode string');
            }
        }
        if (this.isText) {
            return valueString;
        }
        if (this.isArray) {
            if (this.isHash) {
                const arr: any[] = [];
                let arrIdx = 0;
                let keyIdx = 0;
                while(valueString.length > 0) {
                    arr[arrIdx] = arr[arrIdx] || {};
                    if (valueString.startsWith('[')) {
                        let count = 1;
                        let endSplit = -1;
                        for (let i = 1;i < valueString.length;++i) {
                            if (valueString[i] == '[') {
                                ++count;
                            }
                            if (valueString[i] == ']') {
                                --count;
                                if (count == 0) {
                                    endSplit = i;
                                    break;
                                }
                            }
                        }

                        arr[arrIdx][this.hashKeyTypeParsers[keyIdx].TypeKey] = await this.hashKeyTypeParsers[keyIdx].ParseAndReplaceAsset(valueString.substring(1, endSplit));

                        valueString = valueString.slice(endSplit + 1);
                    }
                    else {
                        const vSplit = valueString.indexOf('|');
                        const aSplit = valueString.indexOf(',');
                        let vStr = '';
                        if (vSplit == -1) {
                            if (aSplit != -1) {
                                // 单元素
                                vStr = valueString.substring(0, aSplit);
                            }
                            else {
                                // 最后一个
                                vStr = valueString;
                            }
                        }
                        else {
                            if (aSplit != -1 && aSplit < vSplit) {
                                // 本组最后一个
                                vStr = valueString.substring(0, aSplit);
                            }
                            else {
                                vStr = valueString.substring(0, vSplit);
                            }
                        }
                        arr[arrIdx][this.hashKeyTypeParsers[keyIdx].TypeKey] = await this.hashKeyTypeParsers[keyIdx].ParseAndReplaceAsset(vStr);
                        valueString = valueString.slice(vStr.length);
                    }
                    if (valueString.startsWith('|')) {
                        valueString = valueString.slice(1);
                        ++keyIdx;
                    }
                    if (valueString.startsWith(',')) {
                        valueString = valueString.slice(1);
                        ++arrIdx;
                        keyIdx = 0;
                    }
                }
                return arr;
            }

            const arr = String(valueString).split(',').map(v => this.arrayKeyType == 'number' ? Number(v) : v);
            if (arr.length == 1 && arr[0] === '') {
                return [];
            }
            if (this.isNumber) {
                return arr.map(v => Number(v));
            }
            return arr;
        }
        if (this.isNumber || this.isGrid) {
            return Number(valueString) || 0;
        }
        if (this.isString) {
            return String(valueString) || '';
        }
        if (this.isAsset) {
            if (!valueString || !Editor.Utils.UUID.isUUID(valueString)) {
                return valueString;
            }
            const asset = await Editor.Message.request('asset-db', 'query-url', valueString);
            if (!asset) {
                return console.log('不存在：' + this.typeKey);
            }
            const url = asset.split('/');
            if (url.indexOf('bundles') == -1) {
                return valueString;
            }
            while(url.length > 0 && url[0] != 'bundles') {
                url.shift();
            }
            url.shift();
            const bundleName = url.shift();
            let path = url.join('/');
            path = path.substring(0, path.lastIndexOf('.'));
            return bundleName + '|' + path;

        }
        if (this.isEnum) {
            return String(valueString);
        }
        if (this.isHash) {
            const ret: any = {};
            let idx = 0;
            while(valueString.length > 0) {
                if (valueString.startsWith('[')) {
                    let count = 1;
                    let endSplit = -1;
                    for (let i = 1;i < valueString.length;++i) {
                        if (valueString[i] == '[') {
                            ++count;
                        }
                        if (valueString[i] == ']') {
                            --count;
                            if (count == 0) {
                                endSplit = i;
                                break;
                            }
                        }
                    }

                    ret[this.hashKeyTypeParsers[idx].TypeKey] = this.hashKeyTypeParsers[idx].Parse(valueString.substring(1, endSplit));
                    valueString = valueString.slice(endSplit + 1);
                    if (valueString.startsWith('|')) {
                        valueString = valueString.slice(1);
                        ++idx;
                    }
                }
                else {
                    const endSplit = valueString.indexOf('|');
                    ret[this.hashKeyTypeParsers[idx].TypeKey] = this.hashKeyTypeParsers[idx].Parse(endSplit == -1 ? valueString : valueString.substring(0, endSplit));
                    if (endSplit != -1) {
                        valueString = valueString.slice(endSplit + 1);
                        ++idx;
                    }
                    else {
                        valueString = '';
                    }
                }
            }
            return ret;
        }
        return String(valueString);
    }

    get TypeString() {
        if (this.isIgnore) {
            return 'ignore';
        }
        if (this.isText) {
            return 'text';
        }
        if (this.isGrid) {
            return 'grid#' + this.gridSize.join('|');
        }
        if (this.isAsset) {
            return 'asset#' + this.type;
        }
        let str: string[] = [];
        if (this.isJSON) {
            str.push('json');
        }
        if (this.isArray) {
            str.push('array');
        }
        if (this.isEnum) {
            str.push('enum');
        }
        if (this.isHash) {
            str.push('hash');
        }
        if (this.isColor) {
            str.push('color');
        }
        if (this.isString) {
            str.push(this.isTranslate ? 'translate' : 'string');
        }
        if (this.isNumber) {
            str.push('number');
        }
        if (this.arrayKeyType) {
            !this.isNumber && str.push(this.arrayKeyType);
        }
        if (this.type) {
            str.push(this.type);
        }
        if (this.enumKeys.length > 0 && !this.isAutoEnum) {
            str.push(this.enumKeys.join('|'));
        }

        if (this.hashKeyTypeParsers.length > 0) {
            let hashKvs: string[] = [];
            this.hashKeyTypeParsers.forEach((parser, idx) => {
                const sub = parser.TypeString;
                hashKvs.push(`${parser.typeKey}:${sub.indexOf('#') == -1 ? sub : '[' + sub + ']'}`);
            });

            str.push(hashKvs.join('|'));
        }
        return str.join('#');
    }

    Encode(value: any, isSub = false) {
        if (this.isJSON) {
            return JSON.stringify(value);
        }

        if (this.isHash) {
            const arr: string[] = [];
            [].concat(value).forEach(o => {
                const v = [];
                this.hashKeyTypeParsers.forEach(parser => {
                    v.push(parser.Encode(o[parser.TypeKey], true));
                });
                arr.push(v.join('|'));
            });
            return isSub ? `[${arr.join(',')}]` : arr.join(',');
        }
        else if (this.isArray) {
            value = [].concat(value || []);
            return isSub ? `[${value.join(',')}]` : value.join(',');
        }
        else {
            return String(value);
        }
    }

    get NewValue() {
        if (this.isArray) {
            return [];
        }
        if (this.isHash) {
            const ret: any = {};
            this.hashKeyTypeParsers.forEach(psr => {
                ret[psr.TypeKey] = psr.NewValue;
            });
            return ret;
        }
        return this.isNumber || this.isGrid ? 0 : '';
    }

    get NewItem() {
        if (!this.isArray) {
            return;
        }
        if (this.isHash) {
            const ret: any = {};
            this.hashKeyTypeParsers.forEach(psr => {
                ret[psr.TypeKey] = psr.NewValue;
            });
            return ret;
        }
        return this.isNumber || this.isGrid ? 0 : '';
    }
}

const panelDataMap = new WeakMap<any, App>();
/**
 * @zh 如果希望兼容 3.3 之前的版本可以使用下方的代码
 * @en You can add the code below if you want compatibility with versions prior to 3.3
 */
// Editor.Panel.define = Editor.Panel.define || function(options: any) { return options }

module.exports = Editor.Panel.define({
    // listeners: {
    //     show() { console.log('show'); },
    //     hide() { console.log('hide'); },
    // },
    template: readFileSync(join(__dirname, '../../../static/template/default/index.html'), 'utf-8'),
    style: readFileSync(join(__dirname, '../../../static/style/default/index.css'), 'utf-8'),
    $: {
        app: '#app',
    },
    ready() {
        if (this.$.app) {
            const helperTemp = readFileSync(join(__dirname, '../../../template/helper.ts.ejs'), 'utf-8');
            const settingPath = join(__dirname, '../../../setting/setting.json');
            const setting = readJSONSync(settingPath);

            const path = setting.path && existsSync(setting.path) ? setting.path : '';
            const jsonpath = setting.jsonpath && existsSync(setting.jsonpath) ? setting.jsonpath : '';
            let list: string[] = [];
            let parsed: any[] = [];
            if (jsonpath && existsSync(join(jsonpath, 'GameConfig.json'))) {
                parsed = readJSONSync(join(jsonpath, 'GameConfig.json'), 'utf-8');
                list = parsed.map(file => file.name);
            }
            else if (path) {
                list = readdirSync(setting.path).filter(filename => !filename.startsWith('~$') && extname(filename).startsWith('.xls'));
                parsed = list.map(file => {
                    const origin_name = file;
                    file = basename(file, extname(file));
                    return {
                        origin_name,
                        name: file.indexOf('@') != -1 ? file.substring(0, file.indexOf('@')) : file, 
                        memo: file.indexOf('@') != -1 ? file.slice(file.indexOf('@') + 1) : '',
                        pages: parse(join(path, file + '.xlsx')).map(page => ({name: page.name.split('@')[0],memo:page.name.split('@')[1] || '', data: page.data})), 
                        rename: '', 
                        removed: false,
                    }
                });
            }

            parsed.sort((f1, f2) => {
                return (f1.memo || f1.name) < (f2.memo || f1.name) ? -1 : 1;
            });

            const file = parsed[0] || null;
            const page = file ? file.pages[0] : null;
            
            const app = createApp({
                data() {
                    return {
                        path,
                        jsonpath,
                        parsed,
                        file,
                        page,
                        editMode: 0,
                        keyIndex: 0,
                        rowIndex: 0,
                        modal: {
                            show: false,
                            type: '',
                            title: '',
                            values: [] as any[],
                            height: 130,
                        },
                        parsers: [] as TypeParser[],
                    }
                },
                provide() {
                    return {
                        updateParser: this.updateParser,
                    }
                },
                methods: {
                    saveSetting() {
                        writeJSONSync(settingPath, setting);
                    },

                    setEXCELPath(path: string) {
                        this.path = setting.path = path;
                        this.saveSetting();
                    },
                    setJSONPath(path: string) {
                        this.jsonpath = setting.jsonpath = path;
                        this.saveSetting();
                    },

                    async importEXCEL() {
                        if (!this.path || !existsSync(this.path)) {
                            return this.alert('路径不存在');
                        }
                        if (this.parsed && this.parsed.length > 0 && !await this.confirm('确定要重新加载文件吗？未保存的更改将永久丢失。')) {
                            return;
                        }

                        this.parsed = readdirSync(this.path).filter(filename => !filename.startsWith('~$') && extname(filename).startsWith('.xls')).map(file => {
                            const origin_name = file;
                            file = basename(file, extname(file));
                            return {
                                origin_name,
                                name: file.indexOf('@') != -1 ? file.substring(0, file.indexOf('@')) : file, 
                                memo: file.indexOf('@') != -1 ? file.slice(file.indexOf('@') + 1) : '',
                                pages: parse(join(this.path, file + '.xlsx')).map(
                                    page => (
                                        {
                                            name: page.name.split('@')[0],
                                            memo:page.name.split('@')[1] || '', 
                                            data: page.data
                                        }
                                    )
                                ), 
                                rename: '', 
                                removed: false,
                            }
                        });
                        this.parsed.sort((f1, f2) => {
                            return (f1.memo || f1.name) < (f2.memo || f1.name) ? -1 : 1;
                        });
                        this.file = this.parsed[0] || null;
                        this.page = this.file ? this.file.pages[0] : null;
                        this.keyIndex = this.rowIndex = 0;
                    },
                    async combineExcel() {
                        if (!this.parsed || this.parsed.length == 0) {
                            return this.importEXCEL();
                        }
                        if (!this.path || !existsSync(this.path)) {
                            return this.alert('路径不存在');
                        }
                        if (!await this.confirm('确定要将EXCEL结构合并到当前项目吗？')) {
                            return;
                        }

                        const files = readdirSync(this.path).filter(filename => !filename.startsWith('~$') && extname(filename).startsWith('.xls')).map(origin_name => {
                            const file = basename(origin_name, extname(origin_name));
                            return {
                                origin_name,
                                name: file.indexOf('@') != -1 ? file.substring(0, file.indexOf('@')) : file,
                                memo: file.indexOf('@') != -1 ? file.slice(file.indexOf('@') + 1) : '',
                                pages: parse(join(this.path, file + '.xlsx')).map(
                                    page => (
                                        {
                                            name: page.name.split('@')[0],
                                            memo:page.name.split('@')[1] || '', 
                                            data: page.data
                                        }
                                    ),
                                )
                            }
                        });

                        // 清楚掉被移除的页面
                        for (let parsedOne of this.parsed) {
                            parsedOne.pages = parsedOne.pages.filter(page => !!files.find(file => !!file.pages.find(p => p.name == page.name || p.memo == page.memo)));
                        }
                        
                        for (let file of files) {
                            const origin = this.parsed.find(f => f.name == file.name);
                            if (!origin) {
                                this.parsed.push({
                                    origin_name: file.origin_name,
                                    name: file.name,
                                    memo: file.memo,
                                    pages: [],
                                    rename: '',
                                    removed: false
                                });
                            }

                            for (let page of file.pages) {
                                const pageName = page.name;
                                const pageMemo = page.memo;
                                const pageData = page.data;
                                const origin_file = this.parsed.find(file => !!(file.pages.find(page => page.name == pageName || (page.memo && page.memo == pageMemo))));
                                if (origin_file) {
                                    const idx = origin_file.pages.findIndex(page => page.name == pageName || (page.memo && page.memo == pageMemo));
                                    const originPage = origin_file.pages[idx];

                                    originPage.name = pageName;
                                    originPage.memo = pageMemo;

                                    if (origin_file.name != file.name) {
                                        this.parsed[file.name].pages.push(...origin_file.pages.splice(idx, 1));
                                    }

                                    if (this.checkIsConfigPage(pageName)) {
                                        for (let i = 3;i < pageData.length;++i) {
                                            const key = pageData[i][0];
                                            const originRow = originPage.data.find(row => row[0] == key);
                                            if (originRow) {
                                                // 暂不修改
                                                // for (let idx in originRow) {
                                                //     originRow[idx] = pageData[i][idx];
                                                // }
                                            }
                                            else {
                                                originPage.data.push(pageData[i]);
                                            }
                                        }
                                    }
                                    else {
                                        const removedIndecies: number[] = [];

                                        originPage.data[0].forEach((key, idx) => {
                                            if (!pageData[0].includes(key)) {
                                                removedIndecies.push(idx);
                                            }
                                        });

                                        if (removedIndecies.length > 0) {
                                            for (let i = 0;i < originPage.data.length;++i) {
                                                originPage.data[i] = originPage.data[i].filter((v, idx) => !removedIndecies.includes(idx));
                                            }
                                        }

                                        pageData[0].forEach((key, idx) => {
                                            if (!originPage.data[0].includes(key)) {
                                                for (let i = 0;i < 4;++i) {
                                                    originPage.data[i].push(page.data[i][idx]);
                                                }
                                                originPage.data.slice(4).forEach(row => row.push(''));
                                            }
                                            else {
                                                const idx2 = originPage.data[0].indexOf(key);
                                                for (let i = 1;i < 4;++i) {
                                                    originPage.data[i][idx2] = pageData[i][idx];
                                                }
                                            }
                                        });

                                        const sort = pageData[0].map(key => originPage.data[0].indexOf(key));

                                        if (sort.find((v, i) => v != i)) {
                                            originPage.data.forEach((row, idx) => {
                                                originPage.data[idx] = row.map((v, i) => row[sort[i]]);
                                            });
                                        }

                                        for await (let row of pageData.slice(4)) {
                                            const originRow = originPage.data.slice(4).find(r => r[0] == row[0]);
                                            if (originRow) {
                                                if (originRow.some((v, i) => row[i] != v)) {
                                                    for (let i = 0;i < row.length;++i) {
                                                        originRow[i] = row[i];
                                                    }
                                                }
                                            }
                                            else {
                                                originPage.data.push(row.slice());
                                            }
                                        }
                                    }
                                }
                                else {
                                    this.parsed.find(f => f.name == file.name).pages.push({
                                        name: pageName,
                                        memo: pageMemo,
                                        data: pageData
                                    });
                                }
                            }
                        }

                        this.parsed = JSON.parse(JSON.stringify(this.parsed));
                        this.file = this.parsed[0] || null;
                        this.editMode = 0;
                        this.page = this.file ? this.file.pages[0] : null;
                        this.keyIndex = this.rowIndex = 0;
                    },
                    saveEXCEL() {
                        if (this.duplicatedFileNames.length > 0 || this.duplicatedPageNames.length > 0 || this.duplicatedKeys.length > 0 || this.duplicatedRows.length > 0) {
                            return this.alert('当前存在重复的文件名，表名，或某些表内存在相同的参数名或相同_id的项，请修改后再保存。');
                        }
                        for (let file of this.parsed) {
                            file.origin_name && removeSync(join(setting.path, file.origin_name));
                            if (file.removed) {
                                continue;
                            }
                            else {
                                if (file.rename) {
                                    file.name = file.rename;
                                    file.rename = '';
                                }

                                const data = build(file.pages.map(page => ({name: page.name + (page.memo ? '@' + page.memo : ''), data: page.data})));
                                writeFileSync(join(setting.path, file.origin_name = file.name + (file.memo ? '@' + file.memo : '') + '.xlsx'), data);
                            }
                        }
                        this.parsed = this.parsed.filter(file => !file.removed);
                        this.alert('文件已保存', '成功');
                    },

                    async importJSON() {
                        if (!this.jsonpath || !existsSync(this.jsonpath)) {
                            return this.alert('路径不存在');
                        }
                        if (this.parsed && this.parsed.length > 0 && !await this.confirm('确定要重新加载文件吗？未保存的更改将永久丢失。')) {
                            return;
                        }
                        this.parsed = readJSONSync(join(this.jsonpath, 'GameConfig.json'), 'utf-8');
                        this.file = this.parsed[0] || null;
                        this.page = this.file ? this.file.pages[0] : null;
                        this.keyIndex = this.rowIndex = 0;
                    },
                    saveJSON() {
                        if (this.duplicatedFileNames.length > 0 || this.duplicatedPageNames.length > 0 || this.duplicatedKeys.length > 0 || this.duplicatedRows.length > 0) {
                            return this.alert('当前存在重复的文件名，表名，或某些表内存在相同的参数名或相同_id的项，请修改后再保存。');
                        }
                        if (!this.jsonpath || !existsSync(this.jsonpath)) {
                            return this.alert('路径不存在');
                        }
                        writeFileSync(join(this.jsonpath, 'GameConfig.json'), JSON.stringify(this.parsed, null, 4), 'utf-8');
                        this.alert('文件已保存', '成功');
                    },
                    newFile() {
                        this.modalShow('new-file');
                    },
                    renameFile() {
                        this.modalShow('rename-file');
                    },
                    async removeFile() {
                        if (await this.confirm(`确定要删除文件<${this.file.rename || this.file.name}>吗？`)) {
                            this.file.removed = true;
                            this.file = this.parsed.find(file => !file.removed) || null;
                            this.page = this.file ? this.file.pages[0] : null;
                        }
                    },
                    selectFile(file) {
                        this.file = file;
                        this.page = file.pages[0];
                        this.keyIndex = this.rowIndex = 0;
                    },
                    newPage() {
                        this.modalShow('new-page');
                    },
                    renamePage() {
                        this.modalShow('rename-page');
                    },
                    selectPage(pageIndex) {
                        if (!isNaN(pageIndex)) {
                            if (this.file.pages[pageIndex] != this.page) {
                                this.page = this.file.pages[pageIndex];
                                this.keyIndex = this.rowIndex = 0;
                                this.pageChanged = true;
                            }
                            else {
                                this.renamePage();
                            }
                        }
                    },
                    async removePage() {
                        if (await this.confirm(`确定要删除表页<${this.page.name}>吗？`)) {
                            const originIdx = this.file.pages.indexOf(this.page);
                            this.file.pages.splice(originIdx, 1);
                            this.page = this.file.pages[Math.max(0, originIdx - 1)];
                        }
                    },
                    selectEditMode(mode) {
                        if (!isNaN(mode)) {
                            this.editMode = mode;
                        }
                    },
                    newKey() {
                        this.page.data[0].push('new_key');
                        this.page.data[1].push('string');
                        this.page.data[2].push('新属性');
                        this.page.data[3].push('#MEMO');
                        this.page.data.slice(4).forEach(data => data.push(''));
                        this.keyIndex = this.page.data[0].length - 1;
                        this.updateParser();
                    },
                    moveKey(offset) {
                        this.page.data.forEach(data => {
                            [data[this.keyIndex], data[this.keyIndex + offset]] = [data[this.keyIndex + offset], data[this.keyIndex]];
                        });
                        this.keyIndex += offset;
                        this.updateParser();
                    },
                    async removeKey() {
                        if (await this.confirm(`确认要删除字段<${this.page.data[0][this.keyIndex]}>吗？对应所有表项都会随之删除。`)) {
                            this.page.data.forEach(data => data.splice(this.keyIndex, 1));
                            this.keyIndex = Math.min(this.page.data[0].length - 1, this.keyIndex);
                            this.updateParser();
                        }
                    },
                    newRow() {
                        this.page.data.push(this.page.data[0].map((v, idx)=> idx == 0 ? 'new_row' : ''));
                        this.rowIndex = this.page.data.length - 5;
                    },
                    moveRow(offset) {
                        [this.page.data[this.rowIndex + 4], this.page.data[this.rowIndex + 4 + offset]] = [this.page.data[this.rowIndex + 4 + offset], this.page.data[this.rowIndex + 4]];
                        this.rowIndex += offset;
                    },
                    async removeRow() {
                        if (await this.confirm(`确认要删除行<${this.page.data[this.rowIndex + 4][0]}>吗？`)) {
                            this.page.data.splice(this.rowIndex + 4, 1);
                            this.updateParser();
                            this.rowIndex = Math.max(0, this.rowIndex - 1);
                        }
                    },
                    newConfig() {
                        this.page.data.push(['new_config', '新配置', 'number', '0']);
                        this.rowIndex = this.page.data.length - 4;
                        this.updateParser();
                    },
                    moveConfig(offset) {
                        [this.page.data[this.rowIndex + 3], this.page.data[this.rowIndex + 3 + offset]] = [this.page.data[this.rowIndex + 3 + offset], this.page.data[this.rowIndex + 3]];
                        [this.parsers[this.rowIndex], this.parsers[this.rowIndex + offset]] = [this.parsers[this.rowIndex + offset], this.parsers[this.rowIndex]];
                        this.rowIndex += offset;
                    },
                    async removeConfig() {
                        if (await this.confirm(`确认要删除配置<${this.page.data[this.rowIndex + 3][0]}>吗？`)) {
                            this.page.data.splice(this.rowIndex + 3, 1);
                            this.updateParser();
                            this.rowIndex = Math.max(0, this.rowIndex - 1);
                        }
                    },
                    updateParser() {
                        if (!this.page) {
                            return;
                        }
                        if (this.isConfigPage) {
                            if (this.page.data.length < 4) {
                                this.page.data.push(this.page.data[0].map(v => ''));
                            }
                            this.parsers = this.page.data.slice(3).map(r => {
                                const parser = new TypeParser(r[2], r[0] + '@' + r[1]);
                                parser.parsedValue = parser.Parse(parser.encodedValue = r[3]);
                                parser.encodedValue = parser.encodedValue || parser.Encode(parser.parsedValue);
                                return parser;
                            });
                        }
                        else {
                            if (this.page.data.length < 5) {
                                this.page.data.push(this.page.data[0].map(v => ''));
                            }
                            this.parsers = this.page.data[1].map((t, i) => {
                                const parser = new TypeParser(t, this.page.data[0][i] + '@' + this.page.data[2][i], t == 'enum' ? this.page.data.slice(4).map(r => r[i]) : null);
                                parser.parsedValue = parser.Parse(parser.encodedValue = this.page.data[this.rowIndex + 4][i] || '');
                                return parser;
                            });
                        }
                    },
                    modalShow(modalType: string) {
                        this.modal.type = modalType;
                        this.modal.values = [];
                        this.modal.height = 130;
                        switch(modalType) {
                            case 'new-file':
                                this.modal.title = '新建配置表文件';
                                this.modal.height = 200;
                                this.modal.values[0] = this.modal.values[1] = '';
                            break;
                            case 'rename-file':
                                this.modal.height = 165;
                                this.modal.title = '重命名配置表文件';
                                this.modal.values[0] = this.file.rename || this.file.name;
                                this.modal.values[1] = this.file.memo;
                            break;
                            case 'new-page':
                                this.modal.title = '新建表页';
                                this.modal.height = 165;
                                this.modal.values[0] = this.modal.values[1] = '';
                            break;
                            case 'rename-page':
                                this.modal.title = '重命名·转移表页';
                                this.modal.height = 225;
                                this.modal.values[0] = this.page.name;
                                this.modal.values[1] = this.page.memo || '';
                                this.modal.values[2] = this.file.name;
                                this.modal.values[3] = this.file.pages.indexOf(this.page);
                            break;
                        }
                        this.modal.show = true;
                    },
                    modalOk() {
                        if (['new-file', 'rename-file'].includes(this.modal.type) && (!this.modal.values[0] || !/^[A-Za-z]{1}[A-Za-z0-9]{0,}$/.test(this.modal.values[0]))) {
                            this.alert('文件名由大小写字母和数字组成，不要用数字开头');
                            return;
                        }
                        if (this.modal.type == 'new-file' && (!this.modal.values[2] || !/[a-z]{1}[a-z0-9_]{0,}[a-z0-9]{1}$/.test(this.modal.values[2]))) {
                            this.alert('表页名需要由小写字母、数字及下划线组成，不要用数字或下划线开头，不小于两个字符');
                            return;
                        }
                        if (['new-page', 'rename-page'].includes(this.modal.type) && (!this.modal.values[0] || !/[a-z]{1}[a-z0-9_]{0,}[a-z0-9]{1}$/.test(this.modal.values[0]))) {
                            this.alert('表页名需要由小写字母、数字及下划线组成，不要用数字或下划线开头，不小于两个字符');
                            return;
                        }
                        switch(this.modal.type) {
                            case 'new-file':
                                this.parsed.push(this.file = {
                                    name: this.modal.values[0],
                                    memo: this.modal.values[1],
                                    pages: [{name: this.modal.values[2], data:
                                        this.checkIsConfigPage(this.modal.values[2]) ? [
                                            ['_id', 'memo', 'type', 'value'],
                                            ['string', 'ignore', 'type', 'value'],
                                            ['参数名', '描述', '类型', '值'],
                                        ] : [
                                            ['_id'],
                                            ['string'],
                                            ['编号'],
                                            ['#MEMO'],
                                            ['1']
                                        ]
                                    }],
                                    removed: false,
                                });
                                this.parsed.sort((f1, f2) => {
                                    return (f1.memo || f1.name) < (f2.memo || f1.name) ? -1 : 1;
                                });
                                this.page = this.file.pages[0] || null;
                            break;
                            case 'rename-file':
                                if (this.modal.values[0] != (this.file.rename || this.file.name)) {
                                    this.file.rename = this.modal.values[0];
                                }
                                this.file.memo = this.modal.values[1];
                                this.parsed.sort((f1, f2) => {
                                    return (f1.memo || f1.name) < (f2.memo || f1.name) ? -1 : 1;
                                });
                            break;
                            case 'new-page':
                                this.file.pages.push(this.page = {
                                    name: this.modal.values[0],
                                    memo: this.modal.values[1] || '',
                                    data: this.checkIsConfigPage(this.modal.values[0]) ? [
                                        ['_id', 'memo', 'type', 'value'],
                                        ['string', 'ignore', 'type', 'value'],
                                        ['参数名', '描述', '类型', '值'],
                                    ] : [
                                        ['_id'],
                                        ['string'],
                                        ['编号'],
                                        ['#MEMO'],
                                        ['1']
                                    ]
                                });
                            break;
                            case 'rename-page':
                                this.page.name = this.modal.values[0];
                                this.page.memo = this.modal.values[1] || '';
                                if (this.file.name != this.modal.values[2]) {
                                    this.file.pages.splice(this.file.pages.indexOf(this.page), 1);
                                    this.file = this.parsed.find(file => file.name == this.modal.values[2]);
                                    this.file.pages.push(this.page);
                                }
                                if (this.file.pages.indexOf(this.page) != this.modal.values[3]) {
                                    this.file.pages.splice(this.modal.values[3], 0, ...this.file.pages.splice(this.file.pages.indexOf(this.page), 1));
                                }
                            break;
                        }
                        
                        this.modal.show = false;
                    },
                    modalClose() {
                        this.modal.show = false;
                    },
                    checkIsConfigPage(name: string) {
                        return name.endsWith('config');
                    },
                    async exportToProject() {
                        if (this.duplicatedFileNames.length > 0 || this.duplicatedPageNames.length > 0 || this.duplicatedKeys.length > 0 || this.duplicatedRows.length > 0) {
                            return this.alert('当前存在重复的文件名，表名，或某些表内存在相同的参数名或相同_id的项，请修改后再导出。');
                        }
                        setting.path = this.path;
                        ++setting.version;
                        this.saveSetting();

                        type KV = {[key: string]: number | string | KV};

                        let list: {[key: string]: number | string | KV} = {
                            version: setting.version
                        };

                        const intfs: {[key: string]: KV | string} = {};
                        const annos: {[key: string]: KV | string} = {};

                        await Promise.all(this.parsed.map(async xls => {
                            return Promise.all(xls.pages.map(async page => {
                                if (page.name.startsWith('ignore_') || !page.data[1]) {
                                    return;
                                }

                                const intf = intfs[page.name] = {};
                                const anno = annos[page.name] = {};
                                const json = list[page.name] = {};

                                if (this.checkIsConfigPage(page.name)) {
                                    const memoIdx = page.data[0].indexOf('memo');
                                    const typeIdx = page.data[0].indexOf('type');
                                    const valIdx = page.data[0].indexOf('value');

                                    return Promise.all(page.data.slice(3).map(async data => {
                                        const key = data[0];
                                        if (key) {
                                            const typeString = data[typeIdx];
                                            const parser = new TypeParser(typeString, key);
                                            intf[key] = parser.TypeStringTS;
                                            anno[key] = data[memoIdx];
                                            json[key] = await parser.ParseAndReplaceAsset(data[valIdx]);
                                        }
                                    }));
                                }
                                else {
                                    const typeParsers: TypeParser[] = page.data[1].filter(t => !!t).map((t, idx) => {
                                        switch(t) {
                                            case 'ignore':
                                                return null;
                                            case 'enum':{
                                                const enumList: string[] = [];
                                                for (let i = 4;i < page.data.length;++i) {
                                                    const key = page.data[i][idx];
                                                    key && !enumList.includes(key) && enumList.push(key);
                                                }
                                                return new TypeParser(t, page.data[0][idx], enumList);
                                            }
                                            default:
                                                return new TypeParser(t, page.data[0][idx]);
                                        }
                                    });

                                    page.data[0].forEach((key, idx) => {
                                        if (!typeParsers[idx]) {
                                            return;
                                        }
                                        intf[key] = typeParsers[idx].TypeStringTS;
                                        anno[key] = page.data[2][idx];
                                    });

                                    return Promise.all(page.data.slice(4).map(async data => {
                                        const key = data[0];
                                        if (key) {
                                            json[key] = {};
                                            return Promise.all(data.map(async (val, idx) => {
                                                if (!typeParsers[idx] || typeParsers[idx].isIgnore) {
                                                    return;
                                                }
                                                json[key][page.data[0][idx]] = await typeParsers[idx].ParseAndReplaceAsset(val);
                                            }));
                                        }
                                    }));
                                }
                            }));
                        }))

                        // this.parsed.forEach(async xls => {
                        //     xls.pages.forEach(async page => {
                        //         if (page.name.startsWith('ignore_') || !page.data[1]) {
                        //             return;
                        //         }

                        //         const intf = intfs[page.name] = {};
                        //         const anno = annos[page.name] = {};
                        //         const json = list[page.name] = {};

                        //         if (this.checkIsConfigPage(page.name)) {
                        //             const memoIdx = page.data[0].indexOf('memo');
                        //             const typeIdx = page.data[0].indexOf('type');
                        //             const valIdx = page.data[0].indexOf('value');
                        //             for (let i = 3;i < page.data.length;++i) {
                        //                 const data = page.data[i];
                        //                 const key = data[0];
                        //                 if (key) {
                        //                     const typeString = data[typeIdx];
                        //                     const parser = new TypeParser(typeString, key);
                        //                     intf[key] = parser.TypeStringTS;
                        //                     anno[key] = data[memoIdx];
                        //                     json[key] = parser.Parse(data[valIdx]);
                        //                 }
                        //             }
                        //         }
                        //         else {
                        //             const typeParsers: TypeParser[] = page.data[1].filter(t => !!t).map((t, idx) => {
                        //                 switch(t) {
                        //                     case 'ignore':
                        //                         return null;
                        //                     case 'enum':{
                        //                         const enumList: string[] = [];
                        //                         for (let i = 4;i < page.data.length;++i) {
                        //                             const key = page.data[i][idx];
                        //                             key && !enumList.includes(key) && enumList.push(key);
                        //                         }
                        //                         return new TypeParser(t, page.data[0][idx], enumList);
                        //                     }
                        //                     default:
                        //                         return new TypeParser(t, page.data[0][idx]);
                        //                 }
                        //             });

                        //             page.data[0].forEach((key, idx) => {
                        //                 if (!typeParsers[idx]) {
                        //                     return;
                        //                 }
                        //                 intf[key] = typeParsers[idx].TypeStringTS;
                        //                 anno[key] = page.data[2][idx];
                        //             });

                        //             for (let i = 4;i < page.data.length;++i) {
                        //                 const data = page.data[i];
                        //                 const key = data[0];
                        //                 if (key) {
                        //                     json[key] = {};
                        //                     data.forEach((val, idx) => {
                        //                         if (!typeParsers[idx] || typeParsers[idx].isIgnore) {
                        //                             return;
                        //                         }
                        //                         json[key][page.data[0][idx]] = typeParsers[idx].Parse(val);
                        //                     });
                        //                 }
                        //             }
                        //         }
                        //     });
                        // });

                        const helper = render(helperTemp, {intfs, list, annos});

                        await Editor.Message.request('asset-db', 'create-asset', EXPORT_JSON_PATH, JSON.stringify(list), {overwrite: true});
                        await Editor.Message.request('asset-db', 'create-asset', EXPORT_HELPER_PATH, helper, {overwrite: true});

                        this.alert('导入完成，版本：' + setting.version, '导入完成', 'info');
                    },
                    async alert(detail: string, title='出现问题', level = 'warn') {
                        return Editor.Dialog[level](title, {
                            detail: detail,
                            buttons: ['确认']
                        });
                    },
                    async confirm(detail: string, title: string = '请确认') {
                        const code = await Editor.Dialog.warn(title, {
                            detail,
                            buttons: ['确认', '取消']
                        });
                        return code.response == 0;
                    }
                },
                computed: {
                    memoIndex() {
                        let idx = this.page.data[0].indexOf('name');
                        if (idx == -1) {
                            idx = this.page.data[0].indexOf('memo');
                        }
                        return idx;
                    },
                    duplicatedFileNames() {
                        const names = this.parsed.map(file => file.rename || file.name);
                        return names.filter(name => names.indexOf(name) != names.lastIndexOf(name));
                    },
                    duplicatedPageNames() {
                        const pages: string[] = [];
                        this.parsed.forEach(file => file.pages.forEach(page => pages.push(page.name)));
                        return pages.filter(page => pages.indexOf(page) != pages.lastIndexOf(page));
                    },
                    duplicatedKeys() {
                        const keys: string[][] = [];
                        this.parsed.forEach(file => {
                            file.pages.forEach(page => {
                                page.data[0].forEach(key => {
                                    if (page.data[0].indexOf(key) != page.data[0].lastIndexOf(key)) {
                                        keys.push([file.name, page.name, key]);
                                    }
                                });
                            });
                        });
                        return keys;
                    },
                    duplicatedRows() {
                        const rows: string[][] = [];
                        this.parsed.forEach(file => {
                            file.pages.forEach(page => {
                                const ids: string[] = page.data.slice(4).map(d => d[0]);
                                ids.forEach(_id => {
                                    if (ids.indexOf(_id) != ids.lastIndexOf(_id)) {
                                        rows.push([file.name, page.name, _id]);
                                    }
                                });
                            });
                        });
                        return rows;
                    },
                    canMoveUp() {
                        if (this.isConfigPage) {
                            return this.rowIndex > 0;
                        }
                        switch(this.editMode) {
                            case 0:
                                return this.keyIndex > 1;
                            case 1:
                                return this.rowIndex > 0;
                        }
                        return false;
                    },
                    canMoveDown() {
                        if (this.isConfigPage) {
                            return this.rowIndex < this.page.data.length - 4;
                        }
                        switch(this.editMode) {
                            case 0:
                                return this.keyIndex != 0 && this.keyIndex < this.page.data[0].length - 1;
                            case 1:
                                return this.rowIndex < this.page.data.length - 5;
                        }
                        return false;
                    },
                    canRemove() {
                        if (this.isConfigPage) {
                            return true;
                        }
                        switch(this.editMode) {
                            case 0:
                                return this.keyIndex != 0;
                            case 1:
                                return this.page.data.length > 5;
                        }
                        return false;
                    },
                    parser() {
                        const parser = this.parsers[this.isConfigPage ? this.rowIndex : this.keyIndex];
                        return parser;
                    },
                    ks() {
                        const ks = {
                            memos: {},
                            keys: {}
                        };
                        this.parsed.forEach(file => {
                            file.pages.forEach(page => {
                                const k = underlineToHump(`T_${page.name}_key`);
                                const nameIdx = page.data[0].indexOf('name');
                                const memoIdx = page.data[0].indexOf('memo');
                                ks.keys[k] = {};
                                page.data.slice(4).forEach(d => {
                                    ks.keys[k][d[0]] = (nameIdx >= 0 ? d[nameIdx] : memoIdx >= 0 ? d[memoIdx] : d[0]) || d[0];
                                });
                                ks.memos[k] = page.memo || k;
                            });
                        });
                        return ks;
                    },
                    updatedType() {
                        if (!this.parser) {
                            return '';
                        }
                        const origin = this.isConfigPage ? this.page.data[this.rowIndex + 3][2] : this.page.data[1][this.keyIndex];
                        if (this.parser.TypeString != origin) {
                            if (!this.parser.isJSON && (this.parser.encodedValue.startsWith('{') || this.parser.encodedValue.startsWith('[{'))) {
                                this.parser.encodedValue = this.parser.Encode(this.parser.parsedValue);
                            }
                            else {
                                this.parser.parsedValue = this.parser.Parse(this.parser.encodedValue);
                                this.parser.encodedValue = this.parser.Encode(this.parser.parsedValue);
                            }
                        }

                        if (this.isConfigPage) {
                            return this.page.data[this.rowIndex + 3][2] = this.parser.TypeString;
                        }
                        else {
                            return this.page.data[1][this.keyIndex] = this.parser.TypeString;
                        }
                    },
                    encodedValue() {
                        if (!this.parser) {
                            return '';
                        }
                        return this.parser.Encode(this.parser.parsedValue);
                    },
                    parsedValue() {
                        if (!this.parser) {
                            return '';
                        }
                        if (this.parser.encodedValue != this.encodedValue) {
                            this.parser.encodedValue = this.encodedValue;
                        }
                        return JSON.stringify(this.parser.parsedValue);
                    },
                    updatedPage() {
                        if (!this.page) {
                            return;
                        }
                        if (this.isConfigPage) {
                            this.parsers.forEach((parser: TypeParser, idx: number) => {
                                this.page.data[idx + 3][0] = parser.TypeKey;
                                this.page.data[idx + 3][1] = parser.TypeMemo;
                                this.page.data[idx + 3][2] = parser.TypeString;
                                this.page.data[idx + 3][3] = parser.encodedValue = parser.Encode(parser.parsedValue);
                            });
                        }
                        else {
                            this.parsers.forEach((parser: TypeParser, idx: number) => {
                                this.page.data[0][idx] = parser.TypeKey;
                                this.page.data[1][idx] = parser.TypeString;
                                this.page.data[2][idx] = parser.TypeMemo;
                                this.page.data[this.rowIndex + 4][idx] = parser.encodedValue = parser.Encode(parser.parsedValue);
                            });
                        }
                        return this.page;
                    },
                    isConfigPage() {
                        return this.page && this.checkIsConfigPage(this.page.name);
                    }
                },
                watch: {
                    page() {
                        this.updateParser();
                    },
                    rowIndex() {
                        !this.isConfigPage && this.updateParser();
                    }
                },
                mounted() {
                    this.updateParser();
                },
            });
            app.config.compilerOptions.isCustomElement = (tag) => tag.startsWith('ui-');
            app.component('type-parser', {
                template: readFileSync(join(__dirname, '../../../static/template/vue/type-parser.html'), 'utf-8'),
                props: {
                    parser: {
                        type: TypeParser,
                        default: null
                    },
                    ks: {
                        default: {
                            memos: {},
                            keys: {}
                        }
                    },
                    mode: {
                        type: Number,
                        default: 0
                    }
                },
                methods: {
                    setBaseType(type: string) {
                        ['quot', 'number', 'string', 'enum', 'hash', 'ignore', 'grid', 'asset', 'color', 'text'].forEach(key => {
                            this.parser['is' + key[0].toUpperCase() + key.slice(1)] = key == type;
                        });
                        if (type == 'hash' && this.parser.hashKeyTypeParsers.length == 0) {
                            this.parser.hashKeyTypeParsers.push(new TypeParser('string', 'NewKey'));
                        }
                        if (type == 'enum' && this.parser.enumKeys.length == 0) {
                            this.parser.enumKeys.push('new_enum_key');
                        }
                        if (['enum', 'hash', 'grid'].includes(type)) {
                            this.parser.type = '';
                        }
                        if (type == 'asset') {
                            this.parser.type = 'cc.ImageAsset';
                        }
                        // this.parser.parsedValue = this.parser.NewValue;
                        // this.parser.encodedValue = this.parser.Encode(this.parser.parsedValue);
                    },
                    setTypeParser(key: string, value: any) {
                        this.parser[key] = value;
                        // this.parser.encodedValue = this.parser.Encode(this.parser.parsedValue = this.parser.Parse(this.parser.encodedValue));
                    },
                    newTypeParser(idx: number) {
                        this.parser.hashKeyTypeParsers.splice(idx + 1, 0, new TypeParser('string', 'NewKey'));
                    },
                    removeTypeParser(idx: number) {
                        this.parser.hashKeyTypeParsers.splice(idx, 1);
                    },
                    setEnumKey(idx: number, key: string) {
                        const memo = this.parser.enumKeys[idx].split('@')[1];
                        this.parser.enumKeys[idx] = key + (memo ? '@' + memo : '');
                    },
                    setEnumMemo(idx: number, memo: string) {
                        const key = this.parser.enumKeys[idx].split('@')[0];
                        this.parser.enumKeys[idx] = key + (memo ? '@' + memo : '');
                    },
                    newEnumKey(idx: number) {
                        this.parser.enumKeys.splice(idx + 1, 0, 'new_enum_key');
                    },
                    removeEnumKey(idx: number) {
                        this.parser.enumKeys.splice(idx, 1);
                    },
                },
                computed: {
                    baseType() {
                        if (!this.parser) {
                            return '';
                        }
                        return this.parser.isQuot ? 'quot' :
                            this.parser.isNumber ? 'number' :
                            this.parser.isString ? 'string' :
                            this.parser.isEnum ? 'enum' :
                            this.parser.isHash ? 'hash' : 
                            this.parser.isIgnore ? 'ignore' : 
                            this.parser.isGrid ? 'grid' :
                            this.parser.isAsset ? 'asset' : 
                            this.parser.isColor ? 'color': 
                            this.parser.isText ? 'text': '';
                    },
                    ksKeys() {
                        return Object.keys(this.ks.keys);
                    }
                }
            });
            app.component('value-modifier', {
                template: readFileSync(join(__dirname, '../../../static/template/vue/value-modifier.html'), 'utf-8'),
                props: {
                    parser: {
                        type: TypeParser,
                        default: null
                    },
                    ks: {
                        default: {
                            memos: {},
                            keys: {}
                        }
                    },
                    mode: {
                        type: Number,
                        default: 0
                    },
                    val: {
                        default: null
                    }
                },
                methods: {
                    newArrayItem(idx: number) {
                        if (idx < 0) {
                            this.parsedVal.push(this.parser.NewItem);
                            return;
                        }
                        this.parsedVal.splice(idx + 1, 0, clone(this.parsedVal[idx]));
                    },
                    removeArrayItem(idx: number) {
                        this.parsedVal.splice(idx, 1);
                    },
                    setVal(key: string, val, idx = -1) {
                        if (this.parser.isColor) {
                            val = typeof val == 'string' ? JSON.parse(val) : val;
                            val = '#' + val.map((v: number) => v.toString(16).padStart(2, '0')).join('');
                        }
                        if (!this.val) {
                            if (idx == -1) {
                                this.parser.parsedValue = val;
                            }
                            else {
                                if (this.parser.isGrid) {
                                    this.parser.parsedValue ^= 1 << idx;
                                }
                                else {
                                    this.parser.parsedValue[idx] = val;
                                }
                            }
                            // this.parser.encodedValue = this.parser.Encode(this.parser.parsedValue);
                        }
                        else if (idx == -1) {
                            this.val[key] = val;
                        }
                        else {
                            this.val[key] = [].concat(this.val[key]);
                            this.val[key][idx] = val;
                        }
                    },
                },
                computed: {
                    parsedVal() {
                        if (!this.parser) {
                            return '';
                        }
                        return this.val ? this.val[this.parser.TypeKey] : this.parser.parsedValue;
                    },
                    ksItems() {
                        if (!this.parser) {
                            return {};
                        }
                        return Object.keys(this.ks.keys[this.parser.type] || {});
                    }
                }
            });
            app.mount(this.$.app);
            panelDataMap.set(this, app);
        }
    },
    beforeClose() { },
    close() {
        const app = panelDataMap.get(this);
        if (app) {
            app.unmount();
        }
    },
});
