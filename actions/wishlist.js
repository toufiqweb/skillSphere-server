const { ObjectId } = require("mongodb");

// Helper: resolve a raw string ID to the correct query object.
// Tries numeric `id` first, falls back to MongoDB ObjectId.
const resolveIdQuery = (rawId) => {
  const numericId = parseInt(rawId, 10);
  if (!isNaN(numericId)) return { id: numericId };
  if (ObjectId.isValid(rawId)) return { _id: new ObjectId(rawId) };
  return null;
};

// POST /api/student/wishlist/toggle
// Body: { courseId }
// Header: x-user-id (the student's ID)
const toggleWishlist = (wishlistCollection, coursesCollection) =>
  async (req, res) => {
    try {
      const rawUserId = req.headers["x-user-id"] || req.headers["userid"];
      const { courseId } = req.body;

      if (!rawUserId) {
        return res.status(401).json({
          success: false,
          message: "Authentication required. Missing user ID header.",
        });
      }

      if (!courseId) {
        return res.status(400).json({
          success: false,
          message: "Missing courseId in request body.",
        });
      }

      // Resolve userId to ObjectId (better-auth stores as string ObjectId)
      let userId;
      if (ObjectId.isValid(rawUserId)) {
        userId = new ObjectId(rawUserId);
      } else {
        return res.status(400).json({
          success: false,
          message: "Invalid userId format.",
        });
      }

      // Resolve courseId to ObjectId
      let resolvedCourseId;
      if (ObjectId.isValid(courseId)) {
        resolvedCourseId = new ObjectId(courseId);
      } else {
        return res.status(400).json({
          success: false,
          message: "Invalid courseId format.",
        });
      }

      // Check if this exact wishlist entry already exists
      const existing = await wishlistCollection.findOne({
        userId,
        courseId: resolvedCourseId,
      });

      if (existing) {
        // Already wishlisted → REMOVE
        await wishlistCollection.deleteOne({ _id: existing._id });
        return res.status(200).json({
          success: true,
          action: "removed",
          message: "Removed from wishlist",
        });
      } else {
        // Not wishlisted → ADD
        await wishlistCollection.insertOne({
          userId,
          courseId: resolvedCourseId,
          createdAt: new Date(),
        });
        return res.status(200).json({
          success: true,
          action: "added",
          message: "Added to wishlist",
        });
      }
    } catch (error) {
      console.error("Toggle Wishlist Error:", error);
      res.status(500).json({
        success: false,
        message: "An error occurred while updating the wishlist.",
        error: error.message,
      });
    }
  };

// GET /api/student/wishlist
// Header: x-user-id (the student's ID)
// Returns full course data for each wishlist entry via $lookup
const getWishlist = (wishlistCollection) =>
  async (req, res) => {
    try {
      const rawUserId = req.headers["x-user-id"] || req.headers["userid"];
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 9;
      const skip = (page - 1) * limit;

      if (!rawUserId) {
        return res.status(401).json({
          success: false,
          message: "Authentication required. Missing user ID header.",
        });
      }

      let userId;
      if (ObjectId.isValid(rawUserId)) {
        userId = new ObjectId(rawUserId);
      } else {
        return res.status(400).json({
          success: false,
          message: "Invalid userId format.",
        });
      }

      const totalItems = await wishlistCollection.countDocuments({ userId });
      const totalPages = Math.ceil(totalItems / limit) || 1;

      // Aggregate: join wishlist with courses collection
      const wishlistItems = await wishlistCollection
        .aggregate([
          { $match: { userId } },
          { $sort: { createdAt: -1 } },
          { $skip: skip },
          { $limit: limit },
          {
            $lookup: {
              from: "courses",
              localField: "courseId",
              foreignField: "_id",
              as: "course",
            },
          },
          { $unwind: "$course" },
          {
            $project: {
              _id: 1,
              createdAt: 1,
              // Spread key course card fields
              courseId: "$course._id",
              title: "$course.title",
              image: "$course.image",
              category: "$course.category",
              level: "$course.level",
              rating: "$course.rating",
              price: "$course.price",
              originalPrice: "$course.originalPrice",
              duration: "$course.duration",
              lessons: "$course.lessons",
              students: "$course.students",
              instructor: "$course.instructor",
              status: "$course.status",
            },
          },
        ])
        .toArray();

      return res.status(200).json({
        success: true,
        message: "Wishlist fetched successfully.",
        totalItems,
        totalPages,
        currentPage: page,
        data: wishlistItems,
      });
    } catch (error) {
      console.error("Get Wishlist Error:", error);
      res.status(500).json({
        success: false,
        message: "An error occurred while fetching the wishlist.",
        error: error.message,
      });
    }
  };

// GET /api/student/wishlist/ids
// Header: x-user-id
// Lightweight endpoint — returns only the array of courseId strings
// Used by the frontend to know which courses are already wishlisted without
// fetching full course data.
const getWishlistIds = (wishlistCollection) =>
  async (req, res) => {
    try {
      const rawUserId = req.headers["x-user-id"] || req.headers["userid"];

      if (!rawUserId) {
        return res.status(401).json({
          success: false,
          message: "Authentication required.",
        });
      }

      let userId;
      if (ObjectId.isValid(rawUserId)) {
        userId = new ObjectId(rawUserId);
      } else {
        return res.status(400).json({ success: false, message: "Invalid userId." });
      }

      const entries = await wishlistCollection
        .find({ userId }, { projection: { courseId: 1 } })
        .toArray();

      const courseIds = entries.map((e) => e.courseId.toString());

      return res.status(200).json({ success: true, data: courseIds });
    } catch (error) {
      console.error("Get Wishlist IDs Error:", error);
      res.status(500).json({
        success: false,
        message: "An error occurred while fetching wishlist IDs.",
        error: error.message,
      });
    }
  };

module.exports = { toggleWishlist, getWishlist, getWishlistIds };
