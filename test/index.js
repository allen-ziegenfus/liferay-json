var should = require('chai').should(),
    chai = require("chai"),
    liferay = require('../index'),
    invoke = liferay.invoke_liferay;

var fs = require('fs');

var config = JSON.parse(fs.readFileSync('./config.json'));
var articleConfig = JSON.parse(fs.readFileSync("./article-lookup-config.json"));
var article = articleConfig[0];
describe('invoke_liferay', function () {
    it('should be able to get build version', function (done) {
        invoke(config, { "/portal/get-build-number": {} }, function (body) {
            body.should.equal(config.buildversion);
            done();
        });
    });

    it("should be able to retrieve article metadata", function (done) {
        liferay.getArticle(config, article, function (article) {
            //console.log(article);
            article.articleId.should.equal(article.articleId);
            done();
        });
    });

    it("should be able to retrieve article content without a structure", function (done) {
        fs.access(article.filename, fs.F_OK, (err) => {
            if (!err) {
                console.log("deleting existing test file ", article.filename);
                fs.unlinkSync(article.filename);
            }
        });
        liferay.viewArticleContent(config, article, "en_US", function () {
            fs.access(article.filename, fs.F_OK, (err) => {
                chai.assert.isNotOk(err);
                done();
            });
        });
    });


     it("should be able to retrieve article content that has a structure", function (done) {
        var articleConfig = JSON.parse(fs.readFileSync("./dynamic-article-lookup-config.json"));
        var article = articleConfig[0]
        fs.access(article.filename, fs.F_OK, (err) => {
            if (!err) {
                console.log("deleting existing test file ", article.filename);
                fs.unlinkSync(article.filename);
            }
        });
        liferay.viewArticleContent(config, article, "en_US", function () {
            fs.access(article.filename, fs.F_OK, (err) => {
                chai.assert.isNotOk(err);
                done();
            });
        });
    });

    // test unsecured web services
});
