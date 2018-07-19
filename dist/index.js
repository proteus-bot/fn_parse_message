'use strict';

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var Datastore = require('@google-cloud/datastore');
var PubSub = require('@google-cloud/pubsub');

var runtimeConfig = require('cloud-functions-runtime-config');

var projectId = process.env.GCLOUD_PROJECT;

var lazyPubsub = void 0;
var lazyTopicOnParseMessage = void 0;

var datastore = new Datastore({
  projectId: projectId
});

var publishMatches = function publishMatches(topicOnParseMessage, dataBuffer, discordMessageId) {
  return new Promise(function (resolve, reject) {
    lazyPubsub = lazyPubsub || new PubSub();

    lazyPubsub.topic(topicOnParseMessage).publisher().publish(dataBuffer).then(function (messageId) {
      console.log('Message ' + messageId + ' published for Discord ID ' + discordMessageId + '.');
      resolve();
    }).catch(function (err) {
      console.error(err);
      reject();
    });
  });
};

/**
 * Process incoming Discord messages.
 *
 * @param {!Object} event The Cloud Functions event.
 * @param {!Function} The callback function.
 */
exports.fn_parse_message = function (event, callback) {
  var pubsubMessage = event.data;

  var jsonString = Buffer.from(pubsubMessage.data, 'base64').toString();
  var message = JSON.parse(jsonString);
  var messageContent = message.content;

  console.log('Parsing message: ' + jsonString);

  var query = datastore.createQuery('Trigger');

  query.run().then(function (data) {
    var triggers = data[0];
    var matchesBucket = new Array(messageContent.length);
    var matches = [];

    triggers.forEach(function (trigger) {
      var re = new RegExp(trigger.expression, "gi");

      var match = void 0;
      while ((match = re.exec(messageContent)) != null) {
        var oldValue = matchesBucket[match.index];

        var triggerPackage = trigger[datastore.KEY].parent.id;
        var triggerAsJson = JSON.stringify(_extends({}, trigger, { package: triggerPackage }));

        if (oldValue === undefined) {
          matchesBucket[match.index] = triggerAsJson;
        } else if (oldValue instanceof Array) {
          matchesBucket[match.index].push(triggerAsJson);
        } else {
          matchesBucket[match.index] = [oldValue, triggerAsJson];
        }
      }
    });

    var _loop = function _loop(index) {
      if (matchesBucket[index] !== undefined) {
        if (matchesBucket[index] instanceof Array) {
          matchesBucket[index].forEach(function (trigger) {
            matches.push({
              trigger: trigger,
              index: index
            });
          });
        } else {
          matches.push({
            trigger: matchesBucket[index],
            index: index
          });
        }
      }
    };

    for (var index = 0; index < matchesBucket.length; index++) {
      _loop(index);
    }

    if (matches.length > 0) {
      var _data = JSON.stringify({
        discordMessageId: message.id,
        matches: matches
      });

      console.log('Trigger matches found: ' + _data);

      var dataBuffer = Buffer.from(_data);

      if (lazyTopicOnParseMessage === undefined) {
        runtimeConfig.getVariable('config', 'PROTEUS_TOPIC_ON_PARSE_MESSAGE').then(function (topicName) {
          lazyTopicOnParseMessage = topicName;

          publishMatches(lazyTopicOnParseMessage, dataBuffer, message.id).then(callback()).catch(function (err) {
            console.error(err);
            callback();
          });
        }).catch(function (err) {
          console.error(err);
          callback();
        });
      } else {
        publishMatches(lazyTopicOnParseMessage, dataBuffer, message.id).then(callback()).catch(function (err) {
          console.error(err);
          callback();
        });
      }
    } else {
      callback();
    }
  }).catch(function (err) {
    console.error('Query failed: ' + err);
    callback();
  });
};