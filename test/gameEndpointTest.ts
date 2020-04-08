import path from "path";
require("dotenv").config({ path: path.join(process.cwd(), ".env") });
import { expect } from "chai";
import { Server } from "http";
import fetch from "node-fetch";
import mongo, { MongoClient } from "mongodb";
import { bryptAsync } from "../src/utils/bcrypt-async-helper";
import setup from "../src/config/setupDB";
import GameFacade from "../src/facades/gameFacade";
import {
  positionCreator,
  getLatitudeInside,
  getLatitudeOutside
} from "../src/utils/geoUtils";
import {
  USER_COLLECTION_NAME,
  POSITION_COLLECTION_NAME,
  POST_COLLECTION_NAME
} from "../src/config/collectionNames";

let server: Server;
const TEST_PORT = "7777";
let client: MongoClient;
const DISTANCE_TO_SEARCH = 100;
const MOCHA_TIMEOUT = 5000;

describe("Verify GameAPI", () => {
  let URL: string;

  //IMPORTANT --> this does now work with Mocha for ARROW-functions
  before(async function() {
    //@ts-ignore
    this.timeout(MOCHA_TIMEOUT);

    process.env["PORT"] = TEST_PORT;
    process.env["DB_NAME"] = "semester_case_test";

    server = await require("../src/app").server;
    URL = `http://localhost:${process.env.PORT}`;
    client = await setup();
    //This is not required. The server connects to the DB via the use of the facade
    //await client.connect();
  });

  beforeEach(async () => {
    // Observe, no use of facade, but operates directly on connection
    // client = await setup();
    // await client.connect();
    const db = client.db(process.env.DB_NAME);
    const usersCollection = db.collection(USER_COLLECTION_NAME);
    await usersCollection.deleteMany({});
    const secretHashed = await bryptAsync("secret");
    const team1 = {
      name: "Team1",
      userName: "t1",
      password: secretHashed,
      role: "team"
    };
    const team2 = {
      name: "Team2",
      userName: "t2",
      password: secretHashed,
      role: "team"
    };
    const team3 = {
      name: "Team3",
      userName: "t3",
      password: secretHashed,
      role: "team"
    };

    const status = await usersCollection.insertMany([team1, team2, team3]);

    const positionsCollection = db.collection(POSITION_COLLECTION_NAME);
    await positionsCollection.deleteMany({});
    await positionsCollection.createIndex(
      { lastUpdated: 1 },
      { expireAfterSeconds: 30 }
    );
    await positionsCollection.createIndex({ location: "2dsphere" });
    const positions = [
      positionCreator(12.48, 55.77, team1.userName, team1.name, true),
      positionCreator(
        12.48,
        getLatitudeInside(55.77, DISTANCE_TO_SEARCH),
        team2.userName,
        team2.name,
        true
      ),
      positionCreator(
        12.48,
        getLatitudeOutside(55.77, DISTANCE_TO_SEARCH),
        team3.userName,
        team3.name,
        true
      )
    ];
    const locations = await positionsCollection.insertMany(positions);

    const postCollection = db.collection(POST_COLLECTION_NAME);
    await postCollection.deleteMany({});
    await postCollection.insertOne({
      _id: "Post1",
      task: { text: "1+1", isUrl: false },
      taskSolution: "2",
      location: {
        type: "Point",
        coordinates: [12.49, 55.77]
      }
    });
  });

  after(async () => {
    server.close();
    await client.close();
  });

  it("Should find team2, since inside range", async function() {
    //  //@ts-ignore
    //  this.timeout(MOCHA_TIMEOUT)
    const newPosition = {
      userName: "t1",
      password: "secret",
      lat: 55.77,
      lon: 12.48,
      distance: DISTANCE_TO_SEARCH
    };
    const config = {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(newPosition)
    };
    const result = await fetch(`${URL}/gameapi/nearbyplayers`, config).then(r =>
      r.json()
    );
    expect(result.length).to.be.equal(1);
    expect(result[0].userName).to.be.equal("t2");
  });

  it("Should find team2 +team3, since both are inside range", async function() {
    const newPosition = {
      userName: "t1",
      password: "secret",
      lat: 55.77,
      lon: 12.48,
      distance: DISTANCE_TO_SEARCH + 5
    };
    const config = {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(newPosition)
    };
    const result = await fetch(`${URL}/gameapi/nearbyplayers`, config).then(r =>
      r.json()
    );
    expect(result.length).to.be.equal(2);
    expect(result[0].userName).to.be.equal("t2");
    expect(result[1].userName).to.be.equal("t3");
  });

  it("Should NOT find team2, since not in range", async function() {
    const newPosition = {
      userName: "t1",
      password: "secret",
      lat: 55.77,
      lon: 12.48,
      distance: DISTANCE_TO_SEARCH - 10
    };
    const config = {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(newPosition)
    };
    const result = await fetch(`${URL}/gameapi/nearbyplayers`, config).then(r =>
      r.json()
    );
    expect(result.length).to.be.equal(0);
  });

  it("Should not find team2, since credentials are wrong", async function() {
    const newPosition = {
      userName: "t1",
      password: "xxxxx",
      lat: 55.77,
      lon: 12.48,
      distance: DISTANCE_TO_SEARCH
    };
    const config = {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(newPosition)
    };
    const result = await fetch(`${URL}/gameapi/nearbyplayers`, config).then(r =>
      r.json()
    );
    expect(result.code).to.be.equal(403);
  });

  it("Should find the post since it was reached", async () => {
    const newPost = {
      postId: "Post1",
      lat: getLatitudeInside(55.77, GameFacade.DIST_TO_CENTER),
      lon: 12.49
    };
    const config = {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(newPost)
    };
    const result = await fetch(
      `${URL}/gameapi/getPostIfReached`,
      config
    ).then(r => r.json());
    expect(result.postId).to.be.equal("Post1");
    expect(result.task).to.be.equal("1+1");
  });

  it("Should NOT find the post since it was NOT reached", async () => {
    const newPost = {
      postId: "Post1",
      lat: getLatitudeOutside(55.77, GameFacade.DIST_TO_CENTER),
      lon: 12.49
    };
    const config = {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(newPost)
    };
    const result = await fetch(
      `${URL}/gameapi/getPostIfReached`,
      config
    ).then(r => r.json());
    expect(result.code).to.be.equal(400);
  });
});
