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

    app.get("/api/courses", async (req, res) => {
      try {
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 12;
        const search = req.query.search || "";
        const category = req.query.category || "";
        const level = req.query.level || "";
        const sort = req.query.sort || "";

        const query = {};

        // Search logic for title and description
        if (search) {
          query.$or = [
            { title: { $regex: search, $options: "i" } },
            { description: { $regex: search, $options: "i" } }
          ];
        }

        // Category filtering
        if (category && category.toLowerCase() !== "all") {
          query.category = category;
        }

        // Level filtering
        if (level && level.toLowerCase() !== "all") {
          query.level = level;
        }

        // Sorting logic
        let sortOption = {};
        if (sort === "rating") sortOption = { rating: -1 };
        else if (sort === "students") sortOption = { students: -1 };
        else if (sort === "price-low") sortOption = { price: 1 };
        else if (sort === "price-high") sortOption = { price: -1 };

        // Pagination logic
        const skip = (page - 1) * limit;

        // Fetch total count and paginated data
        const totalCourses = await coursesCollection.countDocuments(query);
        const result = await coursesCollection
          .find(query)
          .sort(sortOption)
          .skip(skip)
          .limit(limit)
          .toArray();

        res.status(200).json({
          success: true,
          message: "Courses fetched successfully",
          data: result,
          meta: {
            totalCourses,
            totalPages: Math.ceil(totalCourses / limit) || 1,
            currentPage: page,
            limit
          }
        });
      } catch (error) {
        console.error("Error fetching courses:", error);
        res.status(500).json({
          success: false,
          message: "An error occurred while fetching courses",
          error: error.message
        });
      }
    });

    app.get("/api/courses/:id", async (req, res) => {
      try {
        const id = req.params.id;
        
        // Try searching by numeric id first
        let query = { id: parseInt(id, 10) };
        let course = await coursesCollection.findOne(query);

        // Fallback to ObjectId if it's a valid MongoDB ID
        if (!course && ObjectId.isValid(id)) {
          course = await coursesCollection.findOne({ _id: new ObjectId(id) });
        }

        if (course) {
          res.status(200).json({ success: true, data: course });
        } else {
          res.status(404).json({ success: false, message: "Course not found" });
        }
      } catch (error) {
        console.error("Error fetching course details:", error);
        res.status(500).json({
          success: false,
          message: "An error occurred while fetching course details",
          error: error.message
        });
      }
    });
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
