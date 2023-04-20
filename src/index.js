const notion = require("./notion");
const core = require("@actions/core");


function isJson(str) {
  try {
    const obj = JSON.parse(str);
    if (obj && typeof obj == "object") return true;
  } catch (e) { }

  return false;
}

var migrate_image = core.getInput("migrate_image") === "true" || false;
const picBedConfigStr = core.getInput("picBedConfig") || "{}";

// test the picBed config
if (!isJson(picBedConfigStr)) {
  core.warning("picBedConfig is not a valid json string, use default config: {}, and set migrate_image to false.");
  migrate_image = false;
}

var picBedConfig = {};

if (migrate_image) {
  core.info("migrate_image is true, use picBedConfig to upload images.");
  picBedConfig = JSON.parse(picBedConfigStr);
}

var pic_base_url = core.getInput("pic_base_url") || null;

if (pic_base_url && !pic_base_url.endsWith("/")) {
  pic_base_url = pic_base_url + "/";
}

let config = {
  notion_secret: core.getInput("notion_secret"),
  database_id: core.getInput("database_id"),
  migrate_image: migrate_image || false,
  picBed: picBedConfig || {},
  pic_base_url: pic_base_url || null,
  pic_compress: core.getInput("pic_compress") === "true" || false,
  status: {
    name: core.getInput("status_name") || "status",
    unpublish: core.getInput("status_unpublish") || "未发布",
    published: core.getInput("status_published") || "已发布",
  },
  output_dir: {
    page: core.getInput("page_output_dir") || "source/",
    post: core.getInput("post_output_dir") || "source/_posts/notion/",
    clean_unpublished_post: core.getInput("clean_unpublished_post") === "true" || false,
  },
  timezone: core.getInput("timezone") || "Asia/Shanghai",
};

// add current running file dir to PATH
process.env.PATH = __dirname + ":" + process.env.PATH;

(async function () {
  notion.init(config);
  await notion.sync();
})();
