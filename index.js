const Datastore = require('@google-cloud/datastore');
const PubSub = require('@google-cloud/pubsub');

const runtimeConfig = require('cloud-functions-runtime-config');

const projectId = process.env.GCLOUD_PROJECT;

let lazyPubsub;
let lazyTopicOnParseMessage;

const datastore = new Datastore({
  projectId
});

const publishMatches = (topicOnParseMessage, dataBuffer, discordMessageId) => {
  return new Promise((resolve, reject) => {
    lazyPubsub = lazyPubsub || new PubSub();

    lazyPubsub
    .topic(topicOnParseMessage)
    .publisher()
    .publish(dataBuffer)
    .then(messageId => {
      console.log(`Message ${messageId} published for Discord ID ${discordMessageId}.`);
      resolve();
    })
    .catch(err => {
      console.error(err);
      reject();
    })
  });
};

/**
 * Process incoming Discord messages.
 *
 * @param {!Object} event The Cloud Functions event.
 * @param {!Function} The callback function.
 */
exports.fn_parse_message = (event, callback) => {
    const pubsubMessage = event.data;
  
    const jsonString = Buffer.from(pubsubMessage.data, 'base64').toString();
    const message = JSON.parse(jsonString);
    const messageContent = message.content;
  
    console.log(`Parsing message: ${jsonString}`);

    const query = datastore.createQuery('Trigger');

    query.run().then(data => {
      const triggers = data[0];
      const matchesBucket = new Array(messageContent.length);
      const matches = [];

      triggers.forEach(trigger => {
        const re = new RegExp(trigger.expression, "gi");
        
        let match;
        while ((match = re.exec(messageContent)) != null) {
          const oldValue = matchesBucket[match.index];
          const triggerAsJson = JSON.stringify(trigger);

          if (oldValue === undefined) {
            matchesBucket[match.index] = triggerAsJson;
          } else if (oldValue instanceof Array) {
            matchesBucket[match.index].push(triggerAsJson);
          } else {
            matchesBucket[match.index] = [oldValue, triggerAsJson];
          }
        }
      });

      for (let index = 0; index < matchesBucket.length; index++) {
        if (matchesBucket[index] !== undefined) {
          if (matchesBucket[index] instanceof Array) {
            matchesBucket[index].forEach(trigger => {
              matches.push({
                trigger,
                index
              })
            });
          } else {
            matches.push({
              trigger: matchesBucket[index],
              index,
            });
          }
        }
      }

      if (matches.length > 0) {
        const data = JSON.stringify({
          discordMessageId: message.id,
          matches
        });

        console.log(`Trigger matches found: ${data}`);

        const dataBuffer = Buffer.from(data);

        if (lazyTopicOnParseMessage === undefined) {
          runtimeConfig.getVariable('config', 'PROTEUS_TOPIC_ON_PARSE_MESSAGE')
            .then(topicName => {
              lazyTopicOnParseMessage = topicName;

              publishMatches(lazyTopicOnParseMessage, dataBuffer, message.id)
                .then(callback())
                .catch(err => {
                  console.error(err);
                  callback();
                });
            }).catch(err => {
              console.error(err);
              callback();
            });
        } else {
          publishMatches(lazyTopicOnParseMessage, dataBuffer, message.id)
                .then(callback())
                .catch(err => {
                  console.error(err);
                  callback();
                });
        }

      } else {
        callback();
      }

    }).catch(err => {
      console.error(`Query failed: ${err}`);
      callback();
    })
  };