const express = require('express')
var bodyParser = require('body-parser')
const { createJWT } = require('../functions/src/__tests__/utils');

const app = express()
const port = 8123

var jsonParser = bodyParser.json()

app.post('/', jsonParser, (req, res) => {
    res.send(createJWT(3600, req.body, "secret_token"));
})

app.listen(port, () => {
    console.log(`Debugging signer server listening on port ${port}`)
})