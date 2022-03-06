import dotenv from "dotenv";
import functions from "firebase-functions-test";

// Setting up ENV variables
dotenv.config({ path: './.env.test' });

// @ts-ignore
global.firebaseTest = functions({
    projectId: process.env.GCLOUD_PROJECT,
});