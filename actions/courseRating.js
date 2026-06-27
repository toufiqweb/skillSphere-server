const { ObjectId } = require("mongodb");

const submitCourseRating =
  (coursesCollection, transactionsCollection) => async (req, res) => {
    try {
      const rawUserId =
        req.headers["x-user-id"] ||
        req.headers["userid"] ||
        req.user?._id?.toString() ||
        req.user?.id?.toString();

      if (!rawUserId) {
        return res
          .status(401)
          .json({ success: false, message: "Unauthorized. Missing user ID." });
      }

      const { courseId, ratingValue } = req.body;

      if (
        !courseId ||
        typeof ratingValue !== "number" ||
        ratingValue < 1 ||
        ratingValue > 5
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid course ID or rating value (must be 1-5).",
        });
      }

      // 1. Security Check: ensure user has a paid transaction for this course
      const transaction = await transactionsCollection.findOne({
        $or: [{ userId: rawUserId }, { userId: parseInt(rawUserId, 10) }],
        courseId: courseId,
        paymentStatus: "paid",
      });

      if (!transaction) {
        return res.status(403).json({
          success: false,
          message: "Forbidden: You must be enrolled in this course to rate it.",
        });
      }

      // 2. Fetch the course document
      let query;
      if (ObjectId.isValid(courseId)) {
        query = { _id: new ObjectId(courseId) };
      } else {
        query = { id: courseId };
      }

      const course = await coursesCollection.findOne(query);
      if (!course) {
        return res
          .status(404)
          .json({ success: false, message: "Course not found." });
      }

      // 3. Mathematical Update
      const oldCount = course.totalRatingsCount || course.ratingCount || 0;
      const oldAvg = course.rating || course.averageRating || 0;

      const newCount = oldCount + 1;
      let newAvg = (oldAvg * oldCount + ratingValue) / newCount;
      // Round to 1 decimal place
      newAvg = Math.round(newAvg * 10) / 10;

      // 4. Save back to database
      // We update both rating/ratingCount and averageRating/totalRatingsCount to ensure compatibility with both schemas
      await coursesCollection.updateOne(query, {
        $set: {
          rating: newAvg,
          averageRating: newAvg,
          totalRatingsCount: newCount,
          ratingCount: newCount,
        },
      });

      return res.json({
        success: true,
        message: "Rating submitted successfully.",
        newAverageRating: newAvg,
        newTotalRatingsCount: newCount,
      });
    } catch (error) {
      console.error("POST /api/courses/rate error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  };

module.exports = { submitCourseRating };
