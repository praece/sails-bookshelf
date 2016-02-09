## Sails Bookshelf

Integration for [bookshelfjs ORM](http://bookshelfjs.org/).

### Configuration:

`models/user.js`

```javascript
module.exports = sails.Model.extend({
  tableName: 'user',

  relationships: {
    emailAddresses: function() {
      return this.morphMany(EmailAddress, 'contact', ['contactType', 'contactId']);
    },
    primaryEmail: function() {
      return this.morphOne(EmailAddress, 'contact', ['contactType', 'contactId'])
        .query({where: {primary: 'true'}});
    },
    addresses: function() {
      return this.morphMany(Address, 'contact', ['contactType', 'contactId']);
    },
    phoneNumbers: function() {
      return this.morphMany(PhoneNumber, 'contact', ['contactType', 'contactId']);
    },
    createdBy: function() {
      return this.belongsTo(User, 'createdBy');
    }
  }
}, {
  // Attach to lifecycle events
  initialize: function(model) {
    model.on('creating', function(model, attrs, options) {
      /* Some custom function to run on create. */
    });
  }

  // The attributes (schema) for the model, needed for filtering parameters
  attributes: {
    firstName: {
      type: 'text',
      // Required validation
      validation: {required: true}
    },
    lastName: {
      type: 'text',
      validation: {required: true}
    },
    status: {
      type: 'text',
      // Default value
      defaultsTo: 'Active',
      validation: {
        required: true, 
        // In validaiton
        in: sails.config.constants.STATUSES
      }
    },
    emailAddresses: {
      validation: {
        // Custom validation
        custom: function(attributes, method, field) {
          if (/* Do some custom logic! */) return 'Oops, this has failed!';
        }
      }
    }
  },

  // Default where filters
  defaultWhere: {
    status: 'Active'
  }
});
```