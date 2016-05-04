var _ = require('lodash');

module.exports = function graph(data, options) {
  return this.save(data, _.assign({ graph: true }, options));
};