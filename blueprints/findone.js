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
  var params = req.params.all();
  var model = Model.forge({id: params.id});

  // Fetch the record
  model.fetch({ require: true, currentUser: req.user })
    .call('load', params.load || [])
    .call('toJSON')
    .then(res.ok)
    .catch(Model.NotFoundError, function(err) {
      return res.notFound('No record found.');
    })
    .catch(function(err) {
      sails.log.error(err);
      return res.serverError(err);
    });
};
