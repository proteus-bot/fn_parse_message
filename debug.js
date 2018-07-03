const fn_parse_message = require("./index").fn_parse_message;

const event = {
    data: {
        data: Buffer.from("hello").toString("base64")
    }
};

const promise = event => new Promise(resolve => fn_parse_message(event, resolve));

promise(event).then(() => {
    console.log("Function execution finished.");
}).catch(e => {
    console.error(`Function execution failed: ${e}`);
});