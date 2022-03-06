import functions from "firebase-functions-test";

// @ts-ignore
global.firebaseTest = functions({
    projectId: process.env.GCLOUD_PROJECT,
});