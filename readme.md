# notion2markdown-action

将 notion database 中的文章转换为 markdown 文件，提供给 hexo、hugo 等静态博客使用

- 使用 notion 导出接口，支持图片、表格、callout 等格式
- 支持迁移图片到置顶文件夹
- 内置PicGO-Core, 支持采用picBed进行图床上传，支持的图床有：SMMS/QINIU/UPYUN/TCYUN/GITHUB/ALIYUN/IMGUR. 详见：[picBed](https://picgo.github.io/PicGo-Core-Doc/zh/guide/config.html#picbed)

> 本项目受[`notion-blog-action`](https://github.com/mohuishou/notion-blog-actions)项目启发，fork 后深度修改而得，在此感谢[Mo Huishou](https://github.com/mohuishou)。

# [Updates]

- 2023.04.17：添加`pic_base_url`可选配置项，可配置为自己图床的基础链接。图床上传过程中，如检测到此链接，将会自动查询要上传的图片是否已在图床（上传的文件名为 md5，据此检测）。此项可极大提高文章更新效率，节省宝贵的`GitHub Action`运行时间和`CDN`流量。

# 概览

方案主要分为三部分：

- `Notion database`：创建写作, 进行稿件管理
- `notion2markdown-action`：GitHub Actions 将 notion 转为 Markdown，并将图片上传图床
- `GitHub Actions`: 编译部署 Hexo, 推送到 COS

# 实现原理

1. 采用 Notion API，从 Notion 中同步 Dataset 中的 Pages，并转换为 Markdown，将其中的图片上传到图床中；
2. Hexo 部署。
3. 以上均通过 Github Action 实现。

# 食用方法

## Notion 配置

1. 从[Blog - Template](https://www.notion.so/397943b2d0384e15ba69448900823984) 复制`Dataset`模板
2. 参考`Notion`官方教程[Create an integration (notion.com)](https://developers.notion.com/docs/create-a-notion-integration)，创建**Notion integration**
   应用，并获取**`Secrets`**，直达链接：[My integrations | Notion Developers](https://www.notion.so/my-integrations)
3. 将创建的`Dataset`数据库授权给刚创建的`Integration`应用，如下图：

![](https://i.cuger.cn/b/6f6266d6d365ad8a49a8293e8518f9b8.png)

## GitHub 配置

### workflows 配置

1. 切换到自己在 GitHub 上托管的仓库目录
2. 分别添加`notion_sync.yml`和`deploy.yml`

```yaml
name: Automatic sync pages from notion

on:
#   push:
#     branches: master
  workflow_dispatch:
  schedule:
    - cron: "5 */1 * * *"

permissions:
  contents: write

jobs:
  notionSyncTask:
    name: Ubuntu and node ${{ matrix.node_version }} and ${{ matrix.os }}
    runs-on: ubuntu-latest
    strategy:
      matrix:
        os: [ubuntu-latest]
        node_version: [16.x]
    outputs:
      HAS_CHANGES: ${{ steps.checkStep.outputs.HAS_CHANGES }}

    steps:
      - name: Checkout
        uses: actions/checkout@v3
      - name: Use Node.js ${{ matrix.node_version }}
        uses: actions/setup-node@v3
        with:
          node-version: ${{ matrix.node_version }}
      - name: Convert notion to markdown
        uses: Doradx/notion2markdown-action@latest
        with:
          notion_secret: ${{ secrets.NOTION_TOKEN }} # NOTION授权码
          database_id: ${{ secrets.NOTION_DATABASE_ID }} # Dataset ID
          migrate_image: true
          picBedConfig: ${{ secrets.PICBED_CONFIG}} # picBed的配置，JSON格式，建议为minify JSON, 否则可能报错. 不同图床的配置可参考：https://picgo.github.io/PicGo-Core-Doc/zh/guide/config.html#picbed
          # 图床基础链接, 可留空。如填写，在图片上传图床前，会检查该图片是否已经上传过，如已上传则跳过，提升效率。
					pic_base_url: "" # 改成你的链接，例如你图床的图片链接为：https://i.blog.com/image/xxxx.jpg, 则此处填写https://i.blog.com/image/
					page_output_dir: 'source' # page 类文章的输出目录，例如about。
          post_output_dir: 'source/_posts/notion' # post 的输出目录，切记当clean_unpublished_post为true时，勿设置为 'source/_posts', 可能会删除你原目录下的文章！！！
          clean_unpublished_post: true # 是否清除未发表的文章，例如之前发表了，你又在notion中给移到草稿箱了.
      - name: Check if there is anything changed
        id: checkStep
        run: |
          if [[ -n "$(git status --porcelain)" ]]; then
            echo "HAS_CHANGES=true" >> $GITHUB_OUTPUT;
            echo "Updates available & redeployment required."
          else
            echo "HAS_CHANGES=false" >> $GITHUB_OUTPUT;
            echo "Nothing to commit & deploy."
          fi
      - name: Commit & Push
        uses: stefanzweifel/git-auto-commit-action@v4
        with:
          commit_message: Automatic sync from notion.
  callDepolyTask:
    name: Call the depoly workflow
    needs: notionSyncTask
    if: ${{ needs.notionSyncTask.outputs.HAS_CHANGES=='true' }}
    uses: Doradx/hexo-blog/.github/workflows/deploy.yml@master # 根据自身Github地址修改即可
```

```yaml
name: Automatic deployment of Dorad's Blog -> Tencent COS

on:
  push:
    branches: master
    paths:
      - "source/**"
      - "**.yml"
  workflow_dispatch:
  workflow_call:

env:
  GIT_USER: Dorad
  GIT_EMAIL: ddxid@outlook.com

jobs:
  build:
    name: Ubuntu and node ${{ matrix.node_version }} and ${{ matrix.os }}
    runs-on: ubuntu-latest
    strategy:
      matrix:
        os: [ubuntu-latest]
        node_version: [14.x]

    steps:
      - name: Checkout blog and theme
        uses: actions/checkout@v3
        with:
          submodules: "recursive"
      - name: Use Node.js ${{ matrix.node_version }}
        uses: actions/setup-node@v3
        with:
          node-version: ${{ matrix.node_version }}
      - name: Install dependencies
        run: |
          git pull
          npm install
      - name: Depoly
        run: |
          npm run clean
          gulp
          npm run build
          npm run deploy
      - name: Commit & Push
        uses: stefanzweifel/git-auto-commit-action@v4
        with:
          commit_message: Automatic deployment.
```

### GitHub Action 环境变量配置

前往博客仓库的`settings/secrets/actions`中添加环境变量，核心为`NOTION_DATABASE_ID`, `NOTION_TOKEN`和`PICBED_CONFIG`。

![配置完成的GITHUB ACTION环境变量](https://i.cuger.cn/b/7091f2333e1ba7a774f4c5313a738fd2.png)

其中，

- `NOTION_DATABASE_ID`：`Notion Dataset`的页面 ID，在`Notion Dataset`主页中点击`Copy Link`，得到链接，例如：[https://www.notion.so/doradx/397943b2d0384e15ba69448900823984?v=06762d5d3e2140e399c03d84131ee682](/397943b2d0384e15ba69448900823984?v=06762d5d3e2140e399c03d84131ee682)，其中`397943b2d0384e15ba69448900823984`便是此`Dataset`的 ID。
- `NOTION_TOKEN`：在此前获取的`Notion Integration`的**`Secrets`**，直达链接：[My integrations | Notion Developers](https://www.notion.so/my-integrations)
- `PICBED_CONFIG`：图床的配置文件，JSON 格式，由于图床使用的是[PicGo-Core](https://picgo.github.io/PicGo-Core-Doc/), 其配置保持相同，但只需要`picBed`部分，不同图床的配置方式详见：[配置文件 | PicGo-Core](https://picgo.github.io/PicGo-Core-Doc/zh/guide/config.html#%E6%89%8B%E5%8A%A8%E7%94%9F%E6%88%90)

以腾讯云 COS 为例，`PICBED_CONFIG`的格式为：

```json
{
    "uploader": "tcyun", // 代表当前的默认上传图床为,
    "tcyun":
    {
        "secretId": "",
        "secretKey": "",
        "bucket": "", // 存储桶名，v4 和 v5 版本不一样
        "appId": "",
        "area": "", // 存储区域，例如 ap-beijing-1
        "path": "", // 自定义存储路径，比如 img/
        "customUrl": "", // 自定义域名，注意要加 http://或者 https://
        "version": "v5" | "v4" // COS 版本，v4 或者 v5
    }
}
```

如需使用不同图床，直接修改`uploader`字段，并配置相应的参数即可。以下提供几种常见图床的配置文件案例：

- `qiniu`

```json
{
    "uploader": "qiniu", // 代表当前的默认上传图床为,
    "qiniu":
    {
        "accessKey": "",
        "secretKey": "",
        "bucket": "", // 存储空间名
        "url": "", // 自定义域名
        "area": "z0" | "z1" | "z2" | "na0" | "as0", // 存储区域编号
        "options": "", // 网址后缀，比如？imgslim
        "path": "" // 自定义存储路径，比如 img/
    }
}
```

- `aliyun`

```json
{
  "uploader": "aliyun", // 代表当前的默认上传图床,
  "aliyun": {
    "accessKeyId": "",
    "accessKeySecret": "",
    "bucket": "", // 存储空间名
    "area": "", // 存储区域代号
    "path": "", // 自定义存储路径
    "customUrl": "", // 自定义域名，注意要加 http://或者 https://
    "options": "" // 针对图片的一些后缀处理参数 PicGo 2.2.0+ PicGo-Core 1.4.0+
  }
}
```

- `github`

```json
{
  "uploader": "github", // 代表当前的默认上传图床,
  "github": {
    "repo": "", // 仓库名，格式是 username/reponame
    "token": "", // github token
    "path": "", // 自定义存储路径，比如 img/
    "customUrl": "", // 自定义域名，注意要加 http://或者 https://
    "branch": "" // 分支名，默认是 main
  }
}
```

## 测试效果

前往仓库的`Actions`页面，选择`Automatic sync pages from notion`，进行测试手动部署，并查看运行情况。

![手动触发，查看运行结果](https://i.cuger.cn/b/36ef3d31bc346b85e7c450b1ea5cd0f1.png)

搞定！尽情享受写作吧！

# 完整版配置文件及说明

[`notion2markdown`](https://github.com/Doradx/notion2markdown-action)提供了众多配置参数，以满足各类需求，以下为根据此 action 的配置文件，撰写的参数说明。

````yaml
name: "notion2markdown-action"
description: |
  将 notion database 中的 page 转换为 markdown 文档，可以用于 hexo、hugo 等静态博客构建, 内置picgo-core,使用picBed上传图床。
inputs:
  notion_secret: # id of input
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
      是否迁移图片到图床
      注意: 如果不迁移图片默认导出图片链接是 notion 的自带链接，有访问时效
      目前支持迁移图片到多类图床中，采用的是PicGO-Core.
    default: "true"
  picBedConfig:
    description: |
      picgo-core中picBed配置文件, 支持多类型图床。
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
  pic_base_url:
    description: |
      图床的基础链接, 例如: https://i.blog.com/image/，如填写此链接，在图片上传图床前，会检查该图片是否已经上传过，如已上传则跳过，提升效率。
    default: ""
  page_output_dir:
    description: page类型页面的输出文件夹
    default: "source/"
  post_output_dir:
    description: post类型页面的输出文件夹
    default: "source/_posts/notion"
  clean_unpublished_post:
    description: 是否清除未发表的post
    default: "false"
  timezone:
    description: 设置的时区
    default: "Asia/Shanghai"
````

# Notion 文章属性说明

## 属性列表

`Nation Dataset`中，每篇文章都预设了属性字段，字段说明如下：

- `status`: 文章状态
- `type`:页面类型，`post/page`, 分别对应 hexo 中的`page`和`post`, 留空则默认为`post`
- `date`: 发表日期
- `categories`: 分类
- `tags`: 标签
- `filename`: `Markdown`文件最终的文件名，可留空，默认为文章的标题
- `description`: 文章简介
- `abbrlink`: 静态文章链接, 此项需搭配[**hexo-abbrlink**](https://github.com/rozbo/hexo-abbrlink)使用，如果你不知道该属性的意义，可留空
- `Created time`:　创建时间，此属性自动更新，将会被同步到`*.md`文件的 cre`ated`属性中
- `Last edit time`：最后修改时间，此属性自动更新，将会被同步到`*.md`文件的`updated`属性中

## Tips

- 只有状态为`待发布`的文章才会被`Github Action`转为`Markdown`
- `Notion`上设置的`文章封面`会被用作文章的`cover`字段，并上传图床
- `Notion`中每个页面会有一个独一无二的 UID, 为方便管理，此 ID 会被同步到`*.md`文件的`id`属性
- `Notion`中每个页面会有`created_time`和`last_edited_time`, 会被分别同步到`*.md`文件的`created`和`updated`属性
- `Notion Dataset`中，使用`status`进行阶段管理，其中只有处于`待发布`状态的文章会被自动处理。所以，只需要保证`待发布`和`已发布`两个状态存在即可，其它几个状态可以根据喜好修改或删除；
- `Notion Dataset`中，每篇文章都设置了众多属性，其均会写入到最终`Markdown`文件头部的 YAML 配置中，可根据自身需要添加属性，但注意字段名最好不要有特殊字符，否则可能出错；
- 使用`hexo`的童鞋，如**部署过慢**，建议升级`hexo`版本，并**清理项目依赖**（在`package.json`中），可极大提升部署效率。博主升级后时间缩短了一半，目前约`90s内`能完成部署。

## Actions 耗时分析

### notion_sync.yml

对于此任务，最耗时的部分在于图床上传，具体耗时与图片数量和`GitHub Actions`的具体执行机器有关（每次机器都不一样）。

由于是每小时轮询，当查到 Notion 无需要发布的文献时候

> 本文处理耗时约`17s`，各任务为并行，取决于执行机器网速和图片数量。此步骤主要瓶颈在于 GitHub 上传图床速度，可优化面较小。。。或许用 GitHub 做图床会非常快？利好图床采用外网平台的童鞋。

### deploy.yml

此任务最大耗时在依赖安装(`Install dependencies`)和部署(`Deploy`)：

- 升级`Hexo`到最新版`v6.3.0`，并清理`package.json`中无用的包后，依赖安装约耗时`20s`
- 部署部分主要还是网络问题，速度取决于你的部署类型，博主使用腾讯云 COS，单次部署上传约`30s`

> 单次部署的典型耗时约`1min`

# Q&A

- 如何更新`已发布`的文章？

撰写修改后，将文章状态修改为`待发布`即可，会自动更新。

- 如何删除`已发布`的文章？

直接将文章状态修改为`正在写`/`计划中`，或其它任何不是`已发布`/`待发布`的状态即可。

> 注意：需要`notion_sync.yml`中配置`clean_unpublished_post: true`

- 更新`已发布`的文章，如何保证文章链接不变？

方案 1（手动）：给`Notion`的文章手动设置`abbrlink`，会同步到`Markdown`文件中

方案 2（自动）：采用[rozbo/hexo-abbrlink](https://github.com/rozbo/hexo-abbrlink)插件的童鞋，`Notion`文章的 abbrlink 留空即可，会自动处理；当然如果想自定义`abbrlink`，直接填写即可

> [rozbo/hexo-abbrlink](https://github.com/rozbo/hexo-abbrlink)会在`Deploy`阶段自动给文章生成`abbrlink`，当将已发布文章修改后重新发布时，会读取原 Markfown 文件中的`abbrlink`并同步到 Notion 文章。

- 如何修改同步频次？

在`notion_sync.yml`配置中修改 `schedule`配置即可，格式为 cron，可利用[Crontab.guru](https://crontab.guru/#5_*/1_*_*_*)进行可视化调整。

> 注意：不要改那么高频！GitHub 对于私有仓库，调用 GitHub Actions 的时间是有限的，Pro 用户每个月 3000 分钟。小心 GitHub 找你收钱。根据推算，建议触发间隔前往不要小于 10 分钟！

- 如何嵌入 HTML 等代码？

在`Notion`中直接粘贴即可，需要确保在粘贴过程中 Notion 没有给你的 URL 链接自动加上超链接，否则可能渲染出错，例如：

```html
<iframe
  width="560"
  height="315"
  src="https://www.youtube.com/embed/r7iLI8vW4bE"
  title="YouTube video player"
  frameborder="0"
  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
  allowfullscreen
></iframe>
```

复制后直接粘贴到 Notion 的文章，它会自动给 URL 加上超链接：

```html
<iframe
  width="560"
  height="315"
  src="[https://www.youtube.com/embed/r7iLI8vW4bE](https://www.youtube.com/embed/r7iLI8vW4bE)
"
  title="YouTube video player"
  frameborder="0"
  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
  allowfullscreen
></iframe>
```

会导致最终的`Markdown`渲染出错。

# 总结

## 优势

- 功能完备，虽然有一些小坑，但`Notion`转`Markdown`功能完备
- 自动化部署，只需要在`Notion`编辑即可，且方便管理，剩余流程全自动
- 利用`Notion`可在多端同步编辑，图床自动上传，无需关心其它问题，转注写作即可
- 支持各类博客，因为原理就是 Notion to Markdown，通用型极高
- 可设置指定的目录存储 Notion 导出的 post, 例如: `source/_posts/notion`,不影响原先使用其它编辑器撰写的文章
- 多处备份，`Notion+GitHub`,暂不用担心数据丢失

## 不足

- `Notion`的有些特性，`Markdown`可能不支持，所以写作时的结果和发表后的结果可能有差异。

> 例如如何嵌入`HTML`代码…添加`Bilibili/YouTube/163`等视频或音乐`iframe`媒体文件，`Markdown`导入`Notion`时，`Notion`给转成了`embed`类型，再导出`Markdown`的时候就全成链接了！！！麻了。。。解决方案也很简单，将`iframe`代码直接复制粘贴到`Notion`中粘贴为纯文本即可，记得检查`Notion`是否把链接给转成了引用。

- 目前是采用`GitHub Actions Schedule` 定时触发，从`Notion`同步数据，但`GitHub`的**`schedule`**并不是总准时，而且还有可能跳票，详见：[Events that trigger workflows - GitHub Docs](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#schedule)

> Note: The `schedule`  
>  event can be delayed during periods of high loads of GitHub Actions workflow runs. High load times include the start of every hour. If the load is sufficiently high enough, some queued jobs may be dropped. To decrease the chance of delay, schedule your workflow to run at a different time of the hour.

- 后期可考虑换为`Webhook`(更及时、节省资源)
- ~~已发布的稿件，如何撤销？只能上~~~~`GitHub`~~~~或者~~~~`VS CODE`~~ ~~（已支持）~~

# 主要参考

- [`notion-blog-action`](https://github.com/mohuishou/notion-blog-actions)
- [使用 Notion Database 管理静态博客文章 - Mohuishou (lailin.xyz)](https://lailin.xyz/post/notion-markdown-blog.html)
- [利用 Github Actions 自动部署 Hexo 博客 | Sanonz](https://sanonz.github.io/2020/deploy-a-hexo-blog-from-github-actions/#Workflow-%E6%A8%A1%E7%89%88)
