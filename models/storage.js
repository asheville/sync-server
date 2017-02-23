/**
 * Storage model
 * @module
 */

var modelFactory = require('../factories/model');
var templateCompiler = require('es6-template-strings');
var validateParams = require('../lib/validateParams');

/**
 * Represents storage of items from sources
 * @class Storage
 * @property {string} [clientId] - OAuth 2.0 client ID
 * @property {string} [clientSecret] - OAuth 2.0 client secret
 * @property {string} host - Host URL (e.g. "api-content.dropbox.com")
 * @property {string} name - Name (e.g. "Dropbox")
 * @property {string} [passportStrategy] - Strategy for Passport module (e.g. "passport-dropbox-oauth2")
 * @property {string} [itemPutUrlTemplate=https://{$host}{$path}?access_token={$accessToken}] - String template used to generate URLs for PUT requests for items to storage
 */
module.exports = modelFactory.new('Storage', {
  clientId: String,
  clientSecret: String,
  host: { type: String, required: true },
  name: { type: String, required: true },
  passportStrategy: String,
  itemPutUrlTemplate: {
    type: String,
    default: 'https://${host}${path}?access_token=${accessToken}'
  }
}, {
  jsonapi: {
    delete: 'admin',
    get: 'public',
    patch: 'admin',
    post: 'admin'
  }
}, {
  /**
   * Returns headers used to make requests to storage
   * @instance
   * @param {Object} path - Path at which to put item
   * @param {Object} userStorageAuth - UserStorageAuth used to make request
   * @returns {string} URL
   */
  headers: function(path, userStorageAuth) {
    return {
      'Authorization': 'Bearer ' + userStorageAuth.storageToken,
      'Content-Type': 'application/octet-stream',
      'Dropbox-API-Arg': JSON.stringify({
        autorename: true,
        mode: 'add',
        path: path
      })
    };
  },

  /**
   * Returns URL for making PUT request for item to storage
   * @instance
   * @param {Object} path - Path at which to put item
   * @param {Object} userStorageAuth - UserStorageAuth used to make request
   * @returns {string} URL
   */
  itemPutUrl: function(path, userStorageAuth) {
    validateParams([{
      name: 'path', variable: path, required: true, requiredType: 'string',
    }, {
      name: 'userStorageAuth', variable: userStorageAuth, required: true, requiredProperties: ['storageToken']
    }]);

    return templateCompiler(this.itemPutUrlTemplate, {
      host: this.host,
      path: path,
      accessToken: userStorageAuth.storageToken
    });
  }
});