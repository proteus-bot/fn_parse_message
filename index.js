const Datastore = require('@google-cloud/datastore');

const projectId = process.env.PROTEUS_PROJECT_ID;

const datastore = new Datastore({
  projectId
});

/**
 * Process incoming Discord messages.
 *
 * @param {!Object} event The Cloud Functions event.
 * @param {!Function} The callback function.
 */
exports.fn_parse_message = (event, callback) => {
    const pubsubMessage = event.data;
  
    const message = Buffer.from(pubsubMessage.data, 'base64').toString();
  
    console.log(`Parsing message: ${message}`);

    const query = datastore.createQuery('Trigger');

    query.run().then(triggers => {
      for (let i = 0; i < triggers[0].length; i++) {
        const trigger = triggers[0][i].expression;
        const re = new RegExp(trigger, "gi");
        const results = message.match(re);

        console.log(results);

        callback();
      };
    }).catch(err => {
      console.error(`Query failed: ${err}`);
      callback();
    })
  };