(function (){
    // 防止使用编辑器自带的package报错
    const Path = require('path')
    // @ts-ignore
    module.paths.push(Path.join(Editor.App.path,'node_modules'));
})();
(()=>{"use strict";var e={d:(t,r)=>{for(var o in r)e.o(r,o)&&!e.o(t,o)&&Object.defineProperty(t,o,{enumerable:!0,get:r[o]})},o:(e,t)=>Object.prototype.hasOwnProperty.call(e,t),r:e=>{"undefined"!=typeof Symbol&&Symbol.toStringTag&&Object.defineProperty(e,Symbol.toStringTag,{value:"Module"}),Object.defineProperty(e,"__esModule",{value:!0})}},t={};e.r(t),e.d(t,{onAfterBuild:()=>n});const r=require("path"),o=require("fs");function n(e,t){const n=function(){const e=(0,r.join)(__dirname,"package.json");if(!(0,o.existsSync)(e))return"";try{const t=(0,o.readFileSync)(e,"utf-8");return JSON.parse(t).name||""}catch(e){return""}}();if(!n)return;const{buildPath:a,name:u,outputName:i,platform:d,md5Cache:c}=e;Editor.Message.request(n,"onBuilder",{type:"onAfterBuild",data:{buildPath:a,name:u,outputName:i,platform:d,md5Cache:c}})}var a=exports;for(var u in t)a[u]=t[u];t.__esModule&&Object.defineProperty(a,"__esModule",{value:!0})})();