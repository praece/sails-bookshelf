/**
 * Find One Record
 *
 * get /:modelIdentity/:id
 *
 * An API call to find and return a single model instance from the data adapter
 * using the specified id.
 *
 * Required:
 * @param {Integer|String} id  - the unique id of the particular instance you'd like to look up *
 *
 * Optional:
 * @param {String} callback - default jsonp callback param (i.e. the name of the js function returned)
 */

module.exports = function findOneRecord (req, res) {
  // Load the model
  var Model = sails.models[req.options.model];

  // Fetch the record
  Model.forge({id: req.param('id')})
    .fetch()
    .then(function(record) {
      return record.load(_.keys(record.relationships));
    })
    .then(function(record) {
      if (!record) return res.notFound('No record found with the specified `id`.');
      return res.ok(record.toJSON());
    })
    .catch(function(err) {
      sails.log.error(err);
      return res.serverError(err);
    });
};
