var _       = require('lodash');
var Promise = require('bluebird');

module.exports = function transaction(data, options) {
  var model = this;
  data = data || null;
  options = options || {};

  return new Promise(function(resolve, reject) {
    sails.db.transaction(function(t) {
      options.transacting = t;
      options.autoCommit = true;
      model.save(data, options).then(resolve, reject);
    }).catch(_.noop);
  });
};