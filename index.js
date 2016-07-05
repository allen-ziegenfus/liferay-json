//TODO: secure password storage
// clean up base64auth files
// TODO: read http://blog.modulus.io/node.js-tutorial-how-to-use-request-module


var fs = require('fs');
var request = require("request");
var winston = require("winston");

var logdir = "logs";

fs.access(logdir, fs.F_OK, (err) => {
    if (err) {
         fs.mkdirSync(logdir);
    } 
});

function  formatDate  (d) {
                if (typeof d === 'number') d = new Date(d);
                if (!(d instanceof Date)) return d;
                function pad(n) { return n < 10 ? '0' + n : n; }
                return ("[" + pad(d.getHours()) + ":"+ pad(d.getMinutes()) + ":"+ pad(d.getSeconds()) + "]");
            }
var logger = new winston.Logger({
    level: 'debug',
    transports: [
        new (winston.transports.Console)({
            level: "info",
            timestamp: function () {
                return formatDate(Date.now());
            },
           
            formatter: function (options) {
                // Return string will be passed to logger.
            return options.timestamp() +' '+ options.level.toUpperCase() +' '+ (undefined !== options.message ? options.message : '') +
          (options.meta && Object.keys(options.meta).length ? ' '+ JSON.stringify(options.meta) : '' );
           }
        }),
        new (winston.transports.File)({
            name: 'debug-file',
            filename: 'logs/debug.log',
            level: 'debug'
        }),
        new (winston.transports.File)({
            name: 'silly-file',
            filename: 'logs/trace.log',
            level: 'silly'
        })
    ]
});

function invoke_liferay_api(config, api, payload, callback) {
    var cmdArray = [];
    var myCmd = {};
    myCmd[api] = payload;
    cmdArray.push(
        myCmd
    );
    invoke_liferay(config, cmdArray, callback);
}

/**
 * invoke_liferay with post request
 * @param {{server: string, base64auth: string}} config - config object with server name and base 64 authentication . 
 * @param {string} body - post body 
 * @param {function} callback - callback when post completes.
 */
function invoke_liferay(config, body, callback) {

    var invoke_path = (config.server.indexOf("https") === 0)? "/api/secure/jsonws/invoke" :  "/api/jsonws/invoke";
    var postrequest = {
        json: true,
        url: config.server + invoke_path,
        body: body,
        headers: { "Authorization": "Basic " + config.base64auth }
    };
    logger.debug(invoke_path);
    logger.debug("POST Request: ", postrequest);

    request.post(postrequest, function (err, httpResponse, body) {

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
        }
        else {
            if (body && body.exception) {
                logger.error("An exception occurred: " + body.exception);
                throw body.exception;
            } else { callback(body) }
        }
    });
}
function post_liferay(config, api, payload, callback) {
    var postrequest = {
        url: config.server + "/api/secure/jsonws" + api,
        form: payload,
        headers: { "Authorization": "Basic " + config.base64auth }
    };
    logger.info(postrequest);

    request.post(postrequest, function (err, httpResponse, body) {
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
        }
        else {

            var response = JSON.parse(body);
            if (response && response.exception) {
                logger.error("An exception occurred: " + response.exception);
                throw response.exception;
            } else { callback(body) }


        }
    });
}
function getArticle(config, article, cb) {
    var cmd = {
        "/journalarticle/get-article": {
            "groupId": article.groupId,
            "articleId": article.articleId
        }
    };

    invoke_liferay(config, cmd,
        function (jsonresponse) {
            logger.debug("body: " + jsonresponse.content);
            cb(jsonresponse);
        });
}




module.exports = {
    viewArticleContent: function (config, article, languageid) {
        getArticle(config, article, function (jsonresponse) {
            //  https://web.liferay.com/de/c/journal/view_article_content?cmd=preview&groupId=67510365&articleId=74591624&version=1.2&languageId=de_DE&type=general&structureId=73728595&templateId=73728597
            //  https://web.liferay.com/de/c/journal/view_article_content?cmd=preview&groupId=67510365&articleId=74591624&version=1.2&languageId=de_DE&type=general&structureId=73728595&templateId=73728597
            //  https://web.liferay.com/de/c/journal/view_article_content?cmd=preview&groupId=67510365&articleId=74591624&version=1.2&languageId=en_US&type=general&structureId=73728595&templateId=73728597
            var getrequest = {
                url: config.server + "/de/c/journal/view_article_content",
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
            logger.debug(getrequest);
            request.get(getrequest, function (err, httpResponse, body) {
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
                }
                else {

                    var startBody = body.indexOf("<body>");
                    var endBody = body.indexOf("</body>");

                    var creamynougatcenter = body.substr(startBody + 6, endBody - startBody - 6);
                    logger.debug(creamynougatcenter);
                    logger.info("Writing article file: ", article);
                    fs.writeFile(article.filename, creamynougatcenter);

                }
            });
        });
    },
    getDisplayArticleByTitle: function (config, article) {

        var cmd = {
            "/journalarticle/get-display-article-by-url-title": {
                "groupId": article.groupId,
                "urlTitle": article.urlTitle,
            }
        };
        invoke_liferay(config, cmd,
            function (jsonresponse) {
                logger.info("body: " + jsonresponse.content);
            });
    },
    getArticle: getArticle,

    getArticleContent: function (config, article, locale) {
        var cmd = {
            "/journalarticle/get-article-content": {
                "groupId": article.groupId,
                "articleId": article.articleId,
                "languageId": locale,
                "themeDisplay": {
                    class: "com.liferay.portal.theme.ThemeDisplay",
                    _companyId: 1,
                    _companyGroupId: 8431626,
                    _scopeGroupeId: article.groupId,
                    _siteGroupId: article.groupId

                }
            }
        };
        invoke_liferay(config, cmd,
            function (jsonresponse) {
                logger.info("body: " + jsonresponse.content);
            });
    },
    updateStaticArticleContent: function (config, article) {

        // need to get version info first...
        logger.info("Updating article: ", article);
        var staticContent = [];
        var allLocales = [];
        article.locales.forEach(function (locale) {
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
                    "available-locales": availableLocales, "default-locale": article.defaultLocale
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
        invoke_liferay(config, cmd,
            function (jsonresponse) {
                logger.debug("body: " + jsonresponse.content);
            });
    },
};

module.exports.invoke_liferay = invoke_liferay;
