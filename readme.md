# notion2markdown-action
[[English]](./readme.md) [[简体中文]](./readme_cn.md)

Convert articles in Notion database to markdown files, which can be used for static blogs such as Hexo and Hugo.

## Features
- Use Notion export API, support formats such as images, tables, and callouts.
- Support migrating images to a specified folder.
- Built-in PicGO-Core, which supports using picBed for image hosting. Supported image hosting services include: SMMS/QINIU/UPYUN/TCYUN/GITHUB/ALIYUN/IMGUR. For more information, see: [picBed](https://picgo.github.io/PicGo-Core-Doc/zh/guide/config.html#picbed)

> This project was inspired by the [`notion-blog-action`](https://github.com/mohuishou/notion-blog-actions) project, and was heavily modified after forking. Thanks to [Mo Huishou](https://github.com/mohuishou) for their contributions.

# Overview

The solution is mainly divided into three parts:

- `Notion database`: create and manage articles
- `notion2markdown-action`: GitHub Actions converts Notion to Markdown and uploads images to image hosting services
- `GitHub Actions`: compile and deploy Hexo, and push to COS

# Implementation

1. Use the Notion API to synchronize Pages in the Dataset from Notion, convert them to Markdown, and upload the images to image hosting services.
2. Hexo deployment.
3. All of the above are implemented through Github Actions.

# Usage

## [See the latest tutorial on the blog (in Chinese)](https://blog.cuger.cn/p/634642fd/)

# [Rendered demo](https://blog.cuger.cn/p/634642fd/#%E6%B8%B2%E6%9F%93%E6%95%88%E6%9E%9C)
See [blog](https://blog.cuger.cn/p/634642fd/#%E6%B8%B2%E6%9F%93%E6%95%88%E6%9E%9C) for rendered demo.