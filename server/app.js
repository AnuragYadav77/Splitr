import express from 'express'; //creates our web application

import cors from 'cors'; //allows frontend to talk to backend on different ports also

import path from 'path'; //helps create file paths 

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename)

//everything gets attached to app : middleware, routes,etc
const app = express();

//registering middleware
app.use(cors());
app.use(express.json());



