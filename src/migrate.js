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

async function compressPic(picBuffer, extname) {
  return imagemin.buffer(picBuffer, {
    plugins: [
      imageminPngquant(),
      imageminMozjpeg(),
      imageminGifsicle(),
      imageminSvgo()
    ],
  }).then((newBuffer) => {
    const { width, height } = imageSize(newBuffer);
    var item = {
      buffer: newBuffer,
      width: width,
      height: height,
      fileName: `${crypto.createHash("md5").update(newBuffer).digest("hex")}${extname}`,
    }
    // update the buffer
    console.log(`Compress image ${item.fileName} success`);
    return item;
  });
}

async function checkPicUrlList(picUrlList) {
  return Promise.all(picUrlList.map(async (url) => {
    const exists = await checkPicExist(url);
    if (exists) {
      return true;
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
      return result;
    }
    var existsImgsList = [];
    // filter the url using include and exclude
    const toUploadURLs = this.urlArray.filter(url => ((!include || includesReg.test(url)) && (!exclude || !excludesReg.test(url)))).map(async (url) => {
      return await new Promise(async (resolve, reject) => {
        try {
          let imgInfo;
          const picPath = this.getLocalPath(url);
          if (!picPath) {
            imgInfo = await this.handlePicFromURL(url);
          }
          else {
            imgInfo = await this.handlePicFromLocal(picPath, url);
          }
          resolve(imgInfo);
        }
        catch (err) {
          // dont reject
          resolve(undefined);
          this.ctx.log.error(err);
        }
      });
    });
    var toUploadImgs = await Promise.all(toUploadURLs).then(imgs => imgs.filter(img => img !== undefined));
    const totalImageNeedToProcess = toUploadImgs.length;
    console.log(`Total ${totalImageNeedToProcess} images to upload, list: ${toUploadImgs.map(item => item.fileName).join(', ')}`);
    // 文件重命名为 md5 hash
    toUploadImgs.forEach((item) => {
      item.fileName =
        crypto.createHash("md5").update(item.buffer).digest("hex") + item.extname;
    });
    /**
     * check the url if it is already uploaded, if base_url is set
     */
    if (base_url) {
      // check if the file exists on the server
      const imageUrlExistCheckList = await checkPicUrlList(toUploadImgs.map(item => `${base_url}${item.fileName}`));
      // get the existsImgsList with the url
      existsImgsList = existsImgsList.concat(toUploadImgs.filter((item, index) => {
        return imageUrlExistCheckList[index];
      }).map(item => {
        return {
          original: item.origin,
          new: `${base_url}${item.fileName}`
        };
      }));
      // remove the existsImgsList from toUploadImgs
      toUploadImgs = toUploadImgs.filter((item, index) => {
        return !imageUrlExistCheckList[index];
      });
    }
    // compress the image if the config is set
    if (this.ctx.getConfig('compress')) {
      toUploadImgs = await Promise.all(toUploadImgs.map(async (item) => {
        var item_compressed = await compressPic(item.buffer, item.extname);
        item_compressed.origin = item.origin;
        return item_compressed;
      }));
    }
    // filter the image again if the base_url is set
    if (base_url) {
      // check if the file exists on the server
      const imageUrlExistCheckList = await checkPicUrlList(toUploadImgs.map(item => `${base_url}${item.fileName}`));
      // get the existsImgsList with the url
      existsImgsList = existsImgsList.concat(toUploadImgs.filter((item, index) => {
        return imageUrlExistCheckList[index];
      }).map(item => {
        return {
          original: item.origin,
          new: `${base_url}${item.fileName}`
        };
      }));
      // remove the existsImgsList from toUploadImgs
      toUploadImgs = toUploadImgs.filter((item, index) => {
        return !imageUrlExistCheckList[index];
      });
    }
    // 整合输出
    console.log('===============================')
    console.log(`Total ${totalImageNeedToProcess} images to process, ${existsImgsList.length} images already exists, ${toUploadImgs.length} images to upload`)
    console.log('===============================')
    if (!toUploadImgs || toUploadImgs.length === 0) {
      console.log('No image needs to upload, exit');
      return {
        urls: existsImgsList,
        success: existsImgsList.length,
        exists: existsImgsList.length,
        total: totalImageNeedToProcess
      };
    }
    // upload
    let output = [];
    try {
      const res = await this.ctx.upload(toUploadImgs);
      if (Array.isArray(res)) {
        output = res;
      }
    }
    catch (e) {
      // fake output
      this.ctx.log.error(e);
      output = this.ctx.output;
    }
    return {
      urls: existsImgsList.concat(output.filter(item => item.imgUrl && item.imgUrl !== item.origin).map(item => {
        return {
          original: item.origin,
          new: item.imgUrl
        };
      })),
      success: output.filter(item => item.imgUrl && item.imgUrl !== item.origin).length + existsImgsList.length,
      exists: existsImgsList.length,
      total: totalImageNeedToProcess
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
