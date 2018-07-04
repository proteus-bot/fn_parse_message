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
          console.log(`Match for "${trigger.expression}" found at index ${match.index}`);

          const oldValue = matchesBucket[match.index];

          if (oldValue === undefined) {
            matchesBucket[match.index] = trigger.expression;
          } else if (oldValue instanceof Array) {
            matchesBucket[match.index].push(trigger.expression);
          } else {
            matchesBucket[match.index] = [oldValue, trigger.expression];
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
              index
            });
          }
        }
      }

      console.log(`Results: ${JSON.stringify(matches)}`);

      callback();

    }).catch(err => {
      console.error(`Query failed: ${err}`);
      callback();
    })
  };