const { ObjectId } = require("mongodb");

const getCourseReviews = (reviewsCollection) => async (req, res) => {
  try {
    const { id: courseId } = req.params;

    if (!courseId) {
      return res
        .status(400)
        .json({ success: false, message: "Course ID is required." });
    }

    // Try both object ID and string ID just in case
    const query = {
      $or: [
        {
          courseId: ObjectId.isValid(courseId)
            ? new ObjectId(courseId)
            : courseId,
        },
        { courseId: courseId },
      ],
    };

    const reviews = await reviewsCollection
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    return res.json({ success: true, reviews });
  } catch (error) {
    console.error("GET /api/courses/:id/reviews error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getCourseReviews };
