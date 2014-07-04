var logger = require('../../lib/logger');
var passport = require('../../lib/passport');
var dropboxPassport = require('passport-dropbox-oauth2');
var https = require('https');

var UserStorageAuth = require('../../models/user-storage-auth');
var User = require('../../models/user');

module.exports = function(app) {
  var authFilter = function(req, res, next) {
    if (req.path == '/storages/dropbox/auth') {
      req.session.storagesDropboxAuthRedirectURL = null;
    } else {
      req.session.storagesDropboxAuthRedirectURL = req.path;
    }

    if (typeof req.user == 'undefined') {
      logger.trace('screened request with Dropbox authFilter; no session user');
      res.redirect('/storages/dropbox/auth');
    } else {
      UserStorageAuth.findOne({
        user_id:    req.user.id,
        storage_id: "dropbox"
      }, function(error, userStorageAuth) {
        if (!userStorageAuth) {
          logger.trace('screened request with Dropbox authFilter; no user storage auth');
          res.redirect('/storages/dropbox/auth');
        } else {
          next();
        }
      });
    }
  };

  app.authFilter = authFilter;

  passport.use(new dropboxPassport.Strategy({
      clientID: process.env.ASHEVILLE_SYNC_STORAGES_DROPBOX_APP_KEY || logger.crit('App key not provided by environment for Dropbox config'),
      clientSecret: process.env.ASHEVILLE_SYNC_STORAGES_DROPBOX_APP_SECRET || logger.crit('App secret not provided by environment for Dropbox config'),
      callbackURL: app.host + '/storages/dropbox/auth-callback'
    },
    function(accessToken, refreshToken, profile, done) {
      logger.trace('authenticating Dropbox user', { dropbox_id: profile.id });

      UserStorageAuth.findOrCreate({
        storage_id:       "dropbox",
        storage_user_id:  profile.id
      }, 
        function(error, userStorageAuth) {
          if (error) {
            logger.warn('failed to find or create user storage auth from Dropbox auth data');
            return done(error);
          }

          logger.trace('saving token to user storage auth', { token: accessToken });
          userStorageAuth.storage_token = accessToken;

          userStorageAuth.save(function(error) {
            if (error) {
              logger.warn('failed to save Dropbox token to user storage auth', { id: userStorageAuth.id });
              return done(error);
            } else {
              logger.trace('saved Dropbox token to user storage auth', { id: userStorageAuth.id });
            }

            if (userStorageAuth.user_id) {
              User.findOne({ _id: userStorageAuth.user_id }, function(error, user) {
                if (error) {
                  logger.warn('failed to find user from user ID', { id: userStorageAuth.id, error: error });
                  return done(error);
                } else if (!user) {
                  logger.warn('failed to find user from user ID', { id: userStorageAuth.id });
                  return done(error);
                }

                return done(error, user);
              });
            } else {
              logger.trace('creating user with profile data', { profile: profile });

              var email;

              if (profile.emails.length) {
                email = profile.emails[0].value;
              }

              User.create({ 
                name: profile.displayName,
                email: email
              }, function(error, user) {
                if (error || !user) {
                  logger.warn('failed to create user');
                  return done(error);
                }

                userStorageAuth.user_id = user.id;

                userStorageAuth.save(function(error) {
                  return done(error, user);
                });
              });
            }
          });
        }
      );
    }
  ));

  app.get('/storages/dropbox/auth', function(req, res) {
    if (req.query.redirectURL) {
      req.session.storagesDropboxAuthRedirectURL = req.query.redirectURL;
      logger.trace('remember to redirect after Dropbox auth', { url: req.session.storagesDropboxAuthRedirectURL });
    }

    logger.trace('redirecting request to Dropbox auth');
    passport.authenticate('dropbox-oauth2')(req, res);
  }); 

  app.get('/storages/dropbox/auth-callback', function(req, res) {
    passport.authenticate('dropbox-oauth2', function(error, user, info) {
      if (error) {
        logger.warn('Dropbox auth failed', { error: error });
        res.redirect('/storages/dropbox/auth');
      } else {
        req.logIn(user, function(error) {
          if (error) { 
            logger.warn('Dropbox auth session establishment failed', { error: error });
            res.redirect('/storages/dropbox/auth');
          } else {
            if (req.session.storagesDropboxAuthRedirectURL) {
              logger.trace('redirect to remembered URL', { url: req.session.storagesDropboxAuthRedirectURL });
              var storagesDropboxAuthRedirectURL = req.session.storagesDropboxAuthRedirectURL;
              req.session.storagesDropboxAuthRedirectURL = null;
              res.redirect(storagesDropboxAuthRedirectURL);
            } else {
              res.redirect('/sessions');
            }
          }
        });
      }
    })(req, res);
  });

  app.get('/storages/dropbox/account/info', authFilter, function(req, res) {
    try {
      UserStorageAuth.findOne({
        storage_id: "dropbox",
        user_id:    req.user.id
      }, function(error, userStorageAuth) {
        logger.trace('checkpoint');

        if (error) {
          logger.warn('failed to retrieve user storage auth for user');
        }

        logger.trace('retrieved userStorageAuth', { userStorageAuth: userStorageAuth.toObject() });

        var options = {
          host: 'api.dropbox.com',
          path: '/1/account/info?access_token=' + userStorageAuth.storage_token
        };

        _res = res;

        https.get(options, function(res) {
          try {
            if (res.statusCode == 401) {
              throw new Error('unauthorized request');
            }

            var data = '';

            res.on('data', function(chunk) {
              data += chunk;
            });

            res.on('end', function() {
              _res.json({ response: JSON.parse(data) });
            });
          } catch (error) {
            logger.warn('failed to parse dropbox account info', {
              error: error
            });

            _res.json({ error: error.message });
          }
        }).on('error', function(error) {
          logger.warn('failed to retrieve dropbox account info', {
            error: error
          });

          res.json({ error: error.message });
        });
      });
    } catch (error) {
      logger.warn('failed to retrieve dropbox account info', {
        error: error
      });

      res.json({ error: error.message });
    }
  });
}