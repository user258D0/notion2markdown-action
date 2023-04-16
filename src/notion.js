const { Client } = require("@notionhq/client");
const { writeFileSync, existsSync, mkdirSync, readFileSync, readdirSync } = require("fs");
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
  picBed: { uploader: "tcyun", current: "tcyun", tcyun: {}, aliyun: {} },
  status: {
    name: "",
    unpublish: "",
    published: "",
  },
  output_dir: {
    page: "",
    post: "",
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
  // get all the output markdown filename list of the pages, and remove the file not exists in the pages under the output directory
  // query the filename list from the output directory
  const notion_page_prop_list = pages.map((page) => {
    var properties = getPropertiesDict(page);
    properties.filename = properties.filename ? properties.filename + ".md" : page.title + ".md";
    return properties;
  });
  // query the filename list from the output directory
  if (!existsSync(config.output_dir.post)) {
    mkdirSync(config.output_dir.post, { recursive: true });
  } else {
    readdirSync(config.output_dir.post).forEach((file) => {
      if (file.endsWith(".md")) {
        // check if the file exists in the pages
        if (!notion_page_prop_list.some((page) => page.filename == file)) {
          // remove the file
          fs.unlinkSync(join(config.output, file));
          console.log(`File ${file} removed.`);
        }
      }
    });
  }
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    console.log(`Handling page: ${page.id} [${i + 1}/${pages.length}]`);
    console.log(`Page properties:`, page.properties);
    console.log(`[${i + 1}]: ${page.properties.title.title[0].plain_text}`);
    var pageNeedUpdate = false;
    // only handle the page ubpublished
    if (page.properties[config.status.name].select.name != config.status.unpublish) {
      console.log(`Page status is ${config.status.name}: ${page.properties[config.status.name].select.name}, skip it.`);
      continue;
    }
    // check if the page is unpublished, change it to published
    if (page.properties[config.status.name].select.name == config.status.unpublish) {
      console.log(`Page status is ${config.status.name}: ${config.status.unpublish}, change to published.`);
      page.properties[config.status.name].select = { name: config.status.published };
      pageNeedUpdate = true;
    }
    // get the filename and filepath of the markwon file
    let properties = getPropertiesDict(page);
    console.log(`Page properties dict:`, properties);
    // add support for the both page and post
    var filename = properties.filename ? properties.filename + ".md" : page.title + ".md";
    var output_dir = config.output_dir.post;
    if (properties.type == "page") {
      // page
      filename = 'index.md';
      output_dir = join(config.output_dir.page, properties.filename);
    }
    // const filename = properties.filename ? properties.filename + '.md' : page.title + '.md';
    // get the filepath, and old properties of the page from the markdown file
    const filePath = join(output_dir, filename);
    // check if the file exists
    if (existsSync(filePath)) {
      console.log(`File exists: ${filePath}`);
      const oldProperties = await loadPropertiesFromMarkdownFile(filePath);
      console.log(`Markdown file properties:`, oldProperties);
      // skip if the page is published and the updated time is not changed
      if (properties[config.status.name] == config.status.published && oldProperties.updated == properties.updated) {
        console.log(`Page is published and the updated time is not changed, skip it.`);
        continue;
      }
      // update the abbrlink for the page of nation, if it exists in the markdown file
      if (properties.hasOwnProperty('abbrlink') && oldProperties.abbrlink && oldProperties.abbrlink != properties.abbrlink) {
        // update the abbrlink for the page
        const abbrlink = oldProperties.abbrlink;
        const text = {
          type: 'text',
          plain_text: abbrlink,
          text: { content: abbrlink }
        }
        if (page.properties.abbrlink.rich_text.length == 0) {
          page.properties.abbrlink.rich_text.push(text);
        } else {
          page.properties.abbrlink.rich_text[0] = text;
        }
        console.log(`Page abbrlink updated: ${abbrlink}`);
        pageNeedUpdate = true;
      }
    } else {
      console.log(`File not exists: ${filePath}, it's a new page.`);
      mkdirSync(filePath, { recursive: true });
    }
    // get the properties of the page
    properties = getPropertiesDict(page);
    console.log(`Finnal properties for markdown file:`, properties);
    // tranform the page of nation to markdown
    await page2Markdown(page, filePath, properties);
    if (config.migrate_image) await migrateImages(filePath);
    // update the page status to published
    if (pageNeedUpdate) await updatePageProperties(page);
    console.log(`Page deployed: ${page.id}, ${page.title}`);
  }
  if (pages.length == 0)
    console.log(`no pages ${config.status.name}: ${config.status.unpublish}`);
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
  console.log(`handling file: ${file}`)
  let res = await Migrater(picgo, [file]);
  if (res.success != res.total)
    throw new Error(
      `file migrate img fail, total: ${res.total}, success: ${res.success}`
    );
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
  console.log('Page filter:', filter);
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
  console.log('Page full properties updated:', page.properties);
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
  // console.log('File properties:', properties);
  return properties;
}

/**
 * 生成元数据
 * @param {*} page
 * @returns {Object}
 */
function getPropertiesDict(page) {
  let data = {};
  for (const key in page.properties) {
    data[key] = getPropVal(page.properties[key]);
  }
  // cover image
  if (page.cover) {
    if (page.cover.type === "external") {
      data['cover'] = page.cover.external.url;
    } else if (page.cover.type === "file") {
      data['cover'] = page.cover.file.url;
    }
  }
  // created, updated time
  data['created'] = page.created_time;
  data['updated'] = page.last_edited_time;
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
  if (!val) return '';
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
