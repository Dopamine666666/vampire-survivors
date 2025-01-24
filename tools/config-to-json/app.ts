import { extname, join } from 'node:path';
import { readdirSync, writeJSONSync } from 'fs-extra';
import { parse } from 'node-xlsx';
import { render } from 'ejs';
import { readFileSync, writeFileSync } from 'node:fs';

const EXPORT_HELPER_PATH = join(__dirname, '../../assets/scripts/helpers/GameConfig.ts');
const EXPORT_JSON_PATH = join(__dirname, '../../assets/resources/data/game-config.json');
const version = 1;

let list = {
    version
};

const intfs = {};
const annos = {};
readdirSync(join(__dirname, 'src')).forEach(async filename => {
    if(!filename.startsWith('~$') && extname(filename).startsWith('.xls')) {
        const xls = parse(join(__dirname, 'src', filename));
        xls.forEach(page => {
            if(page.name.startsWith('ignore_') || !page.data[1]) {
                return;
            }
            const intf = intfs[page.name] = {};
            const anno = annos[page.name] = {};
            if(page.name != 'config') {
                page.data[0].forEach((key, idx) => {
                    const type = page.data[1][idx];
                    if(type == 'ignore') {
                        return;
                    }
                    intf[key] = type == 'integer' || type == 'number' ? 'number' : type == 'json' ? 'any' : 'string';
                    anno[key] = page.data[2][idx];
                });
            }
            else {
                const jsonIdx = page.data[0].indexOf('json');
                const numberIdx = page.data[0].indexOf('number');
                for(let i = 3; i < page.data.length; i++) {
                    intf[page.data[i][0]] = page.data[i][jsonIdx] ? 'any' : page.data[i][numberIdx] ? 'number' : 'string';
                    anno[page.data[i][0]] = page.data[i][1];
                }
            }
            const json = list[page.name] = {};
            for(let i = 3; i < page.data.length; i++) {
                const data = page.data[i];
                if(data[0] == 'ignore' || !data[0]) {
                    continue;
                }
                if(page.name == 'config') {
                    const jsonIdx = page.data[0].indexOf('json');
                    const numberIdx = page.data[0].indexOf('number');
                    const stringIdx = page.data[0].indexOf('string');
                    try{
                        json[data[0]] = data[jsonIdx] ? JSON.parse(data[jsonIdx]) : data[numberIdx] ? JSON.parse(data[numberIdx]) : JSON.parse(data[stringIdx]);
                    }
                    catch(e) {
                        console.log(e);
                        console.log(data[jsonIdx]);
                    }
                    continue;
                }
                json[data[0]] = {};
                data.forEach((val, idx) => {
                    const key = page.data[0][idx];
                    switch(intfs[page.name][key]) {
                        case 'any': 
                            try {
                                json[data[0][key]] = JSON.parse(val);
                            }
                            catch(e) {
                                console.log(e);
                                console.log(page.name);
                                console.log(key);
                                console.log(val);
                            }
                        break;
                        case 'number': 
                            json[data[0][key]] = +(+val).toFixed(2) || 0;
                        break;
                        case 'string':
                            json[data[0][key]] = val + '';
                        break;
                    }
                });
            }
        });
    }
});

writeJSONSync(EXPORT_JSON_PATH, list);

const helperTemplate = readFileSync(join(__dirname, 'helper.ts.ejs'), 'utf-8');
writeFileSync(EXPORT_HELPER_PATH, render(helperTemplate, {intfs, list, annos}));