const { ObjectId } = require("mongodb");

const getEnrolledCourses = (transactionsCollection, coursesCollection) => async (req, res) => {
  try {
    const rawUserId = req.headers["x-user-id"] || req.headers["userid"] || req.user?._id?.toString() || req.user?.id?.toString();

    if (!rawUserId) {
      return res.status(401).json({ success: false, message: "Unauthorized. Missing user ID." });
    }

    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 6;
    const skip = (page - 1) * limit;

    // We match by the raw ID (which might be numeric or ObjectId in string format)
    // We only want successfully paid transactions
    const query = {
      $or: [{ userId: rawUserId }, { userId: parseInt(rawUserId, 10) }],
      paymentStatus: "paid",
    };

    // Calculate total items
    const totalItems = await transactionsCollection.countDocuments(query);
    const totalPages = Math.ceil(totalItems / limit) || 1;

    // Fetch paginated transactions, newest first
    const transactions = await transactionsCollection
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    // Lookup course details for each transaction
    const enrolledCoursesWithDetails = await Promise.all(
      transactions.map(async (tx) => {
        let courseQuery = { id: parseInt(tx.courseId, 10) };
        let course = await coursesCollection.findOne(courseQuery);

        if (!course && ObjectId.isValid(tx.courseId)) {
          course = await coursesCollection.findOne({ _id: new ObjectId(tx.courseId) });
        }

        // Return a combined object (transaction + course details)
        return {
          ...tx,
          course: course || null,
        };
      })
    );

    return res.status(200).json({
      success: true,
      totalItems,
      totalPages,
      currentPage: page,
      data: enrolledCoursesWithDetails,
    });
  } catch (error) {
    console.error("GET /api/student/my-learning error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getEnrolledCourses,
};
