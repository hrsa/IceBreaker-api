import { DataSource } from 'typeorm';
import * as dotenv from "dotenv";
import { testDataSourceOptions } from '../test/config/test-database.config';

dotenv.config({path: ".env.test"});


export default new DataSource(testDataSourceOptions);
