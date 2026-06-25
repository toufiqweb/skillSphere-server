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
      getPublicCourses,
      toggleCourseStatus
    } = require("./actions/course");

    const { isNotBlocked } = require("./middlewares/isNotBlocked");
    const blockCheck = isNotBlocked(usersCollection);

    app.post("/api/courses", blockCheck, createCourse(coursesCollection));
    app.get("/api/courses", getCourses(coursesCollection));
    app.get("/api/public/courses", getPublicCourses(coursesCollection));
    app.get("/api/courses/:id", getCourseById(coursesCollection));
    app.delete("/api/courses/:id", blockCheck, deleteCourse(coursesCollection));
    app.get(
      "/api/courses/instructor/:instructorId",
      getCoursesByInstructor(coursesCollection)
    );
    app.patch("/api/courses/:id", blockCheck, updateCourse(coursesCollection));
    app.patch("/api/courses/:id/toggle-status", blockCheck, toggleCourseStatus(coursesCollection));

    // Admin Routes
    const { isAdmin } = require("./middlewares/isAdmin");
    const { getPendingCourses, getAllCoursesForAdmin, approveOrRejectCourse } = require("./actions/admin");

    const adminMiddleware = isAdmin(usersCollection);

    app.get("/api/admin/courses/pending", adminMiddleware, getPendingCourses(coursesCollection));
    app.get("/api/admin/courses", adminMiddleware, getAllCoursesForAdmin(coursesCollection));
    app.patch("/api/admin/courses/:id/approval", adminMiddleware, approveOrRejectCourse(coursesCollection));

    // Admin User Management Routes
    const { getAllUsers, updateUserRole, toggleUserBlock } = require("./actions/adminUsers");

    app.get("/api/admin/users", adminMiddleware, getAllUsers(usersCollection));
    app.patch("/api/admin/users/:id/role", adminMiddleware, updateUserRole(usersCollection));
    app.patch("/api/admin/users/:id/block", adminMiddleware, toggleUserBlock(usersCollection));

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
