import { getTestApp, TestSetup } from "./setup";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.test" });

beforeAll(async () => {
  await TestSetup.initializeTestDatabase();
  await getTestApp();

  jest.setTimeout(60000);
});

afterAll(async () => {
  const app = await getTestApp();
  await app.close();
});
