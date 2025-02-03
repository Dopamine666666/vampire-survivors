import * as XLSX from 'xlsx';
import * as fs from 'fs-extra';
import { render } from 'ejs';


interface SheetData {
    [key: string]: any;
}

interface WorkbookData {
    [sheetName: string]: SheetData;
}

function parseJsonString(val: string): any {
    if(/^\s*[\{\[]/.test(val)) {
        try {
            return JSON.parse(val)
        }
        catch(err) {
            return val;
        }
    }
    return val;
}
function excel2json(filePath: string) {
    const workbook = XLSX.readFile(filePath);
    const workbookData: WorkbookData = {};
    const interfaceDic: { [sheetName: string]: { [key: string]: string } } = {};
    const annotationDic: { [sheetName: string]: { [key: string]: string } } = {};

    for(let i = 0; i < workbook.SheetNames.length; i++) {
        const sheetName = workbook.SheetNames[i];
        const workSheet = workbook.Sheets[sheetName];
        const jsonSheet: SheetData[] = XLSX.utils.sheet_to_json(workSheet, { header: 1 });
        interfaceDic[sheetName] = {};
        annotationDic[sheetName] = {};
        if(sheetName === 'config') {
            const headers = jsonSheet[0] as string[];
            const data: SheetData = {};
            for(let j = 3; j < jsonSheet.length; j++) {
                const row = jsonSheet[j];
                const key = row[0] as string;
                interfaceDic[sheetName][key] = 'any';
                for(let k = 2; k < headers.length; k++) {
                    if(typeof row[k] != 'undefined') {
                        data[key] = parseJsonString(row[k]);
                        interfaceDic[sheetName][key] = jsonSheet[1][k];
                        annotationDic[sheetName][key] = row[1];
                        break;
                    }
                }
            }

            workbookData[sheetName] = data;
        }
        else {
            const headers = jsonSheet[0] as string[];
            const data: SheetData = {};
    
            for(let j = 3; j < jsonSheet.length; j++) {
                const row = jsonSheet[j];
                const key = row[0] as string;
                const value: SheetData = {};
                headers.forEach((header, idx) => value[header] = parseJsonString(row[idx]));
                data[key] = value;
            }

            headers.forEach((header, idx) => {
                interfaceDic[sheetName][header] = jsonSheet[1][idx];
                annotationDic[sheetName][header] = jsonSheet[2][idx];
            });
    
            workbookData[sheetName] = data;
        }
    }

    return { workbookData, interfaceDic, annotationDic };
}

try {
    const { workbookData, interfaceDic, annotationDic } = excel2json('./GameConfig.xlsx');
    fs.writeFileSync('../../assets/resources/data/game-config.json', JSON.stringify(workbookData, null, 2), 'utf-8');
    const template = fs.readFileSync('./type-hint.ejs', 'utf-8');
    const rendered = render(template, { interfaceDic, annotationDic, workbookData });
    fs.writeFileSync('../../assets/scripts/helpers/GameConfig.ts', rendered, 'utf-8');
} catch(err) {
    console.error(err);
}