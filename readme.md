# notion2markdown-action

将 notion database 中的文章转换为 markdown 文件，提供给 hexo、hugo 等静态博客使用

- 使用 notion 导出接口，支持图片、表格、callout 等格式
- 支持迁移图片到置顶文件夹
- 内置PicGO-Core, 支持采用picBed进行图床上传，支持的图床有：SMMS/QINIU/UPYUN/TCYUN/GITHUB/ALIYUN/IMGUR. 详见：[picBed](https://picgo.github.io/PicGo-Core-Doc/zh/guide/config.html#picbed)

## 使用说明

### Notion

- 使用 [database 模板](https://doradx.notion.site/397943b2d0384e15ba69448900823984?v=3cea1a4916ac48efba8b83113518c1ac) 创建一个数据库
  ![](docs/database_tpl.jpg)
- 参考 [Notion 官方教程](https://developers.notion.com/docs/getting-started#step-1-create-an-integration) 创建一个应用，并获取到 token
  ![](./docs/app-sec.jpg)
- 将之前创建好的页面分享给刚刚创建的应用，[教程](https://developers.notion.com/docs/getting-started#step-2-share-a-database-with-your-integration)

### Github Action

#### 参数说明

```yaml
name: 'notion2markdown-action'
description: |
  将 notion database 中的 page 转换为 markdown 文档，可以用于 hexo、hugo 等静态博客构建, 内置picgo-core,使用picBed上传图床。
inputs:
  notion_secret:  # id of input
    description: notion app token，建议最好放到 Action Secret 中
    required: true
  database_id:
    required: true
    description: |
      notion 中的数据库 id
      - 假设你的数据库页面链接是 `https://www.notion.so/you-name/0f3d856498ca4db3b457c5b4eeaxxxxx`
      - 那么 `database_id=0f3d856498ca4db3b457c5b4eeaxxxxx`
  status_name:
    description: notion database 状态字段的字段名，支持自定义
    default: "status"
  status_published:
    description: notion database 文章已发布状态的字段值
    default: "已发布"
  status_unpublish:
    description: |
      notion database 文章待发布状态的字段值
      触发 action 后会自动拉去所有该状态的文章，成功导出之后会把这篇文章的状态修改为上面设置的已发布状态
    default: "待发布"
  migrate_image:
    required: false
    description: |
      是否迁移图片到 tcyun oss
      注意: 如果不迁移图片默认导出图片链接是 notion 的自带链接，有访问时效
      目前支持迁移图片到 tcyun oss 中
    default: "true"
  picBedConfig: 
    description: |
      picgo-core中picBed配置文件, 支持类图床。
      example:
      ```
      "current": "smms",
      "uploader": "smms", // 代表当前的默认上传图床为 SM.MS,
      "smms": {
        "token": "" // 从 https://sm.ms/home/apitoken 获取的 token
      }
      "aliyun":{
        "accessKeyId": "",
        "accessKeySecret": "",
        "bucket": "", // 存储空间名
        "area": "", // 存储区域代号
        "path": "", // 自定义存储路径
        "customUrl": "", // 自定义域名，注意要加 http://或者 https://
        "options": "" // 针对图片的一些后缀处理参数 PicGo 2.2.0+ PicGo-Core 1.4.0+
      },
      "tcyun":{
        "secretId": "",
        "secretKey": "",
        "bucket": "", // 存储桶名，v4 和 v5 版本不一样
        "appId": "",
        "area": "", // 存储区域，例如 ap-beijing-1
        "path": "", // 自定义存储路径，比如 img/
        "customUrl": "", // 自定义域名，注意要加 http://或者 https://
        "version": "v5" | "v4" // COS 版本，v4 或者 v5
      }
      ```
      详见: https://picgo.github.io/PicGo-Core-Doc/zh/guide/config.html#%E6%89%8B%E5%8A%A8%E7%94%9F%E6%88%90
    default: "{}"
  page_output_dir:
    description: page类型页面的输出文件夹
    default: "source/"
  post_output_dir:
    description: post类型页面的输出文件夹
    default: "source/_posts/notion"
  clean_unpublished_post:
    description: 是否清除未发表的post
    default: "false"

```

#### 配置示例

```yaml
on: [repository_dispatch, watch]

name: notion

jobs:
  notion:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@master
      with:
        submodules: false

    - name: Convert notion to markdown
      uses: Doradx/notion2markdown-action@latest
      with:
        notion_secret: ${{ secrets.NOTION_TOKEN }}
        database_id: ${{ secrets.NOTION_DATABASE_ID }}
        migrate_image: true
        picBedConfig: ${{ secrets.PICBED_CONFIG}}
        page_output_dir: 'md/page'
        post_output_dir: 'md/_posts'
        clean_unpublished_post: true

    - name: update blog
      run: |
        git add source
        git commit -m "feat: auto update by notion sync"
        git push
```
