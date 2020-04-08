import path from "path";
require("dotenv").config({ path: path.join(process.cwd(), ".env") });
import { expect } from "chai";
import { Server } from "http";
import fetch from "node-fetch";
import mongo, { MongoClient } from "mongodb";
import { bryptAsync } from "../src/utils/bcrypt-async-helper";
import setup from "../src/config/setupDB";

let server: Server;
const TEST_PORT = "7777";
let client: MongoClient;

describe("Testing the User API (DB)", () => {
  let URL: string;
  before(async () => {
    process.env["PORT"] = TEST_PORT;
    process.env["DB_NAME"] = "semester_case_test";

    server = await require("../src/app").server;
    URL = `http://localhost:${process.env.PORT}`;

    client = await setup();
  });

  beforeEach(async () => {
    //Observe, no use of facade, but operates directly on connection
    const db = client.db(process.env.DB_NAME);
    const usersCollection = db.collection("users");
    await usersCollection.deleteMany({});
    const secretHashed = await bryptAsync("secret");
    const status = await usersCollection.insertMany([
      {
        name: "Peter Pan",
        userName: "pp@b.dk",
        password: secretHashed,
        role: "user"
      },
      {
        name: "Donald Duck",
        userName: "dd@b.dk",
        password: secretHashed,
        role: "user"
      },
      {
        name: "admin",
        userName: "admin@a.dk",
        password: secretHashed,
        role: "admin"
      }
    ]);
  });

  after(async () => {
    server.close();
    await client.close();
  });

  it("Should get the message Hello", async () => {
    const result = await fetch(`${URL}/api/dummy`).then(r => r.json());
    expect(result.msg).to.be.equal("Hello");
  });

  it("Should get three users", async () => {
    const users = await fetch(`${URL}/api/users`).then(r => r.json());
    expect(users.length).to.equal(3);
  });

  it("Should Add the user Jan", async () => {
    const newUser = {
      name: "Jan Olsen",
      userName: "jo@b.dk",
      password: "secret",
      role: "user"
    };
    const config = {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(newUser)
    };
    const result = await fetch(`${URL}/api/users`, config).then(r => r.json());
    expect(result.status).to.be.equal("User was added");
  });

  it("Should find the user Donald Duck", async () => {
    const user = await fetch(`${URL}/api/users/dd@b.dk`).then(r => r.json());
    expect(user.name).to.equal("Donald Duck");
    expect(user.role).to.be.undefined;
    expect(user.password).to.be.undefined;
  });

  it("Should not find the user xxx@b.dk", async () => {
    try {
      await fetch(`${URL}/api/users/xxx@b.dk`).then(r => r.json());
    } catch (err) {
      expect(err.message).to.equal("User Not Found");
    }
  });

  it("Should Remove the user Donald Duck", async () => {
    const config = {
      method: "DELETE",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      }
    };
    const msg = await fetch(`${URL}/api/users/dd@b.dk`, config).then(r =>
      r.json()
    );
    expect(msg.status).to.equal("User was deleted");
  });
});
