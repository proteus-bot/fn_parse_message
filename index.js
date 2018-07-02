/**
 * Process incoming Discord messages.
 *
 * @param {!Object} event The Cloud Functions event.
 * @param {!Function} The callback function.
 */
exports.fn_parse_message = (event, callback) => {
    const pubsubMessage = event.data;
  
    const data = Buffer.from(pubsubMessage.data, 'base64');
  
    console.log(`Parsing message: ${data}`);

    callback();
  };