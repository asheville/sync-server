var logger = require('../lib/logger');
var User = require('../models/user');
var UserStorageAuth = require('../models/userStorageAuth');
var UserSourceAuth = require('../models/userSourceAuth');

module.exports = function(app) {
  app.adminAuthFilter = function(req, res, next) {
    User.findOne({
      _id: req.user.id
    }, function(error, user) {
      if (!user) {
        logger.trace('screened request with adminAuthFilter; user in session invalid');
        res.redirect('/storages/dropbox/auth');
      } else if (!user.admin) {
        res.status(403).send('403 Forbidden');
      } else {
        next();
      }
    });
  };

  app.get('/sessions', function(req, res) {
    var respond = function(user, userStorageAuths, userSourceAuths) {
      var users = [];
      
      var userStorageAuthObjects = [];
      var userStorageAuthIds = [];

      var userSourceAuthObjects = [];
      var userSourceAuthIds = [];

      if (user) {
        var userJSON = user.toObject();

        if (userStorageAuths) {
          userStorageAuths.forEach(function(userStorageAuth) {
            userStorageAuthObjects.push(userStorageAuth.toObject());
            userStorageAuthIds.push(userStorageAuth.id);
          });

          userJSON.userStorageAuths = userStorageAuthIds;
        }

        if (userSourceAuths) {
          userSourceAuths.forEach(function(userSourceAuth) {
            userSourceAuthObjects.push(userSourceAuth.toObject());
            userSourceAuthIds.push(userSourceAuth.id);
          });

          userJSON.userSourceAuths = userSourceAuthIds;
        }

        users.push(userJSON);
      }

      res.json({
        sessions: [{
          id: req.session.id,
          users: users.map(function(user) {
            return user.id;
          })
        }],
        users: users,
        userStorageAuths: userStorageAuthObjects,
        userSourceAuths: userSourceAuthObjects
      });
    };

    if (req.user) {
      logger.trace('found user by ID');

      UserStorageAuth.find({
        userId: req.user.id
      }, function(error, userStorageAuths) {
        UserSourceAuth.find({
          userId: req.user.id
        }, function(error, userSourceAuths) {
          respond(req.user, userStorageAuths, userSourceAuths);
        });
      });
    } else {
      logger.trace('no user stored in session');
      respond();
    }
  });

  app.delete('/sessions/:id', function(req, res) {
    if (req.params.id == req.session.id) {
      req.logout();
    }

    res.status(204).json(null);
  });
}