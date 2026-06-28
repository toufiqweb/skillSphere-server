const getAllReviewsForModeration = (reviewsCollection) => async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const courseId = req.query.courseId;
    const skip = (page - 1) * limit;

    const query = {};
    if (courseId) {
      query.courseId = courseId;
    }

    const totalReviews = await reviewsCollection.countDocuments(query);
    const totalPages = Math.ceil(totalReviews / limit);

    const reviews = await reviewsCollection
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    return res.status(200).json({
      success: true,
      reviews,
      totalPages: totalPages === 0 ? 1 : totalPages,
      currentPage: page,
    });
  } catch (error) {
    console.error("Error fetching reviews for moderation:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch reviews.",
      error: error.message,
    });
  }
};

module.exports = {
  getAllReviewsForModeration,
};
