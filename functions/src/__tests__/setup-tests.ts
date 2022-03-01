import dotenv from 'dotenv';
import * as path from "path";
import functions from "firebase-functions-test";

// Setting up ENV variables
dotenv.config({ path: '../test-params.env' });

// you can check all these information in firebase console/settings
const projectConfig = {
    projectId: "projectId",
    databaseURL: "databaseURL"
  };
  
  // you should pass projectConfig and path to serviceAccountKey like this
  // path.resolve defaults to directory where you're executing test command
  // for my case, it's functions directory
  // @ts-ignore
  global.testEnv = functions(projectConfig, path.resolve("service-key.json"));
  
  