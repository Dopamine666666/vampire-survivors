"use strict";
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_extra_1 = require("fs-extra");
const path_1 = require("path");
const vue_1 = require("vue");
const ejs_1 = require("ejs");
// const xlsx = require('../../../node_modules/node-xlsx/dist/index.cjs');
// const { parse } = xlsx;
const node_xlsx_1 = require("node-xlsx");
const EXPORT_HELPER_PATH = 'db://assets/scripts/helpers/GameConfig.ts';
const EXPORT_JSON_PATH = 'db://assets/resources/data/game-config.json';
const underlineToHump = string => string.replace(/\_(\w)/g, (_, char) => char.toUpperCase());
const humpToUnderline = string => string.replace(/([A-Z])/g, '_$1').toLowerCase();
const clone = obj => {
    if (typeof obj != 'object') {
        return obj;
    }
    const cloned = obj.constructor == Array ? [] : {};
    for (let key in obj) {
        cloned[key] = clone(obj[key]);
    }
    return cloned;
};
class TypeParser {
    constructor(typeString, typeKey, enumKeys) {
        this.isNumber = false;
        this.isString = false;
        this.isArray = false;
        this.isHash = false;
        this.isEnum = false;
        this.isAutoEnum = false;
        this.isJSON = false;
        this.isIgnore = false;
        this.isQuot = false;
        this.isGrid = false;
        this.isAsset = false;
        this.isColor = false;
        this.isTranslate = false;
        this.isText = false;
        this.enumKeys = [];
        this.gridSize = [3, 3];
        // hashKeys: string[] = [];
        this.hashKeyTypeParsers = [];
        this.arrayKeyType = '';
        this.type = '';
        this.typeKey = '';
        this.encodedValue = '';
        this.parsedValue = null;
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
        while ((firstSplit = typeString.indexOf('#')) != -1) {
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
            if (this.isArray)
                this.arrayKeyType = 'number';
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
            while (typeString != '') {
                let keySplit = typeString.indexOf(':');
                if (keySplit == -1) {
                    break;
                }
                let typeKey = typeString.substring(0, keySplit);
                typeString = typeString.slice(keySplit + 1);
                if (typeString.startsWith('[')) {
                    let count = 1;
                    let endSplit = -1;
                    for (let i = 1; i < typeString.length; ++i) {
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
            let kvs = [];
            this.hashKeyTypeParsers.forEach((parser, idx) => {
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
        if (this.isHash) {
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
    _parse(valueString) {
        if (this.isJSON) {
            try {
                return JSON.parse(valueString);
            }
            catch (e) {
                console.log('parse json failed,parse as encode string');
            }
        }
        if (this.isText) {
            return valueString;
        }
        if (this.isArray) {
            if (this.isHash) {
                const arr = [];
                let arrIdx = 0;
                let keyIdx = 0;
                while (valueString.length > 0) {
                    arr[arrIdx] = arr[arrIdx] || {};
                    if (valueString.startsWith('[')) {
                        let count = 1;
                        let endSplit = -1;
                        for (let i = 1; i < valueString.length; ++i) {
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
            const ret = {};
            let idx = 0;
            while (valueString.length > 0) {
                if (valueString.startsWith('[')) {
                    let count = 1;
                    let endSplit = -1;
                    for (let i = 1; i < valueString.length; ++i) {
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
    Parse(valueString) {
        if (!valueString) {
            return this.NewValue;
        }
        try {
            return this._parse(valueString);
        }
        catch (e) {
            return this.NewValue;
        }
    }
    async ParseAndReplaceAsset(valueString) {
        valueString = valueString || '';
        if (this.isJSON) {
            try {
                return JSON.parse(valueString);
            }
            catch (e) {
                console.log('parse json failed,parse as encode string');
            }
        }
        if (this.isText) {
            return valueString;
        }
        if (this.isArray) {
            if (this.isHash) {
                const arr = [];
                let arrIdx = 0;
                let keyIdx = 0;
                while (valueString.length > 0) {
                    arr[arrIdx] = arr[arrIdx] || {};
                    if (valueString.startsWith('[')) {
                        let count = 1;
                        let endSplit = -1;
                        for (let i = 1; i < valueString.length; ++i) {
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
            while (url.length > 0 && url[0] != 'bundles') {
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
            const ret = {};
            let idx = 0;
            while (valueString.length > 0) {
                if (valueString.startsWith('[')) {
                    let count = 1;
                    let endSplit = -1;
                    for (let i = 1; i < valueString.length; ++i) {
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
        let str = [];
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
            let hashKvs = [];
            this.hashKeyTypeParsers.forEach((parser, idx) => {
                const sub = parser.TypeString;
                hashKvs.push(`${parser.typeKey}:${sub.indexOf('#') == -1 ? sub : '[' + sub + ']'}`);
            });
            str.push(hashKvs.join('|'));
        }
        return str.join('#');
    }
    Encode(value, isSub = false) {
        if (this.isJSON) {
            return JSON.stringify(value);
        }
        if (this.isHash) {
            const arr = [];
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
            const ret = {};
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
            const ret = {};
            this.hashKeyTypeParsers.forEach(psr => {
                ret[psr.TypeKey] = psr.NewValue;
            });
            return ret;
        }
        return this.isNumber || this.isGrid ? 0 : '';
    }
}
const panelDataMap = new WeakMap();
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
    template: (0, fs_extra_1.readFileSync)((0, path_1.join)(__dirname, '../../../static/template/default/index.html'), 'utf-8'),
    style: (0, fs_extra_1.readFileSync)((0, path_1.join)(__dirname, '../../../static/style/default/index.css'), 'utf-8'),
    $: {
        app: '#app',
    },
    ready() {
        if (this.$.app) {
            const helperTemp = (0, fs_extra_1.readFileSync)((0, path_1.join)(__dirname, '../../../template/helper.ts.ejs'), 'utf-8');
            const settingPath = (0, path_1.join)(__dirname, '../../../setting/setting.json');
            const setting = (0, fs_extra_1.readJSONSync)(settingPath);
            const path = setting.path && (0, fs_extra_1.existsSync)(setting.path) ? setting.path : '';
            const jsonpath = setting.jsonpath && (0, fs_extra_1.existsSync)(setting.jsonpath) ? setting.jsonpath : '';
            let list = [];
            let parsed = [];
            if (jsonpath && (0, fs_extra_1.existsSync)((0, path_1.join)(jsonpath, 'GameConfig.json'))) {
                parsed = (0, fs_extra_1.readJSONSync)((0, path_1.join)(jsonpath, 'GameConfig.json'), 'utf-8');
                list = parsed.map(file => file.name);
            }
            else if (path) {
                list = (0, fs_extra_1.readdirSync)(setting.path).filter(filename => !filename.startsWith('~$') && (0, path_1.extname)(filename).startsWith('.xls'));
                parsed = list.map(file => {
                    const origin_name = file;
                    file = (0, path_1.basename)(file, (0, path_1.extname)(file));
                    return {
                        origin_name,
                        name: file.indexOf('@') != -1 ? file.substring(0, file.indexOf('@')) : file,
                        memo: file.indexOf('@') != -1 ? file.slice(file.indexOf('@') + 1) : '',
                        pages: (0, node_xlsx_1.parse)((0, path_1.join)(path, file + '.xlsx')).map(page => ({ name: page.name.split('@')[0], memo: page.name.split('@')[1] || '', data: page.data })),
                        rename: '',
                        removed: false,
                    };
                });
            }
            parsed.sort((f1, f2) => {
                return (f1.memo || f1.name) < (f2.memo || f1.name) ? -1 : 1;
            });
            const file = parsed[0] || null;
            const page = file ? file.pages[0] : null;
            const app = (0, vue_1.createApp)({
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
                            values: [],
                            height: 130,
                        },
                        parsers: [],
                    };
                },
                provide() {
                    return {
                        updateParser: this.updateParser,
                    };
                },
                methods: {
                    saveSetting() {
                        (0, fs_extra_1.writeJSONSync)(settingPath, setting);
                    },
                    setEXCELPath(path) {
                        this.path = setting.path = path;
                        this.saveSetting();
                    },
                    setJSONPath(path) {
                        this.jsonpath = setting.jsonpath = path;
                        this.saveSetting();
                    },
                    async importEXCEL() {
                        if (!this.path || !(0, fs_extra_1.existsSync)(this.path)) {
                            return this.alert('路径不存在');
                        }
                        if (this.parsed && this.parsed.length > 0 && !await this.confirm('确定要重新加载文件吗？未保存的更改将永久丢失。')) {
                            return;
                        }
                        this.parsed = (0, fs_extra_1.readdirSync)(this.path).filter(filename => !filename.startsWith('~$') && (0, path_1.extname)(filename).startsWith('.xls')).map(file => {
                            const origin_name = file;
                            file = (0, path_1.basename)(file, (0, path_1.extname)(file));
                            return {
                                origin_name,
                                name: file.indexOf('@') != -1 ? file.substring(0, file.indexOf('@')) : file,
                                memo: file.indexOf('@') != -1 ? file.slice(file.indexOf('@') + 1) : '',
                                pages: (0, node_xlsx_1.parse)((0, path_1.join)(this.path, file + '.xlsx')).map(page => ({
                                    name: page.name.split('@')[0],
                                    memo: page.name.split('@')[1] || '',
                                    data: page.data
                                })),
                                rename: '',
                                removed: false,
                            };
                        });
                        this.parsed.sort((f1, f2) => {
                            return (f1.memo || f1.name) < (f2.memo || f1.name) ? -1 : 1;
                        });
                        this.file = this.parsed[0] || null;
                        this.page = this.file ? this.file.pages[0] : null;
                        this.keyIndex = this.rowIndex = 0;
                    },
                    async combineExcel() {
                        var _a, e_1, _b, _c;
                        if (!this.parsed || this.parsed.length == 0) {
                            return this.importEXCEL();
                        }
                        if (!this.path || !(0, fs_extra_1.existsSync)(this.path)) {
                            return this.alert('路径不存在');
                        }
                        if (!await this.confirm('确定要将EXCEL结构合并到当前项目吗？')) {
                            return;
                        }
                        const files = (0, fs_extra_1.readdirSync)(this.path).filter(filename => !filename.startsWith('~$') && (0, path_1.extname)(filename).startsWith('.xls')).map(origin_name => {
                            const file = (0, path_1.basename)(origin_name, (0, path_1.extname)(origin_name));
                            return {
                                origin_name,
                                name: file.indexOf('@') != -1 ? file.substring(0, file.indexOf('@')) : file,
                                memo: file.indexOf('@') != -1 ? file.slice(file.indexOf('@') + 1) : '',
                                pages: (0, node_xlsx_1.parse)((0, path_1.join)(this.path, file + '.xlsx')).map(page => ({
                                    name: page.name.split('@')[0],
                                    memo: page.name.split('@')[1] || '',
                                    data: page.data
                                }))
                            };
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
                                        for (let i = 3; i < pageData.length; ++i) {
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
                                        const removedIndecies = [];
                                        originPage.data[0].forEach((key, idx) => {
                                            if (!pageData[0].includes(key)) {
                                                removedIndecies.push(idx);
                                            }
                                        });
                                        if (removedIndecies.length > 0) {
                                            for (let i = 0; i < originPage.data.length; ++i) {
                                                originPage.data[i] = originPage.data[i].filter((v, idx) => !removedIndecies.includes(idx));
                                            }
                                        }
                                        pageData[0].forEach((key, idx) => {
                                            if (!originPage.data[0].includes(key)) {
                                                for (let i = 0; i < 4; ++i) {
                                                    originPage.data[i].push(page.data[i][idx]);
                                                }
                                                originPage.data.slice(4).forEach(row => row.push(''));
                                            }
                                            else {
                                                const idx2 = originPage.data[0].indexOf(key);
                                                for (let i = 1; i < 4; ++i) {
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
                                        try {
                                            for (var _d = true, _e = (e_1 = void 0, __asyncValues(pageData.slice(4))), _f; _f = await _e.next(), _a = _f.done, !_a; _d = true) {
                                                _c = _f.value;
                                                _d = false;
                                                let row = _c;
                                                const originRow = originPage.data.slice(4).find(r => r[0] == row[0]);
                                                if (originRow) {
                                                    if (originRow.some((v, i) => row[i] != v)) {
                                                        for (let i = 0; i < row.length; ++i) {
                                                            originRow[i] = row[i];
                                                        }
                                                    }
                                                }
                                                else {
                                                    originPage.data.push(row.slice());
                                                }
                                            }
                                        }
                                        catch (e_1_1) { e_1 = { error: e_1_1 }; }
                                        finally {
                                            try {
                                                if (!_d && !_a && (_b = _e.return)) await _b.call(_e);
                                            }
                                            finally { if (e_1) throw e_1.error; }
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
                            file.origin_name && (0, fs_extra_1.removeSync)((0, path_1.join)(setting.path, file.origin_name));
                            if (file.removed) {
                                continue;
                            }
                            else {
                                if (file.rename) {
                                    file.name = file.rename;
                                    file.rename = '';
                                }
                                const data = (0, node_xlsx_1.build)(file.pages.map(page => ({ name: page.name + (page.memo ? '@' + page.memo : ''), data: page.data })));
                                (0, fs_extra_1.writeFileSync)((0, path_1.join)(setting.path, file.origin_name = file.name + (file.memo ? '@' + file.memo : '') + '.xlsx'), data);
                            }
                        }
                        this.parsed = this.parsed.filter(file => !file.removed);
                        this.alert('文件已保存', '成功');
                    },
                    async importJSON() {
                        if (!this.jsonpath || !(0, fs_extra_1.existsSync)(this.jsonpath)) {
                            return this.alert('路径不存在');
                        }
                        if (this.parsed && this.parsed.length > 0 && !await this.confirm('确定要重新加载文件吗？未保存的更改将永久丢失。')) {
                            return;
                        }
                        this.parsed = (0, fs_extra_1.readJSONSync)((0, path_1.join)(this.jsonpath, 'GameConfig.json'), 'utf-8');
                        this.file = this.parsed[0] || null;
                        this.page = this.file ? this.file.pages[0] : null;
                        this.keyIndex = this.rowIndex = 0;
                    },
                    saveJSON() {
                        if (this.duplicatedFileNames.length > 0 || this.duplicatedPageNames.length > 0 || this.duplicatedKeys.length > 0 || this.duplicatedRows.length > 0) {
                            return this.alert('当前存在重复的文件名，表名，或某些表内存在相同的参数名或相同_id的项，请修改后再保存。');
                        }
                        if (!this.jsonpath || !(0, fs_extra_1.existsSync)(this.jsonpath)) {
                            return this.alert('路径不存在');
                        }
                        (0, fs_extra_1.writeFileSync)((0, path_1.join)(this.jsonpath, 'GameConfig.json'), JSON.stringify(this.parsed, null, 4), 'utf-8');
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
                        this.page.data.push(this.page.data[0].map((v, idx) => idx == 0 ? 'new_row' : ''));
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
                    modalShow(modalType) {
                        this.modal.type = modalType;
                        this.modal.values = [];
                        this.modal.height = 130;
                        switch (modalType) {
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
                        switch (this.modal.type) {
                            case 'new-file':
                                this.parsed.push(this.file = {
                                    name: this.modal.values[0],
                                    memo: this.modal.values[1],
                                    pages: [{ name: this.modal.values[2], data: this.checkIsConfigPage(this.modal.values[2]) ? [
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
                    checkIsConfigPage(name) {
                        return name.endsWith('config');
                    },
                    async exportToProject() {
                        if (this.duplicatedFileNames.length > 0 || this.duplicatedPageNames.length > 0 || this.duplicatedKeys.length > 0 || this.duplicatedRows.length > 0) {
                            return this.alert('当前存在重复的文件名，表名，或某些表内存在相同的参数名或相同_id的项，请修改后再导出。');
                        }
                        setting.path = this.path;
                        ++setting.version;
                        this.saveSetting();
                        let list = {
                            version: setting.version
                        };
                        const intfs = {};
                        const annos = {};
                        await Promise.all(this.parsed.map(async (xls) => {
                            return Promise.all(xls.pages.map(async (page) => {
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
                                    return Promise.all(page.data.slice(3).map(async (data) => {
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
                                    const typeParsers = page.data[1].filter(t => !!t).map((t, idx) => {
                                        switch (t) {
                                            case 'ignore':
                                                return null;
                                            case 'enum': {
                                                const enumList = [];
                                                for (let i = 4; i < page.data.length; ++i) {
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
                                    return Promise.all(page.data.slice(4).map(async (data) => {
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
                        }));
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
                        const helper = (0, ejs_1.render)(helperTemp, { intfs, list, annos });
                        await Editor.Message.request('asset-db', 'create-asset', EXPORT_JSON_PATH, JSON.stringify(list), { overwrite: true });
                        await Editor.Message.request('asset-db', 'create-asset', EXPORT_HELPER_PATH, helper, { overwrite: true });
                        this.alert('导入完成，版本：' + setting.version, '导入完成', 'info');
                    },
                    async alert(detail, title = '出现问题', level = 'warn') {
                        return Editor.Dialog[level](title, {
                            detail: detail,
                            buttons: ['确认']
                        });
                    },
                    async confirm(detail, title = '请确认') {
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
                        const pages = [];
                        this.parsed.forEach(file => file.pages.forEach(page => pages.push(page.name)));
                        return pages.filter(page => pages.indexOf(page) != pages.lastIndexOf(page));
                    },
                    duplicatedKeys() {
                        const keys = [];
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
                        const rows = [];
                        this.parsed.forEach(file => {
                            file.pages.forEach(page => {
                                const ids = page.data.slice(4).map(d => d[0]);
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
                        switch (this.editMode) {
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
                        switch (this.editMode) {
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
                        switch (this.editMode) {
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
                            this.parsers.forEach((parser, idx) => {
                                this.page.data[idx + 3][0] = parser.TypeKey;
                                this.page.data[idx + 3][1] = parser.TypeMemo;
                                this.page.data[idx + 3][2] = parser.TypeString;
                                this.page.data[idx + 3][3] = parser.encodedValue = parser.Encode(parser.parsedValue);
                            });
                        }
                        else {
                            this.parsers.forEach((parser, idx) => {
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
                template: (0, fs_extra_1.readFileSync)((0, path_1.join)(__dirname, '../../../static/template/vue/type-parser.html'), 'utf-8'),
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
                    setBaseType(type) {
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
                    setTypeParser(key, value) {
                        this.parser[key] = value;
                        // this.parser.encodedValue = this.parser.Encode(this.parser.parsedValue = this.parser.Parse(this.parser.encodedValue));
                    },
                    newTypeParser(idx) {
                        this.parser.hashKeyTypeParsers.splice(idx + 1, 0, new TypeParser('string', 'NewKey'));
                    },
                    removeTypeParser(idx) {
                        this.parser.hashKeyTypeParsers.splice(idx, 1);
                    },
                    setEnumKey(idx, key) {
                        const memo = this.parser.enumKeys[idx].split('@')[1];
                        this.parser.enumKeys[idx] = key + (memo ? '@' + memo : '');
                    },
                    setEnumMemo(idx, memo) {
                        const key = this.parser.enumKeys[idx].split('@')[0];
                        this.parser.enumKeys[idx] = key + (memo ? '@' + memo : '');
                    },
                    newEnumKey(idx) {
                        this.parser.enumKeys.splice(idx + 1, 0, 'new_enum_key');
                    },
                    removeEnumKey(idx) {
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
                                                        this.parser.isColor ? 'color' :
                                                            this.parser.isText ? 'text' : '';
                    },
                    ksKeys() {
                        return Object.keys(this.ks.keys);
                    }
                }
            });
            app.component('value-modifier', {
                template: (0, fs_extra_1.readFileSync)((0, path_1.join)(__dirname, '../../../static/template/vue/value-modifier.html'), 'utf-8'),
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
                    newArrayItem(idx) {
                        if (idx < 0) {
                            this.parsedVal.push(this.parser.NewItem);
                            return;
                        }
                        this.parsedVal.splice(idx + 1, 0, clone(this.parsedVal[idx]));
                    },
                    removeArrayItem(idx) {
                        this.parsedVal.splice(idx, 1);
                    },
                    setVal(key, val, idx = -1) {
                        if (this.parser.isColor) {
                            val = typeof val == 'string' ? JSON.parse(val) : val;
                            val = '#' + val.map((v) => v.toString(16).padStart(2, '0')).join('');
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zb3VyY2UvcGFuZWxzL2RlZmF1bHQvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7O0FBQUEsdUNBQXFJO0FBQ3JJLCtCQUErQztBQUMvQyw2QkFBa0Q7QUFDbEQsNkJBQTZCO0FBQzdCLDBFQUEwRTtBQUMxRSwwQkFBMEI7QUFDMUIseUNBQXlDO0FBRXpDLE1BQU0sa0JBQWtCLEdBQUcsMkNBQTJDLENBQUM7QUFDdkUsTUFBTSxnQkFBZ0IsR0FBRyw2Q0FBNkMsQ0FBQztBQUV2RSxNQUFNLGVBQWUsR0FBRyxNQUFNLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsU0FBUyxFQUFFLENBQUMsQ0FBQyxFQUFFLElBQUksRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLFdBQVcsRUFBRSxDQUFDLENBQUM7QUFDN0YsTUFBTSxlQUFlLEdBQUcsTUFBTSxDQUFDLEVBQUUsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLFVBQVUsRUFBRSxLQUFLLENBQUMsQ0FBQyxXQUFXLEVBQUUsQ0FBQztBQUVsRixNQUFNLEtBQUssR0FBRyxHQUFHLENBQUMsRUFBRTtJQUNoQixJQUFJLE9BQU8sR0FBRyxJQUFJLFFBQVEsRUFBRSxDQUFDO1FBQ3pCLE9BQU8sR0FBRyxDQUFDO0lBQ2YsQ0FBQztJQUNELE1BQU0sTUFBTSxHQUFRLEdBQUcsQ0FBQyxXQUFXLElBQUksS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztJQUN2RCxLQUFLLElBQUksR0FBRyxJQUFJLEdBQUcsRUFBRSxDQUFDO1FBQ2xCLE1BQU0sQ0FBQyxHQUFHLENBQUMsR0FBRyxLQUFLLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7SUFDbEMsQ0FBQztJQUNELE9BQU8sTUFBTSxDQUFDO0FBQ2xCLENBQUMsQ0FBQTtBQUVELE1BQU0sVUFB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QUFHLENBQUMsRUFBQyxFQUFFLENBQUMsRUFBRSxDQUFDO29EQUN2QixVQUFVLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7Z0RBQy9DLENBQUM7Z0RBQ0QsVUFBVSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDOzRDQUMxRCxDQUFDO2lEQUNJLENBQUM7Z0RBQ0YsTUFBTSxJQUFJLEdBQUcsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUM7Z0RBQzdDLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFDLENBQUMsR0FBRyxDQUFDLEVBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQztvREFDdkIsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUM7Z0RBQ2hELENBQUM7NENBQ0wsQ0FBQzt3Q0FDTCxDQUFDLENBQUMsQ0FBQzt3Q0FFSCxNQUFNLElBQUksR0FBRyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQzt3Q0FFckUsSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUM7NENBQzlCLFVBQVUsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUFF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QUM7NEJBQzlELElBQUksQ0FBQyxRQUFRLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQzs0QkFDdEUsSUFBSSxDQUFDLFlBQVksRUFBRSxDQUFDO3dCQUN4QixDQUFDO29CQUNMLENBQUM7b0JBQ0QsTUFBTTt3QkFDRixJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLEdBQUcsRUFBQyxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO3dCQUNqRixJQUFJLENBQUMsUUFBUSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUM7b0JBQzlDLENBQUM7b0JBQ0QsT0FBTyxDQUFDLE1BQU07d0JBQ1YsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxHQUFHLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLEdBQUcsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxHQUFHLENBQUMsR0FBRyxNQUFNLENBQUMsRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7d0JBQ2xLLElBQUksQ0FBQyxRQUFRLElBQUksTUFBTSxDQUFDO29CQUM1QixDQUFDO29CQUNELEtBQUssQ0FBQyxTQUFTO3dCQUNYLElBQUksTUFBTSxJQUFJLENBQUMsT0FBTyxDQUFDLFVBQVUsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQzs0QkFDMUUsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxRQUFRLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDOzRCQUM1QyxJQUFJLENBQUMsWUFBWSxFQUFFLENBQUM7NEJBQ3BCLElBQUksQ0FBQyxRQUFRLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLFFBQVEsR0FBRyxDQUFDLENBQUMsQ0FBQzt3QkFDbkQsQ0FBQztvQkFDTCxDQUFDO29CQUNELFNBQVM7d0JBQ0wsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsWUFBWSxFQUFFLEtBQUssRUFBRSxRQUFRLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQzt3QkFDMUQsSUFBSSxDQUFDLFFBQVEsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDO3dCQUMxQyxJQUFJLENBQUMsWUFBWSxFQUFFLENBQUM7b0JBQ3hCLENBQUM7b0JBQ0QsVUFBVSxDQUFDLE1BQU07d0JBQ2IsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxHQUFHLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLEdBQUcsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxHQUFHLENBQUMsR0FBRyxNQUFNLENBQUMsRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENB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QUFLLENBQUMsTUFBTSxHQUFHLEdBQUcsQ0FBQztnQ0FDeEIsSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDO2dDQUNyRCxNQUFNOzRCQUNOLEtBQUssYUFBYTtnQ0FDZCxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sR0FBRyxHQUFHLENBQUM7Z0NBQ3hCLElBQUksQ0FBQyxLQUFLLENBQUMsS0FBSyxHQUFHLFVBQVUsQ0FBQztnQ0FDOUIsSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLElBQUksSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUM7Z0NBQzFELElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDO2dDQUMxQyxNQUFNOzRCQUNOLEtBQUssVUFBVTtnQ0FDWCxJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUssR0FBRyxNQUFNLENBQUM7Z0NBQzFCLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxHQUFHLEdBQUcsQ0FBQztnQ0FDeEIsSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDO2dDQUNyRCxNQUFNOzRCQUNOLEtBQUssYUFBYTtnQ0FDZCxJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUssR0FBRyxVQUFVLENBQUM7Z0NBQzlCLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxHQUFHLEdBQUcsQ0FBQztnQ0FDeEIsSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUM7Z0NBQ3RDLElBQUksQ0FBQyxL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LENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDLENBQUM7b0JBQzdELENBQUM7aUJBQ0o7YUFDSixDQUFDLENBQUM7WUFDSCxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUM7WUFDdEIsWUFBWSxDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLENBQUM7UUFDaEMsQ0FBQztJQUNMLENBQUM7SUFDRCxXQUFXLEtBQUssQ0FBQztJQUNqQixLQUFLO1FBQ0QsTUFBTSxHQUFHLEdBQUcsWUFBWSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNuQyxJQUFJLEdBQUcsRUFBRSxDQUFDO1lBQ04sR0FBRyxDQUFDLE9BQU8sRUFBRSxDQUFDO1FBQ2xCLENBQUM7SUFDTCxDQUFDO0NBQ0osQ0FBQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgcmVhZEZpbGVTeW5jLCByZWFkSlNPTlN5bmMsIHdyaXRlSlNPTlN5bmMsIHJlYWRkaXJTeW5jLCBleGlzdHNTeW5jLCByZW1vdmVTeW5jLCByZW5hbWVTeW5jLCB3cml0ZUZpbGVTeW5jIH0gZnJvbSAnZnMtZXh0cmEnO1xyXG5pbXBvcnQgeyBqb2luLCBleHRuYW1lLCBiYXNlbmFtZSB9IGZyb20gJ3BhdGgnO1xyXG5pbXBvcnQgeyBjcmVhdGVBcHAsIEFwcCwgZGVmaW5lUHJvcHMgfSBmcm9tICd2dWUnO1xyXG5pbXBvcnQgeyByZW5kZXIgfSBmcm9tICdlanMnO1xyXG4vLyBjb25zdCB4bHN4ID0gcmVxdWlyZSgnLi4vLi4vLi4vbm9kZV9tb2R1bGVzL25vZGUteGxzeC9kaXN0L2luZGV4LmNqcycpO1xyXG4vLyBjb25zdCB7IHBhcnNlIH0gPSB4bHN4O1xyXG5pbXBvcnQgeyBwYXJzZSwgYnVpbGQgfSBmcm9tICdub2RlLXhsc3gnO1xyXG5cclxuY29uc3QgRVhQT1JUX0hFTFBFUl9QQVRIID0gJ2RiOi8vYXNzZXRzL3NjcmlwdHMvaGVscGVycy9HYW1lQ29uZmlnLnRzJztcclxuY29uc3QgRVhQT1JUX0pTT05fUEFUSCA9ICdkYjovL2Fzc2V0cy9yZXNvdXJjZXMvZGF0YS9nYW1lLWNvbmZpZy5qc29uJztcclxuXHJcbmNvbnN0IHVuZGVybGluZVRvSHVtcCA9IHN0cmluZyA9PiBzdHJpbmcucmVwbGFjZSgvXFxfKFxcdykvZywgKF8sIGNoYXIpID0+IGNoYXIudG9VcHBlckNhc2UoKSk7XHJcbmNvbnN0IGh1bXBUb1VuZGVybGluZSA9IHN0cmluZyA9PiBzdHJpbmcucmVwbGFjZSgvKFtBLVpdKS9nLCAnXyQxJykudG9Mb3dlckNhc2UoKTtcclxuXHJcbmNvbnN0IGNsb25lID0gb2JqID0+IHtcclxuICAgIGlmICh0eXBlb2Ygb2JqICE9ICdvYmplY3QnKSB7XHJcbiAgICAgICAgcmV0dXJuIG9iajtcclxuICAgIH1cclxuICAgIGNvbnN0IGNsb25lZDogYW55ID0gb2JqLmNvbnN0cnVjdG9yID09IEFycmF5ID8gW10gOiB7fTtcclxuICAgIGZvciAobGV0IGtleSBpbiBvYmopIHtcclxuICAgICAgICBjbG9uZWRba2V5XSA9IGNsb25lKG9ialtrZXldKTtcclxuICAgIH1cclxuICAgIHJldHVybiBjbG9uZWQ7XHJcbn1cclxuXHJcbmNsYXNzIFR5cGVQYXJzZXIge1xyXG4gICAgaXNOdW1iZXIgPSBmYWxzZTtcclxuICAgIGlzU3RyaW5nID0gZmFsc2U7XHJcbiAgICBpc0FycmF5ID0gZmFsc2U7XHJcbiAgICBpc0hhc2ggPSBmYWxzZTtcclxuICAgIGlzRW51bSA9IGZhbHNlO1xyXG4gICAgaXNBdXRvRW51bSA9IGZhbHNlO1xyXG4gICAgaXNKU09OID0gZmFsc2U7XHJcbiAgICBpc0lnbm9yZSA9IGZhbHNlO1xyXG4gICAgaXNRdW90ID0gZmFsc2U7XHJcbiAgICBpc0dyaWQgPSBmYWxzZTtcclxuICAgIGlzQXNzZXQgPSBmYWxzZTtcclxuICAgIGlzQ29sb3IgPSBmYWxzZTtcclxuICAgIGlzVHJhbnNsYXRlID0gZmFsc2U7XHJcbiAgICBpc1RleHQgPSBmYWxzZTtcclxuICAgIGVudW1LZXlzOiBzdHJpbmdbXSA9IFtdO1xyXG4gICAgZ3JpZFNpemU6IG51bWJlcltdID0gWzMsIDNdO1xyXG4gICAgLy8gaGFzaEtleXM6IHN0cmluZ1tdID0gW107XHJcbiAgICBoYXNoS2V5VHlwZVBhcnNlcnM6IFR5cGVQYXJzZXJbXSA9IFtdO1xyXG4gICAgYXJyYXlLZXlUeXBlID0gJyc7XHJcbiAgICB0eXBlID0gJyc7XHJcbiAgICB0eXBlS2V5ID0gJyc7XHJcblxyXG4gICAgZW5jb2RlZFZhbHVlID0gJyc7XHJcbiAgICBwYXJzZWRWYWx1ZSA9IG51bGw7XHJcblxyXG4gICAgY29uc3RydWN0b3IodHlwZVN0cmluZzogc3RyaW5nLCB0eXBlS2V5OiBzdHJpbmcsIGVudW1LZXlzPzogc3RyaW5nW10pIHtcclxuICAgICAgICB0aGlzLnR5cGVLZXkgPSB0eXBlS2V5O1xyXG4gICAgICAgIGlmICh0eXBlU3RyaW5nLnN0YXJ0c1dpdGgoJ2dyaWQnKSkge1xyXG4gICAgICAgICAgICB0aGlzLmlzR3JpZCA9IHRydWU7XHJcbiAgICAgICAgICAgIHR5cGVTdHJpbmcgPSB0eXBlU3RyaW5nLnNsaWNlKHR5cGVTdHJpbmcuaW5kZXhPZignIycpICsgMSk7XHJcbiAgICAgICAgICAgIHR5cGVTdHJpbmcuc3BsaXQoJ3wnKS5mb3JFYWNoKCh2LCBpKSA9PiB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmdyaWRTaXplW2ldID0gK3Y7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAodHlwZVN0cmluZy5zdGFydHNXaXRoKCdhc3NldCcpKSB7XHJcbiAgICAgICAgICAgIHRoaXMuaXNBc3NldCA9IHRydWU7XHJcbiAgICAgICAgICAgIHRoaXMudHlwZSA9IHR5cGVTdHJpbmcuc2xpY2UodHlwZVN0cmluZy5pbmRleE9mKCcjJykgKyAxKTtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKHR5cGVTdHJpbmcgPT0gJ2lnbm9yZScpIHtcclxuICAgICAgICAgICAgdGhpcy5pc0lnbm9yZSA9IHRydWU7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgbGV0IGZpcnN0U3BsaXQgPSAtMTtcclxuICAgICAgICB3aGlsZSgoZmlyc3RTcGxpdCA9IHR5cGVTdHJpbmcuaW5kZXhPZignIycpKSAhPSAtMSkge1xyXG4gICAgICAgICAgICBjb25zdCBzdHIgPSB0eXBlU3RyaW5nLnN1YnN0cmluZygwLCBmaXJzdFNwbGl0KTtcclxuICAgICAgICAgICAgaWYgKHN0ciA9PSAnYXJyYXknKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmlzQXJyYXkgPSB0cnVlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGVsc2UgaWYgKHN0ciA9PSAnaGFzaCcpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuaXNIYXNoID0gdHJ1ZTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBlbHNlIGlmIChzdHIgPT0gJ2VudW0nKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmlzRW51bSA9IHRydWU7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgZWxzZSBpZiAoc3RyID09ICdqc29uJykge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5pc0pTT04gPSB0cnVlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGVsc2UgaWYgKHN0ciA9PSAndHJhbnNsYXRlJykge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5pc1RyYW5zbGF0ZSA9IHRydWU7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB0eXBlU3RyaW5nID0gdHlwZVN0cmluZy5zbGljZShmaXJzdFNwbGl0ICsgMSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAodHlwZVN0cmluZyA9PSAndGV4dCcpIHtcclxuICAgICAgICAgICAgdGhpcy5pc1RleHQgPSB0cnVlO1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAoL15UW0EtWmEtejAtOV17MSx9S2V5JC8udGVzdCh0eXBlU3RyaW5nKSkge1xyXG4gICAgICAgICAgICB0aGlzLmlzUXVvdCA9IHRydWU7XHJcbiAgICAgICAgICAgIHRoaXMudHlwZSA9IHR5cGVTdHJpbmc7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmICh0eXBlU3RyaW5nID09ICdudW1iZXInKSB7XHJcbiAgICAgICAgICAgIHRoaXMuaXNOdW1iZXIgPSB0cnVlO1xyXG4gICAgICAgICAgICBpZih0aGlzLmlzQXJyYXkpIHRoaXMuYXJyYXlLZXlUeXBlID0gJ251bWJlcic7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmICh0eXBlU3RyaW5nID09ICdjb2xvcicpIHtcclxuICAgICAgICAgICAgdGhpcy5pc0NvbG9yID0gdHJ1ZTtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKFsnc3RyaW5nJywgJ3RyYW5zbGF0ZSddLmluY2x1ZGVzKHR5cGVTdHJpbmcpKSB7XHJcbiAgICAgICAgICAgIHRoaXMuaXNUcmFuc2xhdGUgPSB0eXBlU3RyaW5nID09ICd0cmFuc2xhdGUnO1xyXG4gICAgICAgICAgICB0aGlzLmlzU3RyaW5nID0gdHJ1ZTtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuICAgICAgICB0aGlzLmVudW1LZXlzID0gZW51bUtleXMgfHwgW107XHJcbiAgICAgICAgaWYgKHR5cGVTdHJpbmcgPT0gJ2VudW0nKSB7XHJcbiAgICAgICAgICAgIHRoaXMuaXNFbnVtID0gdGhpcy5pc0F1dG9FbnVtID0gdHJ1ZTtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICBpZiAodHlwZVN0cmluZy5zdGFydHNXaXRoKCdUJykpIHtcclxuICAgICAgICAgICAgdGhpcy50eXBlID0gdHlwZVN0cmluZztcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKHRoaXMuaXNFbnVtKSB7XHJcbiAgICAgICAgICAgIHRoaXMuZW51bUtleXMgPSB0eXBlU3RyaW5nLnNwbGl0KCd8Jyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2UgaWYgKHRoaXMuaXNIYXNoKSB7XHJcbiAgICAgICAgICAgIHdoaWxlKHR5cGVTdHJpbmcgIT0gJycpIHtcclxuICAgICAgICAgICAgICAgIGxldCBrZXlTcGxpdCA9IHR5cGVTdHJpbmcuaW5kZXhPZignOicpO1xyXG4gICAgICAgICAgICAgICAgaWYgKGtleVNwbGl0ID09IC0xKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBsZXQgdHlwZUtleSA9IHR5cGVTdHJpbmcuc3Vic3RyaW5nKDAsIGtleVNwbGl0KTtcclxuXHJcbiAgICAgICAgICAgICAgICB0eXBlU3RyaW5nID0gdHlwZVN0cmluZy5zbGljZShrZXlTcGxpdCArIDEpO1xyXG5cclxuICAgICAgICAgICAgICAgIGlmICh0eXBlU3RyaW5nLnN0YXJ0c1dpdGgoJ1snKSkge1xyXG4gICAgICAgICAgICAgICAgICAgIGxldCBjb3VudCA9IDE7XHJcbiAgICAgICAgICAgICAgICAgICAgbGV0IGVuZFNwbGl0ID0gLTE7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAxO2kgPCB0eXBlU3RyaW5nLmxlbmd0aDsrK2kpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHR5cGVTdHJpbmdbaV0gPT0gJ1snKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICArK2NvdW50O1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICh0eXBlU3RyaW5nW2ldID09ICddJykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLS1jb3VudDtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChjb3VudCA9PSAwKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZW5kU3BsaXQgPSBpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuaGFzaEtleVR5cGVQYXJzZXJzLnB1c2gobmV3IFR5cGVQYXJzZXIodHlwZVN0cmluZy5zdWJzdHJpbmcoMSwgZW5kU3BsaXQpLCB0eXBlS2V5KSk7XHJcbiAgICAgICAgICAgICAgICAgICAgdHlwZVN0cmluZyA9IHR5cGVTdHJpbmcuc2xpY2UoZW5kU3BsaXQgKyAxKTtcclxuICAgICAgICAgICAgICAgICAgICBpZiAodHlwZVN0cmluZy5zdGFydHNXaXRoKCd8JykpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZVN0cmluZyA9IHR5cGVTdHJpbmcuc2xpY2UoMSk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgbGV0IHZhbFNwbGl0ID0gdHlwZVN0cmluZy5pbmRleE9mKCd8Jyk7XHJcbiAgICAgICAgICAgICAgICAgICAgbGV0IHZhbHVlID0gdmFsU3BsaXQgPT0gLTEgPyB0eXBlU3RyaW5nIDogdHlwZVN0cmluZy5zdWJzdHJpbmcoMCwgdmFsU3BsaXQpO1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuaGFzaEtleVR5cGVQYXJzZXJzLnB1c2gobmV3IFR5cGVQYXJzZXIodmFsdWUsIHR5cGVLZXkpKTtcclxuICAgICAgICAgICAgICAgICAgICB0eXBlU3RyaW5nID0gdmFsU3BsaXQgPT0gLTEgPyAnJyA6IHR5cGVTdHJpbmcuc2xpY2UodmFsU3BsaXQgKyAxKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIGlmICh0aGlzLmlzQXJyYXkpIHtcclxuICAgICAgICAgICAgdGhpcy5hcnJheUtleVR5cGUgPSB0eXBlU3RyaW5nO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBnZXQgVHlwZVN0cmluZ1RTKCkge1xyXG4gICAgICAgIGxldCBlbnVtVHlwZSA9ICcnO1xyXG4gICAgICAgIGxldCBoYXNoVHlwZSA9ICcnO1xyXG4gICAgICAgIGlmICh0aGlzLmlzRW51bSkge1xyXG4gICAgICAgICAgICBlbnVtVHlwZSA9IGBcIiR7dGhpcy5lbnVtS2V5cy5tYXAoa2V5ID0+IGtleS5zcGxpdCgnQCcpWzBdKS5qb2luKCdcIiB8IFwiJyl9XCJgO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIGlmICh0aGlzLmlzSGFzaCkge1xyXG4gICAgICAgICAgICBsZXQga3ZzOiBzdHJpbmdbXSA9IFtdO1xyXG4gICAgICAgICAgICB0aGlzLmhhc2hLZXlUeXBlUGFyc2Vycy5mb3JFYWNoKChwYXJzZXI6IFR5cGVQYXJzZXIsIGlkeCkgPT4ge1xyXG4gICAgICAgICAgICAgICAga3ZzLnB1c2goYHJlYWRvbmx5ICR7cGFyc2VyLlR5cGVLZXl9OiAke3BhcnNlci5UeXBlU3RyaW5nVFN9YCk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICBoYXNoVHlwZSA9IGB7JHtrdnMuam9pbignLCcpfX1gO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAodGhpcy5pc0FycmF5KSB7XHJcbiAgICAgICAgICAgIGlmICh0aGlzLmlzTnVtYmVyKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gJ251bWJlcltdJztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBpZiAodGhpcy5pc1N0cmluZykge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuICdzdHJpbmdbXSc7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgaWYgKHRoaXMuaXNFbnVtKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gYCgke2VudW1UeXBlfSlbXWA7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgaWYgKHRoaXMuaXNIYXNoKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gYCR7aGFzaFR5cGV9W11gO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGlmICh0aGlzLmlzUXVvdCkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGAke3RoaXMudHlwZX1bXWA7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcmV0dXJuIGAke3RoaXMuYXJyYXlLZXlUeXBlfVtdYDtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKHRoaXMuaXNOdW1iZXIgfHwgdGhpcy5pc0dyaWQpIHtcclxuICAgICAgICAgICAgcmV0dXJuICdudW1iZXInO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAodGhpcy5pc1N0cmluZyB8fCB0aGlzLmlzQXNzZXQgfHwgdGhpcy5pc0NvbG9yIHx8IHRoaXMuaXNUZXh0KSB7XHJcbiAgICAgICAgICAgIHJldHVybiAnc3RyaW5nJztcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKHRoaXMuaXNFbnVtKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBlbnVtVHlwZSArICd8IFwiXCInO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAodGhpcy5pc0hhc2gpe1xyXG4gICAgICAgICAgICByZXR1cm4gaGFzaFR5cGU7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiB0aGlzLnR5cGU7XHJcbiAgICB9XHJcblxyXG4gICAgZ2V0IFR5cGVLZXkoKSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMudHlwZUtleS5zcGxpdCgnQCcpWzBdO1xyXG4gICAgfVxyXG5cclxuICAgIGdldCBUeXBlTWVtbygpIHtcclxuICAgICAgICByZXR1cm4gdGhpcy50eXBlS2V5LnNwbGl0KCdAJylbMV0gfHwgJyc7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBfcGFyc2UodmFsdWVTdHJpbmc6IHN0cmluZykge1xyXG4gICAgICAgIGlmICh0aGlzLmlzSlNPTikge1xyXG4gICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIEpTT04ucGFyc2UodmFsdWVTdHJpbmcpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGNhdGNoKGUpIHtcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdwYXJzZSBqc29uIGZhaWxlZCxwYXJzZSBhcyBlbmNvZGUgc3RyaW5nJyk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKHRoaXMuaXNUZXh0KSB7XHJcbiAgICAgICAgICAgIHJldHVybiB2YWx1ZVN0cmluZztcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKHRoaXMuaXNBcnJheSkge1xyXG4gICAgICAgICAgICBpZiAodGhpcy5pc0hhc2gpIHtcclxuICAgICAgICAgICAgICAgIGNvbnN0IGFycjogYW55W10gPSBbXTtcclxuICAgICAgICAgICAgICAgIGxldCBhcnJJZHggPSAwO1xyXG4gICAgICAgICAgICAgICAgbGV0IGtleUlkeCA9IDA7XHJcbiAgICAgICAgICAgICAgICB3aGlsZSh2YWx1ZVN0cmluZy5sZW5ndGggPiAwKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgYXJyW2FycklkeF0gPSBhcnJbYXJySWR4XSB8fCB7fTtcclxuICAgICAgICAgICAgICAgICAgICBpZiAodmFsdWVTdHJpbmcuc3RhcnRzV2l0aCgnWycpKSB7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgY291bnQgPSAxO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgZW5kU3BsaXQgPSAtMTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDE7aSA8IHZhbHVlU3RyaW5nLmxlbmd0aDsrK2kpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICh2YWx1ZVN0cmluZ1tpXSA9PSAnWycpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICArK2NvdW50O1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHZhbHVlU3RyaW5nW2ldID09ICddJykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC0tY291bnQ7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGNvdW50ID09IDApIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZW5kU3BsaXQgPSBpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGFyclthcnJJZHhdW3RoaXMuaGFzaEtleVR5cGVQYXJzZXJzW2tleUlkeF0uVHlwZUtleV0gPSB0aGlzLmhhc2hLZXlUeXBlUGFyc2Vyc1trZXlJZHhdLlBhcnNlKHZhbHVlU3RyaW5nLnN1YnN0cmluZygxLCBlbmRTcGxpdCkpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZVN0cmluZyA9IHZhbHVlU3RyaW5nLnNsaWNlKGVuZFNwbGl0ICsgMSk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB2U3BsaXQgPSB2YWx1ZVN0cmluZy5pbmRleE9mKCd8Jyk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGFTcGxpdCA9IHZhbHVlU3RyaW5nLmluZGV4T2YoJywnKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IHZTdHIgPSAnJztcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHZTcGxpdCA9PSAtMSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGFTcGxpdCAhPSAtMSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIOWNleWFg+e0oFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZTdHIgPSB2YWx1ZVN0cmluZy5zdWJzdHJpbmcoMCwgYVNwbGl0KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIOacgOWQjuS4gOS4qlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZTdHIgPSB2YWx1ZVN0cmluZztcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChhU3BsaXQgIT0gLTEgJiYgYVNwbGl0IDwgdlNwbGl0KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8g5pys57uE5pyA5ZCO5LiA5LiqXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdlN0ciA9IHZhbHVlU3RyaW5nLnN1YnN0cmluZygwLCBhU3BsaXQpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdlN0ciA9IHZhbHVlU3RyaW5nLnN1YnN0cmluZygwLCB2U3BsaXQpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGFyclthcnJJZHhdW3RoaXMuaGFzaEtleVR5cGVQYXJzZXJzW2tleUlkeF0uVHlwZUtleV0gPSB0aGlzLmhhc2hLZXlUeXBlUGFyc2Vyc1trZXlJZHhdLlBhcnNlKHZTdHIpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZVN0cmluZyA9IHZhbHVlU3RyaW5nLnNsaWNlKHZTdHIubGVuZ3RoKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHZhbHVlU3RyaW5nLnN0YXJ0c1dpdGgoJ3wnKSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZVN0cmluZyA9IHZhbHVlU3RyaW5nLnNsaWNlKDEpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICArK2tleUlkeDtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHZhbHVlU3RyaW5nLnN0YXJ0c1dpdGgoJywnKSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZVN0cmluZyA9IHZhbHVlU3RyaW5nLnNsaWNlKDEpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICArK2FycklkeDtcclxuICAgICAgICAgICAgICAgICAgICAgICAga2V5SWR4ID0gMDtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gYXJyO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBjb25zdCBhcnIgPSBTdHJpbmcodmFsdWVTdHJpbmcpLnNwbGl0KCcsJyk7XHJcbiAgICAgICAgICAgIGlmIChhcnIubGVuZ3RoID09IDEgJiYgYXJyWzBdID09PSAnJykge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIFtdO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGlmICh0aGlzLmlzTnVtYmVyKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gYXJyLm1hcCh2ID0+IE51bWJlcih2KSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcmV0dXJuIGFycjtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKHRoaXMuaXNOdW1iZXIgfHwgdGhpcy5pc0dyaWQpIHtcclxuICAgICAgICAgICAgcmV0dXJuIE51bWJlcih2YWx1ZVN0cmluZykgfHwgMDtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKHRoaXMuaXNTdHJpbmcgfHwgdGhpcy5pc0Fzc2V0KSB7XHJcbiAgICAgICAgICAgIHJldHVybiBTdHJpbmcodmFsdWVTdHJpbmcpIHx8ICcnO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAodGhpcy5pc0VudW0pIHtcclxuICAgICAgICAgICAgcmV0dXJuIFN0cmluZyh2YWx1ZVN0cmluZyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmICh0aGlzLmlzSGFzaCkge1xyXG4gICAgICAgICAgICBjb25zdCByZXQ6IGFueSA9IHt9O1xyXG4gICAgICAgICAgICBsZXQgaWR4ID0gMDtcclxuICAgICAgICAgICAgd2hpbGUodmFsdWVTdHJpbmcubGVuZ3RoID4gMCkge1xyXG4gICAgICAgICAgICAgICAgaWYgKHZhbHVlU3RyaW5nLnN0YXJ0c1dpdGgoJ1snKSkge1xyXG4gICAgICAgICAgICAgICAgICAgIGxldCBjb3VudCA9IDE7XHJcbiAgICAgICAgICAgICAgICAgICAgbGV0IGVuZFNwbGl0ID0gLTE7XHJcbiAgICAgICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDE7aSA8IHZhbHVlU3RyaW5nLmxlbmd0aDsrK2kpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHZhbHVlU3RyaW5nW2ldID09ICdbJykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgKytjb3VudDtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAodmFsdWVTdHJpbmdbaV0gPT0gJ10nKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAtLWNvdW50O1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGNvdW50ID09IDApIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbmRTcGxpdCA9IGk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0W3RoaXMuaGFzaEtleVR5cGVQYXJzZXJzW2lkeF0uVHlwZUtleV0gPSB0aGlzLmhhc2hLZXlUeXBlUGFyc2Vyc1tpZHhdLlBhcnNlKHZhbHVlU3RyaW5nLnN1YnN0cmluZygxLCBlbmRTcGxpdCkpO1xyXG4gICAgICAgICAgICAgICAgICAgIHZhbHVlU3RyaW5nID0gdmFsdWVTdHJpbmcuc2xpY2UoZW5kU3BsaXQgKyAxKTtcclxuICAgICAgICAgICAgICAgICAgICBpZiAodmFsdWVTdHJpbmcuc3RhcnRzV2l0aCgnfCcpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlU3RyaW5nID0gdmFsdWVTdHJpbmcuc2xpY2UoMSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICsraWR4O1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGVuZFNwbGl0ID0gdmFsdWVTdHJpbmcuaW5kZXhPZignfCcpO1xyXG4gICAgICAgICAgICAgICAgICAgIHJldFt0aGlzLmhhc2hLZXlUeXBlUGFyc2Vyc1tpZHhdLlR5cGVLZXldID0gdGhpcy5oYXNoS2V5VHlwZVBhcnNlcnNbaWR4XS5QYXJzZShlbmRTcGxpdCA9PSAtMSA/IHZhbHVlU3RyaW5nIDogdmFsdWVTdHJpbmcuc3Vic3RyaW5nKDAsIGVuZFNwbGl0KSk7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKGVuZFNwbGl0ICE9IC0xKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlU3RyaW5nID0gdmFsdWVTdHJpbmcuc2xpY2UoZW5kU3BsaXQgKyAxKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgKytpZHg7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZVN0cmluZyA9ICcnO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICByZXR1cm4gcmV0O1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gU3RyaW5nKHZhbHVlU3RyaW5nKTtcclxuICAgIH1cclxuXHJcbiAgICBQYXJzZSh2YWx1ZVN0cmluZzogc3RyaW5nKSB7XHJcbiAgICAgICAgaWYgKCF2YWx1ZVN0cmluZykge1xyXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5OZXdWYWx1ZTtcclxuICAgICAgICB9XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX3BhcnNlKHZhbHVlU3RyaW5nKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgY2F0Y2goZSkge1xyXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5OZXdWYWx1ZTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgYXN5bmMgUGFyc2VBbmRSZXBsYWNlQXNzZXQodmFsdWVTdHJpbmc6IHN0cmluZykge1xyXG4gICAgICAgIHZhbHVlU3RyaW5nID0gdmFsdWVTdHJpbmcgfHwgJyc7XHJcbiAgICAgICAgaWYgKHRoaXMuaXNKU09OKSB7XHJcbiAgICAgICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gSlNPTi5wYXJzZSh2YWx1ZVN0cmluZyk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgY2F0Y2goZSkge1xyXG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ3BhcnNlIGpzb24gZmFpbGVkLHBhcnNlIGFzIGVuY29kZSBzdHJpbmcnKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAodGhpcy5pc1RleHQpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHZhbHVlU3RyaW5nO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAodGhpcy5pc0FycmF5KSB7XHJcbiAgICAgICAgICAgIGlmICh0aGlzLmlzSGFzaCkge1xyXG4gICAgICAgICAgICAgICAgY29uc3QgYXJyOiBhbnlbXSA9IFtdO1xyXG4gICAgICAgICAgICAgICAgbGV0IGFycklkeCA9IDA7XHJcbiAgICAgICAgICAgICAgICBsZXQga2V5SWR4ID0gMDtcclxuICAgICAgICAgICAgICAgIHdoaWxlKHZhbHVlU3RyaW5nLmxlbmd0aCA+IDApIHtcclxuICAgICAgICAgICAgICAgICAgICBhcnJbYXJySWR4XSA9IGFyclthcnJJZHhdIHx8IHt9O1xyXG4gICAgICAgICAgICAgICAgICAgIGlmICh2YWx1ZVN0cmluZy5zdGFydHNXaXRoKCdbJykpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IGNvdW50ID0gMTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IGVuZFNwbGl0ID0gLTE7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAxO2kgPCB2YWx1ZVN0cmluZy5sZW5ndGg7KytpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAodmFsdWVTdHJpbmdbaV0gPT0gJ1snKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKytjb3VudDtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICh2YWx1ZVN0cmluZ1tpXSA9PSAnXScpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAtLWNvdW50O1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChjb3VudCA9PSAwKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVuZFNwbGl0ID0gaTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgICBhcnJbYXJySWR4XVt0aGlzLmhhc2hLZXlUeXBlUGFyc2Vyc1trZXlJZHhdLlR5cGVLZXldID0gYXdhaXQgdGhpcy5oYXNoS2V5VHlwZVBhcnNlcnNba2V5SWR4XS5QYXJzZUFuZFJlcGxhY2VBc3NldCh2YWx1ZVN0cmluZy5zdWJzdHJpbmcoMSwgZW5kU3BsaXQpKTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlU3RyaW5nID0gdmFsdWVTdHJpbmcuc2xpY2UoZW5kU3BsaXQgKyAxKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHZTcGxpdCA9IHZhbHVlU3RyaW5nLmluZGV4T2YoJ3wnKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgYVNwbGl0ID0gdmFsdWVTdHJpbmcuaW5kZXhPZignLCcpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgdlN0ciA9ICcnO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAodlNwbGl0ID09IC0xKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoYVNwbGl0ICE9IC0xKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8g5Y2V5YWD57SgXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdlN0ciA9IHZhbHVlU3RyaW5nLnN1YnN0cmluZygwLCBhU3BsaXQpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8g5pyA5ZCO5LiA5LiqXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdlN0ciA9IHZhbHVlU3RyaW5nO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGFTcGxpdCAhPSAtMSAmJiBhU3BsaXQgPCB2U3BsaXQpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyDmnKznu4TmnIDlkI7kuIDkuKpcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2U3RyID0gdmFsdWVTdHJpbmcuc3Vic3RyaW5nKDAsIGFTcGxpdCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2U3RyID0gdmFsdWVTdHJpbmcuc3Vic3RyaW5nKDAsIHZTcGxpdCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgYXJyW2FycklkeF1bdGhpcy5oYXNoS2V5VHlwZVBhcnNlcnNba2V5SWR4XS5UeXBlS2V5XSA9IGF3YWl0IHRoaXMuaGFzaEtleVR5cGVQYXJzZXJzW2tleUlkeF0uUGFyc2VBbmRSZXBsYWNlQXNzZXQodlN0cik7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlU3RyaW5nID0gdmFsdWVTdHJpbmcuc2xpY2UodlN0ci5sZW5ndGgpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICBpZiAodmFsdWVTdHJpbmcuc3RhcnRzV2l0aCgnfCcpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlU3RyaW5nID0gdmFsdWVTdHJpbmcuc2xpY2UoMSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICsra2V5SWR4O1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICBpZiAodmFsdWVTdHJpbmcuc3RhcnRzV2l0aCgnLCcpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlU3RyaW5nID0gdmFsdWVTdHJpbmcuc2xpY2UoMSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICsrYXJySWR4O1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBrZXlJZHggPSAwO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIHJldHVybiBhcnI7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGNvbnN0IGFyciA9IFN0cmluZyh2YWx1ZVN0cmluZykuc3BsaXQoJywnKS5tYXAodiA9PiB0aGlzLmFycmF5S2V5VHlwZSA9PSAnbnVtYmVyJyA/IE51bWJlcih2KSA6IHYpO1xyXG4gICAgICAgICAgICBpZiAoYXJyLmxlbmd0aCA9PSAxICYmIGFyclswXSA9PT0gJycpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBbXTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBpZiAodGhpcy5pc051bWJlcikge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGFyci5tYXAodiA9PiBOdW1iZXIodikpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHJldHVybiBhcnI7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmICh0aGlzLmlzTnVtYmVyIHx8IHRoaXMuaXNHcmlkKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBOdW1iZXIodmFsdWVTdHJpbmcpIHx8IDA7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmICh0aGlzLmlzU3RyaW5nKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBTdHJpbmcodmFsdWVTdHJpbmcpIHx8ICcnO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAodGhpcy5pc0Fzc2V0KSB7XHJcbiAgICAgICAgICAgIGlmICghdmFsdWVTdHJpbmcgfHwgIUVkaXRvci5VdGlscy5VVUlELmlzVVVJRCh2YWx1ZVN0cmluZykpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiB2YWx1ZVN0cmluZztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBjb25zdCBhc3NldCA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ3F1ZXJ5LXVybCcsIHZhbHVlU3RyaW5nKTtcclxuICAgICAgICAgICAgaWYgKCFhc3NldCkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGNvbnNvbGUubG9nKCfkuI3lrZjlnKjvvJonICsgdGhpcy50eXBlS2V5KTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBjb25zdCB1cmwgPSBhc3NldC5zcGxpdCgnLycpO1xyXG4gICAgICAgICAgICBpZiAodXJsLmluZGV4T2YoJ2J1bmRsZXMnKSA9PSAtMSkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHZhbHVlU3RyaW5nO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHdoaWxlKHVybC5sZW5ndGggPiAwICYmIHVybFswXSAhPSAnYnVuZGxlcycpIHtcclxuICAgICAgICAgICAgICAgIHVybC5zaGlmdCgpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHVybC5zaGlmdCgpO1xyXG4gICAgICAgICAgICBjb25zdCBidW5kbGVOYW1lID0gdXJsLnNoaWZ0KCk7XHJcbiAgICAgICAgICAgIGxldCBwYXRoID0gdXJsLmpvaW4oJy8nKTtcclxuICAgICAgICAgICAgcGF0aCA9IHBhdGguc3Vic3RyaW5nKDAsIHBhdGgubGFzdEluZGV4T2YoJy4nKSk7XHJcbiAgICAgICAgICAgIHJldHVybiBidW5kbGVOYW1lICsgJ3wnICsgcGF0aDtcclxuXHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmICh0aGlzLmlzRW51bSkge1xyXG4gICAgICAgICAgICByZXR1cm4gU3RyaW5nKHZhbHVlU3RyaW5nKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKHRoaXMuaXNIYXNoKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IHJldDogYW55ID0ge307XHJcbiAgICAgICAgICAgIGxldCBpZHggPSAwO1xyXG4gICAgICAgICAgICB3aGlsZSh2YWx1ZVN0cmluZy5sZW5ndGggPiAwKSB7XHJcbiAgICAgICAgICAgICAgICBpZiAodmFsdWVTdHJpbmcuc3RhcnRzV2l0aCgnWycpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgbGV0IGNvdW50ID0gMTtcclxuICAgICAgICAgICAgICAgICAgICBsZXQgZW5kU3BsaXQgPSAtMTtcclxuICAgICAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMTtpIDwgdmFsdWVTdHJpbmcubGVuZ3RoOysraSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAodmFsdWVTdHJpbmdbaV0gPT0gJ1snKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICArK2NvdW50O1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICh2YWx1ZVN0cmluZ1tpXSA9PSAnXScpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC0tY291bnQ7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoY291bnQgPT0gMCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVuZFNwbGl0ID0gaTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICAgICAgcmV0W3RoaXMuaGFzaEtleVR5cGVQYXJzZXJzW2lkeF0uVHlwZUtleV0gPSB0aGlzLmhhc2hLZXlUeXBlUGFyc2Vyc1tpZHhdLlBhcnNlKHZhbHVlU3RyaW5nLnN1YnN0cmluZygxLCBlbmRTcGxpdCkpO1xyXG4gICAgICAgICAgICAgICAgICAgIHZhbHVlU3RyaW5nID0gdmFsdWVTdHJpbmcuc2xpY2UoZW5kU3BsaXQgKyAxKTtcclxuICAgICAgICAgICAgICAgICAgICBpZiAodmFsdWVTdHJpbmcuc3RhcnRzV2l0aCgnfCcpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlU3RyaW5nID0gdmFsdWVTdHJpbmcuc2xpY2UoMSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICsraWR4O1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGVuZFNwbGl0ID0gdmFsdWVTdHJpbmcuaW5kZXhPZignfCcpO1xyXG4gICAgICAgICAgICAgICAgICAgIHJldFt0aGlzLmhhc2hLZXlUeXBlUGFyc2Vyc1tpZHhdLlR5cGVLZXldID0gdGhpcy5oYXNoS2V5VHlwZVBhcnNlcnNbaWR4XS5QYXJzZShlbmRTcGxpdCA9PSAtMSA/IHZhbHVlU3RyaW5nIDogdmFsdWVTdHJpbmcuc3Vic3RyaW5nKDAsIGVuZFNwbGl0KSk7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKGVuZFNwbGl0ICE9IC0xKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlU3RyaW5nID0gdmFsdWVTdHJpbmcuc2xpY2UoZW5kU3BsaXQgKyAxKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgKytpZHg7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZVN0cmluZyA9ICcnO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICByZXR1cm4gcmV0O1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gU3RyaW5nKHZhbHVlU3RyaW5nKTtcclxuICAgIH1cclxuXHJcbiAgICBnZXQgVHlwZVN0cmluZygpIHtcclxuICAgICAgICBpZiAodGhpcy5pc0lnbm9yZSkge1xyXG4gICAgICAgICAgICByZXR1cm4gJ2lnbm9yZSc7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmICh0aGlzLmlzVGV4dCkge1xyXG4gICAgICAgICAgICByZXR1cm4gJ3RleHQnO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAodGhpcy5pc0dyaWQpIHtcclxuICAgICAgICAgICAgcmV0dXJuICdncmlkIycgKyB0aGlzLmdyaWRTaXplLmpvaW4oJ3wnKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKHRoaXMuaXNBc3NldCkge1xyXG4gICAgICAgICAgICByZXR1cm4gJ2Fzc2V0IycgKyB0aGlzLnR5cGU7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGxldCBzdHI6IHN0cmluZ1tdID0gW107XHJcbiAgICAgICAgaWYgKHRoaXMuaXNKU09OKSB7XHJcbiAgICAgICAgICAgIHN0ci5wdXNoKCdqc29uJyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmICh0aGlzLmlzQXJyYXkpIHtcclxuICAgICAgICAgICAgc3RyLnB1c2goJ2FycmF5Jyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmICh0aGlzLmlzRW51bSkge1xyXG4gICAgICAgICAgICBzdHIucHVzaCgnZW51bScpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAodGhpcy5pc0hhc2gpIHtcclxuICAgICAgICAgICAgc3RyLnB1c2goJ2hhc2gnKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKHRoaXMuaXNDb2xvcikge1xyXG4gICAgICAgICAgICBzdHIucHVzaCgnY29sb3InKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKHRoaXMuaXNTdHJpbmcpIHtcclxuICAgICAgICAgICAgc3RyLnB1c2godGhpcy5pc1RyYW5zbGF0ZSA/ICd0cmFuc2xhdGUnIDogJ3N0cmluZycpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAodGhpcy5pc051bWJlcikge1xyXG4gICAgICAgICAgICBzdHIucHVzaCgnbnVtYmVyJyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmICh0aGlzLmFycmF5S2V5VHlwZSkge1xyXG4gICAgICAgICAgICAhdGhpcy5pc051bWJlciAmJiBzdHIucHVzaCh0aGlzLmFycmF5S2V5VHlwZSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmICh0aGlzLnR5cGUpIHtcclxuICAgICAgICAgICAgc3RyLnB1c2godGhpcy50eXBlKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKHRoaXMuZW51bUtleXMubGVuZ3RoID4gMCAmJiAhdGhpcy5pc0F1dG9FbnVtKSB7XHJcbiAgICAgICAgICAgIHN0ci5wdXNoKHRoaXMuZW51bUtleXMuam9pbignfCcpKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmICh0aGlzLmhhc2hLZXlUeXBlUGFyc2Vycy5sZW5ndGggPiAwKSB7XHJcbiAgICAgICAgICAgIGxldCBoYXNoS3ZzOiBzdHJpbmdbXSA9IFtdO1xyXG4gICAgICAgICAgICB0aGlzLmhhc2hLZXlUeXBlUGFyc2Vycy5mb3JFYWNoKChwYXJzZXIsIGlkeCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgY29uc3Qgc3ViID0gcGFyc2VyLlR5cGVTdHJpbmc7XHJcbiAgICAgICAgICAgICAgICBoYXNoS3ZzLnB1c2goYCR7cGFyc2VyLnR5cGVLZXl9OiR7c3ViLmluZGV4T2YoJyMnKSA9PSAtMSA/IHN1YiA6ICdbJyArIHN1YiArICddJ31gKTtcclxuICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICBzdHIucHVzaChoYXNoS3ZzLmpvaW4oJ3wnKSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiBzdHIuam9pbignIycpO1xyXG4gICAgfVxyXG5cclxuICAgIEVuY29kZSh2YWx1ZTogYW55LCBpc1N1YiA9IGZhbHNlKSB7XHJcbiAgICAgICAgaWYgKHRoaXMuaXNKU09OKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh2YWx1ZSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAodGhpcy5pc0hhc2gpIHtcclxuICAgICAgICAgICAgY29uc3QgYXJyOiBzdHJpbmdbXSA9IFtdO1xyXG4gICAgICAgICAgICBbXS5jb25jYXQodmFsdWUpLmZvckVhY2gobyA9PiB7XHJcbiAgICAgICAgICAgICAgICBjb25zdCB2ID0gW107XHJcbiAgICAgICAgICAgICAgICB0aGlzLmhhc2hLZXlUeXBlUGFyc2Vycy5mb3JFYWNoKHBhcnNlciA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgdi5wdXNoKHBhcnNlci5FbmNvZGUob1twYXJzZXIuVHlwZUtleV0sIHRydWUpKTtcclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgYXJyLnB1c2godi5qb2luKCd8JykpO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgcmV0dXJuIGlzU3ViID8gYFske2Fyci5qb2luKCcsJyl9XWAgOiBhcnIuam9pbignLCcpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIGlmICh0aGlzLmlzQXJyYXkpIHtcclxuICAgICAgICAgICAgdmFsdWUgPSBbXS5jb25jYXQodmFsdWUgfHwgW10pO1xyXG4gICAgICAgICAgICByZXR1cm4gaXNTdWIgPyBgWyR7dmFsdWUuam9pbignLCcpfV1gIDogdmFsdWUuam9pbignLCcpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgcmV0dXJuIFN0cmluZyh2YWx1ZSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGdldCBOZXdWYWx1ZSgpIHtcclxuICAgICAgICBpZiAodGhpcy5pc0FycmF5KSB7XHJcbiAgICAgICAgICAgIHJldHVybiBbXTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKHRoaXMuaXNIYXNoKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IHJldDogYW55ID0ge307XHJcbiAgICAgICAgICAgIHRoaXMuaGFzaEtleVR5cGVQYXJzZXJzLmZvckVhY2gocHNyID0+IHtcclxuICAgICAgICAgICAgICAgIHJldFtwc3IuVHlwZUtleV0gPSBwc3IuTmV3VmFsdWU7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICByZXR1cm4gcmV0O1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gdGhpcy5pc051bWJlciB8fCB0aGlzLmlzR3JpZCA/IDAgOiAnJztcclxuICAgIH1cclxuXHJcbiAgICBnZXQgTmV3SXRlbSgpIHtcclxuICAgICAgICBpZiAoIXRoaXMuaXNBcnJheSkge1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmICh0aGlzLmlzSGFzaCkge1xyXG4gICAgICAgICAgICBjb25zdCByZXQ6IGFueSA9IHt9O1xyXG4gICAgICAgICAgICB0aGlzLmhhc2hLZXlUeXBlUGFyc2Vycy5mb3JFYWNoKHBzciA9PiB7XHJcbiAgICAgICAgICAgICAgICByZXRbcHNyLlR5cGVLZXldID0gcHNyLk5ld1ZhbHVlO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgcmV0dXJuIHJldDtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuaXNOdW1iZXIgfHwgdGhpcy5pc0dyaWQgPyAwIDogJyc7XHJcbiAgICB9XHJcbn1cclxuXHJcbmNvbnN0IHBhbmVsRGF0YU1hcCA9IG5ldyBXZWFrTWFwPGFueSwgQXBwPigpO1xyXG4vKipcclxuICogQHpoIOWmguaenOW4jOacm+WFvOWuuSAzLjMg5LmL5YmN55qE54mI5pys5Y+v5Lul5L2/55So5LiL5pa555qE5Luj56CBXHJcbiAqIEBlbiBZb3UgY2FuIGFkZCB0aGUgY29kZSBiZWxvdyBpZiB5b3Ugd2FudCBjb21wYXRpYmlsaXR5IHdpdGggdmVyc2lvbnMgcHJpb3IgdG8gMy4zXHJcbiAqL1xyXG4vLyBFZGl0b3IuUGFuZWwuZGVmaW5lID0gRWRpdG9yLlBhbmVsLmRlZmluZSB8fCBmdW5jdGlvbihvcHRpb25zOiBhbnkpIHsgcmV0dXJuIG9wdGlvbnMgfVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBFZGl0b3IuUGFuZWwuZGVmaW5lKHtcclxuICAgIC8vIGxpc3RlbmVyczoge1xyXG4gICAgLy8gICAgIHNob3coKSB7IGNvbnNvbGUubG9nKCdzaG93Jyk7IH0sXHJcbiAgICAvLyAgICAgaGlkZSgpIHsgY29uc29sZS5sb2coJ2hpZGUnKTsgfSxcclxuICAgIC8vIH0sXHJcbiAgICB0ZW1wbGF0ZTogcmVhZEZpbGVTeW5jKGpvaW4oX19kaXJuYW1lLCAnLi4vLi4vLi4vc3RhdGljL3RlbXBsYXRlL2RlZmF1bHQvaW5kZXguaHRtbCcpLCAndXRmLTgnKSxcclxuICAgIHN0eWxlOiByZWFkRmlsZVN5bmMoam9pbihfX2Rpcm5hbWUsICcuLi8uLi8uLi9zdGF0aWMvc3R5bGUvZGVmYXVsdC9pbmRleC5jc3MnKSwgJ3V0Zi04JyksXHJcbiAgICAkOiB7XHJcbiAgICAgICAgYXBwOiAnI2FwcCcsXHJcbiAgICB9LFxyXG4gICAgcmVhZHkoKSB7XHJcbiAgICAgICAgaWYgKHRoaXMuJC5hcHApIHtcclxuICAgICAgICAgICAgY29uc3QgaGVscGVyVGVtcCA9IHJlYWRGaWxlU3luYyhqb2luKF9fZGlybmFtZSwgJy4uLy4uLy4uL3RlbXBsYXRlL2hlbHBlci50cy5lanMnKSwgJ3V0Zi04Jyk7XHJcbiAgICAgICAgICAgIGNvbnN0IHNldHRpbmdQYXRoID0gam9pbihfX2Rpcm5hbWUsICcuLi8uLi8uLi9zZXR0aW5nL3NldHRpbmcuanNvbicpO1xyXG4gICAgICAgICAgICBjb25zdCBzZXR0aW5nID0gcmVhZEpTT05TeW5jKHNldHRpbmdQYXRoKTtcclxuXHJcbiAgICAgICAgICAgIGNvbnN0IHBhdGggPSBzZXR0aW5nLnBhdGggJiYgZXhpc3RzU3luYyhzZXR0aW5nLnBhdGgpID8gc2V0dGluZy5wYXRoIDogJyc7XHJcbiAgICAgICAgICAgIGNvbnN0IGpzb25wYXRoID0gc2V0dGluZy5qc29ucGF0aCAmJiBleGlzdHNTeW5jKHNldHRpbmcuanNvbnBhdGgpID8gc2V0dGluZy5qc29ucGF0aCA6ICcnO1xyXG4gICAgICAgICAgICBsZXQgbGlzdDogc3RyaW5nW10gPSBbXTtcclxuICAgICAgICAgICAgbGV0IHBhcnNlZDogYW55W10gPSBbXTtcclxuICAgICAgICAgICAgaWYgKGpzb25wYXRoICYmIGV4aXN0c1N5bmMoam9pbihqc29ucGF0aCwgJ0dhbWVDb25maWcuanNvbicpKSkge1xyXG4gICAgICAgICAgICAgICAgcGFyc2VkID0gcmVhZEpTT05TeW5jKGpvaW4oanNvbnBhdGgsICdHYW1lQ29uZmlnLmpzb24nKSwgJ3V0Zi04Jyk7XHJcbiAgICAgICAgICAgICAgICBsaXN0ID0gcGFyc2VkLm1hcChmaWxlID0+IGZpbGUubmFtZSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgZWxzZSBpZiAocGF0aCkge1xyXG4gICAgICAgICAgICAgICAgbGlzdCA9IHJlYWRkaXJTeW5jKHNldHRpbmcucGF0aCkuZmlsdGVyKGZpbGVuYW1lID0+ICFmaWxlbmFtZS5zdGFydHNXaXRoKCd+JCcpICYmIGV4dG5hbWUoZmlsZW5hbWUpLnN0YXJ0c1dpdGgoJy54bHMnKSk7XHJcbiAgICAgICAgICAgICAgICBwYXJzZWQgPSBsaXN0Lm1hcChmaWxlID0+IHtcclxuICAgICAgICAgICAgICAgICAgICBjb25zdCBvcmlnaW5fbmFtZSA9IGZpbGU7XHJcbiAgICAgICAgICAgICAgICAgICAgZmlsZSA9IGJhc2VuYW1lKGZpbGUsIGV4dG5hbWUoZmlsZSkpO1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG9yaWdpbl9uYW1lLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBuYW1lOiBmaWxlLmluZGV4T2YoJ0AnKSAhPSAtMSA/IGZpbGUuc3Vic3RyaW5nKDAsIGZpbGUuaW5kZXhPZignQCcpKSA6IGZpbGUsIFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBtZW1vOiBmaWxlLmluZGV4T2YoJ0AnKSAhPSAtMSA/IGZpbGUuc2xpY2UoZmlsZS5pbmRleE9mKCdAJykgKyAxKSA6ICcnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBwYWdlczogcGFyc2Uoam9pbihwYXRoLCBmaWxlICsgJy54bHN4JykpLm1hcChwYWdlID0+ICh7bmFtZTogcGFnZS5uYW1lLnNwbGl0KCdAJylbMF0sbWVtbzpwYWdlLm5hbWUuc3BsaXQoJ0AnKVsxXSB8fCAnJywgZGF0YTogcGFnZS5kYXRhfSkpLCBcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmVuYW1lOiAnJywgXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlbW92ZWQ6IGZhbHNlLFxyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBwYXJzZWQuc29ydCgoZjEsIGYyKSA9PiB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gKGYxLm1lbW8gfHwgZjEubmFtZSkgPCAoZjIubWVtbyB8fCBmMS5uYW1lKSA/IC0xIDogMTtcclxuICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICBjb25zdCBmaWxlID0gcGFyc2VkWzBdIHx8IG51bGw7XHJcbiAgICAgICAgICAgIGNvbnN0IHBhZ2UgPSBmaWxlID8gZmlsZS5wYWdlc1swXSA6IG51bGw7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBjb25zdCBhcHAgPSBjcmVhdGVBcHAoe1xyXG4gICAgICAgICAgICAgICAgZGF0YSgpIHtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBwYXRoLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBqc29ucGF0aCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgcGFyc2VkLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBmaWxlLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBwYWdlLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBlZGl0TW9kZTogMCxcclxuICAgICAgICAgICAgICAgICAgICAgICAga2V5SW5kZXg6IDAsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJvd0luZGV4OiAwLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBtb2RhbDoge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc2hvdzogZmFsc2UsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRpdGxlOiAnJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlczogW10gYXMgYW55W10sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBoZWlnaHQ6IDEzMCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgcGFyc2VyczogW10gYXMgVHlwZVBhcnNlcltdLFxyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICBwcm92aWRlKCkge1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHVwZGF0ZVBhcnNlcjogdGhpcy51cGRhdGVQYXJzZXIsXHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIG1ldGhvZHM6IHtcclxuICAgICAgICAgICAgICAgICAgICBzYXZlU2V0dGluZygpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgd3JpdGVKU09OU3luYyhzZXR0aW5nUGF0aCwgc2V0dGluZyk7XHJcbiAgICAgICAgICAgICAgICAgICAgfSxcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgc2V0RVhDRUxQYXRoKHBhdGg6IHN0cmluZykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnBhdGggPSBzZXR0aW5nLnBhdGggPSBwYXRoO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnNhdmVTZXR0aW5nKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICBzZXRKU09OUGF0aChwYXRoOiBzdHJpbmcpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5qc29ucGF0aCA9IHNldHRpbmcuanNvbnBhdGggPSBwYXRoO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnNhdmVTZXR0aW5nKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgfSxcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgYXN5bmMgaW1wb3J0RVhDRUwoKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghdGhpcy5wYXRoIHx8ICFleGlzdHNTeW5jKHRoaXMucGF0aCkpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLmFsZXJ0KCfot6/lvoTkuI3lrZjlnKgnKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5wYXJzZWQgJiYgdGhpcy5wYXJzZWQubGVuZ3RoID4gMCAmJiAhYXdhaXQgdGhpcy5jb25maXJtKCfnoa7lrpropoHph43mlrDliqDovb3mlofku7blkJfvvJ/mnKrkv53lrZjnmoTmm7TmlLnlsIbmsLjkuYXkuKLlpLHjgIInKSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnBhcnNlZCA9IHJlYWRkaXJTeW5jKHRoaXMucGF0aCkuZmlsdGVyKGZpbGVuYW1lID0+ICFmaWxlbmFtZS5zdGFydHNXaXRoKCd+JCcpICYmIGV4dG5hbWUoZmlsZW5hbWUpLnN0YXJ0c1dpdGgoJy54bHMnKSkubWFwKGZpbGUgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgb3JpZ2luX25hbWUgPSBmaWxlO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZmlsZSA9IGJhc2VuYW1lKGZpbGUsIGV4dG5hbWUoZmlsZSkpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvcmlnaW5fbmFtZSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBuYW1lOiBmaWxlLmluZGV4T2YoJ0AnKSAhPSAtMSA/IGZpbGUuc3Vic3RyaW5nKDAsIGZpbGUuaW5kZXhPZignQCcpKSA6IGZpbGUsIFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1lbW86IGZpbGUuaW5kZXhPZignQCcpICE9IC0xID8gZmlsZS5zbGljZShmaWxlLmluZGV4T2YoJ0AnKSArIDEpIDogJycsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcGFnZXM6IHBhcnNlKGpvaW4odGhpcy5wYXRoLCBmaWxlICsgJy54bHN4JykpLm1hcChcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcGFnZSA9PiAoXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbmFtZTogcGFnZS5uYW1lLnNwbGl0KCdAJylbMF0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbWVtbzpwYWdlLm5hbWUuc3BsaXQoJ0AnKVsxXSB8fCAnJywgXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGF0YTogcGFnZS5kYXRhXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIClcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICApLCBcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZW5hbWU6ICcnLCBcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZW1vdmVkOiBmYWxzZSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucGFyc2VkLnNvcnQoKGYxLCBmMikgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIChmMS5tZW1vIHx8IGYxLm5hbWUpIDwgKGYyLm1lbW8gfHwgZjEubmFtZSkgPyAtMSA6IDE7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmZpbGUgPSB0aGlzLnBhcnNlZFswXSB8fCBudWxsO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnBhZ2UgPSB0aGlzLmZpbGUgPyB0aGlzLmZpbGUucGFnZXNbMF0gOiBudWxsO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmtleUluZGV4ID0gdGhpcy5yb3dJbmRleCA9IDA7XHJcbiAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICBhc3luYyBjb21iaW5lRXhjZWwoKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghdGhpcy5wYXJzZWQgfHwgdGhpcy5wYXJzZWQubGVuZ3RoID09IDApIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLmltcG9ydEVYQ0VMKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCF0aGlzLnBhdGggfHwgIWV4aXN0c1N5bmModGhpcy5wYXRoKSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuYWxlcnQoJ+i3r+W+hOS4jeWtmOWcqCcpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghYXdhaXQgdGhpcy5jb25maXJtKCfnoa7lrpropoHlsIZFWENFTOe7k+aehOWQiOW5tuWIsOW9k+WJjemhueebruWQl++8nycpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGZpbGVzID0gcmVhZGRpclN5bmModGhpcy5wYXRoKS5maWx0ZXIoZmlsZW5hbWUgPT4gIWZpbGVuYW1lLnN0YXJ0c1dpdGgoJ34kJykgJiYgZXh0bmFtZShmaWxlbmFtZSkuc3RhcnRzV2l0aCgnLnhscycpKS5tYXAob3JpZ2luX25hbWUgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZmlsZSA9IGJhc2VuYW1lKG9yaWdpbl9uYW1lLCBleHRuYW1lKG9yaWdpbl9uYW1lKSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9yaWdpbl9uYW1lLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5hbWU6IGZpbGUuaW5kZXhPZignQCcpICE9IC0xID8gZmlsZS5zdWJzdHJpbmcoMCwgZmlsZS5pbmRleE9mKCdAJykpIDogZmlsZSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtZW1vOiBmaWxlLmluZGV4T2YoJ0AnKSAhPSAtMSA/IGZpbGUuc2xpY2UoZmlsZS5pbmRleE9mKCdAJykgKyAxKSA6ICcnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBhZ2VzOiBwYXJzZShqb2luKHRoaXMucGF0aCwgZmlsZSArICcueGxzeCcpKS5tYXAoXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBhZ2UgPT4gKFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5hbWU6IHBhZ2UubmFtZS5zcGxpdCgnQCcpWzBdLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1lbW86cGFnZS5uYW1lLnNwbGl0KCdAJylbMV0gfHwgJycsIFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRhdGE6IHBhZ2UuZGF0YVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICApLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIClcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyDmuIXmpZrmjonooqvnp7vpmaTnmoTpobXpnaJcclxuICAgICAgICAgICAgICAgICAgICAgICAgZm9yIChsZXQgcGFyc2VkT25lIG9mIHRoaXMucGFyc2VkKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBwYXJzZWRPbmUucGFnZXMgPSBwYXJzZWRPbmUucGFnZXMuZmlsdGVyKHBhZ2UgPT4gISFmaWxlcy5maW5kKGZpbGUgPT4gISFmaWxlLnBhZ2VzLmZpbmQocCA9PiBwLm5hbWUgPT0gcGFnZS5uYW1lIHx8IHAubWVtbyA9PSBwYWdlLm1lbW8pKSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGZvciAobGV0IGZpbGUgb2YgZmlsZXMpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IG9yaWdpbiA9IHRoaXMucGFyc2VkLmZpbmQoZiA9PiBmLm5hbWUgPT0gZmlsZS5uYW1lKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICghb3JpZ2luKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5wYXJzZWQucHVzaCh7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9yaWdpbl9uYW1lOiBmaWxlLm9yaWdpbl9uYW1lLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBuYW1lOiBmaWxlLm5hbWUsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1lbW86IGZpbGUubWVtbyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcGFnZXM6IFtdLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZW5hbWU6ICcnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZW1vdmVkOiBmYWxzZVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZvciAobGV0IHBhZ2Ugb2YgZmlsZS5wYWdlcykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHBhZ2VOYW1lID0gcGFnZS5uYW1lO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHBhZ2VNZW1vID0gcGFnZS5tZW1vO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHBhZ2VEYXRhID0gcGFnZS5kYXRhO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IG9yaWdpbl9maWxlID0gdGhpcy5wYXJzZWQuZmluZChmaWxlID0+ICEhKGZpbGUucGFnZXMuZmluZChwYWdlID0+IHBhZ2UubmFtZSA9PSBwYWdlTmFtZSB8fCAocGFnZS5tZW1vICYmIHBhZ2UubWVtbyA9PSBwYWdlTWVtbykpKSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG9yaWdpbl9maWxlKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGlkeCA9IG9yaWdpbl9maWxlLnBhZ2VzLmZpbmRJbmRleChwYWdlID0+IHBhZ2UubmFtZSA9PSBwYWdlTmFtZSB8fCAocGFnZS5tZW1vICYmIHBhZ2UubWVtbyA9PSBwYWdlTWVtbykpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBvcmlnaW5QYWdlID0gb3JpZ2luX2ZpbGUucGFnZXNbaWR4XTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9yaWdpblBhZ2UubmFtZSA9IHBhZ2VOYW1lO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvcmlnaW5QYWdlLm1lbW8gPSBwYWdlTWVtbztcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChvcmlnaW5fZmlsZS5uYW1lICE9IGZpbGUubmFtZSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5wYXJzZWRbZmlsZS5uYW1lXS5wYWdlcy5wdXNoKC4uLm9yaWdpbl9maWxlLnBhZ2VzLnNwbGljZShpZHgsIDEpKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMuY2hlY2tJc0NvbmZpZ1BhZ2UocGFnZU5hbWUpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMztpIDwgcGFnZURhdGEubGVuZ3RoOysraSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGtleSA9IHBhZ2VEYXRhW2ldWzBdO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IG9yaWdpblJvdyA9IG9yaWdpblBhZ2UuZGF0YS5maW5kKHJvdyA9PiByb3dbMF0gPT0ga2V5KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAob3JpZ2luUm93KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIOaaguS4jeS/ruaUuVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBmb3IgKGxldCBpZHggaW4gb3JpZ2luUm93KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vICAgICBvcmlnaW5Sb3dbaWR4XSA9IHBhZ2VEYXRhW2ldW2lkeF07XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9yaWdpblBhZ2UuZGF0YS5wdXNoKHBhZ2VEYXRhW2ldKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCByZW1vdmVkSW5kZWNpZXM6IG51bWJlcltdID0gW107XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb3JpZ2luUGFnZS5kYXRhWzBdLmZvckVhY2goKGtleSwgaWR4KSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFwYWdlRGF0YVswXS5pbmNsdWRlcyhrZXkpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlbW92ZWRJbmRlY2llcy5wdXNoKGlkeCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHJlbW92ZWRJbmRlY2llcy5sZW5ndGggPiAwKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7aSA8IG9yaWdpblBhZ2UuZGF0YS5sZW5ndGg7KytpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9yaWdpblBhZ2UuZGF0YVtpXSA9IG9yaWdpblBhZ2UuZGF0YVtpXS5maWx0ZXIoKHYsIGlkeCkgPT4gIXJlbW92ZWRJbmRlY2llcy5pbmNsdWRlcyhpZHgpKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcGFnZURhdGFbMF0uZm9yRWFjaCgoa2V5LCBpZHgpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIW9yaWdpblBhZ2UuZGF0YVswXS5pbmNsdWRlcyhrZXkpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwO2kgPCA0OysraSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb3JpZ2luUGFnZS5kYXRhW2ldLnB1c2gocGFnZS5kYXRhW2ldW2lkeF0pO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9yaWdpblBhZ2UuZGF0YS5zbGljZSg0KS5mb3JFYWNoKHJvdyA9PiByb3cucHVzaCgnJykpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgaWR4MiA9IG9yaWdpblBhZ2UuZGF0YVswXS5pbmRleE9mKGtleSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAxO2kgPCA0OysraSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb3JpZ2luUGFnZS5kYXRhW2ldW2lkeDJdID0gcGFnZURhdGFbaV1baWR4XTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHNvcnQgPSBwYWdlRGF0YVswXS5tYXAoa2V5ID0+IG9yaWdpblBhZ2UuZGF0YVswXS5pbmRleE9mKGtleSkpO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChzb3J0LmZpbmQoKHYsIGkpID0+IHYgIT0gaSkpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvcmlnaW5QYWdlLmRhdGEuZm9yRWFjaCgocm93LCBpZHgpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb3JpZ2luUGFnZS5kYXRhW2lkeF0gPSByb3cubWFwKCh2LCBpKSA9PiByb3dbc29ydFtpXV0pO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZvciBhd2FpdCAobGV0IHJvdyBvZiBwYWdlRGF0YS5zbGljZSg0KSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IG9yaWdpblJvdyA9IG9yaWdpblBhZ2UuZGF0YS5zbGljZSg0KS5maW5kKHIgPT4gclswXSA9PSByb3dbMF0pO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChvcmlnaW5Sb3cpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG9yaWdpblJvdy5zb21lKCh2LCBpKSA9PiByb3dbaV0gIT0gdikpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwO2kgPCByb3cubGVuZ3RoOysraSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9yaWdpblJvd1tpXSA9IHJvd1tpXTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb3JpZ2luUGFnZS5kYXRhLnB1c2gocm93LnNsaWNlKCkpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5wYXJzZWQuZmluZChmID0+IGYubmFtZSA9PSBmaWxlLm5hbWUpLnBhZ2VzLnB1c2goe1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbmFtZTogcGFnZU5hbWUsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtZW1vOiBwYWdlTWVtbyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRhdGE6IHBhZ2VEYXRhXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5wYXJzZWQgPSBKU09OLnBhcnNlKEpTT04uc3RyaW5naWZ5KHRoaXMucGFyc2VkKSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZmlsZSA9IHRoaXMucGFyc2VkWzBdIHx8IG51bGw7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZWRpdE1vZGUgPSAwO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnBhZ2UgPSB0aGlzLmZpbGUgPyB0aGlzLmZpbGUucGFnZXNbMF0gOiBudWxsO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmtleUluZGV4ID0gdGhpcy5yb3dJbmRleCA9IDA7XHJcbiAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICBzYXZlRVhDRUwoKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLmR1cGxpY2F0ZWRGaWxlTmFtZXMubGVuZ3RoID4gMCB8fCB0aGlzLmR1cGxpY2F0ZWRQYWdlTmFtZXMubGVuZ3RoID4gMCB8fCB0aGlzLmR1cGxpY2F0ZWRLZXlzLmxlbmd0aCA+IDAgfHwgdGhpcy5kdXBsaWNhdGVkUm93cy5sZW5ndGggPiAwKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5hbGVydCgn5b2T5YmN5a2Y5Zyo6YeN5aSN55qE5paH5Lu25ZCN77yM6KGo5ZCN77yM5oiW5p+Q5Lqb6KGo5YaF5a2Y5Zyo55u45ZCM55qE5Y+C5pWw5ZCN5oiW55u45ZCMX2lk55qE6aG577yM6K+35L+u5pS55ZCO5YaN5L+d5a2Y44CCJyk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgZm9yIChsZXQgZmlsZSBvZiB0aGlzLnBhcnNlZCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZmlsZS5vcmlnaW5fbmFtZSAmJiByZW1vdmVTeW5jKGpvaW4oc2V0dGluZy5wYXRoLCBmaWxlLm9yaWdpbl9uYW1lKSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZmlsZS5yZW1vdmVkKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29udGludWU7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZmlsZS5yZW5hbWUpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZmlsZS5uYW1lID0gZmlsZS5yZW5hbWU7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZpbGUucmVuYW1lID0gJyc7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBkYXRhID0gYnVpbGQoZmlsZS5wYWdlcy5tYXAocGFnZSA9PiAoe25hbWU6IHBhZ2UubmFtZSArIChwYWdlLm1lbW8gPyAnQCcgKyBwYWdlLm1lbW8gOiAnJyksIGRhdGE6IHBhZ2UuZGF0YX0pKSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgd3JpdGVGaWxlU3luYyhqb2luKHNldHRpbmcucGF0aCwgZmlsZS5vcmlnaW5fbmFtZSA9IGZpbGUubmFtZSArIChmaWxlLm1lbW8gPyAnQCcgKyBmaWxlLm1lbW8gOiAnJykgKyAnLnhsc3gnKSwgZGF0YSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5wYXJzZWQgPSB0aGlzLnBhcnNlZC5maWx0ZXIoZmlsZSA9PiAhZmlsZS5yZW1vdmVkKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5hbGVydCgn5paH5Lu25bey5L+d5a2YJywgJ+aIkOWKnycpO1xyXG4gICAgICAgICAgICAgICAgICAgIH0sXHJcblxyXG4gICAgICAgICAgICAgICAgICAgIGFzeW5jIGltcG9ydEpTT04oKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghdGhpcy5qc29ucGF0aCB8fCAhZXhpc3RzU3luYyh0aGlzLmpzb25wYXRoKSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuYWxlcnQoJ+i3r+W+hOS4jeWtmOWcqCcpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLnBhcnNlZCAmJiB0aGlzLnBhcnNlZC5sZW5ndGggPiAwICYmICFhd2FpdCB0aGlzLmNvbmZpcm0oJ+ehruWumuimgemHjeaWsOWKoOi9veaWh+S7tuWQl++8n+acquS/neWtmOeahOabtOaUueWwhuawuOS5heS4ouWkseOAgicpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5wYXJzZWQgPSByZWFkSlNPTlN5bmMoam9pbih0aGlzLmpzb25wYXRoLCAnR2FtZUNvbmZpZy5qc29uJyksICd1dGYtOCcpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmZpbGUgPSB0aGlzLnBhcnNlZFswXSB8fCBudWxsO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnBhZ2UgPSB0aGlzLmZpbGUgPyB0aGlzLmZpbGUucGFnZXNbMF0gOiBudWxsO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmtleUluZGV4ID0gdGhpcy5yb3dJbmRleCA9IDA7XHJcbiAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICBzYXZlSlNPTigpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMuZHVwbGljYXRlZEZpbGVOYW1lcy5sZW5ndGggPiAwIHx8IHRoaXMuZHVwbGljYXRlZFBhZ2VOYW1lcy5sZW5ndGggPiAwIHx8IHRoaXMuZHVwbGljYXRlZEtleXMubGVuZ3RoID4gMCB8fCB0aGlzLmR1cGxpY2F0ZWRSb3dzLmxlbmd0aCA+IDApIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLmFsZXJ0KCflvZPliY3lrZjlnKjph43lpI3nmoTmlofku7blkI3vvIzooajlkI3vvIzmiJbmn5DkupvooajlhoXlrZjlnKjnm7jlkIznmoTlj4LmlbDlkI3miJbnm7jlkIxfaWTnmoTpobnvvIzor7fkv67mlLnlkI7lho3kv53lrZjjgIInKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIXRoaXMuanNvbnBhdGggfHwgIWV4aXN0c1N5bmModGhpcy5qc29ucGF0aCkpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLmFsZXJ0KCfot6/lvoTkuI3lrZjlnKgnKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICB3cml0ZUZpbGVTeW5jKGpvaW4odGhpcy5qc29ucGF0aCwgJ0dhbWVDb25maWcuanNvbicpLCBKU09OLnN0cmluZ2lmeSh0aGlzLnBhcnNlZCwgbnVsbCwgNCksICd1dGYtOCcpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmFsZXJ0KCfmlofku7blt7Lkv53lrZgnLCAn5oiQ5YqfJyk7XHJcbiAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICBuZXdGaWxlKCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLm1vZGFsU2hvdygnbmV3LWZpbGUnKTtcclxuICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICAgIHJlbmFtZUZpbGUoKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMubW9kYWxTaG93KCdyZW5hbWUtZmlsZScpO1xyXG4gICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgYXN5bmMgcmVtb3ZlRmlsZSgpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGF3YWl0IHRoaXMuY29uZmlybShg56Gu5a6a6KaB5Yig6Zmk5paH5Lu2PCR7dGhpcy5maWxlLnJlbmFtZSB8fCB0aGlzLmZpbGUubmFtZX0+5ZCX77yfYCkpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZmlsZS5yZW1vdmVkID0gdHJ1ZTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZmlsZSA9IHRoaXMucGFyc2VkLmZpbmQoZmlsZSA9PiAhZmlsZS5yZW1vdmVkKSB8fCBudWxsO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5wYWdlID0gdGhpcy5maWxlID8gdGhpcy5maWxlLnBhZ2VzWzBdIDogbnVsbDtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgc2VsZWN0RmlsZShmaWxlKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZmlsZSA9IGZpbGU7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucGFnZSA9IGZpbGUucGFnZXNbMF07XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMua2V5SW5kZXggPSB0aGlzLnJvd0luZGV4ID0gMDtcclxuICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICAgIG5ld1BhZ2UoKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMubW9kYWxTaG93KCduZXctcGFnZScpO1xyXG4gICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgcmVuYW1lUGFnZSgpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5tb2RhbFNob3coJ3JlbmFtZS1wYWdlJyk7XHJcbiAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICBzZWxlY3RQYWdlKHBhZ2VJbmRleCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWlzTmFOKHBhZ2VJbmRleCkpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLmZpbGUucGFnZXNbcGFnZUluZGV4XSAhPSB0aGlzLnBhZ2UpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnBhZ2UgPSB0aGlzLmZpbGUucGFnZXNbcGFnZUluZGV4XTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmtleUluZGV4ID0gdGhpcy5yb3dJbmRleCA9IDA7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5wYWdlQ2hhbmdlZCA9IHRydWU7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnJlbmFtZVBhZ2UoKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgYXN5bmMgcmVtb3ZlUGFnZSgpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGF3YWl0IHRoaXMuY29uZmlybShg56Gu5a6a6KaB5Yig6Zmk6KGo6aG1PCR7dGhpcy5wYWdlLm5hbWV9PuWQl++8n2ApKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBvcmlnaW5JZHggPSB0aGlzLmZpbGUucGFnZXMuaW5kZXhPZih0aGlzLnBhZ2UpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5maWxlLnBhZ2VzLnNwbGljZShvcmlnaW5JZHgsIDEpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5wYWdlID0gdGhpcy5maWxlLnBhZ2VzW01hdGgubWF4KDAsIG9yaWdpbklkeCAtIDEpXTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgc2VsZWN0RWRpdE1vZGUobW9kZSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWlzTmFOKG1vZGUpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmVkaXRNb2RlID0gbW9kZTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgbmV3S2V5KCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnBhZ2UuZGF0YVswXS5wdXNoKCduZXdfa2V5Jyk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucGFnZS5kYXRhWzFdLnB1c2goJ3N0cmluZycpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnBhZ2UuZGF0YVsyXS5wdXNoKCfmlrDlsZ7mgKcnKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5wYWdlLmRhdGFbM10ucHVzaCgnI01FTU8nKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5wYWdlLmRhdGEuc2xpY2UoNCkuZm9yRWFjaChkYXRhID0+IGRhdGEucHVzaCgnJykpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmtleUluZGV4ID0gdGhpcy5wYWdlLmRhdGFbMF0ubGVuZ3RoIC0gMTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy51cGRhdGVQYXJzZXIoKTtcclxuICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICAgIG1vdmVLZXkob2Zmc2V0KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucGFnZS5kYXRhLmZvckVhY2goZGF0YSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBbZGF0YVt0aGlzLmtleUluZGV4XSwgZGF0YVt0aGlzLmtleUluZGV4ICsgb2Zmc2V0XV0gPSBbZGF0YVt0aGlzLmtleUluZGV4ICsgb2Zmc2V0XSwgZGF0YVt0aGlzLmtleUluZGV4XV07XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmtleUluZGV4ICs9IG9mZnNldDtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy51cGRhdGVQYXJzZXIoKTtcclxuICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICAgIGFzeW5jIHJlbW92ZUtleSgpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGF3YWl0IHRoaXMuY29uZmlybShg56Gu6K6k6KaB5Yig6Zmk5a2X5q61PCR7dGhpcy5wYWdlLmRhdGFbMF1bdGhpcy5rZXlJbmRleF19PuWQl++8n+WvueW6lOaJgOacieihqOmhuemDveS8mumaj+S5i+WIoOmZpOOAgmApKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnBhZ2UuZGF0YS5mb3JFYWNoKGRhdGEgPT4gZGF0YS5zcGxpY2UodGhpcy5rZXlJbmRleCwgMSkpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5rZXlJbmRleCA9IE1hdGgubWluKHRoaXMucGFnZS5kYXRhWzBdLmxlbmd0aCAtIDEsIHRoaXMua2V5SW5kZXgpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy51cGRhdGVQYXJzZXIoKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgbmV3Um93KCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnBhZ2UuZGF0YS5wdXNoKHRoaXMucGFnZS5kYXRhWzBdLm1hcCgodiwgaWR4KT0+IGlkeCA9PSAwID8gJ25ld19yb3cnIDogJycpKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5yb3dJbmRleCA9IHRoaXMucGFnZS5kYXRhLmxlbmd0aCAtIDU7XHJcbiAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICBtb3ZlUm93KG9mZnNldCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBbdGhpcy5wYWdlLmRhdGFbdGhpcy5yb3dJbmRleCArIDRdLCB0aGlzLnBhZ2UuZGF0YVt0aGlzLnJvd0luZGV4ICsgNCArIG9mZnNldF1dID0gW3RoaXMucGFnZS5kYXRhW3RoaXMucm93SW5kZXggKyA0ICsgb2Zmc2V0XSwgdGhpcy5wYWdlLmRhdGFbdGhpcy5yb3dJbmRleCArIDRdXTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5yb3dJbmRleCArPSBvZmZzZXQ7XHJcbiAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICBhc3luYyByZW1vdmVSb3coKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChhd2FpdCB0aGlzLmNvbmZpcm0oYOehruiupOimgeWIoOmZpOihjDwke3RoaXMucGFnZS5kYXRhW3RoaXMucm93SW5kZXggKyA0XVswXX0+5ZCX77yfYCkpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucGFnZS5kYXRhLnNwbGljZSh0aGlzLnJvd0luZGV4ICsgNCwgMSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnVwZGF0ZVBhcnNlcigpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5yb3dJbmRleCA9IE1hdGgubWF4KDAsIHRoaXMucm93SW5kZXggLSAxKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgbmV3Q29uZmlnKCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnBhZ2UuZGF0YS5wdXNoKFsnbmV3X2NvbmZpZycsICfmlrDphY3nva4nLCAnbnVtYmVyJywgJzAnXSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucm93SW5kZXggPSB0aGlzLnBhZ2UuZGF0YS5sZW5ndGggLSA0O1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnVwZGF0ZVBhcnNlcigpO1xyXG4gICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgbW92ZUNvbmZpZyhvZmZzZXQpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgW3RoaXMucGFnZS5kYXRhW3RoaXMucm93SW5kZXggKyAzXSwgdGhpcy5wYWdlLmRhdGFbdGhpcy5yb3dJbmRleCArIDMgKyBvZmZzZXRdXSA9IFt0aGlzLnBhZ2UuZGF0YVt0aGlzLnJvd0luZGV4ICsgMyArIG9mZnNldF0sIHRoaXMucGFnZS5kYXRhW3RoaXMucm93SW5kZXggKyAzXV07XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIFt0aGlzLnBhcnNlcnNbdGhpcy5yb3dJbmRleF0sIHRoaXMucGFyc2Vyc1t0aGlzLnJvd0luZGV4ICsgb2Zmc2V0XV0gPSBbdGhpcy5wYXJzZXJzW3RoaXMucm93SW5kZXggKyBvZmZzZXRdLCB0aGlzLnBhcnNlcnNbdGhpcy5yb3dJbmRleF1dO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnJvd0luZGV4ICs9IG9mZnNldDtcclxuICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICAgIGFzeW5jIHJlbW92ZUNvbmZpZygpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGF3YWl0IHRoaXMuY29uZmlybShg56Gu6K6k6KaB5Yig6Zmk6YWN572uPCR7dGhpcy5wYWdlLmRhdGFbdGhpcy5yb3dJbmRleCArIDNdWzBdfT7lkJfvvJ9gKSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5wYWdlLmRhdGEuc3BsaWNlKHRoaXMucm93SW5kZXggKyAzLCAxKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMudXBkYXRlUGFyc2VyKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnJvd0luZGV4ID0gTWF0aC5tYXgoMCwgdGhpcy5yb3dJbmRleCAtIDEpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICB1cGRhdGVQYXJzZXIoKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghdGhpcy5wYWdlKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMuaXNDb25maWdQYWdlKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5wYWdlLmRhdGEubGVuZ3RoIDwgNCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucGFnZS5kYXRhLnB1c2godGhpcy5wYWdlLmRhdGFbMF0ubWFwKHYgPT4gJycpKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucGFyc2VycyA9IHRoaXMucGFnZS5kYXRhLnNsaWNlKDMpLm1hcChyID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBwYXJzZXIgPSBuZXcgVHlwZVBhcnNlcihyWzJdLCByWzBdICsgJ0AnICsgclsxXSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcGFyc2VyLnBhcnNlZFZhbHVlID0gcGFyc2VyLlBhcnNlKHBhcnNlci5lbmNvZGVkVmFsdWUgPSByWzNdKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwYXJzZXIuZW5jb2RlZFZhbHVlID0gcGFyc2VyLmVuY29kZWRWYWx1ZSB8fCBwYXJzZXIuRW5jb2RlKHBhcnNlci5wYXJzZWRWYWx1ZSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHBhcnNlcjtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMucGFnZS5kYXRhLmxlbmd0aCA8IDUpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnBhZ2UuZGF0YS5wdXNoKHRoaXMucGFnZS5kYXRhWzBdLm1hcCh2ID0+ICcnKSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnBhcnNlcnMgPSB0aGlzLnBhZ2UuZGF0YVsxXS5tYXAoKHQsIGkpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBwYXJzZXIgPSBuZXcgVHlwZVBhcnNlcih0LCB0aGlzLnBhZ2UuZGF0YVswXVtpXSArICdAJyArIHRoaXMucGFnZS5kYXRhWzJdW2ldLCB0ID09ICdlbnVtJyA/IHRoaXMucGFnZS5kYXRhLnNsaWNlKDQpLm1hcChyID0+IHJbaV0pIDogbnVsbCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcGFyc2VyLnBhcnNlZFZhbHVlID0gcGFyc2VyLlBhcnNlKHBhcnNlci5lbmNvZGVkVmFsdWUgPSB0aGlzLnBhZ2UuZGF0YVt0aGlzLnJvd0luZGV4ICsgNF1baV0gfHwgJycpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBwYXJzZXI7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgbW9kYWxTaG93KG1vZGFsVHlwZTogc3RyaW5nKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMubW9kYWwudHlwZSA9IG1vZGFsVHlwZTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5tb2RhbC52YWx1ZXMgPSBbXTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5tb2RhbC5oZWlnaHQgPSAxMzA7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHN3aXRjaChtb2RhbFR5cGUpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhc2UgJ25ldy1maWxlJzpcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLm1vZGFsLnRpdGxlID0gJ+aWsOW7uumFjee9ruihqOaWh+S7tic7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5tb2RhbC5oZWlnaHQgPSAyMDA7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5tb2RhbC52YWx1ZXNbMF0gPSB0aGlzLm1vZGFsLnZhbHVlc1sxXSA9ICcnO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYXNlICdyZW5hbWUtZmlsZSc6XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5tb2RhbC5oZWlnaHQgPSAxNjU7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5tb2RhbC50aXRsZSA9ICfph43lkb3lkI3phY3nva7ooajmlofku7YnO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMubW9kYWwudmFsdWVzWzBdID0gdGhpcy5maWxlLnJlbmFtZSB8fCB0aGlzLmZpbGUubmFtZTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLm1vZGFsLnZhbHVlc1sxXSA9IHRoaXMuZmlsZS5tZW1vO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYXNlICduZXctcGFnZSc6XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5tb2RhbC50aXRsZSA9ICfmlrDlu7rooajpobUnO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMubW9kYWwuaGVpZ2h0ID0gMTY1O1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMubW9kYWwudmFsdWVzWzBdID0gdGhpcy5tb2RhbC52YWx1ZXNbMV0gPSAnJztcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FzZSAncmVuYW1lLXBhZ2UnOlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMubW9kYWwudGl0bGUgPSAn6YeN5ZG95ZCNwrfovaznp7vooajpobUnO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMubW9kYWwuaGVpZ2h0ID0gMjI1O1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMubW9kYWwudmFsdWVzWzBdID0gdGhpcy5wYWdlLm5hbWU7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5tb2RhbC52YWx1ZXNbMV0gPSB0aGlzLnBhZ2UubWVtbyB8fCAnJztcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLm1vZGFsLnZhbHVlc1syXSA9IHRoaXMuZmlsZS5uYW1lO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMubW9kYWwudmFsdWVzWzNdID0gdGhpcy5maWxlLnBhZ2VzLmluZGV4T2YodGhpcy5wYWdlKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMubW9kYWwuc2hvdyA9IHRydWU7XHJcbiAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICBtb2RhbE9rKCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoWyduZXctZmlsZScsICdyZW5hbWUtZmlsZSddLmluY2x1ZGVzKHRoaXMubW9kYWwudHlwZSkgJiYgKCF0aGlzLm1vZGFsLnZhbHVlc1swXSB8fCAhL15bQS1aYS16XXsxfVtBLVphLXowLTldezAsfSQvLnRlc3QodGhpcy5tb2RhbC52YWx1ZXNbMF0pKSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5hbGVydCgn5paH5Lu25ZCN55Sx5aSn5bCP5YaZ5a2X5q+N5ZKM5pWw5a2X57uE5oiQ77yM5LiN6KaB55So5pWw5a2X5byA5aS0Jyk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMubW9kYWwudHlwZSA9PSAnbmV3LWZpbGUnICYmICghdGhpcy5tb2RhbC52YWx1ZXNbMl0gfHwgIS9bYS16XXsxfVthLXowLTlfXXswLH1bYS16MC05XXsxfSQvLnRlc3QodGhpcy5tb2RhbC52YWx1ZXNbMl0pKSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5hbGVydCgn6KGo6aG15ZCN6ZyA6KaB55Sx5bCP5YaZ5a2X5q+N44CB5pWw5a2X5Y+K5LiL5YiS57q/57uE5oiQ77yM5LiN6KaB55So5pWw5a2X5oiW5LiL5YiS57q/5byA5aS077yM5LiN5bCP5LqO5Lik5Liq5a2X56ymJyk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKFsnbmV3LXBhZ2UnLCAncmVuYW1lLXBhZ2UnXS5pbmNsdWRlcyh0aGlzLm1vZGFsLnR5cGUpICYmICghdGhpcy5tb2RhbC52YWx1ZXNbMF0gfHwgIS9bYS16XXsxfVthLXowLTlfXXswLH1bYS16MC05XXsxfSQvLnRlc3QodGhpcy5tb2RhbC52YWx1ZXNbMF0pKSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5hbGVydCgn6KGo6aG15ZCN6ZyA6KaB55Sx5bCP5YaZ5a2X5q+N44CB5pWw5a2X5Y+K5LiL5YiS57q/57uE5oiQ77yM5LiN6KaB55So5pWw5a2X5oiW5LiL5YiS57q/5byA5aS077yM5LiN5bCP5LqO5Lik5Liq5a2X56ymJyk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgc3dpdGNoKHRoaXMubW9kYWwudHlwZSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FzZSAnbmV3LWZpbGUnOlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucGFyc2VkLnB1c2godGhpcy5maWxlID0ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBuYW1lOiB0aGlzLm1vZGFsLnZhbHVlc1swXSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbWVtbzogdGhpcy5tb2RhbC52YWx1ZXNbMV0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBhZ2VzOiBbe25hbWU6IHRoaXMubW9kYWwudmFsdWVzWzJdLCBkYXRhOlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5jaGVja0lzQ29uZmlnUGFnZSh0aGlzLm1vZGFsLnZhbHVlc1syXSkgPyBbXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgWydfaWQnLCAnbWVtbycsICd0eXBlJywgJ3ZhbHVlJ10sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgWydzdHJpbmcnLCAnaWdub3JlJywgJ3R5cGUnLCAndmFsdWUnXSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBbJ+WPguaVsOWQjScsICfmj4/ov7AnLCAn57G75Z6LJywgJ+WAvCddLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXSA6IFtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBbJ19pZCddLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFsnc3RyaW5nJ10sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgWyfnvJblj7cnXSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBbJyNNRU1PJ10sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgWycxJ11cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIF1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfV0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlbW92ZWQ6IGZhbHNlLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucGFyc2VkLnNvcnQoKGYxLCBmMikgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gKGYxLm1lbW8gfHwgZjEubmFtZSkgPCAoZjIubWVtbyB8fCBmMS5uYW1lKSA/IC0xIDogMTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnBhZ2UgPSB0aGlzLmZpbGUucGFnZXNbMF0gfHwgbnVsbDtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FzZSAncmVuYW1lLWZpbGUnOlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLm1vZGFsLnZhbHVlc1swXSAhPSAodGhpcy5maWxlLnJlbmFtZSB8fCB0aGlzLmZpbGUubmFtZSkpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5maWxlLnJlbmFtZSA9IHRoaXMubW9kYWwudmFsdWVzWzBdO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmZpbGUubWVtbyA9IHRoaXMubW9kYWwudmFsdWVzWzFdO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucGFyc2VkLnNvcnQoKGYxLCBmMikgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gKGYxLm1lbW8gfHwgZjEubmFtZSkgPCAoZjIubWVtbyB8fCBmMS5uYW1lKSA/IC0xIDogMTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FzZSAnbmV3LXBhZ2UnOlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZmlsZS5wYWdlcy5wdXNoKHRoaXMucGFnZSA9IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbmFtZTogdGhpcy5tb2RhbC52YWx1ZXNbMF0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1lbW86IHRoaXMubW9kYWwudmFsdWVzWzFdIHx8ICcnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkYXRhOiB0aGlzLmNoZWNrSXNDb25maWdQYWdlKHRoaXMubW9kYWwudmFsdWVzWzBdKSA/IFtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFsnX2lkJywgJ21lbW8nLCAndHlwZScsICd2YWx1ZSddLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgWydzdHJpbmcnLCAnaWdub3JlJywgJ3R5cGUnLCAndmFsdWUnXSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFsn5Y+C5pWw5ZCNJywgJ+aPj+i/sCcsICfnsbvlnosnLCAn5YC8J10sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIF0gOiBbXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBbJ19pZCddLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgWydzdHJpbmcnXSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFsn57yW5Y+3J10sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBbJyNNRU1PJ10sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBbJzEnXVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBdXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhc2UgJ3JlbmFtZS1wYWdlJzpcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnBhZ2UubmFtZSA9IHRoaXMubW9kYWwudmFsdWVzWzBdO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucGFnZS5tZW1vID0gdGhpcy5tb2RhbC52YWx1ZXNbMV0gfHwgJyc7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMuZmlsZS5uYW1lICE9IHRoaXMubW9kYWwudmFsdWVzWzJdKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZmlsZS5wYWdlcy5zcGxpY2UodGhpcy5maWxlLnBhZ2VzLmluZGV4T2YodGhpcy5wYWdlKSwgMSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZmlsZSA9IHRoaXMucGFyc2VkLmZpbmQoZmlsZSA9PiBmaWxlLm5hbWUgPT0gdGhpcy5tb2RhbC52YWx1ZXNbMl0pO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmZpbGUucGFnZXMucHVzaCh0aGlzLnBhZ2UpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5maWxlLnBhZ2VzLmluZGV4T2YodGhpcy5wYWdlKSAhPSB0aGlzLm1vZGFsLnZhbHVlc1szXSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmZpbGUucGFnZXMuc3BsaWNlKHRoaXMubW9kYWwudmFsdWVzWzNdLCAwLCAuLi50aGlzLmZpbGUucGFnZXMuc3BsaWNlKHRoaXMuZmlsZS5wYWdlcy5pbmRleE9mKHRoaXMucGFnZSksIDEpKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5tb2RhbC5zaG93ID0gZmFsc2U7XHJcbiAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICBtb2RhbENsb3NlKCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLm1vZGFsLnNob3cgPSBmYWxzZTtcclxuICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICAgIGNoZWNrSXNDb25maWdQYWdlKG5hbWU6IHN0cmluZykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gbmFtZS5lbmRzV2l0aCgnY29uZmlnJyk7XHJcbiAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICBhc3luYyBleHBvcnRUb1Byb2plY3QoKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLmR1cGxpY2F0ZWRGaWxlTmFtZXMubGVuZ3RoID4gMCB8fCB0aGlzLmR1cGxpY2F0ZWRQYWdlTmFtZXMubGVuZ3RoID4gMCB8fCB0aGlzLmR1cGxpY2F0ZWRLZXlzLmxlbmd0aCA+IDAgfHwgdGhpcy5kdXBsaWNhdGVkUm93cy5sZW5ndGggPiAwKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5hbGVydCgn5b2T5YmN5a2Y5Zyo6YeN5aSN55qE5paH5Lu25ZCN77yM6KGo5ZCN77yM5oiW5p+Q5Lqb6KGo5YaF5a2Y5Zyo55u45ZCM55qE5Y+C5pWw5ZCN5oiW55u45ZCMX2lk55qE6aG577yM6K+35L+u5pS55ZCO5YaN5a+85Ye644CCJyk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgc2V0dGluZy5wYXRoID0gdGhpcy5wYXRoO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICArK3NldHRpbmcudmVyc2lvbjtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5zYXZlU2V0dGluZygpO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZSBLViA9IHtba2V5OiBzdHJpbmddOiBudW1iZXIgfCBzdHJpbmcgfCBLVn07XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgbGlzdDoge1trZXk6IHN0cmluZ106IG51bWJlciB8IHN0cmluZyB8IEtWfSA9IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZlcnNpb246IHNldHRpbmcudmVyc2lvblxyXG4gICAgICAgICAgICAgICAgICAgICAgICB9O1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgaW50ZnM6IHtba2V5OiBzdHJpbmddOiBLViB8IHN0cmluZ30gPSB7fTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgYW5ub3M6IHtba2V5OiBzdHJpbmddOiBLViB8IHN0cmluZ30gPSB7fTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGF3YWl0IFByb21pc2UuYWxsKHRoaXMucGFyc2VkLm1hcChhc3luYyB4bHMgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIFByb21pc2UuYWxsKHhscy5wYWdlcy5tYXAoYXN5bmMgcGFnZSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHBhZ2UubmFtZS5zdGFydHNXaXRoKCdpZ25vcmVfJykgfHwgIXBhZ2UuZGF0YVsxXSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBpbnRmID0gaW50ZnNbcGFnZS5uYW1lXSA9IHt9O1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGFubm8gPSBhbm5vc1twYWdlLm5hbWVdID0ge307XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QganNvbiA9IGxpc3RbcGFnZS5uYW1lXSA9IHt9O1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5jaGVja0lzQ29uZmlnUGFnZShwYWdlLm5hbWUpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IG1lbW9JZHggPSBwYWdlLmRhdGFbMF0uaW5kZXhPZignbWVtbycpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB0eXBlSWR4ID0gcGFnZS5kYXRhWzBdLmluZGV4T2YoJ3R5cGUnKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgdmFsSWR4ID0gcGFnZS5kYXRhWzBdLmluZGV4T2YoJ3ZhbHVlJyk7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gUHJvbWlzZS5hbGwocGFnZS5kYXRhLnNsaWNlKDMpLm1hcChhc3luYyBkYXRhID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGtleSA9IGRhdGFbMF07XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoa2V5KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgdHlwZVN0cmluZyA9IGRhdGFbdHlwZUlkeF07XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgcGFyc2VyID0gbmV3IFR5cGVQYXJzZXIodHlwZVN0cmluZywga2V5KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpbnRmW2tleV0gPSBwYXJzZXIuVHlwZVN0cmluZ1RTO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFubm9ba2V5XSA9IGRhdGFbbWVtb0lkeF07XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAganNvbltrZXldID0gYXdhaXQgcGFyc2VyLlBhcnNlQW5kUmVwbGFjZUFzc2V0KGRhdGFbdmFsSWR4XSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHR5cGVQYXJzZXJzOiBUeXBlUGFyc2VyW10gPSBwYWdlLmRhdGFbMV0uZmlsdGVyKHQgPT4gISF0KS5tYXAoKHQsIGlkeCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3dpdGNoKHQpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYXNlICdpZ25vcmUnOlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYXNlICdlbnVtJzp7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGVudW1MaXN0OiBzdHJpbmdbXSA9IFtdO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gNDtpIDwgcGFnZS5kYXRhLmxlbmd0aDsrK2kpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGtleSA9IHBhZ2UuZGF0YVtpXVtpZHhdO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAga2V5ICYmICFlbnVtTGlzdC5pbmNsdWRlcyhrZXkpICYmIGVudW1MaXN0LnB1c2goa2V5KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gbmV3IFR5cGVQYXJzZXIodCwgcGFnZS5kYXRhWzBdW2lkeF0sIGVudW1MaXN0KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVmYXVsdDpcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG5ldyBUeXBlUGFyc2VyKHQsIHBhZ2UuZGF0YVswXVtpZHhdKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwYWdlLmRhdGFbMF0uZm9yRWFjaCgoa2V5LCBpZHgpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICghdHlwZVBhcnNlcnNbaWR4XSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGludGZba2V5XSA9IHR5cGVQYXJzZXJzW2lkeF0uVHlwZVN0cmluZ1RTO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYW5ub1trZXldID0gcGFnZS5kYXRhWzJdW2lkeF07XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIFByb21pc2UuYWxsKHBhZ2UuZGF0YS5zbGljZSg0KS5tYXAoYXN5bmMgZGF0YSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBrZXkgPSBkYXRhWzBdO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGtleSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGpzb25ba2V5XSA9IHt9O1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBQcm9taXNlLmFsbChkYXRhLm1hcChhc3luYyAodmFsLCBpZHgpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCF0eXBlUGFyc2Vyc1tpZHhdIHx8IHR5cGVQYXJzZXJzW2lkeF0uaXNJZ25vcmUpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBqc29uW2tleV1bcGFnZS5kYXRhWzBdW2lkeF1dID0gYXdhaXQgdHlwZVBhcnNlcnNbaWR4XS5QYXJzZUFuZFJlcGxhY2VBc3NldCh2YWwpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSkpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfSkpXHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyB0aGlzLnBhcnNlZC5mb3JFYWNoKGFzeW5jIHhscyA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vICAgICB4bHMucGFnZXMuZm9yRWFjaChhc3luYyBwYWdlID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gICAgICAgICBpZiAocGFnZS5uYW1lLnN0YXJ0c1dpdGgoJ2lnbm9yZV8nKSB8fCAhcGFnZS5kYXRhWzFdKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyAgICAgICAgIGNvbnN0IGludGYgPSBpbnRmc1twYWdlLm5hbWVdID0ge307XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vICAgICAgICAgY29uc3QgYW5ubyA9IGFubm9zW3BhZ2UubmFtZV0gPSB7fTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gICAgICAgICBjb25zdCBqc29uID0gbGlzdFtwYWdlLm5hbWVdID0ge307XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyAgICAgICAgIGlmICh0aGlzLmNoZWNrSXNDb25maWdQYWdlKHBhZ2UubmFtZSkpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gICAgICAgICAgICAgY29uc3QgbWVtb0lkeCA9IHBhZ2UuZGF0YVswXS5pbmRleE9mKCdtZW1vJyk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vICAgICAgICAgICAgIGNvbnN0IHR5cGVJZHggPSBwYWdlLmRhdGFbMF0uaW5kZXhPZigndHlwZScpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyAgICAgICAgICAgICBjb25zdCB2YWxJZHggPSBwYWdlLmRhdGFbMF0uaW5kZXhPZigndmFsdWUnKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gICAgICAgICAgICAgZm9yIChsZXQgaSA9IDM7aSA8IHBhZ2UuZGF0YS5sZW5ndGg7KytpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vICAgICAgICAgICAgICAgICBjb25zdCBkYXRhID0gcGFnZS5kYXRhW2ldO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyAgICAgICAgICAgICAgICAgY29uc3Qga2V5ID0gZGF0YVswXTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gICAgICAgICAgICAgICAgIGlmIChrZXkpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gICAgICAgICAgICAgICAgICAgICBjb25zdCB0eXBlU3RyaW5nID0gZGF0YVt0eXBlSWR4XTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gICAgICAgICAgICAgICAgICAgICBjb25zdCBwYXJzZXIgPSBuZXcgVHlwZVBhcnNlcih0eXBlU3RyaW5nLCBrZXkpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyAgICAgICAgICAgICAgICAgICAgIGludGZba2V5XSA9IHBhcnNlci5UeXBlU3RyaW5nVFM7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vICAgICAgICAgICAgICAgICAgICAgYW5ub1trZXldID0gZGF0YVttZW1vSWR4XTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gICAgICAgICAgICAgICAgICAgICBqc29uW2tleV0gPSBwYXJzZXIuUGFyc2UoZGF0YVt2YWxJZHhdKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gICAgICAgICAgICAgY29uc3QgdHlwZVBhcnNlcnM6IFR5cGVQYXJzZXJbXSA9IHBhZ2UuZGF0YVsxXS5maWx0ZXIodCA9PiAhIXQpLm1hcCgodCwgaWR4KSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vICAgICAgICAgICAgICAgICBzd2l0Y2godCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyAgICAgICAgICAgICAgICAgICAgIGNhc2UgJ2lnbm9yZSc6XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyAgICAgICAgICAgICAgICAgICAgIGNhc2UgJ2VudW0nOntcclxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZW51bUxpc3Q6IHN0cmluZ1tdID0gW107XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vICAgICAgICAgICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSA0O2kgPCBwYWdlLmRhdGEubGVuZ3RoOysraSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qga2V5ID0gcGFnZS5kYXRhW2ldW2lkeF07XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vICAgICAgICAgICAgICAgICAgICAgICAgICAgICBrZXkgJiYgIWVudW1MaXN0LmluY2x1ZGVzKGtleSkgJiYgZW51bUxpc3QucHVzaChrZXkpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyAgICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBuZXcgVHlwZVBhcnNlcih0LCBwYWdlLmRhdGFbMF1baWR4XSwgZW51bUxpc3QpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gICAgICAgICAgICAgICAgICAgICBkZWZhdWx0OlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gbmV3IFR5cGVQYXJzZXIodCwgcGFnZS5kYXRhWzBdW2lkeF0pO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyAgICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vICAgICAgICAgICAgIHBhZ2UuZGF0YVswXS5mb3JFYWNoKChrZXksIGlkeCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyAgICAgICAgICAgICAgICAgaWYgKCF0eXBlUGFyc2Vyc1tpZHhdKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vICAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyAgICAgICAgICAgICAgICAgaW50ZltrZXldID0gdHlwZVBhcnNlcnNbaWR4XS5UeXBlU3RyaW5nVFM7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vICAgICAgICAgICAgICAgICBhbm5vW2tleV0gPSBwYWdlLmRhdGFbMl1baWR4XTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyAgICAgICAgICAgICBmb3IgKGxldCBpID0gNDtpIDwgcGFnZS5kYXRhLmxlbmd0aDsrK2kpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gICAgICAgICAgICAgICAgIGNvbnN0IGRhdGEgPSBwYWdlLmRhdGFbaV07XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vICAgICAgICAgICAgICAgICBjb25zdCBrZXkgPSBkYXRhWzBdO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyAgICAgICAgICAgICAgICAgaWYgKGtleSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyAgICAgICAgICAgICAgICAgICAgIGpzb25ba2V5XSA9IHt9O1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyAgICAgICAgICAgICAgICAgICAgIGRhdGEuZm9yRWFjaCgodmFsLCBpZHgpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCF0eXBlUGFyc2Vyc1tpZHhdIHx8IHR5cGVQYXJzZXJzW2lkeF0uaXNJZ25vcmUpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyAgICAgICAgICAgICAgICAgICAgICAgICBqc29uW2tleV1bcGFnZS5kYXRhWzBdW2lkeF1dID0gdHlwZVBhcnNlcnNbaWR4XS5QYXJzZSh2YWwpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyAgICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIH0pO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgaGVscGVyID0gcmVuZGVyKGhlbHBlclRlbXAsIHtpbnRmcywgbGlzdCwgYW5ub3N9KTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ2NyZWF0ZS1hc3NldCcsIEVYUE9SVF9KU09OX1BBVEgsIEpTT04uc3RyaW5naWZ5KGxpc3QpLCB7b3ZlcndyaXRlOiB0cnVlfSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ2NyZWF0ZS1hc3NldCcsIEVYUE9SVF9IRUxQRVJfUEFUSCwgaGVscGVyLCB7b3ZlcndyaXRlOiB0cnVlfSk7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmFsZXJ0KCflr7zlhaXlrozmiJDvvIzniYjmnKzvvJonICsgc2V0dGluZy52ZXJzaW9uLCAn5a+85YWl5a6M5oiQJywgJ2luZm8nKTtcclxuICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICAgIGFzeW5jIGFsZXJ0KGRldGFpbDogc3RyaW5nLCB0aXRsZT0n5Ye6546w6Zeu6aKYJywgbGV2ZWwgPSAnd2FybicpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIEVkaXRvci5EaWFsb2dbbGV2ZWxdKHRpdGxlLCB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXRhaWw6IGRldGFpbCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJ1dHRvbnM6IFsn56Gu6K6kJ11cclxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICBhc3luYyBjb25maXJtKGRldGFpbDogc3RyaW5nLCB0aXRsZTogc3RyaW5nID0gJ+ivt+ehruiupCcpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgY29kZSA9IGF3YWl0IEVkaXRvci5EaWFsb2cud2Fybih0aXRsZSwge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGV0YWlsLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYnV0dG9uczogWyfnoa7orqQnLCAn5Y+W5raIJ11cclxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBjb2RlLnJlc3BvbnNlID09IDA7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIGNvbXB1dGVkOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgbWVtb0luZGV4KCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgaWR4ID0gdGhpcy5wYWdlLmRhdGFbMF0uaW5kZXhPZignbmFtZScpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoaWR4ID09IC0xKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZHggPSB0aGlzLnBhZ2UuZGF0YVswXS5pbmRleE9mKCdtZW1vJyk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGlkeDtcclxuICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICAgIGR1cGxpY2F0ZWRGaWxlTmFtZXMoKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IG5hbWVzID0gdGhpcy5wYXJzZWQubWFwKGZpbGUgPT4gZmlsZS5yZW5hbWUgfHwgZmlsZS5uYW1lKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG5hbWVzLmZpbHRlcihuYW1lID0+IG5hbWVzLmluZGV4T2YobmFtZSkgIT0gbmFtZXMubGFzdEluZGV4T2YobmFtZSkpO1xyXG4gICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgZHVwbGljYXRlZFBhZ2VOYW1lcygpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgcGFnZXM6IHN0cmluZ1tdID0gW107XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucGFyc2VkLmZvckVhY2goZmlsZSA9PiBmaWxlLnBhZ2VzLmZvckVhY2gocGFnZSA9PiBwYWdlcy5wdXNoKHBhZ2UubmFtZSkpKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHBhZ2VzLmZpbHRlcihwYWdlID0+IHBhZ2VzLmluZGV4T2YocGFnZSkgIT0gcGFnZXMubGFzdEluZGV4T2YocGFnZSkpO1xyXG4gICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgZHVwbGljYXRlZEtleXMoKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGtleXM6IHN0cmluZ1tdW10gPSBbXTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5wYXJzZWQuZm9yRWFjaChmaWxlID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZpbGUucGFnZXMuZm9yRWFjaChwYWdlID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwYWdlLmRhdGFbMF0uZm9yRWFjaChrZXkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAocGFnZS5kYXRhWzBdLmluZGV4T2Yoa2V5KSAhPSBwYWdlLmRhdGFbMF0ubGFzdEluZGV4T2Yoa2V5KSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAga2V5cy5wdXNoKFtmaWxlLm5hbWUsIHBhZ2UubmFtZSwga2V5XSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGtleXM7XHJcbiAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICBkdXBsaWNhdGVkUm93cygpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgcm93czogc3RyaW5nW11bXSA9IFtdO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnBhcnNlZC5mb3JFYWNoKGZpbGUgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZmlsZS5wYWdlcy5mb3JFYWNoKHBhZ2UgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGlkczogc3RyaW5nW10gPSBwYWdlLmRhdGEuc2xpY2UoNCkubWFwKGQgPT4gZFswXSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWRzLmZvckVhY2goX2lkID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGlkcy5pbmRleE9mKF9pZCkgIT0gaWRzLmxhc3RJbmRleE9mKF9pZCkpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJvd3MucHVzaChbZmlsZS5uYW1lLCBwYWdlLm5hbWUsIF9pZF0pO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiByb3dzO1xyXG4gICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgY2FuTW92ZVVwKCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5pc0NvbmZpZ1BhZ2UpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLnJvd0luZGV4ID4gMDtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBzd2l0Y2godGhpcy5lZGl0TW9kZSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FzZSAwOlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLmtleUluZGV4ID4gMTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhc2UgMTpcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5yb3dJbmRleCA+IDA7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgY2FuTW92ZURvd24oKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLmlzQ29uZmlnUGFnZSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMucm93SW5kZXggPCB0aGlzLnBhZ2UuZGF0YS5sZW5ndGggLSA0O1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHN3aXRjaCh0aGlzLmVkaXRNb2RlKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYXNlIDA6XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMua2V5SW5kZXggIT0gMCAmJiB0aGlzLmtleUluZGV4IDwgdGhpcy5wYWdlLmRhdGFbMF0ubGVuZ3RoIC0gMTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhc2UgMTpcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5yb3dJbmRleCA8IHRoaXMucGFnZS5kYXRhLmxlbmd0aCAtIDU7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgY2FuUmVtb3ZlKCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5pc0NvbmZpZ1BhZ2UpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHN3aXRjaCh0aGlzLmVkaXRNb2RlKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYXNlIDA6XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMua2V5SW5kZXggIT0gMDtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhc2UgMTpcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5wYWdlLmRhdGEubGVuZ3RoID4gNTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICBwYXJzZXIoKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHBhcnNlciA9IHRoaXMucGFyc2Vyc1t0aGlzLmlzQ29uZmlnUGFnZSA/IHRoaXMucm93SW5kZXggOiB0aGlzLmtleUluZGV4XTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHBhcnNlcjtcclxuICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICAgIGtzKCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBrcyA9IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1lbW9zOiB7fSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGtleXM6IHt9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucGFyc2VkLmZvckVhY2goZmlsZSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmaWxlLnBhZ2VzLmZvckVhY2gocGFnZSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgayA9IHVuZGVybGluZVRvSHVtcChgVF8ke3BhZ2UubmFtZX1fa2V5YCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgbmFtZUlkeCA9IHBhZ2UuZGF0YVswXS5pbmRleE9mKCduYW1lJyk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgbWVtb0lkeCA9IHBhZ2UuZGF0YVswXS5pbmRleE9mKCdtZW1vJyk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAga3Mua2V5c1trXSA9IHt9O1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBhZ2UuZGF0YS5zbGljZSg0KS5mb3JFYWNoKGQgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBrcy5rZXlzW2tdW2RbMF1dID0gKG5hbWVJZHggPj0gMCA/IGRbbmFtZUlkeF0gOiBtZW1vSWR4ID49IDAgPyBkW21lbW9JZHhdIDogZFswXSkgfHwgZFswXTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBrcy5tZW1vc1trXSA9IHBhZ2UubWVtbyB8fCBrO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4ga3M7XHJcbiAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICB1cGRhdGVkVHlwZSgpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCF0aGlzLnBhcnNlcikge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuICcnO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IG9yaWdpbiA9IHRoaXMuaXNDb25maWdQYWdlID8gdGhpcy5wYWdlLmRhdGFbdGhpcy5yb3dJbmRleCArIDNdWzJdIDogdGhpcy5wYWdlLmRhdGFbMV1bdGhpcy5rZXlJbmRleF07XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLnBhcnNlci5UeXBlU3RyaW5nICE9IG9yaWdpbikge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCF0aGlzLnBhcnNlci5pc0pTT04gJiYgKHRoaXMucGFyc2VyLmVuY29kZWRWYWx1ZS5zdGFydHNXaXRoKCd7JykgfHwgdGhpcy5wYXJzZXIuZW5jb2RlZFZhbHVlLnN0YXJ0c1dpdGgoJ1t7JykpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5wYXJzZXIuZW5jb2RlZFZhbHVlID0gdGhpcy5wYXJzZXIuRW5jb2RlKHRoaXMucGFyc2VyLnBhcnNlZFZhbHVlKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucGFyc2VyLnBhcnNlZFZhbHVlID0gdGhpcy5wYXJzZXIuUGFyc2UodGhpcy5wYXJzZXIuZW5jb2RlZFZhbHVlKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnBhcnNlci5lbmNvZGVkVmFsdWUgPSB0aGlzLnBhcnNlci5FbmNvZGUodGhpcy5wYXJzZXIucGFyc2VkVmFsdWUpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5pc0NvbmZpZ1BhZ2UpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLnBhZ2UuZGF0YVt0aGlzLnJvd0luZGV4ICsgM11bMl0gPSB0aGlzLnBhcnNlci5UeXBlU3RyaW5nO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMucGFnZS5kYXRhWzFdW3RoaXMua2V5SW5kZXhdID0gdGhpcy5wYXJzZXIuVHlwZVN0cmluZztcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgZW5jb2RlZFZhbHVlKCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIXRoaXMucGFyc2VyKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gJyc7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMucGFyc2VyLkVuY29kZSh0aGlzLnBhcnNlci5wYXJzZWRWYWx1ZSk7XHJcbiAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICBwYXJzZWRWYWx1ZSgpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCF0aGlzLnBhcnNlcikge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuICcnO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLnBhcnNlci5lbmNvZGVkVmFsdWUgIT0gdGhpcy5lbmNvZGVkVmFsdWUpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucGFyc2VyLmVuY29kZWRWYWx1ZSA9IHRoaXMuZW5jb2RlZFZhbHVlO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh0aGlzLnBhcnNlci5wYXJzZWRWYWx1ZSk7XHJcbiAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICB1cGRhdGVkUGFnZSgpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCF0aGlzLnBhZ2UpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5pc0NvbmZpZ1BhZ2UpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucGFyc2Vycy5mb3JFYWNoKChwYXJzZXI6IFR5cGVQYXJzZXIsIGlkeDogbnVtYmVyKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5wYWdlLmRhdGFbaWR4ICsgM11bMF0gPSBwYXJzZXIuVHlwZUtleTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnBhZ2UuZGF0YVtpZHggKyAzXVsxXSA9IHBhcnNlci5UeXBlTWVtbztcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnBhZ2UuZGF0YVtpZHggKyAzXVsyXSA9IHBhcnNlci5UeXBlU3RyaW5nO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucGFnZS5kYXRhW2lkeCArIDNdWzNdID0gcGFyc2VyLmVuY29kZWRWYWx1ZSA9IHBhcnNlci5FbmNvZGUocGFyc2VyLnBhcnNlZFZhbHVlKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5wYXJzZXJzLmZvckVhY2goKHBhcnNlcjogVHlwZVBhcnNlciwgaWR4OiBudW1iZXIpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnBhZ2UuZGF0YVswXVtpZHhdID0gcGFyc2VyLlR5cGVLZXk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5wYWdlLmRhdGFbMV1baWR4XSA9IHBhcnNlci5UeXBlU3RyaW5nO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucGFnZS5kYXRhWzJdW2lkeF0gPSBwYXJzZXIuVHlwZU1lbW87XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5wYWdlLmRhdGFbdGhpcy5yb3dJbmRleCArIDRdW2lkeF0gPSBwYXJzZXIuZW5jb2RlZFZhbHVlID0gcGFyc2VyLkVuY29kZShwYXJzZXIucGFyc2VkVmFsdWUpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMucGFnZTtcclxuICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICAgIGlzQ29uZmlnUGFnZSgpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMucGFnZSAmJiB0aGlzLmNoZWNrSXNDb25maWdQYWdlKHRoaXMucGFnZS5uYW1lKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgd2F0Y2g6IHtcclxuICAgICAgICAgICAgICAgICAgICBwYWdlKCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnVwZGF0ZVBhcnNlcigpO1xyXG4gICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgcm93SW5kZXgoKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICF0aGlzLmlzQ29uZmlnUGFnZSAmJiB0aGlzLnVwZGF0ZVBhcnNlcigpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICBtb3VudGVkKCkge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMudXBkYXRlUGFyc2VyKCk7XHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgYXBwLmNvbmZpZy5jb21waWxlck9wdGlvbnMuaXNDdXN0b21FbGVtZW50ID0gKHRhZykgPT4gdGFnLnN0YXJ0c1dpdGgoJ3VpLScpO1xyXG4gICAgICAgICAgICBhcHAuY29tcG9uZW50KCd0eXBlLXBhcnNlcicsIHtcclxuICAgICAgICAgICAgICAgIHRlbXBsYXRlOiByZWFkRmlsZVN5bmMoam9pbihfX2Rpcm5hbWUsICcuLi8uLi8uLi9zdGF0aWMvdGVtcGxhdGUvdnVlL3R5cGUtcGFyc2VyLmh0bWwnKSwgJ3V0Zi04JyksXHJcbiAgICAgICAgICAgICAgICBwcm9wczoge1xyXG4gICAgICAgICAgICAgICAgICAgIHBhcnNlcjoge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiBUeXBlUGFyc2VyLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBkZWZhdWx0OiBudWxsXHJcbiAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICBrczoge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBkZWZhdWx0OiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBtZW1vczoge30sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBrZXlzOiB7fVxyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICBtb2RlOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6IE51bWJlcixcclxuICAgICAgICAgICAgICAgICAgICAgICAgZGVmYXVsdDogMFxyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICBtZXRob2RzOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgc2V0QmFzZVR5cGUodHlwZTogc3RyaW5nKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIFsncXVvdCcsICdudW1iZXInLCAnc3RyaW5nJywgJ2VudW0nLCAnaGFzaCcsICdpZ25vcmUnLCAnZ3JpZCcsICdhc3NldCcsICdjb2xvcicsICd0ZXh0J10uZm9yRWFjaChrZXkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5wYXJzZXJbJ2lzJyArIGtleVswXS50b1VwcGVyQ2FzZSgpICsga2V5LnNsaWNlKDEpXSA9IGtleSA9PSB0eXBlO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHR5cGUgPT0gJ2hhc2gnICYmIHRoaXMucGFyc2VyLmhhc2hLZXlUeXBlUGFyc2Vycy5sZW5ndGggPT0gMCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5wYXJzZXIuaGFzaEtleVR5cGVQYXJzZXJzLnB1c2gobmV3IFR5cGVQYXJzZXIoJ3N0cmluZycsICdOZXdLZXknKSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHR5cGUgPT0gJ2VudW0nICYmIHRoaXMucGFyc2VyLmVudW1LZXlzLmxlbmd0aCA9PSAwKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnBhcnNlci5lbnVtS2V5cy5wdXNoKCduZXdfZW51bV9rZXknKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoWydlbnVtJywgJ2hhc2gnLCAnZ3JpZCddLmluY2x1ZGVzKHR5cGUpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnBhcnNlci50eXBlID0gJyc7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHR5cGUgPT0gJ2Fzc2V0Jykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5wYXJzZXIudHlwZSA9ICdjYy5JbWFnZUFzc2V0JztcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyB0aGlzLnBhcnNlci5wYXJzZWRWYWx1ZSA9IHRoaXMucGFyc2VyLk5ld1ZhbHVlO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyB0aGlzLnBhcnNlci5lbmNvZGVkVmFsdWUgPSB0aGlzLnBhcnNlci5FbmNvZGUodGhpcy5wYXJzZXIucGFyc2VkVmFsdWUpO1xyXG4gICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgc2V0VHlwZVBhcnNlcihrZXk6IHN0cmluZywgdmFsdWU6IGFueSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnBhcnNlcltrZXldID0gdmFsdWU7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIHRoaXMucGFyc2VyLmVuY29kZWRWYWx1ZSA9IHRoaXMucGFyc2VyLkVuY29kZSh0aGlzLnBhcnNlci5wYXJzZWRWYWx1ZSA9IHRoaXMucGFyc2VyLlBhcnNlKHRoaXMucGFyc2VyLmVuY29kZWRWYWx1ZSkpO1xyXG4gICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgbmV3VHlwZVBhcnNlcihpZHg6IG51bWJlcikge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnBhcnNlci5oYXNoS2V5VHlwZVBhcnNlcnMuc3BsaWNlKGlkeCArIDEsIDAsIG5ldyBUeXBlUGFyc2VyKCdzdHJpbmcnLCAnTmV3S2V5JykpO1xyXG4gICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgcmVtb3ZlVHlwZVBhcnNlcihpZHg6IG51bWJlcikge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnBhcnNlci5oYXNoS2V5VHlwZVBhcnNlcnMuc3BsaWNlKGlkeCwgMSk7XHJcbiAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICBzZXRFbnVtS2V5KGlkeDogbnVtYmVyLCBrZXk6IHN0cmluZykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBtZW1vID0gdGhpcy5wYXJzZXIuZW51bUtleXNbaWR4XS5zcGxpdCgnQCcpWzFdO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnBhcnNlci5lbnVtS2V5c1tpZHhdID0ga2V5ICsgKG1lbW8gPyAnQCcgKyBtZW1vIDogJycpO1xyXG4gICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgc2V0RW51bU1lbW8oaWR4OiBudW1iZXIsIG1lbW86IHN0cmluZykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBrZXkgPSB0aGlzLnBhcnNlci5lbnVtS2V5c1tpZHhdLnNwbGl0KCdAJylbMF07XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucGFyc2VyLmVudW1LZXlzW2lkeF0gPSBrZXkgKyAobWVtbyA/ICdAJyArIG1lbW8gOiAnJyk7XHJcbiAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICBuZXdFbnVtS2V5KGlkeDogbnVtYmVyKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucGFyc2VyLmVudW1LZXlzLnNwbGljZShpZHggKyAxLCAwLCAnbmV3X2VudW1fa2V5Jyk7XHJcbiAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICByZW1vdmVFbnVtS2V5KGlkeDogbnVtYmVyKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucGFyc2VyLmVudW1LZXlzLnNwbGljZShpZHgsIDEpO1xyXG4gICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgY29tcHV0ZWQ6IHtcclxuICAgICAgICAgICAgICAgICAgICBiYXNlVHlwZSgpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCF0aGlzLnBhcnNlcikge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuICcnO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLnBhcnNlci5pc1F1b3QgPyAncXVvdCcgOlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5wYXJzZXIuaXNOdW1iZXIgPyAnbnVtYmVyJyA6XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnBhcnNlci5pc1N0cmluZyA/ICdzdHJpbmcnIDpcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucGFyc2VyLmlzRW51bSA/ICdlbnVtJyA6XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnBhcnNlci5pc0hhc2ggPyAnaGFzaCcgOiBcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucGFyc2VyLmlzSWdub3JlID8gJ2lnbm9yZScgOiBcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucGFyc2VyLmlzR3JpZCA/ICdncmlkJyA6XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnBhcnNlci5pc0Fzc2V0ID8gJ2Fzc2V0JyA6IFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5wYXJzZXIuaXNDb2xvciA/ICdjb2xvcic6IFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5wYXJzZXIuaXNUZXh0ID8gJ3RleHQnOiAnJztcclxuICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICAgIGtzS2V5cygpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIE9iamVjdC5rZXlzKHRoaXMua3Mua2V5cyk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgYXBwLmNvbXBvbmVudCgndmFsdWUtbW9kaWZpZXInLCB7XHJcbiAgICAgICAgICAgICAgICB0ZW1wbGF0ZTogcmVhZEZpbGVTeW5jKGpvaW4oX19kaXJuYW1lLCAnLi4vLi4vLi4vc3RhdGljL3RlbXBsYXRlL3Z1ZS92YWx1ZS1tb2RpZmllci5odG1sJyksICd1dGYtOCcpLFxyXG4gICAgICAgICAgICAgICAgcHJvcHM6IHtcclxuICAgICAgICAgICAgICAgICAgICBwYXJzZXI6IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogVHlwZVBhcnNlcixcclxuICAgICAgICAgICAgICAgICAgICAgICAgZGVmYXVsdDogbnVsbFxyXG4gICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAga3M6IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgZGVmYXVsdDoge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbWVtb3M6IHt9LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAga2V5czoge31cclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgbW9kZToge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiBOdW1iZXIsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlZmF1bHQ6IDBcclxuICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICAgIHZhbDoge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBkZWZhdWx0OiBudWxsXHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIG1ldGhvZHM6IHtcclxuICAgICAgICAgICAgICAgICAgICBuZXdBcnJheUl0ZW0oaWR4OiBudW1iZXIpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGlkeCA8IDApIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucGFyc2VkVmFsLnB1c2godGhpcy5wYXJzZXIuTmV3SXRlbSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5wYXJzZWRWYWwuc3BsaWNlKGlkeCArIDEsIDAsIGNsb25lKHRoaXMucGFyc2VkVmFsW2lkeF0pKTtcclxuICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICAgIHJlbW92ZUFycmF5SXRlbShpZHg6IG51bWJlcikge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnBhcnNlZFZhbC5zcGxpY2UoaWR4LCAxKTtcclxuICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICAgIHNldFZhbChrZXk6IHN0cmluZywgdmFsLCBpZHggPSAtMSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5wYXJzZXIuaXNDb2xvcikge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFsID0gdHlwZW9mIHZhbCA9PSAnc3RyaW5nJyA/IEpTT04ucGFyc2UodmFsKSA6IHZhbDtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhbCA9ICcjJyArIHZhbC5tYXAoKHY6IG51bWJlcikgPT4gdi50b1N0cmluZygxNikucGFkU3RhcnQoMiwgJzAnKSkuam9pbignJyk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCF0aGlzLnZhbCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGlkeCA9PSAtMSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucGFyc2VyLnBhcnNlZFZhbHVlID0gdmFsO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMucGFyc2VyLmlzR3JpZCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnBhcnNlci5wYXJzZWRWYWx1ZSBePSAxIDw8IGlkeDtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucGFyc2VyLnBhcnNlZFZhbHVlW2lkeF0gPSB2YWw7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gdGhpcy5wYXJzZXIuZW5jb2RlZFZhbHVlID0gdGhpcy5wYXJzZXIuRW5jb2RlKHRoaXMucGFyc2VyLnBhcnNlZFZhbHVlKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBlbHNlIGlmIChpZHggPT0gLTEpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMudmFsW2tleV0gPSB2YWw7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnZhbFtrZXldID0gW10uY29uY2F0KHRoaXMudmFsW2tleV0pO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy52YWxba2V5XVtpZHhdID0gdmFsO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICBjb21wdXRlZDoge1xyXG4gICAgICAgICAgICAgICAgICAgIHBhcnNlZFZhbCgpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCF0aGlzLnBhcnNlcikge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuICcnO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLnZhbCA/IHRoaXMudmFsW3RoaXMucGFyc2VyLlR5cGVLZXldIDogdGhpcy5wYXJzZXIucGFyc2VkVmFsdWU7XHJcbiAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICBrc0l0ZW1zKCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIXRoaXMucGFyc2VyKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4ge307XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIE9iamVjdC5rZXlzKHRoaXMua3Mua2V5c1t0aGlzLnBhcnNlci50eXBlXSB8fCB7fSk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgYXBwLm1vdW50KHRoaXMuJC5hcHApO1xyXG4gICAgICAgICAgICBwYW5lbERhdGFNYXAuc2V0KHRoaXMsIGFwcCk7XHJcbiAgICAgICAgfVxyXG4gICAgfSxcclxuICAgIGJlZm9yZUNsb3NlKCkgeyB9LFxyXG4gICAgY2xvc2UoKSB7XHJcbiAgICAgICAgY29uc3QgYXBwID0gcGFuZWxEYXRhTWFwLmdldCh0aGlzKTtcclxuICAgICAgICBpZiAoYXBwKSB7XHJcbiAgICAgICAgICAgIGFwcC51bm1vdW50KCk7XHJcbiAgICAgICAgfVxyXG4gICAgfSxcclxufSk7XHJcbiJdfQ==