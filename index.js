const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const port = 5000;

// Middleware
app.use(cors());
app.use(express.json());

const uri = process.env.MONGO_URI;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    const db = client.db(process.env.DB_NAME);
    const usersCollection = db.collection("user");
    const coursesCollection = db.collection("courses");

    // Routes
    app.get("/", (req, res) => {
      res.send("SkillSphere server is running");
    });

    app.get("/api/users", async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.json(result);
    });

    const { 
      createCourse, 
      getCourses, 
      getCourseById,
      deleteCourse,
      getCoursesByInstructor,
      updateCourse,
      getPublicCourses
    } = require("./actions/course");

    app.post("/api/courses", createCourse(coursesCollection));
    app.get("/api/courses", getCourses(coursesCollection));
    app.get("/api/public/courses", getPublicCourses(coursesCollection));
    app.get("/api/courses/:id", getCourseById(coursesCollection));
    app.delete("/api/courses/:id", deleteCourse(coursesCollection));
    app.get(
      "/api/courses/instructor/:instructorId",
      getCoursesByInstructor(coursesCollection)
    );
    app.patch("/api/courses/:id", updateCourse(coursesCollection));
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
  } finally {
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`SkillSphere server is running on port ${port}`);
});
