const notion = require("./notion");
const core = require("@actions/core");

let config = {
  notion_secret: core.getInput("notion_secret"),
  database_id: core.getInput("database_id"),
  migrate_image: core.getInput("migrate_image") === "true",
  picBed: JSON.parse(core.getInput("picBedConfig")),
  status: {
    name: core.getInput("status_name"),
    unpublish: core.getInput("status_unpublish"),
    published: core.getInput("status_published"),
  },
  output_dir: {
    page: core.getInput("page_output_dir"),
    post: core.getInput("post_output_dir"),
  },
};

(async function () {
  notion.init(config);
  await notion.sync();
})();
