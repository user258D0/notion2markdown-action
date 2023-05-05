# notion2markdown-action

将 notion database 中的文章转换为 markdown 文件，提供给 hexo、hugo 等静态博客使用

- 使用 notion 导出接口，支持图片、表格、callout 等格式
- 支持迁移图片到置顶文件夹
- 内置PicGO-Core, 支持采用picBed进行图床上传，支持的图床有：SMMS/QINIU/UPYUN/TCYUN/GITHUB/ALIYUN/IMGUR. 详见：[picBed](https://picgo.github.io/PicGo-Core-Doc/zh/guide/config.html#picbed)

> 本项目受[`notion-blog-action`](https://github.com/mohuishou/notion-blog-actions)项目启发，fork 后深度修改而得，在此感谢[Mo Huishou](https://github.com/mohuishou)。

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

## [最新教程见博客](https://blog.cuger.cn/p/634642fd/)


# [渲染效果](https://blog.cuger.cn/p/634642fd/#%E6%B8%B2%E6%9F%93%E6%95%88%E6%9E%9C)
渲染效果详见[博客](https://blog.cuger.cn/p/634642fd/#%E6%B8%B2%E6%9F%93%E6%95%88%E6%9E%9C)
