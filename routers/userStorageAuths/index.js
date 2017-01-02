var UserStorageAuth = require('../../models/userStorageAuth');

module.exports = function(app) {
  app.get('/userStorageAuths', app.authFilter, function(req, res) {
    if (!req.user) {
      return res.json({
        user_storage_auths: []
      });
    }

    UserStorageAuth.find({
      userId: req.user.id
    }, function(error, UserStorageAuths) {
      if (error) {
        return res.json({
          error: error
        });
      }

      var json = { 
        user_storage_auths: UserStorageAuths.map(function(UserStorageAuth) {
          return UserStorageAuth.toObject();
        }) 
      };

      res.json(json);
    });
  });

  app.delete('/userStorageAuths/:id', app.authFilter, function(req, res) {
    var id = req.params.id;
    
    UserStorageAuth.findOne({
      _id: id
    }, function(error, userStorageAuth) {
      if (error) {
        logger.error('failed to find userStorageAuth object for deletion', { error: error });
      } else {
        if (userStorageAuth) {
          userStorageAuth.remove();
        }
      }

      res.status(204).json();
    });
  });
}