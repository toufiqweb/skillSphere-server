const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

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
const {
  toggleWishlist,
  getWishlist,
  getWishlistIds,
} = require("./actions/wishlist");
const { getEnrolledCourses } = require("./actions/myLearning");
const { submitCourseReviewAndRating } = require("./actions/courseReview");
const { getCourseReviews } = require("./actions/getReviews");
const { updateUserProfile } = require("./actions/userProfile");
const { getInstructorEnrolledStudents } = require("./actions/instructorStudents");
const { getInstructorAnalytics } = require("./actions/instructorAnalytics");

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

// Verify the caller is a logged-in student
const studentMiddleware = async (req, res, next) => {
  try {
    const rawUserId = req.headers["x-user-id"] || req.headers["userid"];
    if (!rawUserId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required. Missing user ID.",
      });
    }

    const { db } = await connectToDatabase();
    let user = null;

    if (ObjectId.isValid(rawUserId)) {
      user = await db.collection("user").findOne({ _id: new ObjectId(rawUserId) });
    }
    if (!user) {
      user = await db.collection("user").findOne({ id: parseInt(rawUserId, 10) });
    }

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }
    if (user.role !== "student") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Students only.",
      });
    }

    req.user = user;
    next();
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

app.put("/api/user/profile", async (req, res) => {
  const { db } = await connectToDatabase();
  return updateUserProfile(db.collection("user"))(req, res);
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

app.get("/api/courses/:id/reviews", async (req, res) => {
  const { db } = await connectToDatabase();
  return getCourseReviews(db.collection("reviews"))(req, res);
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

// ── Instructor Routes ─────────────────────────────────────────────────────────
app.get("/api/instructor/course-students", async (req, res) => {
  const { db } = await connectToDatabase();
  return getInstructorEnrolledStudents(db.collection("transactions"))(req, res);
});

app.get("/api/instructor/analytics", async (req, res) => {
  const { db } = await connectToDatabase();
  return getInstructorAnalytics(
    db.collection("transactions"),
    db.collection("courses")
  )(req, res);
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

// ── Student Wishlist Routes ───────────────────────────────────────────────────
// POST   /api/student/wishlist/toggle  — add or remove a course from wishlist
// GET    /api/student/wishlist/ids     — lightweight: return only courseId strings
// GET    /api/student/wishlist         — full wishlist with populated course data

app.post("/api/student/wishlist/toggle", studentMiddleware, async (req, res) => {
  const { db } = await connectToDatabase();
  return toggleWishlist(
    db.collection("wishlist"),
    db.collection("courses")
  )(req, res);
});

// IMPORTANT: /ids must be declared before the bare /wishlist GET
app.get("/api/student/wishlist/ids", studentMiddleware, async (req, res) => {
  const { db } = await connectToDatabase();
  return getWishlistIds(db.collection("wishlist"))(req, res);
});

app.get("/api/student/wishlist", studentMiddleware, async (req, res) => {
  const { db } = await connectToDatabase();
  return getWishlist(db.collection("wishlist"))(req, res);
});

app.get("/api/student/my-learning", studentMiddleware, async (req, res) => {
  const { db } = await connectToDatabase();
  return getEnrolledCourses(db.collection("transactions"), db.collection("courses"))(req, res);
});

app.post("/api/courses/review", studentMiddleware, async (req, res) => {
  const { db } = await connectToDatabase();
  return submitCourseReviewAndRating(db.collection("courses"), db.collection("transactions"), db.collection("reviews"))(req, res);
});

// ── Enrollment Routes ────────────────────────────────────────────────────────
app.get("/api/enrollments/check", async (req, res) => {
  try {
    const { userId, courseId } = req.query;
    if (!userId || !courseId) {
      return res.status(400).json({ isEnrolled: false, message: "Missing params" });
    }
    const { db } = await connectToDatabase();
    const enrollmentsCollection = db.collection("enrollments");
    
    const existing = await enrollmentsCollection.findOne({ userId, courseId });
    return res.json({ isEnrolled: !!existing });
  } catch (err) {
    console.error("GET /api/enrollments/check error:", err);
    return res.status(500).json({ isEnrolled: false, message: err.message });
  }
});

// ── Transactions (Course Enrollment) ─────────────────────────────────────────
// Mirrors RapidRole's POST /api/subscriptions pattern exactly.
// Called by the Next.js createTransaction() Server Action after Stripe payment.
app.post("/api/transactions", async (req, res) => {
  try {
    const {
      courseId,
      userId,
      instructorId,
      amount,
      stripeSessionId,
      paymentStatus,
      paymentMethod,
      customerEmail,
    } = req.body;

    if (!courseId || !userId || !stripeSessionId) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: courseId, userId, stripeSessionId.",
      });
    }

    const { db } = await connectToDatabase();
    const transactionsCollection = db.collection("transactions");
    const enrollmentsCollection = db.collection("enrollments");
    const coursesCollection = db.collection("courses");
    const { ObjectId } = require("mongodb");

    // ── 1. Duplicate Transaction Protection ──────────────────────────────────
    // Prevent duplicate DB writes on browser refresh or double-submission.
    const existingTransaction = await transactionsCollection.findOne({ stripeSessionId });
    if (existingTransaction) {
      return res.status(400).json({
        success: false,
        message: "Payment already recorded",
      });
    }

    // ── 2. Save Transaction ──────────────────────────────────────────────────
    const transactionDoc = {
      stripeSessionId,
      userId,
      userEmail: customerEmail || "",
      courseId,
      instructorId: instructorId || "",
      amount: Number(amount) || 0,
      paymentStatus: paymentStatus || "paid",
      paymentMethod: paymentMethod || "card",
      createdAt: new Date().toISOString(),
    };
    const txResult = await transactionsCollection.insertOne(transactionDoc);

    // ── 3. Save Enrollment ───────────────────────────────────────────────────
    const enrollmentDoc = {
      userId,
      userEmail: customerEmail || "",
      courseId,
      transactionId: txResult.insertedId.toString(),
      status: "active",
      enrolledAt: new Date().toISOString(),
    };
    await enrollmentsCollection.insertOne(enrollmentDoc);

    // ── 4. Update Course Enrollment Count ────────────────────────────────────
    await coursesCollection.updateOne(
      { _id: new ObjectId(courseId) },
      { $inc: { enrolledStudents: 1 } }
    );

    return res.json({ success: true, message: "Enrolled successfully." });
  } catch (err) {
    console.error("POST /api/transactions error:", err);
    return res
      .status(500)
      .json({ success: false, message: err.message || "Internal server error" });
  }
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
