var _ = require('lodash');

function count(column, options) {
  const count = sails.db.coreCollection.prototype.count;
  const query = this.query().clone().as('q');

  this.resetQuery().query().from(query);

  return count.call(this, column, options);
}

module.exports = count;
