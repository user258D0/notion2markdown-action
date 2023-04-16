/*
 * @Author: Dorad, ddxi@qq.com
 * @Date: 2023-04-16 17:05:49 +02:00
 * @LastEditors: Dorad, ddxi@qq.com
 * @LastEditTime: 2023-04-16 21:18:46 +02:00
 * @FilePath: \test\test.js
 * @Description: 
 * 
 * Copyright (c) 2023 by Dorad (ddxi@qq.com), All Rights Reserved.
 */
const notion = require("../src/notion");
const fs = require("fs");
if (!fs.existsSync("./config.json")) {
    console.error("请先创建配置文件");
}
// load 
const configRaw = fs.readFileSync("./config.json");
const config = JSON.parse(configRaw);
// const config = ;
(async function () {
    notion.init(config);
    await notion.sync();
})();