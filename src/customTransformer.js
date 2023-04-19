/*
 * @Author: Dorad, ddxi@qq.com
 * @Date: 2023-04-18 22:07:58 +02:00
 * @LastEditors: Dorad, ddxi@qq.com
 * @LastEditTime: 2023-04-19 04:49:39 +02:00
 * @FilePath: \src\customTransformer.js
 * @Description: 
 * 
 * Copyright (c) 2023 by Dorad (ddxi@qq.com), All Rights Reserved.
 */

const axios = require('axios');
const cheerio = require('cheerio');

function capitalizeFirstLetter(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

var CAPTION_DIV_TEMPLATE = `<div style="text-align: center; margin:0;"><p>{{caption}}</p></div>`;
/**
 * to parse the link preview block
 * @param {*} block 
 * @returns 
 */
async function link_preview(block) {
    const { link_preview } = block;
    if (!link_preview) return false;
    if (!link_preview.url) {
        console.error("Link preview block without url: ", block);
        return false;
    }
    const url = link_preview.url;
    // fetch the link preview
    try {
        switch (new URL(url).hostname) {
            case "github.com":
                return await link_preview_github(url);
            default:
                console.error("Link preview block with unsupported domain: ", block);
                return false;
        }
    } catch (err) {
        // check if it's the error from axios
        if (axios.isAxiosError(err)) {
            console.error(`Failed to query from ${err.config.url}, status: ${err.response.status}, msg: ${err.response.data}`);
        } else {
            // err.response.data
            console.error("Error parsing link preview block: ", block, err);
        }
        return false;
    }
}

/**
 * 
 * @param {string} url 
 * @returns 
 */

async function link_preview_github(url) {
    /**
     * url example: 
     * https://github.com/Doradx, home page
     * https://github.com/Doradx/CNKI-PDF-RIS-Helper, repo page
     * https://github.com/Doradx/CNKI-PDF-RIS-Helper/issues, issues list page
     * https://github.com/Doradx/CNKI-PDF-RIS-Helper/issues/2, issue page
     * https://github.com/Doradx/CNKI-PDF-RIS-Helper/pulls, pull requests list page
     * https://github.com/dpy1123/GithubRemark/pull/4, pull request page
     */
    const path = new URL(url).pathname.split("/").filter((x) => x);
    const HTML_TEMPLATE = `<div style="margin:5px 1px;"> <a href="{{url}}" target="_blank" rel="noopener noreferrer" style="display:flex;color:inherit;background:#f5f5f5;text-decoration:none;user-select:none;transition:background 20ms ease-in 0s;cursor:pointer;flex-grow:1;min-width:0;align-items:center;border:1px solid rgba(55,53,47,.16);border-radius:5px;padding:6px;fill:inherit"><div style="display:flex;align-self:start;height:32px;width:32px;margin:3px 12px 3px 4px;position:relative"><div><div style="width:100%;height:100%"><img src="{{avatar}}" referrerpolicy="same-origin" style="display:block;object-fit:cover;border-radius:34px;width:30.192px;height:30.192px;transition:opacity .1s ease-out 0s;box-shadow:rgba(15,15,15,.1) 0 2px 4px"></div></div><div style="position:absolute;bottom:-2px;right:-2px"><div style="width:100%;height:100%"><svg xmlns="http://www.w3.org/2000/svg" viewbox="0 0 496 512" style="display:block;object-fit:cover;border-radius:5px;width:14.208px;height:14.208px;transition:opacity .1s ease-out 0s;filter:drop-shadow(white 0 0 1px) drop-shadow(white 0 0 1px) drop-shadow(white 0 0 1px)"><path d="M165.9 397.4c0 2-2.3 3.6-5.2 3.6-3.3.3-5.6-1.3-5.6-3.6 0-2 2.3-3.6 5.2-3.6 3-.3 5.6 1.3 5.6 3.6zm-31.1-4.5c-.7 2 1.3 4.3 4.3 4.9 2.6 1 5.6 0 6.2-2s-1.3-4.3-4.3-5.2c-2.6-.7-5.5.3-6.2 2.3zm44.2-1.7c-2.9.7-4.9 2.6-4.6 4.9.3 2 2.9 3.3 5.9 2.6 2.9-.7 4.9-2.6 4.6-4.6-.3-1.9-3-3.2-5.9-2.9zM244.8 8C106.1 8 0 113.3 0 252c0 110.9 69.8 205.8 169.5 239.2 12.8 2.3 17.3-5.6 17.3-12.1 0-6.2-.3-40.4-.3-61.4 0 0-70 15-84.7-29.8 0 0-11.4-29.1-27.8-36.6 0 0-22.9-15.7 1.6-15.4 0 0 24.9 2 38.6 25.8 21.9 38.6 58.6 27.5 72.9 20.9 2.3-16 8.8-27.1 16-33.7-55.9-6.2-112.3-14.3-112.3-110.5 0-27.5 7.6-41.3 23.6-58.9-2.6-6.5-11.1-33.3 2.6-67.9 20.9-6.5 69 27 69 27 20-5.6 41.5-8.5 62.8-8.5s42.8 2.9 62.8 8.5c0 0 48.1-33.6 69-27 13.7 34.7 5.2 61.4 2.6 67.9 16 17.7 25.8 31.5 25.8 58.9 0 96.5-58.9 104.2-114.8 110.5 9.2 7.9 17 22.9 17 46.4 0 33.7-.3 75.4-.3 83.6 0 6.5 4.6 14.4 17.3 12.1C428.2 457.8 496 362.9 496 252 496 113.3 383.5 8 244.8 8zM97.2 352.9c-1.3 1-1 3.3.7 5.2 1.6 1.6 3.9 2.3 5.2 1 1.3-1 1-3.3-.7-5.2-1.6-1.6-3.9-2.3-5.2-1zm-10.8-8.1c-.7 1.3.3 2.9 2.3 3.9 1.6 1 3.6.7 4.3-.7.7-1.3-.3-2.9-2.3-3.9-2-.6-3.6-.3-4.3.7zm32.4 35.6c-1.6 1.3-1 4.3 1.3 6.2 2.3 2.3 5.2 2.6 6.5 1 1.3-1.3.7-4.3-1.3-6.2-2.2-2.3-5.2-2.6-6.5-1zm-11.4-14.7c-1.6 1-1.6 3.6 0 5.9 1.6 2.3 4.3 3.3 5.6 2.3 1.6-1.3 1.6-3.9 0-6.2-1.4-2.3-4-3.3-5.6-2z"></path></svg></div></div></div><div style="display:flex;flex-direction:column;justify-content:center;flex-grow:1;flex-shrink:1;overflow:hidden"><div style="display:flex;align-items:baseline;font-size:14px"><div spellcheck="false" style="white-space:nowrap;color:#37352f;font-weight:500;overflow:hidden;text-overflow:ellipsis">{{title}}</div></div><div style="display:flex;align-items:center;color:rgba(55,53,47,.65);font-size:12px"><div spellcheck="false" style="white-space:nowrap;color:rgba(55,53,47,.65)">{{owner}}</div><span style="margin-left:3px;margin-right:3px">•</span><div style="color:rgba(55,53,47,.65);font-size:12px;white-space:nowrap">{{remark}}</div></div></div><div role="button" tabindex="0" style="user-select:none;transition:background 20ms ease-in 0s;cursor:pointer;opacity:0;display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:5px;flex-shrink:0;margin-right:4px;color:rgba(55,53,47,.65)"><svg viewbox="0 0 13 3" class="dots" style="width:14px;height:100%;display:block;fill:inherit;flex-shrink:0;backface-visibility:hidden;color:rgba(55,53,47,.45)"><g><path d="M3,1.5A1.5,1.5,0,1,1,1.5,0,1.5,1.5,0,0,1,3,1.5Z"></path><path d="M8,1.5A1.5,1.5,0,1,1,6.5,0,1.5,1.5,0,0,1,8,1.5Z"></path><path d="M13,1.5A1.5,1.5,0,1,1,11.5,0,1.5,1.5,0,0,1,13,1.5Z"></path></g></svg></div></a></div>`;
    var data = {
        title: "",
        owner: "",
        remark: "",
        avatar: "",
        url: url
    }
    if (path.length < 2) {
        console.error("Link preview block with unsupported url: ", url);
        return false;
    } else if (path.length == 2) {
        // home page
        const info = await axios.get(`https://api.github.com/repos/${path[0]}/${path[1]}`).then((res) => res.data);
        data.title = info.full_name;
        data.avatar = info.owner.avatar_url;
        data.owner = info.owner.login;
        data.remark = "Created At: " + info.created_at;
    } else if (path.length == 3) {
        // pulls/issues/actions, pull home page info and add "pulls" or "issues"
        const info = await axios.get(`https://api.github.com/repos/${path[0]}/${path[1]}`).then((res) => res.data);
        data.title = info.full_name + "  " + capitalizeFirstLetter(path[2]);
        data.avatar = info.owner.avatar_url;
        data.owner = info.owner.login;
        data.remark = "Created At: " + info.created_at;
    } else if (path.length == 4) {
        // pull/issue
        let req_url = "";
        if (path[2] == "issues") {
            // issue detail
            req_url = `https://api.github.com/repos/${path[0]}/${path[1]}/issues/${path[3]}`;
        } else if (path[2] == "pull") {
            req_url = `https://api.github.com/repos/${path[0]}/${path[1]}/pulls/${path[3]}`
        } else {
            console.error("Link preview block with unsupported url: ", url);
        }
        if (!req_url) return false;
        const info = await axios.get(req_url).then((res) => res.data);
        data.title = info.title + "  " + capitalizeFirstLetter(info.state);
        data.avatar = info.user.avatar_url;
        data.owner = info.user.login;
        data.remark = "Created At: " + info.created_at;
    } else {
        console.error("Link preview block with unsupported url: ", url);
        return false;
    }
    return HTML_TEMPLATE.replace(/\{\{(.*?)\}\}/g, (match, key) => data[key]);
}

/**
 * to parse a pdf block
 * @param {*} block 
 * @returns 
 */

async function pdf(block) {
    const { pdf } = block || {};
    if (!pdf) {
        return false;
    }
    var caption = pdf.caption && pdf.caption.length > 0 ? pdf.caption[0].plain_text : "";
    var iframe = false;
    switch (pdf.type) {
        case "file":
            console.warn("PDF files are stored on Notion servers and may expire after a period of time, URL:", pdf.file.url);
            iframe = `<iframe src="${pdf.file.url}" style="width: 100%; margin:0; aspect-ratio: 16/9;"></iframe>`;
            break;
        case "external":
            iframe = `<iframe src="${pdf.external.url}" style="width: 100%; margin:0; aspect-ratio: 16/9;"></iframe>`;
            break;
        default:
            console.error("PDF block with unsupported type: ", block);
            return false;
    }
    if (!iframe) {
        return false;
    }
    const caption_div = caption ? CAPTION_DIV_TEMPLATE.replace("{{caption}}", caption) : "";
    return `<div class="pdf">${iframe}${caption_div}</div>`;
}

async function bookmark(block) {
    const { bookmark, author } = block;
    if (!bookmark?.url) return "";
    const caption = bookmark.caption && bookmark.caption.length ? bookmark.caption[0].plain_text : "";
    return await axios.get(bookmark.url).then((res) => {
        const $ = cheerio.load(res.data, {
            ignoreWhitespace: true,
            lowerCaseAttributeNames: true,
            lowerCaseTags: true,
        });
        // get title, description, cover, favicon from meta tags, key case is not considered
        const metaTags = $('head').find('meta');
        var metas = {};
        metaTags.each((i, e) => {
            var name = $(e).attr('name') || $(e).attr('property');
            if (name) metas[name.toLowerCase()] = $(e).attr('content');
        });
        const title = metas['og:title'] || metas['twitter:title'] || $('title').text();
        const description = metas['og:description'] || metas['twitter:description'] || metas['description'] || "";
        const cover = metas['og:image'] || metas['twitter:image'] || metas['image'] || "";
        var favicon = $('link[rel="shortcut icon"]').attr('href') || $('link[rel="icon"]').attr('href') || "";
        if (favicon.startsWith("//")) favicon = "https:" + favicon;
        if (favicon.startsWith("/")) favicon = "https://" + new URL(bookmark.url).hostname + favicon;
        return {
            title: title,
            description: description,
            cover: cover,
            favicon: favicon,
            url: bookmark.url,
        }
    }).then((p) => {
        var cover_div = p.cover ? `<div style="flex: 1 1 180px; display: block; position: relative;"><div style="position: absolute; inset: 0px;"><div style="width: 100%; height: 100%;"><img src="${p.cover}"referrerpolicy="same-origin"style="display: block; object-fit: cover; border-radius: 3px; width: 100%; height: 100%;"></div></div></div>` : "";
        var body_div = `<div style="display: flex; background:white;border-radius:5px"><a href="${p.url}"target="_blank"rel="noopener noreferrer"style="display: flex; color: inherit; text-decoration: none; user-select: none; transition: background 20ms ease-in 0s; cursor: pointer; flex-grow: 1; min-width: 0px; flex-wrap: wrap-reverse; align-items: stretch; text-align: left; overflow: hidden; border: 1px solid rgba(55, 53, 47, 0.16); border-radius: 5px; position: relative; fill: inherit;"><div style="flex: 4 1 180px; padding: 12px 14px 14px; overflow: hidden; text-align: left;"><div style="font-size: 14px; line-height: 20px; color: rgb(55, 53, 47); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-height: 24px; margin-bottom: 2px;">${p.title}</div><div style="font-size: 12px; line-height: 16px; color: rgba(55, 53, 47, 0.65); height: 32px; overflow: hidden;">${p.description}</div><div style="display: flex; margin-top: 6px;"><img src="${p.favicon}"style="width: 16px; height: 16px; min-width: 16px; margin-right: 6px;"><div style="font-size: 12px; line-height: 16px; color: rgb(55, 53, 47); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${p.url}</div></div></div>${cover_div}</a></div>`
        var caption_div = caption ? CAPTION_DIV_TEMPLATE.replace("{{caption}}", caption) : "";
        return `<div style="width: 100%; margin-top: 4px; margin-bottom: 4px;">${body_div}${caption_div}</div>`;
    })
        .catch((err) => {
            console.error('Bookmark preview fetch error: ', err);
            return false
        });
}

async function video(block) {
    const { video } = block;
    if (!video) return false;
    if (!video?.external?.url) {
        console.error("Video block without external url: ", block);
        return false;
    }
    const caption = video.caption && video.caption.length ? video.caption[0].plain_text : "";
    const url = video.external.url;
    // fetch the iframe url
    const domain = new URL(url).hostname;
    var vid = false;
    var video_url = "";
    try {
        switch (domain) {
            case "www.youtube.com":
                vid = new URL(url).searchParams.get("v") || false;
                video_url = `https://www.youtube.com/embed/${vid}`;
                break;
            case "www.bilibili.com":
                vid = new URL(url).pathname.split("/")[2] || false;
                video_url = `//player.bilibili.com/player.html?bvid=${vid}&page=1&autoplay=0`;
                break;
            case "v.qq.com":
                vid = new URL(url).pathname.split("/")[2] || false;
                video_url = `https://v.qq.com/txp/iframe/player.html?vid=${vid}`;
                break;
            default:
                console.error("Video block with unsupported domain: ", block);
                return false;
        }
    }
    catch (err) {
        console.error("Error parsing video block: ", block);
        return false;
    }
    if (!vid) {
        console.error("Video block without video id: ", block);
        return false;
    }
    const video_div = `<iframe src="${video_url}" scrolling="no" border="0" frameborder="no" framespacing="0" allowfullscreen="true" style="width: 100%; margin:0; aspect-ratio: 16/9;"> </iframe>`;
    var caption_div = caption ? CAPTION_DIV_TEMPLATE.replace("{{caption}}", caption) : "";
    return `<div style="width: 100%; margin-top: 4px; margin-bottom: 4px;">${video_div}${caption_div}</div>`
}

async function embed(block) {
    const { embed } = block;
    if (!embed) return false;
    if (!embed.url) {
        console.error("Embed block without url: ", block);
        return false;
    }
    const caption = embed.caption && embed.caption.length ? embed.caption[0].plain_text : "";
    const url = embed.url;
    var iframe = false;
    try {
        switch (new URL(url).hostname) {
            case "twitter.com":
                // get twitter username and status id from status url like: https://twitter.com/engineers_feed/status/1648224909628428288
                // query twitter embed code from twitter
                const data = await axios.get(`https://publish.twitter.com/oembed?url=${url}`).then((resp) => resp.data);
                iframe = data.html;
                break;
            case "www.google.com":
                // check if the url is embed
                if (!url.includes("embed")) {
                    console.error("Embed block with unsupported google url: ", url);
                    return false;
                }
                iframe = `<iframe src="${url}" style="width: 100%; margin:0; aspect-ratio: 16/9;" allowfullscreen="" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>`;
                break;
            default:
                console.error("Embed block with unsupported domain: ", block);
                iframe = `<iframe src="${url}" style="width: 100%; margin:0; aspect-ratio: 16/9;" allowfullscreen="" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>`
        }
    } catch (err) {
        console.error("Error parsing embed block: ", block, err);
        return false;
    }
    if (!iframe) {
        console.error("Embed block without iframe: ", block, err);
        return false;
    }
    var caption_div = caption ? CAPTION_DIV_TEMPLATE.replace("{{caption}}", caption) : "";
    return `<div style="width: 100%; margin: 0 0 2px;">${iframe}${caption_div}</div>`
}

module.exports = {
    t_bookmark: bookmark,
    t_video: video,
    t_embed: embed,
    t_link_preview: link_preview,
    t_pdf: pdf,
}