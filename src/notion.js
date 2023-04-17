/*
 * @Author: Dorad, ddxi@qq.com
 * @Date: 2023-04-12 18:38:51 +02:00
 * @LastEditors: Dorad, ddxi@qq.com
 * @LastEditTime: 2023-04-17 14:51:13 +02:00
 * @FilePath: \src\notion.js
 * @Description: 
 * 
 * Copyright (c) 2023 by Dorad (ddxi@qq.com), All Rights Reserved.
 */
const { Client } = require("@notionhq/client");
const { writeFileSync, existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync } = require("fs");
const { NotionToMarkdown } = require("notion-to-md");
const { parse } = require("twemoji");
const { getBlockChildren } = require("notion-to-md/build/utils/notion");
const YAML = require("yaml");
const { PicGo } = require("picgo");
const crypto = require("crypto");
const { extname, join } = require("path");
const Migrater = require("./migrate");
const { format } = require("prettier");
const moment = require("moment");

let config = {
  notion_secret: "",
  database_id: "",
  migrate_image: true,
  picBed: { uploader: "tcyun", current: "tcyun", tcyun: {}, aliyun: {} },
  status: {
    name: "",
    unpublish: "",
    published: "",
  },
  output_dir: {
    page: "",
    post: "",
    clean_unpublished_post: true,
  },
};

let notion = new Client({ auth: config.notion_secret });
let picgo = new PicGo();
let n2m = new NotionToMarkdown({ notionClient: notion });

function init(conf) {
  config = conf;
  notion = new Client({ auth: config.notion_secret });

  picgo.setConfig({
    picBed: config.picBed,
  });

  // 文件重命名为 md5
  picgo.on("beforeUpload", (ctx) => {
    ctx.output.forEach((item) => {
      let ext = extname(item.fileName);
      item.fileName =
        crypto.createHash("md5").update(item.buffer).digest("hex") + ext;
    });
  });

  // passing notion client to the option
  n2m = new NotionToMarkdown({ notionClient: notion });
  n2m.setCustomTransformer("callout", callout(n2m));
}

async function sync() {
  // 获取待发布和已发布的文章
  let pages = await getPages(config.database_id, ["unpublish", "published"]);
  /**
   * 需要处理的逻辑:
   * 1. 对于已发布的文章，如果本地文件存在，且存在abbrlink，则更新notion中的abbrlink
   * 2. 对于未发布的文章, 如果本地文件存在，则尝试读取本地文件的abbrlink，如果存在，则更新notion中的abbrlink, 并生成markdown文件
   */
  // get all the output markdown filename list of the pages, and remove the file not exists in the pages under the output directory
  // query the filename list from the output directory
  const notionPagePropList = await Promise.all(pages.map(async (page) => {
    var properties = await getPropertiesDict(page);
    switch (properties.type) {
      case "page":
        if (!properties.filename) {
          console.error(`Page ${properties.title} has no filename, the page id will be used as the filename.`);
          properties.filename = properties.id;
        }
        properties.filePath = join(config.output_dir.page, properties.filename, 'index.md');
        properties.output_dir = join(config.output_dir.page, properties.filename);
        properties.filename = "index.md";
        break;
      case "post":
      default:
        properties.filename = properties.filename != undefined && properties.filename ? properties.filename + ".md" : properties.title + ".md";
        properties.filePath = join(config.output_dir.post, properties.filename);
        properties.output_dir = config.output_dir.post;
    }
    return properties;
  }));
  console.log(`${notionPagePropList.length} pages found in notion.`);
  // make the output directory if it is not exists
  if (!existsSync(config.output_dir.post)) {
    mkdirSync(config.output_dir.post, { recursive: true });
  }
  if (!existsSync(config.output_dir.page)) {
    mkdirSync(config.output_dir.page, { recursive: true });
  }
  /**
   * 1. 删除notion中不存在的文章
   * 2. 更新notion中已发布的文章的abbrlink
   *  */
  // load page properties from the markdown file
  const localPostFileList = readdirSync(config.output_dir.post);
  for (let i = 0; i < localPostFileList.length; i++) {
    const file = localPostFileList[i];
    if (!file.endsWith(".md")) {
      return;
    }
    var localProp = loadPropertiesAndContentFromMarkdownFile(join(config.output_dir.post, file));
    if (!localProp) {
      continue;
    }
    var page = pages.find((page) => page.id == localProp.id);
    // if the page is not exists, delete the local file
    if (!page && config.output_dir.clean_unpublished_post) {
      console.log(`Page is not exists, delete the local file: ${file}`);
      unlinkSync(join(config.output_dir.post, file));
      return;
    }
    // if the page is exists, update the abbrlink of the page if it is empty and the local file has the abbrlink
    var notionProp = notionPagePropList.find((prop) => prop.id == page.id);
    if (localProp.abbrlink && notionProp.abbrlink != undefined && !notionProp.abbrlink) {
      console.log(`Update the abbrlink of the page: ${notionProp.id}, ${notionProp.title}`);
      const abbrlink = localProp.abbrlink;
      const text = {
        "type": "text",
        "text": {
          "content": abbrlink,
          "link": null
        },
        "plain_text": abbrlink,
        "href": null
      };
      page.properties.abbrlink.rich_text.push(text);
    };
  }
  /**
   * 更新未发布的文章
   */
  // deal with notionPagePropList
  if (notionPagePropList.length == 0) {
    console.log("No page to deal with.");
    return;
  }
  // 同步处理文章, 提高速度
  const results = await Promise.all(notionPagePropList.map(async (prop) => {
    let page = pages.find((page) => page.id == prop.id);
    console.log(`Handle page: ${prop.id}, ${prop.title}`);
    /**
     * 只处理未发布的文章
     */
    // skip the page if it is not exists or published
    if (!page || prop[config.status.name] == config.status.published) {
      console.log(`Page is not exists or published, skip: ${prop.id}, ${prop.title}`);
      return false;
    }
    /**
     * 对于已发布的文章，如果本地文件存在，且存在abbrlink，则更新notion中的abbrlink
     */
    // check if the local file exists
    if (!existsSync(prop.filePath)) {
      // the local file is not exists
      console.log(`File ${prop.filePath} is not exists, it's a new page.`);
    }
    // check the output directory, if the file is not exists, create it
    if (!existsSync(prop.output_dir)) {
      mkdirSync(prop.output_dir, { recursive: true });
    }
    // update the page status to published
    if (prop[config.status.name] == config.status.unpublish) {
      page.properties[config.status.name].select = { name: config.status.published };
    }
    // get the latest properties of the page
    const newPageProp = await getPropertiesDict(page);
    await page2Markdown(page, prop.filePath, newPageProp);
    if (config.migrate_image) {
      const res = await migrateImages(prop.filePath);
      if (!res) {
        console.warn(`Migrate images failed: ${prop.id}, ${prop.title}`);
        return false;
      }
    }
    // update the page status to published
    await updatePageProperties(page);
    console.log(`Page conversion successfully: ${prop.id}, ${prop.title}`);
    return true;
  }));
  console.log(`All pages are handled, ${notionPagePropList.length} pages are handled, ${results.filter((r) => r).length} pages are updated.`);
}

/**
 * featch page from notion, and convert it to local markdown file
 * @param {*} page 
 * @param {*} filePath 
 * @param {*} properties 
 */

async function page2Markdown(page, filePath, properties) {
  const mdblocks = await n2m.pageToMarkdown(page.id);
  let md = n2m.toMarkdownString(mdblocks);
  fm = YAML.stringify(properties, { doubleQuotedAsJSON: true });
  // check if the file already exists
  md = format(`---\n${fm}---\n\n${md}`, { parser: "markdown" });
  writeFileSync(filePath, md);
}

/**
 * migrate images of the markdown file to tcyun
 * @param {*} file 
 */
async function migrateImages(file) {
  console.log(`[Image migrate]Handling file: ${file}`)
  let res = await Migrater(picgo, [file]);
  if (!res) {
    console.error(`[Image migrate]File migrate img fail: ${file}`)
    return false;
  };
  if (res.success != res.total) {
    console.error(`file migrate img fail, total: ${res.total}, success: ${res.success}`)
    return false;
  }
  return true;
}

/**
 * query the pages of the database
 * @param {*} database_id 
 * @param {*} types 
 * @returns 
 */
async function getPages(database_id, types = ["unpublish", "published"]) {
  let filter = {}
  if (types.length > 1) {
    filter = {
      or: [
        {
          property: config.status.name,
          select: {
            equals: config.status.unpublish,
          },
        },
        {
          property: config.status.name,
          select: {
            equals: config.status.published,
          },
        },
      ],
    }
  } else {
    if (types.length == 0) types = ['unpublish'];
    filter = {
      property: config.status.name,
      select: {
        equals: config.status[types[0]],
      },
    }
  }
  // print the filter
  // console.log('Page filter:', filter);
  let resp = await notion.databases.query({
    database_id: database_id,
    filter: filter,
  });
  return resp.results;
}

/**
 * update the page status to published, and update the abbrlink if exists
 * @param {*} page 
 */
async function updatePageProperties(page) {
  // only update the status property
  // console.log('Page full properties updated:', page.properties);
  let props_updated = {};
  // update status and abbrlink if exists
  [config.status.name, 'abbrlink'].forEach(key => {
    if (page.properties[key]) {
      props_updated[key] = page.properties[key];
    }
  });
  console.log('Page properties updated keys:', props_updated);
  await notion.pages.update({
    page_id: page.id,
    properties: props_updated,
  });
}

/**
 * load properties from the markdown file
 * @param {*} filepath 
 * @returns 
 */

function loadPropertiesAndContentFromMarkdownFile(filepath) {
  // load properties from the markdown file
  // check if the file already exists
  if (!existsSync(filepath)) {
    console.log('File does not exist:', filepath);
    return null;
  }
  const content = readFileSync(filepath, 'utf8');
  // math the front matter
  const fm = content.match(/---\n([\s\S]*?)\n---/);
  // parse the front matter
  if (!fm) return null;
  try {
    const properties = YAML.parse(fm[1]);
    return properties;
  } catch (e) {
    console.log('Parse yaml error:', e);
    return null;
  }
}

/**
 * 生成元数据
 * @param {*} page
 * @returns {Object}
 */
async function getPropertiesDict(page) {
  let data = {};
  for (const key in page.properties) {
    const value = getPropVal(page.properties[key]);
    if (value == undefined || value == "") continue;
    data[key] = value;
  }
  // cover image
  if (page.cover) {
    if (page.cover.type === "external") {
      data['cover'] = page.cover.external.url;
    } else if (page.cover.type === "file") {
      data['cover'] = page.cover.file.url;
    }
  }
  // id, created, updated time
  data['id'] = page.id;
  // data['created'] = page.created_time;
  // data['updated'] = page.last_edited_time;
  return data;
}

/**
 *
 * @param {ListBlockChildrenResponseResult} block
 */
function callout(n2m) {
  return async (block) => {
    let callout_str = block.callout.text.map((a) => a.plain_text).join("");
    if (!block.has_children) {
      return callout2md(callout_str, block.callout.icon);
    }

    const callout_children_object = await getBlockChildren(
      n2m.notionClient,
      block.id,
      100
    );
    // parse children blocks to md object
    const callout_children = await n2m.blocksToMarkdown(
      callout_children_object
    );

    callout_str +=
      "\n" + callout_children.map((child) => child.parent).join("\n\n");

    return callout2md(callout_str.trim(), block.callout.icon);
  };
}

function callout2md(str, icon) {
  return `<aside>\n${icon2md(icon)}${str}\n</aside>`.trim();
}

function icon2md(icon) {
  switch (icon.type) {
    case "emoji":
      return parse(icon.emoji);
    case "external":
      return `<img src="${icon.external.url}" width="25px" />\n`;
  }
  return "";
}

function getPropVal(data) {
  let val = data[data.type];
  if (!val) return undefined;
  switch (data.type) {
    case "multi_select":
      return val.map((a) => a.name);
    case "select":
      return val.name;
    case "date":
      return val.start;
    case "rich_text":
    case "title":
      return val.map((a) => a.plain_text).join("");
    case "text":
      return data.plain_text;
    case "files":
      if (val.length < 1) return "";
      return val[0][val[0].type].url;
    case "created_time":
    case "last_edited_time":
      return moment(val).format();
    default:
      return "";
  }
}

module.exports = {
  sync,
  init,
};
