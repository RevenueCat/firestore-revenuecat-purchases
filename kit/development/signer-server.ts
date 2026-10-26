import express from "express";
import bodyParser from "body-parser";
import { createJWT } from "../src/__tests__/utils";

const app = express()
const port = 8123

const SECRET = process.argv[2] ?? "test_secret";

var jsonParser = bodyParser.json()

app.post('/', jsonParser, (req, res) => {
    console.log(`creating a JWT with body: ${JSON.stringify(req.body)} and secret ${SECRET}`)
    const jwt = createJWT(3600, req.body, SECRET);
    console.log("\t", jwt);

    res.send(jwt);
})

app.listen(port, () => {
    console.log(`Debugging signer server listening on port ${port} and secret ${SECRET}`)
})