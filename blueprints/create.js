/**
 * Create Record
 *
 * post /:modelIdentity
 *
 * An API call to find and return a single model instance from the data adapter
 * using the specified criteria.  If an id was specified, just the instance with
 * that unique id will be returned.
 *
 * Optional:
 * @param {String} callback - default jsonp callback param (i.e. the name of the js function returned)
 * @param {*} * - other params will be used as `values` in the create
 */
module.exports = function createRecord (req, res) {
  // Load the model
  var Model = sails.models[req.options.model];
  var values = _.defaults(req.params.all() || {}, req.options.values);

  // Create and save the new instance
  sails.db.transaction(function(t) {
    return Model.forge(values)
      .save(null, {transacting: t})
      .then(function(created) {
        res.created(created.toJSON());
      })
      .catch(function(err) {
        sails.log.error(err);
        res.serverError(err);
      });
  })
  .catch(function(err) {
    sails.log.error(err);
  });
};