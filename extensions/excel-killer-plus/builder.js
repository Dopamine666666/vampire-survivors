(function (){
    // 防止使用编辑器自带的package报错
    const Path = require('path')
    // @ts-ignore
    module.paths.push(Path.join(Editor.App.path,'node_modules'));
})();
(()=>{"use strict";var e={d:(o,r)=>{for(var t in r)e.o(r,t)&&!e.o(o,t)&&Object.defineProperty(o,t,{enumerable:!0,get:r[t]})},o:(e,o)=>Object.prototype.hasOwnProperty.call(e,o),r:e=>{"undefined"!=typeof Symbol&&Symbol.toStringTag&&Object.defineProperty(e,Symbol.toStringTag,{value:"Module"}),Object.defineProperty(e,"__esModule",{value:!0})}},o={};e.r(o),e.d(o,{configs:()=>r});const r={"*":{hooks:"./hooks"}};var t=exports;for(var n in o)t[n]=o[n];o.__esModule&&Object.defineProperty(t,"__esModule",{value:!0})})();