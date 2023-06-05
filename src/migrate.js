const Migrater = require("picgo-plugin-pic-migrater/dist/lib/Migrater.js");
const FileHandler = require("picgo-plugin-pic-migrater/dist/lib/FileHandler.js");
const crypto = require("crypto");
const axios = require("axios");

const fs = require("fs");
const path = require("path");
const os = require("os");

const imagemin = require("imagemin");
const imageSize = require("image-size");
const imageminPngquant = require("imagemin-pngquant");
const imageminMozjpeg = require("imagemin-mozjpeg");
const imageminGifsicle = require("imagemin-gifsicle");
const imageminSvgo = require("imagemin-svgo");


async function checkPicExist(picUrl) {
  try {
    const res = await axios.head(picUrl);
    return res.status === 200;
  } catch (e) {
    return false;
  }
}

async function compressPic(item) {
  return imagemin.buffer(item.buffer, {
    plugins: [
      imageminPngquant(),
      imageminMozjpeg(),
      imageminGifsicle(),
      imageminSvgo()
    ],
  }).then((newBuffer) => {
    const { width, height } = imageSize(newBuffer);
    item.buffer = newBuffer;
    item.width = width;
    item.height = height;
    // item.fileName = `${crypto.createHash("md5").update(newBuffer).digest("hex")}${item.extname}`;
    // update the buffer
    console.log(`Compress image ${item.fileName} success`);
    return item;
  });
}

async function checkPicUrlList(picUrlList) {
  return Promise.all(picUrlList.map(async (url) => {
    const exists = await checkPicExist(url);
    if (exists) {
      return url;
    }
    else {
      return false;
    }
  }));
}

class NotionMigrater extends Migrater.default {
  async getPicFromURL(url) {
    return this.ctx.request({
      url,
      encoding: null,
      responseType: "arraybuffer",
    });
  }

  async handlePicFromURL(url) {
    try {
      if (url.includes("data:image/svg+xml")) {
        let data = url.replace("data:image/svg+xml;utf8,", "");
        return {
          buffer: Buffer.from(decodeURIComponent(data), "utf-8"),
          fileName: `${new Date().getTime()}.svg`,
          extname: ".svg",
          origin: url,
        };
      }
      return super.handlePicFromURL(url);
    } catch (e) {
      this.ctx.log.error(`get pic from url fail: ${e}`);
      return undefined;
    }
  }

  async migrate() {
    const originTransformer = this.ctx.getConfig('picBed.transformer') || null;
    this.ctx.setConfig({
      'picBed.transformer': 'base64'
    });
    this.ctx.output = []; // a bug before picgo v1.2.2
    const include = this.ctx.getConfig('picgo-plugin-pic-migrater.include') || null;
    const exclude = this.ctx.getConfig('picgo-plugin-pic-migrater.exclude') || null;
    const base_url = this.ctx.getConfig('pic-base-url') || null;
    const includesReg = new RegExp(include);
    const excludesReg = new RegExp(exclude);
    if (!this.urlArray || this.urlArray.length === 0) {
      return {
        urls: [],
        success: 0,
        exists: 0,
        total: 0,
      };
    }
    var existsImgsList = [];
    var successImgsList = [];
    // filter the url using include and exclude
    var toUploadURLs = this.urlArray.filter(url => ((!include || includesReg.test(url)) && (!exclude || !excludesReg.test(url))));
    var ToProcessURLs = toUploadURLs.length;
    console.log(`Total ${toUploadURLs.length} images to upload.`);
    // check the url if it is already uploaded, if base_url is set
    if (base_url) {
      // filter the url include uuid and extname, to check the existence
      const uuidreg = /[a-fA-F0-9]{8}-(?:[a-fA-F0-9]{4}-){3}[a-fA-F0-9]{12}/;
      const toCheckURLs = toUploadURLs.filter(url => {
        const id = uuidreg.exec(url)?.[0];
        var extname = url.split('?')[0].split('.').pop()?.toLowerCase();
        return id && extname;
      });
      const existsImgs = await checkPicUrlList(toCheckURLs.map(url => {
        const id = uuidreg.exec(url)?.[0];
        var extname = url.split('?')[0].split('.').pop()?.toLowerCase();
        return `${base_url}${id}.${extname}`;
      }));
      await existsImgs.forEach((exists, index) => {
        if (exists) {
          existsImgsList.push({
            original: toUploadURLs[index],
            new: `${base_url}${exists}`
          });
          console.log(`Image ${exists} already exists, skip`);
        }
      });
      // remove the exists image from the toUploadURLs
      toUploadURLs = await toUploadURLs.filter(url => !existsImgsList.find(item => item.original === url));
    }
    /** 
     * 采用队列进行图片上传，防止图片过多的时候，资源占用过多
    */
    // the queue
    const queue = new (await import('p-queue')).default({ concurrency: 20 })
    // the queue task function
    const queueTask = async (url) => {
      let imgInfo;
      try {
        const picPath = this.getLocalPath(url);
        if (!picPath) {
          imgInfo = await this.handlePicFromURL(url);
          // get pic uuid from the url using regex
          const uuidreg = /[a-fA-F0-9]{8}-(?:[a-fA-F0-9]{4}-){3}[a-fA-F0-9]{12}/;
          const id = uuidreg.exec(url)?.[0];
          var extname = url.split('?')[0].split('.').pop()?.toLowerCase();
          // if the url is a notion url
          if (id && extname) {
            // 文件重命名为notion url中的id
            imgInfo.extname = '.' + extname;
            imgInfo.uuid = id;
            imgInfo.fileName = `${id}${extname}`;
          }
        }
        else {
          imgInfo = await this.handlePicFromLocal(picPath, url);
        }
      } catch (e) {
        this.ctx.log.error(`get pic from url fail: ${e}`);
        return;
      }

      // compress the image
      if (this.ctx.getConfig('compress')) {
        imgInfo = await compressPic(imgInfo);
      }
      // upload the image
      const result = await this.ctx.upload([imgInfo]);
      if (result && result[0] && result[0].imgUrl) {
        successImgsList.push({
          original: imgInfo.origin,
          new: result[0].imgUrl
        });
        console.log(`Upload image ${imgInfo.fileName} success`);
      }
      else {
        console.log(`Upload image ${imgInfo.fileName} fail`);
      }
    };
    toUploadURLs.forEach(url => {
      queue.add(() => queueTask(url))
    })
    // wait for the queue to be empty
    await queue.onIdle();
    // generate the result
    console.log('===============================')
    console.log(`Total ${existsImgsList.length} / ${ToProcessURLs} images already exists`);
    console.log(`Total ${successImgsList.length} / ${ToProcessURLs} images upload success, list: ${successImgsList.map(item => item.new).join(', ')}`);
    console.log('===============================')
    return {
      urls: existsImgsList.concat(successImgsList),
      success: successImgsList.length + existsImgsList.length,
      exists: existsImgsList.length,
      total: ToProcessURLs
    };
  }
}

class NotionFileHandler extends FileHandler.default {
  getUrlListFromFileContent(file) {
    const content = this.fileList[file] || "";
    const markdownURLList = (content.match(/\!\[.*\]\(.*\)/g) || [])
      .map((item) => {
        const res = item.match(/\!\[.*\]\((.*?)( ".*")?\)/);
        if (res) {
          return res[1];
        }
        return null;
      })
      .filter((item) => item);

    const imageTagURLList = (content.match(/<img.*?(?:>|\/>)/gi) || [])
      .map((item) => {
        const res = item.match(/src=[\'\"]?(.*?)[\'\"]/i);
        if (res) return res[1];
        return null;
      })
      .filter((item) => item);

    let urls = markdownURLList.concat(imageTagURLList);

    // front matter
    let matchs = content.matchAll(/(.*):\s((https?:\/\/.*\.(?:png|jpe?g|gif|svg|tiff?|webp|bmp)).*)/gi);
    for (const m of matchs) {
      let src = m[2];
      src = src.replace(/^'/, "").replace(/'$/, "");
      src = src.replace(/^"/, "").replace(/"$/, "");
      src = src.trim();
      if (!src) continue;
      urls.push(src);
    }

    this.urlList[file] = {};
    for (const url of urls) {
      this.urlList[file][url] = url;
    }
    console.log(`file: ${file}, urls: ${urls}`); 
  }
}

async function migrate(ctx, files) {
  ctx.log.info("Migrating...");

  let total = 0;
  let success = 0;

  for (const file of files) {
    const fileHandler = new NotionFileHandler(ctx);
    // read File
    fileHandler.read(file);
    const migrater = new NotionMigrater(ctx, null, file);
    migrater.init(fileHandler.getFileUrlList(file));

    // migrate pics
    const result = await migrater.migrate();

    if (result.total === 0) continue;

    total += result.total;
    success += result.success;
    if (result.success === 0) {
      ctx.log.warn(
        `Please check your configuration, since no images migrated successfully in ${file}`
      );
      return;
    }
    let content = fileHandler.getFileContent(file);
    // replace content
    result.urls.forEach((item) => {
      content = content.replaceAll(item.original, item.new);
    });
    fileHandler.write(file, content, "", true);
  }
  return { total, success };
}

module.exports = migrate;
