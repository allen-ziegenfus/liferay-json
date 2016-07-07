
// do we need this function?
/**
 * call api with liferay, wrapper function around invoke_liferay
 * @param {{server: string, base64auth: string}} config - config object with server name and base 64 authentication . 
 * @param {string} api - name of api to call
 * @param {} payload - api payload 
 * @param {function} callback - callback when post completes.
 */
function invoke_liferay_api(config, api, payload, callback) {
    var cmdArray = [];
    var myCmd = {};
    myCmd[api] = payload;
    cmdArray.push(
        myCmd
    );
    invoke_liferay(config, cmdArray, callback);
}

// when do we need to post without invoke?
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
