/*
 * @Author: Dorad, ddxi@qq.com
 * @Date: 2023-04-12 18:38:51 +02:00
 * @LastEditors: Dorad, ddxi@qq.com
 * @LastEditTime: 2023-04-18 21:11:23 +02:00
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
const moment = require('moment-timezone');
const axios = require('axios');
const cheerio = require('cheerio');

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
  timezone: "Asia/Shanghai",
  pic_base_url: "",
};

let notion = new Client({ auth: config.notion_secret });
let picgo = new PicGo();
let n2m = new NotionToMarkdown({ notionClient: notion });

function init(conf) {
  config = conf;
  notion = new Client({ auth: config.notion_secret });

  const domain = new URL(config.pic_base_url).hostname;

  picgo.setConfig({
    "picBed": config.picBed,
    "picgo-plugin-pic-migrater": {
      exclude: `^(?=.*${domain.replace('.', '\.')}).*|.*\.ico$`, // exclude the domain and icon
    },
    "pic-base-url": config.pic_base_url || null
  });

  // passing notion client to the option
  var CAPTION_DIV_TEMPLATE = `<div style="text-align: center; margin: 5px 0 10px;"><p>{{caption}}</p></div>`
  n2m = new NotionToMarkdown({ notionClient: notion });
  n2m.setCustomTransformer("callout", callout(n2m));
  n2m.setCustomTransformer("bookmark", async (block) => {
    const { bookmark, author } = block;
    if (!bookmark?.url) return "";
    const caption = bookmark.caption && bookmark.caption.length ? bookmark.caption[0].plain_text : ""; 
    return await axios.get(bookmark.url).then((res) => {
      const $ = cheerio.load(res.data);
      const title = $('meta[property="og:title"]').attr('content') || $('meta[name="twitter:title"]').attr('content') || $('title').text();
      const description = $('meta[property="og:description"]').attr('content') || $('meta[name="twitter:description"]').attr('content') || $('meta[name="description"]').attr('content');
      const cover = $('meta[property="og:image"]').attr('content') || $('meta[name="twitter:image"]').attr('content') || $('meta[name="image"]').attr('content') || "";
      var favicon = $('link[rel="shortcut icon"]').attr('href') || $('link[rel="icon"]').attr('href') || "";
      if (favicon.startsWith("//")) favicon = "https:" + favicon;
      if (favicon.startsWith("/")) favicon = "https://" + new URL(bookmark.url).hostname + favicon;
      return {
        title: title,
        description: description,
        cover: cover,
        favicon: favicon,
        url: bookmark.url,
      }
    }).then((p) => {
      var body_div = `<div style="display: flex;"><a href="${p.url}"target="_blank"rel="noopener noreferrer" style="display: flex; color: inherit; text-decoration: none; user-select: none; transition: background 20ms ease-in 0s; cursor: pointer; flex-grow: 1; min-width: 0px; flex-wrap: wrap-reverse; align-items: stretch; text-align: left; overflow: hidden; border: 1px solid rgba(55, 53, 47, 0.16); border-radius: 3px; position: relative; fill: inherit;"><div style="flex: 4 1 180px; padding: 12px 14px 14px; overflow: hidden; text-align: left;"><div style="font-size: 14px; line-height: 20px; color: rgb(55, 53, 47); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-height: 24px; margin-bottom: 2px;">${p.title}</div><div style="font-size: 12px; line-height: 16px; color: rgba(55, 53, 47, 0.65); height: 32px; overflow: hidden;">${p.description}</div><div style="display: flex; margin-top: 6px;"><img src="${p.favicon}"style="width: 16px; height: 16px; min-width: 16px; margin-right: 6px;"><div style="font-size: 12px; line-height: 16px; color: rgb(55, 53, 47); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${p.url}</div></div></div><div style="flex: 1 1 180px; display: block; position: relative;"><div style="position: absolute; inset: 0px;"><div style="width: 100%; height: 100%;"><img src="${p.cover}"referrerpolicy="same-origin"style="display: block; object-fit: cover; border-radius: 1px; width: 100%; height: 100%;"></div></div></div></a></div>`
      var caption_div = caption ? CAPTION_DIV_TEMPLATE.replace("{{caption}}", caption) : "";
      return caption ? `<div style="width: 100%; margin-top: 4px; margin-bottom: 4px;">${body_div}${caption_div}</div>` : `<div style="width: 100%; margin-top: 4px; margin-bottom: 4px;">${body_div}</div>`
    })
      .catch((err) => {
        console.error('Bookmark preview fetch error: ', err);
        return false
      });
  });
  n2m.setCustomTransformer("video", async (block) => {
    const { video } = block;
    if (!video) return false;
    if (!video?.external?.url) {
      console.error("Video block without external url: ", block);
      return false;
    }
    const caption = video.caption && video.caption.length ? video.caption[0].plain_text : "";
    const url = video.external.url;
    // fetch the iframe url
    const domain = new URL(url).hostname;
    var vid = false;
    var video_url = "";
    try {
      switch (domain) {
        case "www.youtube.com":
          vid = new URL(url).searchParams.get("v") || false;
          video_url = `https://www.youtube.com/embed/${vid}`;
          break;
        case "www.bilibili.com":
          vid = new URL(url).pathname.split("/")[2] || false;
          video_url = `//player.bilibili.com/player.html?bvid=${vid}&page=1&autoplay=0`;
          break;
        case "v.qq.com":
          vid = new URL(url).pathname.split("/")[2] || false;
          video_url = `https://v.qq.com/txp/iframe/player.html?vid=${vid}`;
          break;
        default:
          console.error("Video block with unsupported domain: ", block);
          return false;
      }
    }
    catch (err) {
      console.error("Error parsing video block: ", block);
      return false;
    }
    if (!vid) {
      console.error("Video block without video id: ", block);
      return false;
    }
    const video_div = `<iframe src="${video_url}" scrolling="no" border="0" frameborder="no" framespacing="0" allowfullscreen="true" style="width: 100%; aspect-ratio: 16/9;"> </iframe>`;
    var caption_div = caption ? CAPTION_DIV_TEMPLATE.replace("{{caption}}", caption) : "";
    return `<div style="width: 100%; margin-top: 4px; margin-bottom: 4px;">${video_div}${caption_div}</div>`
  });
  n2m.setCustomTransformer("embed", async (block) => {
    const { embed } = block;
    if (!embed) return false;
    if (!embed.url) {
      console.error("Embed block without url: ", block);
      return false;
    }
    const caption = embed.caption && embed.caption.length ? embed.caption[0].plain_text : "";
    const url = embed.url;
    var iframe = false;
    try {
      switch (new URL(url).hostname) {
        case "twitter.com":
          iframe = `<blockquote class="twitter-tweet"><a href="${url}"></a></blockquote><script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>`;
          break;
        case "www.google.com":
          iframe = `<iframe width="600" height="500" id="gmap_canvas" src="${url}" frameborder="0" scrolling="no" marginheight="0" marginwidth="0"></iframe>`;
          break;
        default:
          console.error("Embed block with unsupported domain: ", block);
          return false;
      }
    } catch (err) {
      console.error("Error parsing embed block: ", block);
      return false;
    }
    if (!iframe) {
      console.error("Embed block without iframe: ", block);
      return false;
    }
    var caption_div = caption ? CAPTION_DIV_TEMPLATE.replace("{{caption}}", caption) : "";
    return `<div style="width: 100%; margin-top: 4px; margin-bottom: 4px;">${iframe}${caption_div}</div>`
  });
  n2m.setCustomTransformer("link_preview", async (block) => {
    const { link_preview } = block;
    if (!link_preview) return false;
    if (!link_preview.url) {
      console.error("Link preview block without url: ", block);
      return false;
    }
    const url = link_preview.url;
    // fetch the link preview
    try {
      switch (new URL(url).hostname) {
        case "github.com":
          const repo = await fetch(`https://api.github.com/repos/${new URL(url).pathname.slice(1)}`).then((res) => res.json());
          return `<div contenteditable="false" data-content-editable-void="true"><a href="${repo.url}" target="_blank" rel="noopener noreferrer" style="display:flex;color:inherit;text-decoration:none;user-select:none;transition:background 20ms ease-in 0s;cursor:pointer;flex-grow:1;min-width:0;align-items:center;border:1px solid rgba(55,53,47,.16);border-radius:3px;padding:6px;fill:inherit"><div style="display:flex;align-self:start;height:32px;width:32px;margin:3px 12px 3px 4px;position:relative"><div><div style="width:100%;height:100%"><img src="${repo.owner.avatar_url}" referrerpolicy="same-origin" style="display:block;object-fit:cover;border-radius:34px;width:30.192px;height:30.192px;transition:opacity .1s ease-out 0s;box-shadow:rgba(15,15,15,.1) 0 2px 4px"></div></div><div style="position:absolute;bottom:-2px;right:-2px"><div style="width:100%;height:100%"><svg xmlns="http://www.w3.org/2000/svg" viewbox="0 0 496 512" style="display:block;object-fit:cover;border-radius:3px;width:14.208px;height:14.208px;transition:opacity .1s ease-out 0s;filter:drop-shadow(white 0 0 1px) drop-shadow(white 0 0 1px) drop-shadow(white 0 0 1px)"><!--! Font Awesome Pro 6.4.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2023 Fonticons, Inc. --><path d="M165.9 397.4c0 2-2.3 3.6-5.2 3.6-3.3.3-5.6-1.3-5.6-3.6 0-2 2.3-3.6 5.2-3.6 3-.3 5.6 1.3 5.6 3.6zm-31.1-4.5c-.7 2 1.3 4.3 4.3 4.9 2.6 1 5.6 0 6.2-2s-1.3-4.3-4.3-5.2c-2.6-.7-5.5.3-6.2 2.3zm44.2-1.7c-2.9.7-4.9 2.6-4.6 4.9.3 2 2.9 3.3 5.9 2.6 2.9-.7 4.9-2.6 4.6-4.6-.3-1.9-3-3.2-5.9-2.9zM244.8 8C106.1 8 0 113.3 0 252c0 110.9 69.8 205.8 169.5 239.2 12.8 2.3 17.3-5.6 17.3-12.1 0-6.2-.3-40.4-.3-61.4 0 0-70 15-84.7-29.8 0 0-11.4-29.1-27.8-36.6 0 0-22.9-15.7 1.6-15.4 0 0 24.9 2 38.6 25.8 21.9 38.6 58.6 27.5 72.9 20.9 2.3-16 8.8-27.1 16-33.7-55.9-6.2-112.3-14.3-112.3-110.5 0-27.5 7.6-41.3 23.6-58.9-2.6-6.5-11.1-33.3 2.6-67.9 20.9-6.5 69 27 69 27 20-5.6 41.5-8.5 62.8-8.5s42.8 2.9 62.8 8.5c0 0 48.1-33.6 69-27 13.7 34.7 5.2 61.4 2.6 67.9 16 17.7 25.8 31.5 25.8 58.9 0 96.5-58.9 104.2-114.8 110.5 9.2 7.9 17 22.9 17 46.4 0 33.7-.3 75.4-.3 83.6 0 6.5 4.6 14.4 17.3 12.1C428.2 457.8 496 362.9 496 252 496 113.3 383.5 8 244.8 8zM97.2 352.9c-1.3 1-1 3.3.7 5.2 1.6 1.6 3.9 2.3 5.2 1 1.3-1 1-3.3-.7-5.2-1.6-1.6-3.9-2.3-5.2-1zm-10.8-8.1c-.7 1.3.3 2.9 2.3 3.9 1.6 1 3.6.7 4.3-.7.7-1.3-.3-2.9-2.3-3.9-2-.6-3.6-.3-4.3.7zm32.4 35.6c-1.6 1.3-1 4.3 1.3 6.2 2.3 2.3 5.2 2.6 6.5 1 1.3-1.3.7-4.3-1.3-6.2-2.2-2.3-5.2-2.6-6.5-1zm-11.4-14.7c-1.6 1-1.6 3.6 0 5.9 1.6 2.3 4.3 3.3 5.6 2.3 1.6-1.3 1.6-3.9 0-6.2-1.4-2.3-4-3.3-5.6-2z"></path></svg></div></div></div><div style="display:flex;flex-direction:column;justify-content:center;flex-grow:1;flex-shrink:1;overflow:hidden"><div style="display:flex;align-items:baseline;font-size:14px"><div spellcheck="false" style="white-space:nowrap;color:#37352f;font-weight:500;overflow:hidden;text-overflow:ellipsis">${repo.full_name}</div></div><div style="display:flex;align-items:center;color:rgba(55,53,47,.65);font-size:12px"><div spellcheck="false" style="white-space:nowrap;color:rgba(55,53,47,.65)">${repo.owner.login}</div><span style="margin-left:3px;margin-right:3px">•</span><div style="color:rgba(55,53,47,.65);font-size:12px;white-space:nowrap">Latest updated: ${repo.updated_at}</div></div></div><div role="button" tabindex="0" style="user-select:none;transition:background 20ms ease-in 0s;cursor:pointer;opacity:0;display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:3px;flex-shrink:0;margin-right:4px;color:rgba(55,53,47,.65)"><svg viewbox="0 0 13 3" class="dots" style="width:14px;height:100%;display:block;fill:inherit;flex-shrink:0;backface-visibility:hidden;color:rgba(55,53,47,.45)"><g><path d="M3,1.5A1.5,1.5,0,1,1,1.5,0,1.5,1.5,0,0,1,3,1.5Z"></path><path d="M8,1.5A1.5,1.5,0,1,1,6.5,0,1.5,1.5,0,0,1,8,1.5Z"></path><path d="M13,1.5A1.5,1.5,0,1,1,11.5,0,1.5,1.5,0,0,1,13,1.5Z"></path></g></svg></div></a></div>`;
        default:
          console.error("Link preview block with unsupported domain: ", block);
          return false;
      }
    }
    catch (err) {
      console.error("Error parsing link preview block: ", block);
      return false;
    }
  });
  n2m.setCustomTransformer("pdf", async (block) => {
    const { pdf } = block || {};
    if (!pdf) {
      return false;
    }
    var caption = pdf.caption && pdf.caption.length > 0 ? pdf.caption[0].plain_text : "";
    var iframe = false;
    switch (pdf.type) {
      case "file":
        console.warn("PDF files are stored on Notion servers and may expire after a period of time, URL:", pdf.file.url);
        iframe = `<iframe src="${pdf.file.url}" style="width: 100%; aspect-ratio: 16/9;"></iframe>`;
        break;
      case "external":
        iframe = `<iframe src="${pdf.external.url}" style="width: 100%; aspect-ratio: 16/9;"></iframe>`;
        break;
      default:
        console.error("PDF block with unsupported type: ", block);
        return false;
    }
    if (!iframe) {
      return false;
    }
    const caption_div = caption ? CAPTION_DIV_TEMPLATE.replace("{{caption}}", caption) : "";
    return `<div class="pdf">${iframe}${caption_div}</div>`;
  });
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
      continue;
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
      continue;
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
      var mt = moment(val.start);
      if (!mt.isValid()) return val.start;
      return mt.tz(config.timezone).format('YYYY-MM-DD HH:mm:ss');
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
      var mt = moment(val);
      if (!mt.isValid()) return val;
      return mt.tz(config.timezone).format('YYYY-MM-DD HH:mm:ss');
    default:
      return "";
  }
}

module.exports = {
  sync,
  init,
};
