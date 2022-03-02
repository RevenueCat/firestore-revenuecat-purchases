import dotenv from "dotenv";
import functions from "firebase-functions-test";
import { FeaturesList } from "firebase-functions-test/lib/features";

// Setting up ENV variables
dotenv.config({ path: '../test-params.env' });

// @ts-ignore
global.firebaseTest = functions({
    projectId: process.env.GCLOUD_PROJECT,
});