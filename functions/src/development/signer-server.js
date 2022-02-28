const express = require('express')
var bodyParser = require('body-parser')
var nJwt = require('njwt');

const app = express()
const port = 8123

var jsonParser = bodyParser.json()

app.post('/', jsonParser, (req, res) => {
    var claims = {
        iss: "https://firebase-extension.revenuecat.com/",
        payload: req.body
    }
    var key = "test-key"


    const jwt = nJwt.create(claims, key);
    jwt.setExpiration(new Date().getTime() + (60 * 60 * 1000)) // one hour

    res.send(jwt.compact());
})

app.listen(port, () => {
    console.log(`Test signer listening on ${port}`)
})