var _ = require('lodash');

module.exports = {buildQuery, applyQuery};

function buildQuery(params) {
  params = params || {};
  params.where = _.defaults(params.where || {}, this.defaultWhere);

  return this.query(function(qb) {
    applyQuery(qb, params);
  });
}

function applyQuery(qb, params) {
  buildWhere(qb, params.where, []);
  if (params.sort) buildSort(qb, params.sort);
  if (params.limit) qb.limit(params.limit);
  if (params.offset) qb.offset(params.offset);
}

function buildWhere(qb, where, modifiers, field) {
  _.forEach(where, function(criteria, operator) {
    var mods = modifiers.slice();

    // If this is an "or" or "and" clause create a nested where
    if (operator === 'or' || operator === 'and') return qb.where(function() {buildWhere(this, criteria, operator === 'or' ? ['or'] : []);});
    
    // Negative clauses
    if (operator === 'not' || operator === '!') {
      mods = mods.concat('not');
      operator = false;
    }
      
    // Specific nested custom operator
    if (_.isPlainObject(criteria)) return buildWhere(qb, criteria, mods, field || operator);

    // Apply the filter
    applyWhere(qb, mods, field || operator, criteria, field && operator);
  });
}

function applyWhere(qb, modifiers, field, value, operator) {
  var method = 'where';

  // Or and not modifiers
  _.forEach(modifiers, function(mod) {
    if (mod === 'or') method = 'or-' + method;
    if (mod === 'not') method = method + '-not';
  });

  // In operator
  if (operator === 'in' || _.isArray(value)) {
    method = method + '-in';
    operator = false;
  }

  // Null checking
  if ((value === '' || value === null) && (!operator || operator === 'is')) {
    method = method + '-null';
    operator = false;
  }

  // Special cases for contains, starts with, ends with
  if (_.includes(['contains', 'startsWith', 'endsWith'], operator)) {
    if (operator === 'contains') value = '%' + value + '%';
    if (operator === 'startsWith') value = value + '%';
    if (operator === 'endsWith') value = ' %' + value;
    operator = 'ilike';
  }

  // Camel case the method name and bind it to the query builder
  method = qb[_.camelCase(method)].bind(qb);

  // If there is no operator let where guess it based on the field or value
  if (!operator) return method(field, value);

  return method(field, operator, value);
}

function buildSort(qb, sort) {
  // Check if we have an array or just a single sort param
  if (_.isArray(sort)) {
    _.forEach(sort, function(sort) {
      applySort(qb, sort);
    });
  } else {
    applySort(qb, sort);
  }
}

function applySort(qb, sort) {
  // Parse sort strings that include direction
  var sort = sort.split(' ');
  qb.orderBy.bind(qb)(sort[0], sort[1])
}