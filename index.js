const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion } = require("mongodb");

// All requires at top level — never inside async functions
const { isAdmin } = require("./middlewares/isAdmin");
const { isNotBlocked } = require("./middlewares/isNotBlocked");
const {
  getPendingCourses,
  getAllCoursesForAdmin,
  approveOrRejectCourse,
} = require("./actions/admin");
const {
  createCourse,
  getCourses,
  getCourseById,
  deleteCourse,
  getCoursesByInstructor,
  updateCourse,
  getPublicCourses,
  toggleCourseStatus,
} = require("./actions/course");
const {
  getAllUsers,
  updateUserRole,
  toggleUserBlock,
} = require("./actions/adminUsers");

const app = express();

// ── CORS ──────────────────────────────────────────────────────────────────────
// ALLOWED_ORIGIN should be set in Vercel env vars to the deployed client domain
// e.g. https://skill-sphere-ecru-ten.vercel.app
const allowedOrigins = [
  "http://localhost:3000",
  process.env.ALLOWED_ORIGIN,
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (Postman, server-to-server calls)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`CORS policy: origin ${origin} not allowed`));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "x-user-id",
      "x-instructor-id",
      "instructorid",
      "userid",
    ],
    credentials: true,
  }),
);

app.use(express.json());

// ── MongoDB Connection Caching ─────────────────────────────────────────────────
let cachedClient = null;
let cachedDb = null;
async function connectToDatabase() {
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error(
      "MONGO_URI environment variable is not set. Add it to Vercel Environment Variables.",
    );
  }

  const client = new MongoClient(uri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
  });

  await client.connect();

  const db = client.db(process.env.DB_NAME);
  cachedClient = client;
  cachedDb = db;

  return { client, db };
}

// ── Middleware wrappers (connect lazily per request) ──────────────────────────
const blockCheckMiddleware = async (req, res, next) => {
  try {
    const { db } = await connectToDatabase();
    return isNotBlocked(db.collection("user"))(req, res, next);
  } catch (err) {
    next(err);
  }
};

const adminMiddleware = async (req, res, next) => {
  try {
    const { db } = await connectToDatabase();
    return isAdmin(db.collection("user"))(req, res, next);
  } catch (err) {
    next(err);
  }
};

// ── Health Check ──────────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.send("SkillSphere server is running");
});

// ── User Routes ───────────────────────────────────────────────────────────────
app.get("/api/users", async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const result = await db.collection("user").find().toArray();
    res.json(result);
  } catch (error) {
    console.error("GET /api/users error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── Course Routes ─────────────────────────────────────────────────────────────
app.post("/api/courses", blockCheckMiddleware, async (req, res) => {
  const { db } = await connectToDatabase();
  return createCourse(db.collection("courses"))(req, res);
});

app.get("/api/courses", async (req, res) => {
  const { db } = await connectToDatabase();
  return getCourses(db.collection("courses"))(req, res);
});

app.get("/api/public/courses", async (req, res) => {
  const { db } = await connectToDatabase();
  return getPublicCourses(db.collection("courses"))(req, res);
});

// IMPORTANT: Specific sub-paths must come BEFORE the generic /:id route
// to prevent Express from treating "instructor" as an :id value
app.get("/api/courses/instructor/:instructorId", async (req, res) => {
  const { db } = await connectToDatabase();
  return getCoursesByInstructor(db.collection("courses"))(req, res);
});

app.get("/api/courses/:id", async (req, res) => {
  const { db } = await connectToDatabase();
  return getCourseById(db.collection("courses"))(req, res);
});

app.delete("/api/courses/:id", blockCheckMiddleware, async (req, res) => {
  const { db } = await connectToDatabase();
  return deleteCourse(db.collection("courses"))(req, res);
});

// IMPORTANT: /toggle-status must come BEFORE the generic /:id PATCH
// to prevent Express from matching "toggle-status" as the second :id param
app.patch(
  "/api/courses/:id/toggle-status",
  blockCheckMiddleware,
  async (req, res) => {
    const { db } = await connectToDatabase();
    return toggleCourseStatus(db.collection("courses"))(req, res);
  },
);

app.patch("/api/courses/:id", blockCheckMiddleware, async (req, res) => {
  const { db } = await connectToDatabase();
  return updateCourse(db.collection("courses"))(req, res);
});

// ── Admin Course Routes ───────────────────────────────────────────────────────
app.get("/api/admin/courses/pending", adminMiddleware, async (req, res) => {
  const { db } = await connectToDatabase();
  return getPendingCourses(db.collection("courses"))(req, res);
});

app.get("/api/admin/courses", adminMiddleware, async (req, res) => {
  const { db } = await connectToDatabase();
  return getAllCoursesForAdmin(db.collection("courses"))(req, res);
});

app.patch(
  "/api/admin/courses/:id/approval",
  adminMiddleware,
  async (req, res) => {
    const { db } = await connectToDatabase();
    return approveOrRejectCourse(db.collection("courses"))(req, res);
  },
);

// ── Admin User Management Routes ──────────────────────────────────────────────
app.get("/api/admin/users", adminMiddleware, async (req, res) => {
  const { db } = await connectToDatabase();
  return getAllUsers(db.collection("user"))(req, res);
});

app.patch("/api/admin/users/:id/role", adminMiddleware, async (req, res) => {
  const { db } = await connectToDatabase();
  return updateUserRole(db.collection("user"))(req, res);
});

app.patch("/api/admin/users/:id/block", adminMiddleware, async (req, res) => {
  const { db } = await connectToDatabase();
  return toggleUserBlock(db.collection("user"))(req, res);
});

// ── Global Error Handler ──────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res
    .status(500)
    .json({ success: false, message: err.message || "Internal server error" });
});

// ── Local Dev Server ──────────────────────────────────────────────────────────
// On Vercel, `module.exports = app` is what handles requests — listen() is not called.
// We guard it so the local dev workflow still works with `node index.js`.
if (process.env.NODE_ENV !== "production") {
  const port = process.env.PORT || 5000;
  app.listen(port, () => {
    console.log(`SkillSphere server is running on port ${port}`);
  });
}

// CRITICAL: Export the app for Vercel's serverless function runtime.
// Without this, Vercel receives no handler and every request returns 404/500.
module.exports = app;
