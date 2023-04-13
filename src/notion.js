const { Client } = require("@notionhq/client");
const { writeFileSync, existsSync, mkdirSync, readFileSync } = require("fs");
const { NotionToMarkdown } = require("notion-to-md");
const { parse } = require("twemoji");
const { getBlockChildren } = require("notion-to-md/build/utils/notion");
const YAML = require("yaml");
const { PicGo } = require("picgo");
const crypto = require("crypto");
const { extname, join } = require("path");
const Migrater = require("./migrate");
const { format } = require("prettier");

let config = {
  notion_secret: "",
  database_id: "",
  migrate_image: true,
  tcyun: {
    secretId: "",
    secretKey: "",
    bucket: "",
    appId: "",
    area: "",
    path: "",
    customUrl: "",
    version: "v5"
  },
  status: {
    name: "",
    unpublish: "",
    published: "",
  },
  output: "",
};

let notion = new Client({ auth: config.notion_secret });
let picgo = new PicGo();
let n2m = new NotionToMarkdown({ notionClient: notion });

function init(conf) {
  config = conf;
  notion = new Client({ auth: config.notion_secret });

  picgo.setConfig({
    picBed: { uploader: "tcyun", current: "tcyun", tcyun: config.tcyun },
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
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];

    console.log(`[${i + 1}]: ${page.properties.title.title[0].plain_text}`);
    const { filepath, properties, md } = await download(page);
    if (config.migrate_image) await migrateImages(filepath);
    if (properties.abbrlink && page.properties.hasOwnProperty('abbrlink') && !page.properties.abbrlink.type == 'text' && page.properties.abbrlink.plain_text != properties.abbrlink) {
      // update the abbrlink for the page
      page.properties.abbrlink.plain_text = properties.abbrlink;
    }
    updatePageProperties(page);
  }
  if (pages.length == 0)
    console.log(`no pages ${config.status.name}: ${config.status.unpublish}`);
}

async function migrateImages(file) {
  console.log(`handling file: ${file}`)
  let res = await Migrater(picgo, [file]);
  if (res.success != res.total)
    throw new Error(
      `file migrate img fail, total: ${res.total}, success: ${res.success}`
    );
}

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
  console.log('Page filter:', filter);
  let resp = await notion.databases.query({
    database_id: database_id,
    filter: filter,
  });
  return resp.results;
}

async function updatePageProperties(page) {
  let props = page.properties;
  props[config.status.name].select = { name: config.status.published };
  // only update the status property
  let props_updated = {};
  props_updated[config.status.name] = props[config.status.name];
  // update status and abbrlink if exists
  for (keyNeedUpdate in ['abbrlink', config.status.name]) {
    if (props.hasOwnProperty(keyNeedUpdate)) {
      props_updated[keyNeedUpdate] = props[keyNeedUpdate];
    }
  }
  await notion.pages.update({
    page_id: page.id,
    properties: props_updated,
  });
}

/**
 * 下载一篇文章
 * @param {*} page
 */
async function download(page) {
  const mdblocks = await n2m.pageToMarkdown(page.id);
  let md = n2m.toMarkdownString(mdblocks);

  let properties = props(page);
  // set the status to published for markdown file
  properties.status = config.status.published;
  // set filename for markdown file
  let filename = properties.title;
  if (properties.urlname) filename = properties.urlname;
  let filepath = join(config.output, filename + ".md");
  // check if the folder exists
  if (!existsSync(config.output)) {
    mkdirSync(config.output, { recursive: true });
    console.log('Folder created successfully:', config.output);
  } else {
    console.log('Folder already exists:', config.output);
  }
  // check if the file already exists
  if (existsSync(filepath)) {
    console.log('File already exists:', filepath);
    // read the properties from the markdown file
    const old_properties = await loadPropertiesFromMarkdownFile(filepath);
    // old_properties 存在, 说明已经部署过, 只需要更新内容，更新properties中的abbrlink
    if (old_properties && old_properties.abbrlink) {
      // abbrlink 存在, 说明已经部署过, 只需要更新内容，更新properties中的abbrlink
      console.log('File already deployed with abbrlink:', old_properties.abbrlink);
      if (!properties.hasOwnProperty('abbrlink')) {
        properties.abbrlink = old_properties.abbrlink;
      }
    }
  } else {
    mkdirSync(config.output, { recursive: true });
    console.log('File created successfully:', filepath);
  }

  fm = YAML.stringify(properties, { doubleQuotedAsJSON: true });
  // check if the file already exists
  md = `---\n${fm}---\n\n${md}`;
  
  md = format(md, { parser: "markdown" });
  writeFileSync(filepath, md);
  return {
    filepath,
    properties,
    md
  };
}

async function loadPropertiesFromMarkdownFile(filepath) {
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
  const properties = YAML.parse(fm[1]);
  console.log('File properties:', properties);
  return properties;
}

/**
 * 生成元数据
 * @param {*} page
 * @returns {Object}
 */
function props(page) {
  let data = {};
  for (const key in page.properties) {
    data[key] = getPropVal(page.properties[key]);
  }
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
      return val.created_time;
    case "last_edited_time":
      return val.last_edited_time
    default:
      return "";
  }
}

module.exports = {
  sync,
  init,
};
