/**
 * Count Records
 *
 *  get   /:modelIdentity
 *   *    /:modelIdentity/find
 *
 * An API call to find and return model instances from the data adapter
 * using the specified criteria.  If an id was specified, just the instance
 * with that unique id will be returned.
 *
 * Optional:
 * @param {Object} where       - the find criteria (passed directly to the ORM)
 * @param {Integer} limit      - the maximum number of records to send back (useful for pagination)
 * @param {Integer} skip       - the number of records to skip (useful for pagination)
 * @param {String} sort        - the order of returned records, e.g. `name ASC` or `age DESC`
 * @param {String} callback - default jsonp callback param (i.e. the name of the js function returned)
 */

module.exports = function countRecords (req, res) {
  // Load the model
  var Model = sails.models[req.options.model];

  // Build the query and fetch the results
  Model.buildQuery(req.params.all())
    .count()
    .then(function(count) {
      return res.ok({count: count});
    })
    .catch(function(err) {
      sails.log.error(err);
      return res.serverError(err);
    });
};
