const notion = require("./notion");
const core = require("@actions/core");



function isJson(str) {
  try {
    const obj = JSON.parse(str);
    if (obj && typeof obj == "object") return true;
  } catch (e) { }

  return false;
}

var picBedConfig = {};
var migrate_image = core.getInput("migrate_image") === "true";

// test the picBed config
if (!isJson(core.getInput("picBedConfig"))) {
  core.warning("picBedConfig is not a valid json string, use default config: {}, and set migrate_image to false.");
  migrate_image = false;
}

if (migrate_image) {
  core.info("migrate_image is true, use picBedConfig to upload images.");
  picBedConfig = JSON.parse(core.getInput("picBedConfig"));
}

let config = {
  notion_secret: core.getInput("notion_secret"),
  database_id: core.getInput("database_id"),
  migrate_image: migrate_image,
  picBed: picBedConfig,
  status: {
    name: core.getInput("status_name"),
    unpublish: core.getInput("status_unpublish"),
    published: core.getInput("status_published"),
  },
  output_dir: {
    page: core.getInput("page_output_dir"),
    post: core.getInput("post_output_dir"),
    clean_unpublished_post: core.getInput("clean_unpublished_post") === "true",
  },
};

(async function () {
  notion.init(config);
  await notion.sync();
})();
