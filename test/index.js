var should = require('chai').should(),
    liferay = require('../index'),
    invoke = liferay.invoke_liferay;

var fs = require('fs');

var config = JSON.parse(fs.readFileSync('./config.json'));

describe('invoke_liferay', function() {
  it('should be able to get build version', function(done) {
    invoke(config, {"/portal/get-build-number": {}}, function (body) {
            body.should.equal(config.buildversion);
            done();
    });
  });
});
