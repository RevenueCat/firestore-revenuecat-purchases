import express from "express";
import bodyParser from "body-parser";
import { createJWT } from "../src/__tests__/utils";

const app = express()
const port = 8123

var jsonParser = bodyParser.json()

app.post('/', jsonParser, (req, res) => {
    res.send(createJWT(3600, req.body, "carranza"));
})

app.listen(port, () => {
    console.log(`Debugging signer server listening on port ${port}`)
})