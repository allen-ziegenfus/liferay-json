var fs = require('fs');
var request = require("request");
var winston = require("winston");
var xml2js = require("xml2js");

var logdir = "logs";

fs.access(logdir, fs.F_OK, (err) => {
    if (err) {
        fs.mkdirSync(logdir);
    }
});

function formatDate(d) {
    if (typeof d === 'number') d = new Date(d);
    if (!(d instanceof Date)) return d;

    function pad(n) { return n < 10 ? '0' + n : n; }
    return ("[" + pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds()) + "]");
}

var logger = new winston.Logger({
    level: 'debug',
    transports: [
        new(winston.transports.Console)({
            level: "info",
            timestamp: function() {
                return formatDate(Date.now());
            },

            formatter: function(options) {
                // Return string will be passed to logger.
                return options.timestamp() + ' ' + options.level.toUpperCase() + ' ' + (undefined !== options.message ? options.message : '') +
                    (options.meta && Object.keys(options.meta).length ? ' ' + JSON.stringify(options.meta) : '');
            }
        }),
        new(winston.transports.File)({
            name: 'debug-file',
            filename: 'logs/debug.log',
            level: 'debug',
            json: false
        }),
        new(winston.transports.File)({
            name: 'silly-file',
            filename: 'logs/trace.log',
            level: 'silly',
            json: false
        })
    ]
});

/**
 * parse Web Content Article content and write to file(s), depending on what locales are available
 * @param {string} content - web content 
 * @param {string} filename - base filename 
 */
function parseWebContentArticleContent(content, filename) {
    xml2js.parseString(content, function(err, xmljsresult) {
        logger.debug(xmljsresult);

        var errorWritingFile = function(err) {
            if (err) logger.error("error writing file", err);
        }
        if (xmljsresult.root && xmljsresult.root["static-content"]) {
            var contentarray = xmljsresult.root["static-content"];
            for (var i = 0; i < contentarray.length; i++) {
                var contentobj = contentarray[i];
                logger.debug("my content: " + contentobj._);
                logger.debug("my attrs", contentobj.$);

                fs.writeFile(contentobj.$["language-id"] + "_" + filename,
                    contentobj._, errorWritingFile);
            }
        } else if (xmljsresult.root && xmljsresult.root["dynamic-element"]) {
            throw "Cannot handle dynamic elements";
            /*//handleDynamicElement(xmljsresult.root, 1);
            var lego = {};
            handleDynamicElementLegoObject(lego, xmljsresult.root, 1);
            //logger.info(lego);
            var string = JSON.stringify(lego, null, '\t');
            console.log(string);
            var html = legotohtml(lego);
            console.log("html: " + html);
            */
        }
    });
}
/**
 * parse Web Content Article content and write to file(s), depending on what locales are available
 * @param {string} content - web content 
 * @param {string} filename - base filename 
 * @param {string} locale - language 
 * @param {function} callback
 */
function parseWebContentArticleLanguageContent(content, filename, locale, callback) {
    xml2js.parseString(content, function(err, xmljsresult) {
        logger.debug(xmljsresult);

        if (xmljsresult.root && xmljsresult.root["static-content"]) {
            var contentarray = xmljsresult.root["static-content"];
            for (var i = 0; i < contentarray.length; i++) {
                var contentobj = contentarray[i];
                logger.debug("my content: " + contentobj._);
                logger.debug("my attrs", contentobj.$);
                if (contentobj.$["language-id"] === locale) {

                    fs.writeFile(filename, contentobj._, callback);

                    return;
                }
            }
        }
        throw "Could not find locale: " + locale;
    });
}

function getInvokeEndpoint(config) {
    if (config && config.buildversion && config.buildversion < 6200) {
        return (config.server.indexOf("https") === 0) ? "/api/secure/jsonws/invoke" : "/api/jsonws/invoke";
    }
    return "/api/jsonws/invoke";
}

module.exports = {
    /**
     * invoke_liferay with post request
     * @param {{server: string, base64auth: string}} config - config object with server name and base 64 authentication . 
     * @param {string} body - post body 
     * @param {function} callback - callback when post completes.
     */
    invoke_liferay: function(config, body, callback) {

        var invoke_path = getInvokeEndpoint(config);
        var postrequest = {
            json: true,
            url: config.server + invoke_path,
            body: body
        };

        if (config.base64auth) {
            postrequest.headers = { "Authorization": "Basic " + config.base64auth };
        }
        logger.debug(invoke_path);
        logger.debug("POST Request: ", postrequest);

        request.post(postrequest, function(err, httpResponse, body) {

            logger.silly("httpResponse: ", httpResponse);
            logger.debug("body: " + body);

            if (err) {
                logger.error(err);
                throw err;
            } else if (httpResponse && httpResponse.statusCode && (httpResponse.statusCode != 200)) {
                logger.error("An error seems to have occurred. Response Code " + httpResponse.statusCode, body);
                var errorobj = {
                    statusCode: httpResponse.statusCode,
                    body: body
                };
                throw errorobj;
            } else {
                if (body && body.exception) {
                    logger.error("An exception occurred: " + body.exception);
                    throw body.exception;
                } else { callback(body) }
            }
        });
    },

    /**
     * get web content article 
     * @param {{server: string, base64auth: string}} config - config object with server name and base 64 authentication . 
     * @param {{groupId: number, articleId: number}} article config 
     * @param {function} callback - callback when post completes.
     */
    getArticle: function(config, article, cb) {
        var cmd = {
            "/journalarticle/get-article": {
                "groupId": article.groupId,
                "articleId": article.articleId
            }
        };

        this.invoke_liferay(config, cmd,
            function(jsonresponse) {
                logger.debug("getArticle body found: " + jsonresponse.content);
                cb(jsonresponse);
            });
    },
    /**
     * get web content article content and save to given filename
     * @param {{server: string, base64auth: string}} config - config object with server name and base 64 authentication . 
     * @param {{groupId: number, articleId: number, filename: string}} article config 
     * @param {string} language id
     * @param {function} callback - callback when post completes.
     */
    viewArticleContent: function(config, article, languageid, cb) {
        logger.debug("viewArticleContent called for ", article);
        this.getArticle(config, article, function(jsonresponse) {

            // if there is no templateId then we just have regular web content, we can get the content
            // from the article info
            logger.debug("viewArticleContent found article content: " + jsonresponse);
            if (!jsonresponse.templateId) {
                logger.debug("Parsing static web content");
                logger.info("Writing article (static content) file: ", article);
                parseWebContentArticleLanguageContent(jsonresponse.content, article.filename, languageid, cb);
            }
            // otherwise we need to render the template. we do this by calling up the preview url
            // as otherwise it does not seem possible to get this through json-ws (themedisplay required)
            else {
                //  https://web.liferay.com/de/c/journal/view_article_content?cmd=preview&groupId=67510365&articleId=74591624&version=1.2&languageId=de_DE&type=general&structureId=73728595&templateId=73728597
                //  https://web.liferay.com/de/c/journal/view_article_content?cmd=preview&groupId=67510365&articleId=74591624&version=1.2&languageId=de_DE&type=general&structureId=73728595&templateId=73728597
                //  https://web.liferay.com/de/c/journal/view_article_content?cmd=preview&groupId=67510365&articleId=74591624&version=1.2&languageId=en_US&type=general&structureId=73728595&templateId=73728597
                var getrequest = {
                    url: config.server + "/c/journal/view_article_content",
                    qs: {
                        //cmd: "preview",
                        groupId: article.groupId,
                        articleId: article.articleId,
                        version: jsonresponse.version,
                        languageId: languageid,
                        type: "general",
                        structureId: jsonresponse.structureId,
                        templateId: jsonresponse.templateId
                    },
                    headers: { "Authorization": "Basic " + config.base64auth }
                };
                logger.debug("viewArticleContent request: ", getrequest);
                request.get(getrequest, function(err, httpResponse, body) {
                    //  logger.silly("httpResponse: ", httpResponse);
                    //  logger.debug("body: " + body);

                    if (err) {
                        //    logger.error(err);
                    } else if (httpResponse && httpResponse.statusCode && (httpResponse.statusCode != 200)) {
                        logger.error("An error seems to have occurred. Response Code " + httpResponse.statusCode);
                        var errorobj = {
                            statusCode: httpResponse.statusCode,
                            body: body
                        };
                        throw errorobj;
                    } else {
                        var startBody = body.indexOf("<body>");
                        var endBody = body.indexOf("</body>");

                        var creamynougatcenter = body.substr(startBody + 6, endBody - startBody - 6);
                        logger.debug(creamynougatcenter);
                        logger.info("Writing article file: ", article);
                        fs.writeFile(article.filename, creamynougatcenter);
                    }
                    cb();
                });
            }
        });
    },
    /**
     * update static web content article content from filename
     * @param {{server: string, base64auth: string}} config - config object with server name and base 64 authentication . 
     * @param {{groupId: number, articleId: number, locales: [{locale: string, filename: string}], defaultLocale: string}} article config 
     */
    updateStaticArticleContent: function(config, article) {
        // need to get version info first...
        logger.info("Updating article: ", article);
        var staticContent = [];
        var allLocales = [];
        article.locales.forEach(function(locale) {
            allLocales.push(locale.locale);
            var articleFile = fs.readFileSync(locale.filename).toString();
            staticContent.push({
                _: articleFile,
                $: {
                    "language-id": locale.locale
                }
            });
        });
        var availableLocales = allLocales.join(",");
        // make function for composing file names
        var obj = {
            root: {
                $: {
                    "available-locales": availableLocales,
                    "default-locale": article.defaultLocale
                },
                "static-content": staticContent
            }
        };

        var xml2js = require("xml2js");
        var builder = new xml2js.Builder({ cdata: true, xmldec: { version: "1.0" } });
        var xml = builder.buildObject(obj);
        logger.silly(xml);

        // nest call to get latest version #
        var cmd = {
            "$article = /journalarticle/get-article": {
                "groupId": article.groupId,
                "articleId": article.articleId,
                "$update = /journalarticle/update-article": {
                    "@version": "$article.version",
                    "groupId": article.groupId,
                    "articleId": article.articleId,
                    "content": xml,
                    "serviceContext.scopeGroupId": article.groupId
                }
            }
        };
        this.invoke_liferay(config, cmd,
            function(jsonresponse) {
                logger.debug("body: " + jsonresponse.content);
            });
    },
};