const notion = require("./notion");
const core = require("@actions/core");

let config = {
  notion_secret: core.getInput("notion_secret"),
  database_id: core.getInput("database_id"),
  migrate_image: core.getInput("migrate_image") === "true",
  tcyun: {
    secretId: core.getInput("secretId"),
    secretKey: core.getInput("secretKey"),
    bucket: core.getInput("bucket"),
    appId: core.getInput("appId"),
    area: core.getInput("area"),
    path: core.getInput("path"),
    customUrl: core.getInput("customUrl"),
    version: core.getInput("version"),
    options: "",
  },
  status: {
    name: core.getInput("status_name"),
    unpublish: core.getInput("status_unpublish"),
    published: core.getInput("status_published"),
  },
  page_output_dir: core.getInput("page_output_dir"),
  post_output_dir: core.getInput("post_output_dir"),
};

(async function () {
  notion.init(config);
  await notion.sync();
})();
